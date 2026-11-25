import supabase from './_db.js'
import { cors, ok, err, requireAny, sendEmail } from './_helpers.js'
import { notifyStaff } from './_notify.js'

const BUCKET = 'deal-docs'
const MAX_BYTES = 3200000
const FILE_TYPES = { 'image/jpeg': 'jpg', 'image/png': 'png', 'application/pdf': 'pdf' }
const AFTER_APPROVAL = ['Approved', 'Docs Sent', 'Ready to Pick Up', 'Completed']
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

function friendly(error) {
  const m = String((error && error.message) || '')
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
    const { data: sess } = await supabase.from('sessions').select('role,user_id').eq('token', t).gt('expires_at', new Date().toISOString()).single()
    if (!sess) return err(res, 'Unauthorized', 401)
    const { data: f } = await supabase.from('deal_doc_files').select('*').eq('id', req.query.id).single()
    if (!f) return err(res, 'File not found', 404)
    if (sess.role !== 'admin') {
      const { data: d } = await supabase.from('deals').select('id,broker_id').eq('id', f.deal_id).single()
      if (!d || String(d.broker_id) !== String(sess.user_id)) return err(res, 'Forbidden', 403)
    }
    const { data: signed, error: signErr } = await supabase.storage.from(BUCKET).createSignedUrl(f.file_path, 120)
    if (signErr || !signed || !signed.signedUrl) return err(res, 'Could not open the file', 500)
    res.setHeader('Location', signed.signedUrl)
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
  const allowed = deal => isAdmin || String(deal.broker_id) === String(session.user_id)

  // What has been requested for a deal, and what has come in
  if (req.method === 'GET') {
    const deal = await loadDeal(req.query.deal_number)
    if (!deal) return err(res, 'Deal not found', 404)
    if (!allowed(deal)) return err(res, 'Forbidden', 403)
    const { data: items, error } = await supabase.from('deal_docs').select('*').eq('deal_id', deal.id).order('id', { ascending: true })
    if (error) return err(res, friendly(error), 500)
    const { data: files } = await supabase.from('deal_doc_files').select('*').eq('deal_id', deal.id).order('id', { ascending: true })
    const byDoc = {}
    for (const f of files || []) {
      if (!byDoc[f.deal_doc_id]) byDoc[f.deal_doc_id] = []
      byDoc[f.deal_doc_id].push({ id: f.id, file_name: f.file_name, content_type: f.content_type, size_bytes: f.size_bytes, uploaded_at: f.uploaded_at })
    }
    return ok(res, {
      status: deal.status,
      types: DOC_TYPES.map(t => ({ key: t.key, label: t.label, max: t.max, def: t.def })),
      items: (items || []).map(i => ({ id: i.id, doc_key: i.doc_key, label: i.label, max_files: i.max_files, requested_at: i.requested_at, requested_by_name: i.requested_by_name, files: byDoc[i.id] || [] })),
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
    const note = String(body.message || '').trim().slice(0, 500)
    const list = fresh.map(t => t.label)
    // Tell the broker: a line in their chat and an email (both best effort)
    await supabase.from('deal_messages').insert({ deal_id: deal.id, sender_role: 'system', sender_id: null, sender_name: 'Brooklyn CDJR', body: 'Documents requested: ' + list.join(', ') + '.' + (note ? ' ' + note : '') })
    const { data: broker } = await supabase.from('brokers').select('*').eq('id', deal.broker_id).single()
    if (broker && broker.email) {
      const text = 'Hi ' + (broker.contact_name || broker.company_name) + ',\n\nFor Deal #' + deal.deal_number + ' (' + deal.customer_name + (deal.vehicle_desc ? ' - ' + deal.vehicle_desc : '') + ') we need the following documents:\n\n' + list.map(l => '  - ' + l).join('\n') + '\n' + (note ? '\n' + note + '\n' : '') + '\nPlease upload them in the broker portal: open My Deals, find the deal, and use the Documents section.\n' + SITE + '\n\n- Brooklyn CDJR Team'
      await sendEmail(broker.email, 'Brooklyn CDJR - Documents needed (Deal #' + deal.deal_number + ')', text)
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

    // Tell the deal owner (or everyone on staff if nobody has claimed it)
    const { data: all } = await supabase.from('deal_docs').select('id,files_count').eq('deal_id', deal.id)
    const others = (all || []).filter(r => r.id !== item.id)
    const completed = item.files_count === 0 && others.every(r => r.files_count >= 1) && !(item.doc_key === 'worksheet' && others.length === 0)
    const { data: broker } = await supabase.from('brokers').select('id,company_name').eq('id', deal.broker_id).single()
    const who = broker ? broker.company_name : 'The broker'
    await notifyStaff(completed
      ? { type: 'docs_complete', dealNumber: deal.deal_number, onlyAdminId: deal.assigned_to || null, title: 'All requested documents received', body: 'Deal #' + deal.deal_number + ' (' + deal.customer_name + '): all ' + (all || []).length + ' requested documents are in.' }
      : { type: 'docs_uploaded', dealNumber: deal.deal_number, onlyAdminId: deal.assigned_to || null, title: 'Documents uploaded', body: who + ' uploaded ' + item.label + ' for Deal #' + deal.deal_number + ' (' + deal.customer_name + ')' })
    return ok(res, { ok: true }, 201)
  }

  // Remove an uploaded file (staff any time; broker only while the deal is still waiting on docs)
  if (req.method === 'POST' && action === 'delete_file') {
    const { data: f } = await supabase.from('deal_doc_files').select('*').eq('id', body.file_id).single()
    if (!f) return err(res, 'File not found', 404)
    const { data: deal } = await supabase.from('deals').select('*').eq('id', f.deal_id).single()
    if (!deal) return err(res, 'Deal not found', 404)
    if (!isAdmin) {
      if (String(deal.broker_id) !== String(session.user_id)) return err(res, 'Forbidden', 403)
      if (!['Application', 'Approved'].includes(deal.status)) return err(res, 'This deal has moved on. Please contact the Brooklyn CDJR team to change a document.', 403)
    }
    await supabase.storage.from(BUCKET).remove([f.file_path])
    const { error } = await supabase.from('deal_doc_files').delete().eq('id', f.id)
    if (error) return err(res, friendly(error), 500)
    const { data: item } = await supabase.from('deal_docs').select('id,files_count').eq('id', f.deal_doc_id).single()
    if (item) await supabase.from('deal_docs').update({ files_count: Math.max(0, item.files_count - 1) }).eq('id', item.id)
    return ok(res, { ok: true })
  }

  return err(res, 'Method not allowed', 405)
}
