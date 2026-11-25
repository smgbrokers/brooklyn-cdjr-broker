import supabase from './_db.js'
import { cors, ok, err, requireAny, sendEmail } from './_helpers.js'
import { notifyStaff } from './_notify.js'
import { makeZip, strToU8 } from './_zip.js'
import { brokerCanSee, brokerRecipients } from './_team.js'
import { logEvent } from './_audit.js'

const BUCKET = 'deal-docs'
const MAX_BYTES = 3200000
const FILE_TYPES = { 'image/jpeg': 'jpg', 'image/png': 'png', 'application/pdf': 'pdf' }
const AFTER_APPROVAL = ['Approved', 'All Docs In', 'eDocs Sent', 'Docs Sent', 'Ready to Pick Up', 'Completed']
const SITE = 'https://brooklyn-cdjr-broker.vercel.app'

// What staff can ask the broker for. def = ticked by default on the first request. max = files allowed.
const DOC_TYPES = [
  { key: 'dl_front', label: 'Driver’s License - Front', max: 1, def: true },
  { key: 'dl_back', label: 'Driver’s License - Back', max: 1, def: false },
  { key: 'ins_card', label: 'Insurance ID Card', max: 1, def: true },
  { key: 'ins_binder', label: 'Insurance Binder', max: 1, def: true },
  { key: 'transfer_reg', label: 'Transfer Registration', max: 1, def: false },
  { key: 'rebate_docs', label: 'Rebate Docs', max: 2, def: false },
  { key: 'misc_1', label: 'Misc 1', max: 1, def: false },
  { key: 'misc_2', label: 'Misc 2', max: 1, def: false },
]

// Make a safe file name for inside the ZIP (no slashes, quotes or other characters Windows and Mac dislike)
const BAD_CHARS = new Set([92, 47, 58, 42, 63, 34, 60, 62, 124])
function safeName(s) {
  return Array.from(String(s || '')).map(c => (BAD_CHARS.has(c.charCodeAt(0)) || c.charCodeAt(0) < 32 ? ' ' : c)).join('').replace(/ +/g, ' ').trim().slice(0, 120)
}

function friendly(error) {
  const m = String((error && error.message) || '')
  if (/review_status|reject_reason|reviewed_|viewed_/.test(m)) return 'Document review needs a one-time database update first.'
  return m.includes('deal_docs') || m.includes('deal_doc_files') ? 'Documents need a one-time database update first.' : m
}

export default async function handler(req, res) {
  cors(res)
  if (req.method === 'OPTIONS') return res.status(204).end()
  const action = req.query.action

  // Open a file (new tab, so auth comes from the token in the link). Staff: any file. Broker: own deals only.
  if (req.method === 'GET' && action === 'file') {
    const t = req.query._t
    if (!t) return err(res, 'Unauthorized', 401)
    const { data: sess } = await supabase.from('sessions').select('*').eq('token', t).gt('expires_at', new Date().toISOString()).single()
    if (!sess) return err(res, 'Unauthorized', 401)
    const { data: f } = await supabase.from('deal_doc_files').select('*').eq('id', req.query.id).single()
    if (!f) return err(res, 'File not found', 404)
    if (sess.role === 'admin') await logEvent({ dealId: f.deal_id, role: 'admin', userId: sess.user_id, action: 'doc_viewed', detail: f.file_name || 'a document', dedupeMinutes: 15 })
    if (sess.role === 'admin') {
      const { data: vw } = await supabase.from('admins').select('id,name').eq('id', sess.user_id).single()
      await supabase.from('deal_doc_files').update({ viewed_at: new Date().toISOString(), viewed_by: sess.user_id, viewed_by_name: vw ? vw.name : null }).eq('id', f.id)
    }
    if (sess.role !== 'admin') {
      const { data: d } = await supabase.from('deals').select('*').eq('id', f.deal_id).single()
      if (!d || !brokerCanSee(sess, d)) return err(res, 'Forbidden', 403)
    }
    const { data: signed, error: signErr } = await supabase.storage.from(BUCKET).createSignedUrl(f.file_path, 120)
    if (signErr || !signed || !signed.signedUrl) return err(res, 'Could not open the file', 500)
    res.setHeader('Location', signed.signedUrl)
    res.status(302).end()
    return
  }

  // Download every file for a deal as one ZIP (staff only). The ZIP is stored privately and the browser is sent a
  // short-lived link, so big downloads are not squeezed through the 4.5 MB function response limit.
  if (req.method === 'GET' && action === 'zip') {
    const t = req.query._t
    if (!t) return err(res, 'Unauthorized', 401)
    const { data: zs } = await supabase.from('sessions').select('role,user_id').eq('token', t).gt('expires_at', new Date().toISOString()).single()
    if (!zs || zs.role !== 'admin') return err(res, 'Unauthorized', 401)
    const { data: zd } = await supabase.from('deals').select('*').eq('deal_number', req.query.deal_number).single()
    if (!zd) return err(res, 'Deal not found', 404)
    const { data: zItems } = await supabase.from('deal_docs').select('*').eq('deal_id', zd.id)
    const { data: zFiles } = await supabase.from('deal_doc_files').select('*').eq('deal_id', zd.id).order('id', { ascending: true })
    const labelOf = {}
    const statusOf = {}
    for (const i of zItems || []) { labelOf[i.id] = i.label; statusOf[i.id] = i.review_status || 'pending' }
    const jobs = (zFiles || []).map(f => ({ bucket: BUCKET, path: f.file_path, name: (statusOf[f.deal_doc_id] === 'rejected' ? 'REJECTED - ' : '') + (labelOf[f.deal_doc_id] || 'Document') + ' - ' + (f.file_name || 'file') }))
    const { data: zApp } = await supabase.from('credit_apps').select('id_file_path,id_file_name').eq('deal_id', zd.id).not('id_file_path', 'is', null).order('id', { ascending: false }).limit(1)
    if (zApp && zApp[0] && zApp[0].id_file_path) jobs.push({ bucket: 'credit-app-ids', path: zApp[0].id_file_path, name: 'Customer ID - ' + (zApp[0].id_file_name || 'id') })
    if (!jobs.length) return err(res, 'There are no files to download yet.', 404)
    const got = await Promise.all(jobs.map(async j => {
      try {
        const { data: blob, error } = await supabase.storage.from(j.bucket).download(j.path)
        if (error || !blob) return null
        return { j, bytes: new Uint8Array(await blob.arrayBuffer()) }
      } catch (e) {
        return null
      }
    }))
    const entries = {}
    const used = new Set()
    const missing = []
    got.forEach((g, k) => {
      if (!g) { missing.push(jobs[k].name); return }
      const ext = ((/\.([A-Za-z0-9]{2,5})$/.exec(g.j.path)) || [])[1] || 'bin'
      const base = safeName(g.j.name.replace(/\.[A-Za-z0-9]{1,5}$/, '')) || 'file'
      let name = base + '.' + ext.toLowerCase()
      for (let n = 2; used.has(name.toLowerCase()); n++) name = base + ' (' + n + ').' + ext.toLowerCase()
      used.add(name.toLowerCase())
      entries[name] = g.bytes
    })
    if (!Object.keys(entries).length) return err(res, 'Could not read the files. Please try again.', 500)
    const fileCount = Object.keys(entries).length
    if (missing.length) entries['READ ME - some files could not be included.txt'] = strToU8('These files could not be added to the ZIP:\n\n' + missing.join('\n') + '\n')
    const zipped = makeZip(entries)
    const zipPath = 'zips/' + zd.deal_number + '.zip'
    await supabase.storage.createBucket(BUCKET, { public: false })
    const { error: zUpErr } = await supabase.storage.from(BUCKET).upload(zipPath, Buffer.from(zipped), { contentType: 'application/zip', upsert: true })
    if (zUpErr) return err(res, 'Could not prepare the download: ' + zUpErr.message, 500)
    const { data: zUrl, error: zUrlErr } = await supabase.storage.from(BUCKET).createSignedUrl(zipPath, 120, { download: 'Deal_' + zd.deal_number + '_documents.zip' })
    if (zUrlErr || !zUrl || !zUrl.signedUrl) return err(res, 'Could not prepare the download', 500)
    await logEvent({ dealId: zd.id, role: 'admin', userId: zs.user_id, action: 'docs_zip', detail: fileCount + ' file' + (fileCount === 1 ? '' : 's') })
    res.setHeader('Location', zUrl.signedUrl)
    res.status(302).end()
    return
  }

  const session = await requireAny(req, res)
  if (!session) return
  const isAdmin = session.role === 'admin'
  const body = req.body || {}

  async function loadDeal(dealNumber) {
    const { data } = await supabase.from('deals').select('*').eq('deal_number', dealNumber).single()
    return data || null
  }
  const allowed = deal => isAdmin || brokerCanSee(session, deal)

  // What has been requested for a deal, and what has come in
  if (req.method === 'GET') {
    const deal = await loadDeal(req.query.deal_number)
    if (!deal) return err(res, 'Deal not found', 404)
    if (!allowed(deal)) return err(res, 'Forbidden', 403)
    const { data: items, error } = await supabase.from('deal_docs').select('*').eq('deal_id', deal.id).order('id', { ascending: true })
    if (error) return err(res, friendly(error), 500)
    const { data: files } = await supabase.from('deal_doc_files').select('*').eq('deal_id', deal.id).order('id', { ascending: true })
    let hasId = false
    if (isAdmin) {
      const { data: idRows } = await supabase.from('credit_apps').select('id_file_path').eq('deal_id', deal.id).not('id_file_path', 'is', null).limit(1)
      hasId = !!(idRows && idRows.length)
    }
    const byDoc = {}
    for (const f of files || []) {
      if (!byDoc[f.deal_doc_id]) byDoc[f.deal_doc_id] = []
      byDoc[f.deal_doc_id].push({ id: f.id, file_name: f.file_name, content_type: f.content_type, size_bytes: f.size_bytes, uploaded_at: f.uploaded_at, ...(isAdmin ? { viewed_at: f.viewed_at || null, viewed_by_name: f.viewed_by_name || null } : {}) })
    }
    return ok(res, {
      status: deal.status,
      has_customer_id: hasId,
      types: DOC_TYPES.map(t => ({ key: t.key, label: t.label, max: t.max, def: t.def })),
      items: (items || []).map(i => ({ id: i.id, doc_key: i.doc_key, label: i.label, max_files: i.max_files, requested_at: i.requested_at, requested_by_name: i.requested_by_name, review_status: i.review_status || 'pending', reject_reason: i.reject_reason || null, reviewed_by_name: i.reviewed_by_name || null, reviewed_at: i.reviewed_at || null, files: byDoc[i.id] || [] })),
    })
  }

  // Staff: ask the broker for documents
  if (req.method === 'POST' && action === 'request') {
    if (!isAdmin) return err(res, 'Only the Brooklyn CDJR team can request documents.', 403)
    const deal = await loadDeal(body.deal_number)
    if (!deal) return err(res, 'Deal not found', 404)
    if (!AFTER_APPROVAL.includes(deal.status)) return err(res, 'Documents can be requested once the deal is approved.')
    const wanted = [...new Set(Array.isArray(body.items) ? body.items : [])]
    const fresh0 = DOC_TYPES.filter(t => wanted.includes(t.key))
    if (!fresh0.length) return err(res, 'Choose at least one document to request.')
    const { data: existing, error: exErr } = await supabase.from('deal_docs').select('doc_key').eq('deal_id', deal.id)
    if (exErr) return err(res, friendly(exErr), 500)
    const have = new Set((existing || []).map(e => e.doc_key))
    const fresh = fresh0.filter(t => !have.has(t.key))
    if (!fresh.length) return err(res, 'Those documents have already been requested.')
    const { data: me } = await supabase.from('admins').select('id,name').eq('id', session.user_id).single()
    const rows = fresh.map(t => ({ deal_id: deal.id, doc_key: t.key, label: t.label, max_files: t.max, files_count: 0, requested_by: session.user_id, requested_by_name: me ? me.name : null }))
    const { error: insErr } = await supabase.from('deal_docs').insert(rows)
    if (insErr) return err(res, friendly(insErr), 500)
    await logEvent({ dealId: deal.id, role: 'admin', userId: session.user_id, action: 'docs_requested', detail: fresh.map(t => t.label).join(', ') })
    const note = String(body.message || '').trim().slice(0, 500)
    const list = fresh.map(t => t.label)
    // Tell the broker: a line in their chat and an email (both best effort)
    await supabase.from('deal_messages').insert({ deal_id: deal.id, sender_role: 'system', sender_id: null, sender_name: 'Brooklyn CDJR', body: 'Documents requested: ' + list.join(', ') + '.' + (note ? ' ' + note : '') })
    const { data: broker } = await supabase.from('brokers').select('*').eq('id', deal.broker_id).single()
    if (broker && broker.email) {
      const text = 'Hi ' + (broker.contact_name || broker.company_name) + ',\n\nFor Deal #' + deal.deal_number + ' (' + deal.customer_name + (deal.vehicle_desc ? ' - ' + deal.vehicle_desc : '') + ') we need the following documents:\n\n' + list.map(l => '  - ' + l).join('\n') + '\n' + (note ? '\n' + note + '\n' : '') + '\nPlease upload them in the broker portal: open My Deals, find the deal, and use the Documents section.\n' + SITE + '\n\n- Brooklyn CDJR Team'
      await sendEmail(await brokerRecipients(broker, deal), 'Brooklyn CDJR - Documents needed (Deal #' + deal.deal_number + ')', text)
    }
    return ok(res, { ok: true, requested: list, message: 'Requested ' + list.length + ' document' + (list.length > 1 ? 's' : '') + ' from the broker' }, 201)
  }

  // Staff: withdraw a request nobody has uploaded to yet
  if (req.method === 'POST' && action === 'cancel') {
    if (!isAdmin) return err(res, 'Only the Brooklyn CDJR team can change requests.', 403)
    const deal = await loadDeal(body.deal_number)
    if (!deal) return err(res, 'Deal not found', 404)
    const { data: item } = await supabase.from('deal_docs').select('*').eq('deal_id', deal.id).eq('doc_key', body.doc_key).single()
    if (!item) return err(res, 'That request was not found', 404)
    if (item.files_count > 0) return err(res, 'Files were already uploaded for this document. Remove the files first.')
    await logEvent({ dealId: deal.id, role: 'admin', userId: session.user_id, action: 'docs_cancelled', detail: item.label })
    const { error } = await supabase.from('deal_docs').delete().eq('id', item.id)
    if (error) return err(res, friendly(error), 500)
    return ok(res, { ok: true })
  }

  // Broker: upload a file for a requested document
  if (req.method === 'POST' && action === 'upload') {
    if (isAdmin) return err(res, 'Documents are uploaded by the broker.', 403)
    const deal = await loadDeal(body.deal_number)
    if (!deal) return err(res, 'Deal not found', 404)
    if (!allowed(deal)) return err(res, 'Forbidden', 403)
    const { data: item } = await supabase.from('deal_docs').select('*').eq('deal_id', deal.id).eq('doc_key', body.doc_key).single()
    if (!item) return err(res, 'That document has not been requested.')
    const f = body.file || {}
    const ext = FILE_TYPES[f.type]
    if (!ext || !f.data) return err(res, 'Please upload a JPG, PNG or PDF file.')
    const buf = Buffer.from(String(f.data), 'base64')
    if (!buf.length) return err(res, 'That file looks empty.')
    if (buf.length > MAX_BYTES) return err(res, 'That file is too large (3 MB max). Try a photo instead of a scan.', 413)
    // A rejected document starts fresh: the old files are cleared and the new upload goes back for review
    const wasRejected = item.review_status === 'rejected'
    if (wasRejected) {
      const { data: oldFiles } = await supabase.from('deal_doc_files').select('*').eq('deal_doc_id', item.id)
      if (oldFiles && oldFiles.length) {
        await supabase.storage.from(BUCKET).remove(oldFiles.map(o => o.file_path))
        await supabase.from('deal_doc_files').delete().eq('deal_doc_id', item.id)
      }
      await supabase.from('deal_docs').update({ files_count: 0 }).eq('id', item.id)
      item.files_count = 0
    }
    if (item.files_count >= item.max_files) return err(res, 'You have already uploaded the maximum number of files for this document.')
    const path = deal.deal_number + '/' + item.doc_key + '-' + Date.now() + '.' + ext
    await supabase.storage.createBucket(BUCKET, { public: false })
    const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, buf, { contentType: f.type, upsert: false })
    if (upErr) return err(res, 'Upload failed: ' + upErr.message, 500)
    const { error: fErr } = await supabase.from('deal_doc_files').insert({ deal_doc_id: item.id, deal_id: deal.id, file_path: path, file_name: String(f.name || (item.doc_key + '.' + ext)).slice(0, 120), content_type: f.type, size_bytes: buf.length, uploaded_by_broker: session.user_id })
    if (fErr) {
      await supabase.storage.from(BUCKET).remove([path])
      return err(res, friendly(fErr), 500)
    }
    await supabase.from('deal_docs').update({ files_count: item.files_count + 1 }).eq('id', item.id)
    if (wasRejected) await supabase.from('deal_docs').update({ review_status: 'pending', reject_reason: null }).eq('id', item.id)
    await logEvent({ dealId: deal.id, role: 'broker', userId: session.user_id, brokerUserId: session.broker_user_id, action: 'doc_uploaded', detail: item.label + ' (' + (f.name || 'file') + ')' + (wasRejected ? ' - replaces the rejected file' : '') })

    // Tell the deal owner (or everyone on staff if nobody has claimed it)
    const { data: all } = await supabase.from('deal_docs').select('*').eq('deal_id', deal.id)
    const others = (all || []).filter(r => r.id !== item.id)
    const completed = item.files_count === 0 && others.every(r => r.files_count >= 1 && (r.review_status || 'pending') !== 'rejected') && !(item.doc_key === 'worksheet' && others.length === 0)
    const { data: broker } = await supabase.from('brokers').select('id,company_name').eq('id', deal.broker_id).single()
    const who = broker ? broker.company_name : 'The broker'
    const uploadedAlert = { type: 'docs_uploaded', dealNumber: deal.deal_number, onlyAdminId: deal.assigned_to || null, title: wasRejected ? 'Corrected document received' : 'Document received - awaiting approval', body: who + (wasRejected ? ' re-uploaded ' : ' uploaded ') + item.label + ' for Deal #' + deal.deal_number + ' (' + deal.customer_name + ')' }
    if (completed) await notifyStaff({ type: 'docs_complete', dealNumber: deal.deal_number, onlyAdminId: deal.assigned_to || null, title: 'All requested documents received - awaiting approval', body: 'Deal #' + deal.deal_number + ' (' + deal.customer_name + '): all ' + (all || []).length + ' requested documents are in.' })
    // A corrected file always gets its own alert, so whoever rejected it sees the replacement arrive
    if (!completed || wasRejected) await notifyStaff(uploadedAlert)
    return ok(res, { ok: true }, 201)
  }

  // Staff: accept a document, once they have opened and looked at every file
  if (req.method === 'POST' && action === 'accept') {
    if (!isAdmin) return err(res, 'Only the Brooklyn CDJR team can review documents.', 403)
    const deal = await loadDeal(body.deal_number)
    if (!deal) return err(res, 'Deal not found', 404)
    const { data: item } = await supabase.from('deal_docs').select('*').eq('deal_id', deal.id).eq('doc_key', body.doc_key).single()
    if (!item) return err(res, 'That document was not found', 404)
    const { data: files } = await supabase.from('deal_doc_files').select('*').eq('deal_doc_id', item.id)
    if (!files || !files.length) return err(res, 'Nothing has been uploaded for this document yet.')
    if (files.every(f => !('viewed_at' in f))) return err(res, 'Document review needs a one-time database update first.', 500)
    if (files.some(f => !f.viewed_at)) return err(res, 'Open each file first, then you can accept it.')
    const { data: me } = await supabase.from('admins').select('id,name').eq('id', session.user_id).single()
    const { error } = await supabase.from('deal_docs').update({ review_status: 'accepted', reviewed_by: session.user_id, reviewed_by_name: me ? me.name : null, reviewed_at: new Date().toISOString(), reject_reason: null }).eq('id', item.id)
    if (error) return err(res, friendly(error), 500)
    await logEvent({ dealId: deal.id, role: 'admin', userId: session.user_id, name: me ? me.name : null, action: 'doc_accepted', detail: item.label })
    await supabase.from('deal_messages').insert({ deal_id: deal.id, sender_role: 'system', sender_id: null, sender_name: 'Brooklyn CDJR', body: 'Accepted: your ' + item.label + ' was accepted.' })
    const { data: allDocs } = await supabase.from('deal_docs').select('id,review_status').eq('deal_id', deal.id)
    const allIn = (allDocs || []).length > 0 && (allDocs || []).every(r => r.review_status === 'accepted')
    return ok(res, { ok: true, all_accepted: allIn, suggest_all_docs_in: allIn && deal.status === 'Approved' })
  }

  // Staff: reject a document with a reason. The broker is told in their chat (highlighted) and by email.
  if (req.method === 'POST' && action === 'reject') {
    if (!isAdmin) return err(res, 'Only the Brooklyn CDJR team can review documents.', 403)
    const reason = String(body.reason || '').trim().slice(0, 500)
    if (!reason) return err(res, 'Please give the broker a reason for rejecting this document.')
    const deal = await loadDeal(body.deal_number)
    if (!deal) return err(res, 'Deal not found', 404)
    const { data: item } = await supabase.from('deal_docs').select('*').eq('deal_id', deal.id).eq('doc_key', body.doc_key).single()
    if (!item) return err(res, 'That document was not found', 404)
    if (!(item.files_count > 0)) return err(res, 'Nothing has been uploaded for this document yet.')
    const { data: me } = await supabase.from('admins').select('id,name').eq('id', session.user_id).single()
    const { error } = await supabase.from('deal_docs').update({ review_status: 'rejected', reject_reason: reason, reviewed_by: session.user_id, reviewed_by_name: me ? me.name : null, reviewed_at: new Date().toISOString() }).eq('id', item.id)
    if (error) return err(res, friendly(error), 500)
    await logEvent({ dealId: deal.id, role: 'admin', userId: session.user_id, name: me ? me.name : null, action: 'doc_rejected', detail: item.label + ': ' + reason })
    await supabase.from('deal_messages').insert({ deal_id: deal.id, sender_role: 'system', sender_id: null, sender_name: 'Brooklyn CDJR', body: 'REJECTED DOCUMENT - Your ' + item.label + ' was rejected. Reason: ' + reason })
    const { data: broker } = await supabase.from('brokers').select('*').eq('id', deal.broker_id).single()
    if (broker && broker.email) {
      const text = 'Hi ' + (broker.contact_name || broker.company_name) + ',\n\nYour ' + item.label + ' for Deal #' + deal.deal_number + ' (' + deal.customer_name + ') was rejected.\n\nReason: ' + reason + '\n\nPlease upload a corrected file in the broker portal: open My Deals, find the deal, and use the Docs tab.\n' + SITE + '\n\n- Brooklyn CDJR Team'
      await sendEmail(await brokerRecipients(broker, deal), 'Brooklyn CDJR - Document rejected (Deal #' + deal.deal_number + ')', text)
    }
    return ok(res, { ok: true })
  }

  // Remove an uploaded file (staff any time; broker only while the deal is still waiting on docs)
  if (req.method === 'POST' && action === 'delete_file') {
    const { data: f } = await supabase.from('deal_doc_files').select('*').eq('id', body.file_id).single()
    if (!f) return err(res, 'File not found', 404)
    const { data: deal } = await supabase.from('deals').select('*').eq('id', f.deal_id).single()
    if (!deal) return err(res, 'Deal not found', 404)
    if (!isAdmin) {
      if (!brokerCanSee(session, deal)) return err(res, 'Forbidden', 403)
      const { data: chk } = await supabase.from('deal_docs').select('*').eq('id', f.deal_doc_id).single()
      if (chk && chk.review_status === 'accepted') return err(res, 'This document was already accepted. Please contact the Brooklyn CDJR team if it needs to change.', 403)
      if (!['Application', 'Approved'].includes(deal.status) && !(chk && chk.review_status === 'rejected')) return err(res, 'This deal has moved on. Please contact the Brooklyn CDJR team to change a document.', 403)
    }
    await logEvent({ dealId: deal.id, role: isAdmin ? 'admin' : 'broker', userId: session.user_id, brokerUserId: session.broker_user_id, action: 'doc_removed', detail: f.file_name || 'a file' })
    await supabase.storage.from(BUCKET).remove([f.file_path])
    const { error } = await supabase.from('deal_doc_files').delete().eq('id', f.id)
    if (error) return err(res, friendly(error), 500)
    const { data: item } = await supabase.from('deal_docs').select('*').eq('id', f.deal_doc_id).single()
    if (item) await supabase.from('deal_docs').update({ files_count: Math.max(0, item.files_count - 1) }).eq('id', item.id)
    if (item && item.review_status === 'accepted') await supabase.from('deal_docs').update({ review_status: 'pending' }).eq('id', item.id)
    return ok(res, { ok: true })
  }

  return err(res, 'Method not allowed', 405)
}
