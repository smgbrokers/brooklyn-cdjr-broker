import supabase from './_db.js'
import { migrateLegacyStatuses, cors, ok, err, requireAdmin, requireBroker, requireAny, sendEmail, sendEmailWithAttachment, notifyAdminsNewRequest, notifyBrokerRequestReceived, notifyBrokerVehicleAvailable, generateCreditAppHtml } from './_helpers.js'
import { notifyStaff } from './_notify.js'
import { logEvent } from './_audit.js'
import { brokerCanSee, brokerRecipients, filterBrokerDeals } from './_team.js'
import { computePayout, buildStats } from './_payout.js'
import { buildPulse } from './_pulse.js'
import { addCarToBoard } from './_porter.js'

async function getBrokerMap() {
  const { data } = await supabase.from('brokers').select('id, company_name, broker_code, contact_name, email')
  const map = {}
  if (data) data.forEach(b => map[b.id] = b)
  return map
}

// What a broker may see of a deal: the invoice name and size only once the car is marked available, never where it is stored
const brokerView = d => {
  const { invoice_path, invoice_mime, ...rest } = d
  const show = !!d.vehicle_available && !!invoice_path
  return { ...rest, invoice_name: show ? d.invoice_name || null : null, invoice_size: show ? d.invoice_size || null : null, invoice_uploaded_at: show ? d.invoice_uploaded_at || null : null }
}

async function withDocSummary(list) {
  try {
    const ids = (list || []).map(d => d.id)
    if (!ids.length) return list
    const { data } = await supabase.from('deal_docs').select('*').in('deal_id', ids)
    const sum = {}
    for (const r of data || []) {
      if (!sum[r.deal_id]) sum[r.deal_id] = { requested: 0, received: 0, accepted: 0, awaiting: 0, rejected: 0 }
      const s = sum[r.deal_id]
      const rs = r.review_status || 'pending'
      s.requested++
      if (rs === 'rejected') s.rejected++
      else if (r.files_count >= 1) {
        s.received++
        if (rs === 'accepted') s.accepted++
        else s.awaiting++
      }
    }
    return list.map(d => ({ ...d, doc_summary: sum[d.id] || { requested: 0, received: 0, accepted: 0, awaiting: 0, rejected: 0 } }))
  } catch (e) {
    return list
  }
}

async function getAdminMap() {
  const { data } = await supabase.from('admins').select('id,name')
  const map = {}
  if (data) data.forEach(a => map[a.id] = a)
  return map
}

export default async function handler(req, res) {
  cors(res)
  if (req.method === 'OPTIONS') return res.status(204).end()
  await migrateLegacyStatuses()
  // an invoice link opened in a new tab carries the token in the address (as the Docs screen does)
  if (req.method === 'GET' && req.query.action === 'invoice' && req.query._t && !(req.headers && req.headers.authorization)) req.headers = { ...(req.headers || {}), authorization: 'Bearer ' + req.query._t }

  const action = req.query.action
  const body = req.body || {}

  // GET deals
  if (req.method === 'GET' && !action) {
    const session = await requireAny(req, res)
    if (!session) return

    if (session.role === 'admin') {
      let query = supabase.from('deals').select('*').order('created_at', { ascending: false })
      if (req.query.status && req.query.status !== 'All') query = query.eq('status', req.query.status)
      if (req.query.broker_id && req.query.broker_id !== 'All') query = query.eq('broker_id', req.query.broker_id)
      if (req.query.search) {
        const s = `%${req.query.search}%`
        query = query.or(`customer_name.ilike.${s},deal_number.ilike.${s},vehicle_desc.ilike.${s},stock_num.ilike.${s}`)
      }
      const { data, error } = await query
      if (error) return err(res, error.message, 500)
      const brokerMap = await getBrokerMap()
      const adminMap = await getAdminMap()
      // Whose deals to show. The server works out who me is from the login, so it can never be out of date.
      const ownerFilter = String(req.query.assigned || 'all')
      const rowsOut = ownerFilter === 'me' ? data.filter(d => String(d.assigned_to) === String(session.user_id))
        : ownerFilter === 'unassigned' ? data.filter(d => !d.assigned_to && !['Request', 'Dead'].includes(d.status))
        : /^\d+$/.test(ownerFilter) ? data.filter(d => String(d.assigned_to) === ownerFilter)
        : data
      const flat = rowsOut.map(d => {
        const b = brokerMap[d.broker_id] || {}
        return { ...d, assigned_to_name: (adminMap[d.assigned_to] || {}).name || null, broker_name: b.company_name, broker_code: b.broker_code, broker_contact: b.contact_name, broker_email: b.email }
      })
      return ok(res, await withDocSummary(flat))
    } else {
      let query = supabase.from('deals').select('*').eq('broker_id', session.user_id).order('created_at', { ascending: false })
      if (req.query.status && req.query.status !== 'All') query = query.eq('status', req.query.status)
      const { data, error } = await query
      if (error) return err(res, error.message, 500)
      return ok(res, await withDocSummary(filterBrokerDeals(session, data, req.query.owner).map(brokerView)))
    }
  }

  // A tiny fingerprint of what has changed for this person; the screens poll it so they stay live
  if (req.method === 'GET' && action === 'pulse') {
    const session = await requireAny(req, res)
    if (!session) return
    res.setHeader('Cache-Control', 'no-store')
    return ok(res, { sig: await buildPulse(session) })
  }

  // GET the audit trail for a deal (staff only)
  if (req.method === 'GET' && action === 'events') {
    const session = await requireAdmin(req, res)
    if (!session) return
    const { data: evDeal } = await supabase.from('deals').select('id').eq('deal_number', req.query.deal_number).single()
    if (!evDeal) return err(res, 'Deal not found', 404)
    const { data: events, error: evErr } = await supabase.from('deal_events').select('*').eq('deal_id', evDeal.id).order('created_at', { ascending: false }).limit(300)
    if (evErr) return err(res, String(evErr.message).includes('deal_events') ? 'The activity log needs a one-time database update first.' : evErr.message, 500)
    return ok(res, events || [])
  }

  // GET credit app data
  if (req.method === 'GET' && action === 'credit_app') {
    const session = await requireAdmin(req, res)
    if (!session) return
    const { data: deal } = await supabase.from('deals').select('*').eq('deal_number', req.query.deal_number).single()
    if (!deal) return err(res, 'Deal not found', 404)
    const { data: app } = await supabase.from('credit_apps').select('*').eq('deal_id', deal.id).single()
    if (!app) return err(res, 'No credit app found', 404)
    const { data: broker } = await supabase.from('brokers').select('company_name').eq('id', deal.broker_id).single()
    return ok(res, { ...app, deal, broker_name: broker?.company_name })
  }

  // GET credit app as HTML
  if (req.method === 'GET' && action === 'credit_app_html') {
    const token = req.query._t
    if (token) {
      const { data } = await supabase.from('sessions').select('*').eq('token', token).eq('role', 'admin').gt('expires_at', new Date().toISOString()).single()
      if (!data) { res.status(401).send('Unauthorized'); return }
    } else {
      const session = await requireAdmin(req, res)
      if (!session) return
    }
    const dealNum = req.query.deal_number
    const { data: deal } = await supabase.from('deals').select('*').eq('deal_number', dealNum).single()
    if (!deal) { res.status(404).send('Deal not found'); return }
    const { data: app } = await supabase.from('credit_apps').select('*').eq('deal_id', deal.id).single()
    if (!app) { res.status(404).send('No credit app found'); return }
    const { data: broker } = await supabase.from('brokers').select('company_name').eq('id', deal.broker_id).single()
    const html = generateCreditAppHtml(app, deal, { company_name: broker?.company_name })
    res.setHeader('Content-Type', 'text/html; charset=UTF-8')
    res.send(html)
    return
  }

  // GET customer ID file (admin only): redirects to a short-lived private link
  if (req.method === 'GET' && action === 'id_file') {
    const idToken = req.query._t
    if (!idToken) return err(res, 'Unauthorized', 401)
    const { data: idSess } = await supabase.from('sessions').select('id,user_id').eq('token', idToken).eq('role', 'admin').gt('expires_at', new Date().toISOString()).single()
    if (!idSess) return err(res, 'Unauthorized', 401)
    const { data: idDeal } = await supabase.from('deals').select('id').eq('deal_number', req.query.deal_number).single()
    if (!idDeal) return err(res, 'Deal not found', 404)
    await logEvent({ dealId: idDeal.id, role: 'admin', userId: idSess.user_id, action: 'viewed_customer_id', detail: 'Customer ID', dedupeMinutes: 15 })
    const { data: idApp } = await supabase.from('credit_apps').select('id_file_path').eq('deal_id', idDeal.id).not('id_file_path', 'is', null).order('id', { ascending: false }).limit(1).maybeSingle()
    if (!idApp || !idApp.id_file_path) return err(res, 'No customer ID on file', 404)
    const { data: signed, error: signErr } = await supabase.storage.from('credit-app-ids').createSignedUrl(idApp.id_file_path, 120)
    if (signErr || !signed || !signed.signedUrl) return err(res, 'Could not open the file', 500)
    res.setHeader('Location', signed.signedUrl)
    res.status(302).end()
    return
  }

  // POST: submit request
  if (req.method === 'POST' && action === 'request') {
    const session = await requireBroker(req, res)
    if (!session) return
    const { customer_name, vin, customer_phone, customer_email, notes } = body
    if (!customer_name) return err(res, 'Customer name required')
    if (!vin) return err(res, 'Vehicle VIN required')
    const { data: vehicle } = await supabase.from('inventory').select('*').eq('vin', vin).single()
    if (!vehicle) return err(res, 'Vehicle not found in inventory')
    const { data: broker } = await supabase.from('brokers').select('*').eq('id', session.user_id).single()
    const { count } = await supabase.from('deals').select('*', { count: 'exact', head: true })
    const deal_number = 'D' + String((count || 0) + 1).padStart(4, '0')
    const deal = { deal_number, broker_id: session.user_id, vin, stock_num: vehicle.stock_num, vehicle_desc: `${vehicle.year_make_model} ${vehicle.trim}`.trim(), msrp: vehicle.msrp, customer_name, customer_phone: customer_phone || '', customer_email: customer_email || '', status: 'Request', request_date: new Date().toISOString().split('T')[0], notes: notes || '' }
    if (session.broker_user_id) {
      const { data: bu } = await supabase.from('broker_users').select('id,name,suspended').eq('id', session.broker_user_id).single()
      if (!bu || bu.suspended) return err(res, 'Your account is suspended. Please contact your company admin.', 403)
      deal.broker_user_id = bu.id
      deal.broker_user_name = bu.name
    }
    const { error } = await supabase.from('deals').insert(deal)
    if (error) return err(res, error.message, 500)
    // Start the notes thread with the broker request note (best effort)
    if (notes && String(notes).trim()) {
      const { data: newDeal } = await supabase.from('deals').select('id').eq('deal_number', deal_number).single()
      if (newDeal) await supabase.from('deal_notes').insert({ deal_id: newDeal.id, author_role: 'broker', author_id: session.user_id, author_name: broker.company_name, body: String(notes).trim().slice(0, 2000), internal: true })
    }
    await notifyAdminsNewRequest(deal, broker)
    await notifyStaff({ type: 'new_request', dealNumber: deal_number, title: 'New car request', body: broker.company_name + (deal.broker_user_name ? ' (' + deal.broker_user_name + ')' : '') + ' requested ' + (deal.vehicle_desc || 'a vehicle') + ' for ' + deal.customer_name })
    await logEvent({ dealNumber: deal_number, role: 'broker', userId: session.user_id, brokerUserId: session.broker_user_id, name: broker.company_name, action: 'requested', detail: (deal.vehicle_desc || 'a vehicle') + ' for ' + deal.customer_name })
    await notifyBrokerRequestReceived(deal, { ...broker, email: await brokerRecipients(broker, deal) })
    return ok(res, { ok: true, deal_number }, 201)
  }

  // POST: submit credit app
  if (req.method === 'POST' && action === 'submit_app') {
    const session = await requireBroker(req, res)
    if (!session) return
    const { deal_number, ...appData } = body
    if (!deal_number) return err(res, 'deal_number required')
    const { data: deal0 } = await supabase.from('deals').select('*').eq('deal_number', deal_number).eq('broker_id', session.user_id).single()
    const deal = deal0 && brokerCanSee(session, deal0) ? deal0 : null
    if (!deal) return err(res, 'Deal not found', 404)
    if (!deal.vehicle_available) return err(res, 'Credit application cannot be submitted until the vehicle has been confirmed available by Brooklyn CDJR.', 403)
    const { data: broker } = await supabase.from('brokers').select('*').eq('id', session.user_id).single()
    // Structure app data for storage
    const { primary, cosigner, business, app_type, notes, id_file } = appData
    const applicant = primary || appData
    // Customer ID upload: validate before saving anything
    const ID_TYPES = { 'image/jpeg': 'jpg', 'image/png': 'png', 'application/pdf': 'pdf' }
    let idBuf = null
    let idExt = null
    if (id_file && id_file.data) {
      idExt = ID_TYPES[id_file.type]
      if (!idExt) return err(res, 'Customer ID must be a JPG, PNG or PDF file')
      idBuf = Buffer.from(String(id_file.data), 'base64')
      if (idBuf.length > 3200000) return err(res, 'Customer ID file is too large (3 MB max). Try a photo instead of a scan.', 413)
    }
    const creditAppRecord = {
      deal_id: deal.id,
      app_type: app_type || 'individual',
      notes: notes || '',
      // Primary applicant fields (flattened)
      ...(primary || appData),
      // Store cosigner and business as JSON
      cosigner_data: cosigner ? JSON.stringify(cosigner) : null,
      business_data: business ? JSON.stringify(business) : null,
    }
    for (const k of ['housing_years','housing_months','years_on_job','months_on_job','prev_years','prev_months']) {
      if (creditAppRecord[k] === '' || creditAppRecord[k] === undefined) creditAppRecord[k] = null
    }
    if (creditAppRecord.dob === '') creditAppRecord.dob = null
    // Years / months must be whole numbers from 0 to 99; money fields cannot be negative
    const NUM_KEYS = ['housing_years', 'housing_months', 'years_on_job', 'months_on_job', 'prev_years', 'prev_months']
    const badNum = v => { if (v === '' || v === null || v === undefined) return false; const n = Number(v); return !Number.isInteger(n) || n < 0 || n > 99 }
    const badObj = o => !!o && typeof o === 'object' && NUM_KEYS.some(k => badNum(o[k]))
    const negMoney = o => !!o && typeof o === 'object' && ['monthly_income', 'housing_monthly_pmt'].some(k => /-/.test(String(o[k] || '')))
    if (badObj(creditAppRecord) || badObj(cosigner) || (business && badNum(business.years_in_business))) return err(res, 'Years and months must be whole numbers between 0 and 99.')
    if (negMoney(creditAppRecord) || negMoney(cosigner) || (business && /-/.test(String(business.annual_revenue || '')))) return err(res, 'Income, payment and revenue amounts cannot be negative.')
    const { error } = await supabase.from('credit_apps').insert(creditAppRecord)
    if (error) return err(res, error.message, 500)
    await supabase.from('deals').update({ status: 'Application', app_date: new Date().toISOString().split('T')[0] }).eq('id', deal.id)
    await notifyStaff({ type: 'credit_app', dealNumber: deal_number, title: 'Credit application received', body: [applicant.first_name, applicant.last_name].filter(Boolean).join(' ') + ' - ' + (deal.vehicle_desc || 'vehicle') + ' - ' + (broker ? broker.company_name : '') })
    await logEvent({ dealId: deal.id, role: 'broker', userId: session.user_id, brokerUserId: session.broker_user_id, name: broker ? broker.company_name : null, action: 'credit_app_submitted', detail: ({ individual: 'Individual', individual_cosigner: 'Individual + Co-Signer', business: 'Business', business_cosigner: 'Business + Co-Signer' }[app_type || 'individual'] || 'Individual') + (idBuf ? ', customer ID attached' : '') })
    // Ask for the worksheet in the Docs tab (the form uploads it right after submitting)
    await supabase.from('deal_docs').insert({ deal_id: deal.id, doc_key: 'worksheet', label: 'Worksheet', max_files: 1, files_count: 0, requested_by: null, requested_by_name: 'Credit application' })
    // Customer ID: store privately, then attach it to the admin email
    let idAttachments = []
    if (idBuf) {
      const idPath = `${deal_number}/${Date.now()}-customer-id.${idExt}`
      try {
        await supabase.storage.createBucket('credit-app-ids', { public: false })
        const { error: upErr } = await supabase.storage.from('credit-app-ids').upload(idPath, idBuf, { contentType: id_file.type, upsert: true })
        if (upErr) console.error('ID upload error:', upErr.message)
        else {
          const { error: colErr } = await supabase.from('credit_apps').update({ id_file_path: idPath, id_file_name: String(id_file.name || ('customer-id.' + idExt)).slice(0, 120) }).eq('deal_id', deal.id)
          if (colErr) console.error('ID column error:', colErr.message)
        }
      } catch (e) { console.error('ID upload error:', e.message) }
      idAttachments = [{ filename: `CustomerID_${deal_number}.${idExt}`, content: idBuf, contentType: id_file.type }]
    }
    const { data: admins } = await supabase.from('admins').select('name,email').eq('notify_email', true).not('email', 'is', null)
    if (admins) {
      const html = generateCreditAppHtml(appData, deal, broker)
      const subject = `Credit Application — Deal #${deal_number} — ${applicant.first_name} ${applicant.last_name}`
      const text = `A credit application has been submitted.\n\nDeal #: ${deal_number}\nBroker: ${broker.company_name}\nCustomer: ${applicant.first_name} ${applicant.last_name}\nVehicle: ${deal.vehicle_desc}\n\nLog in: https://brooklyn-cdjr-broker-wrzb.vercel.app`
      for (const admin of admins) await sendEmailWithAttachment(admin.email, subject, text, html, `CreditApp_${deal_number}_${applicant.last_name}.html`, idAttachments)
    }
    return ok(res, { ok: true })
  }

  // PUT: assign a deal to an admin / fleet manager (and tell the broker)
  if (req.method === 'PUT' && action === 'assign') {
    const session = await requireAdmin(req, res)
    if (!session) return
    const { deal_number, assignee_id, confirm_reassign, notify_broker, message } = body
    const { data: deal } = await supabase.from('deals').select('*').eq('deal_number', deal_number).single()
    if (!deal) return err(res, 'Deal not found', 404)
    if (['Request', 'Dead'].includes(deal.status)) return err(res, 'A deal can be assigned once the credit application has been received')
    const targetId = (assignee_id === 'me' || assignee_id === undefined || assignee_id === null) ? session.user_id : parseInt(assignee_id)
    if (!targetId) return err(res, 'Choose who to assign the deal to')
    const { data: assignee } = await supabase.from('admins').select('id,name').eq('id', targetId).single()
    if (!assignee) return err(res, 'That user was not found', 404)
    const changed = String(deal.assigned_to || '') !== String(assignee.id)
    const hadAssignee = !!deal.assigned_to
    const isReassign = hadAssignee && changed
    const prevOwnerId = deal.assigned_to
    // Reassigning needs an explicit yes, so a stale screen can never silently take a deal from a colleague
    if (isReassign && confirm_reassign !== true) {
      const { data: curOwner } = await supabase.from('admins').select('id,name').eq('id', deal.assigned_to).single()
      return err(res, 'REASSIGN_CONFIRM: ' + (curOwner ? curOwner.name : 'another team member'), 409)
    }
    const notifyBroker = isReassign ? notify_broker !== false : true
    const extraMsg = isReassign && notifyBroker ? String(message || '').trim().slice(0, 500) : ''
    const { error: assignErr } = await supabase.from('deals').update({ assigned_to: assignee.id, assigned_at: new Date().toISOString() }).eq('id', deal.id)
    if (assignErr) return err(res, assignErr.message.includes('assigned_') ? 'The database needs the assignment update first (assigned_to column missing).' : assignErr.message, 500)
    if (changed) {
      const { data: prevOwner } = prevOwnerId ? await supabase.from('admins').select('id,name').eq('id', prevOwnerId).single() : { data: null }
      await logEvent({ dealId: deal.id, role: 'admin', userId: session.user_id, action: isReassign ? 'reassigned' : 'assigned', detail: (prevOwner ? prevOwner.name + ' \u2192 ' : '') + assignee.name + (isReassign ? (notifyBroker ? ' (broker notified' + (extraMsg ? ' with a message' : '') + ')' : ' (broker not notified)') : '') })
    }
    if (changed && notifyBroker) {
      const sysText = hadAssignee ? 'Your deal is now being handled by ' + assignee.name + '.' + (extraMsg ? ' ' + extraMsg : '') : assignee.name + ' is now working on your file.'
      await supabase.from('deal_messages').insert({ deal_id: deal.id, sender_role: 'system', sender_id: null, sender_name: 'Brooklyn CDJR', body: sysText })
    }
    if (changed && String(assignee.id) !== String(session.user_id)) {
      const { data: byAdmin } = await supabase.from('admins').select('id,name').eq('id', session.user_id).single()
      await notifyStaff({ type: 'assigned', dealNumber: deal.deal_number, onlyAdminId: assignee.id, title: 'Deal assigned to you', body: (byAdmin ? byAdmin.name : 'A teammate') + ' assigned Deal #' + deal.deal_number + ' (' + deal.customer_name + ') to you' })
    }
    // Tell the previous owner their deal moved (unless they are the one who moved it)
    if (isReassign && prevOwnerId && String(prevOwnerId) !== String(session.user_id)) {
      const { data: mover } = await supabase.from('admins').select('id,name').eq('id', session.user_id).single()
      await notifyStaff({ type: 'reassigned', dealNumber: deal.deal_number, onlyAdminId: prevOwnerId, title: 'Deal reassigned', body: 'Deal #' + deal.deal_number + ' (' + deal.customer_name + ') was reassigned to ' + assignee.name + (mover && String(mover.id) !== String(assignee.id) ? ' by ' + mover.name : '') + '.' })
    }
    let emailed = false
    if (isReassign && notifyBroker) {
      const { data: rb } = await supabase.from('brokers').select('*').eq('id', deal.broker_id).single()
      if (rb && rb.email) {
        const reText = 'Hi ' + (rb.contact_name || rb.company_name) + ',\n\nYour deal is now being handled by ' + assignee.name + '.' + (extraMsg ? '\n\n' + extraMsg : '') + '\n\nDeal #' + deal.deal_number + ' - ' + deal.customer_name + ' - ' + (deal.vehicle_desc || '') + '\nYou can follow the status any time in the broker portal: https://brooklyn-cdjr-broker.vercel.app\n\n- Brooklyn CDJR Team'
        await sendEmail(await brokerRecipients(rb, deal), 'Brooklyn CDJR - Update on your deal (Deal #' + deal.deal_number + ')', reText)
        emailed = true
      }
    }
    if (changed && !isReassign) {
      const { data: broker } = await supabase.from('brokers').select('*').eq('id', deal.broker_id).single()
      if (broker && broker.email) {
        const text = `Hi ${broker.contact_name || broker.company_name},\n\nYour credit application for ${deal.customer_name} on the ${deal.vehicle_desc} (Deal #${deal.deal_number}) was successfully received, and ${assignee.name} will be working on your file.\n\nYou can follow the status any time in the broker portal: https://brooklyn-cdjr-broker.vercel.app\n\n— Brooklyn CDJR Team`
        await sendEmail(await brokerRecipients(broker, deal), `Brooklyn CDJR — Credit application received (Deal #${deal.deal_number})`, text)
        emailed = true
      }
    }
    return ok(res, { ok: true, assigned_to: assignee.id, assigned_to_name: assignee.name, message: changed ? (emailed ? `Assigned to ${assignee.name} — broker notified` : `Assigned to ${assignee.name}`) : `Already assigned to ${assignee.name}` })
  }

  // PUT: update deal status
  if (req.method === 'PUT' && action === 'status') {
    const session = await requireAdmin(req, res)
    if (!session) return
    const { deal_number, vehicle_available } = body
    const status = body.status === 'Docs Sent' ? 'eDocs Sent' : body.status
    const valid = ['Request','Application','Approved','Declined','All Docs In','eDocs Sent','Ready to Pick Up','Completed','Dead']
    if (status && !valid.includes(status)) return err(res, 'Invalid status')
    const { data: deal } = await supabase.from('deals').select('*').eq('deal_number', deal_number).single()
    if (!deal) return err(res, 'Deal not found', 404)
    const today = new Date().toISOString().split('T')[0]
    // Closing a deal (Completed) needs the money: total bird dog and any short COD. The check amount is worked out here.
    let payoutFields = null
    if (status === 'Completed' && deal.status !== 'Completed') {
      const p = computePayout(body)
      if (p.error) return err(res, p.error)
      payoutFields = p.fields
    }
    const updates = {}
    if (status) {
      updates.status = status
      if (status === 'Application' && !deal.app_date)      updates.app_date = today
      if (status === 'Approved'    && !deal.approved_date) updates.approved_date = today
      if (status === 'Completed' && deal.status !== 'Completed') { updates.sold_date = today; Object.assign(updates, payoutFields) }
    }
    const marking_available = vehicle_available === true && !deal.vehicle_available
    if (vehicle_available !== undefined) {
      updates.vehicle_available = vehicle_available
      if (vehicle_available) updates.vehicle_available_at = new Date().toISOString()
    }
    const { error: upErr } = await supabase.from('deals').update(updates).eq('deal_number', deal_number)
    if (upErr) return err(res, /bird_dog|short_cod|check_amount/.test(upErr.message) ? 'Recording the payout needs a one-time database update first.' : /status_check|check constraint/i.test(upErr.message) ? 'The new statuses need a one-time database update first.' : upErr.message, 500)
    if (payoutFields) await logEvent({ dealId: deal.id, role: 'admin', userId: session.user_id, action: 'payout_recorded', detail: 'Bird dog $' + payoutFields.bird_dog_total.toFixed(2) + ', short COD $' + payoutFields.short_cod.toFixed(2) + ', check $' + payoutFields.check_amount.toFixed(2) })
    if (status && status !== deal.status) await logEvent({ dealId: deal.id, role: 'admin', userId: session.user_id, action: 'status_changed', detail: deal.status + ' \u2192 ' + status })
    if (vehicle_available !== undefined && !!vehicle_available !== !!deal.vehicle_available) await logEvent({ dealId: deal.id, role: 'admin', userId: session.user_id, action: vehicle_available ? 'vehicle_confirmed' : 'vehicle_unconfirmed', detail: deal.vehicle_desc || null })
    // Approved: optionally put the car on the Get Ready board (with or without a state inspection)
    let car = null
    if (status === 'Approved' && deal.status !== 'Approved' && body.get_ready === true) {
      const { data: me } = await supabase.from('admins').select('id,name').eq('id', session.user_id).single()
      car = await addCarToBoard(deal, { inspection: body.needs_inspection === true, by: me ? me.name : 'Staff' })
    }
    // Declined: tell the broker in their message box (and by email), with the office's note
    let notified = false
    if (status === 'Declined' && deal.status !== 'Declined') {
      const note = String(body.decline_note || '').trim().slice(0, 500)
      const what = 'Deal #' + deal.deal_number + (deal.customer_name ? ' for ' + deal.customer_name : '') + ' was declined.'
      const { error: msgErr } = await supabase.from('deal_messages').insert({ deal_id: deal.id, sender_role: 'system', sender_id: null, sender_name: 'Brooklyn CDJR', body: 'DEAL DECLINED - ' + what + (note ? ' Note: ' + note : '') })
      if (msgErr) console.error('[decline] could not post the message:', msgErr.message)
      else notified = true
      try {
        const { data: bk } = await supabase.from('brokers').select('*').eq('id', deal.broker_id).single()
        if (bk && bk.email) await sendEmail(await brokerRecipients(bk, deal), 'Brooklyn CDJR - Deal declined (Deal #' + deal.deal_number + ')', ['Hi ' + (bk.contact_name || 'there') + ',', '', what, ...(note ? ['', 'Note from the team: ' + note] : []), '', 'You can reply from the message box in the broker portal: https://brooklyn-cdjr-broker.vercel.app', '', '- Brooklyn CDJR'].join('\n'))
      } catch (e) {
        console.error('[decline] could not send the email:', e.message)
      }
    }
    if (marking_available) {
      const { data: broker } = await supabase.from('brokers').select('*').eq('id', deal.broker_id).single()
      let invoice = null
      if (deal.invoice_path) {
        try {
          const { data: blob } = await supabase.storage.from('deal-docs').download(deal.invoice_path)
          if (blob) invoice = { filename: deal.invoice_name || 'invoice.pdf', content: Buffer.from(await blob.arrayBuffer()), contentType: deal.invoice_mime || 'application/octet-stream' }
        } catch (e) { console.error('[invoice] could not attach it to the email:', e.message) }
      }
      if (broker?.email) await notifyBrokerVehicleAvailable(deal, { ...broker, email: await brokerRecipients(broker, deal) }, invoice)
    }
    return ok(res, { ok: true, deal: updates, car, notified })
  }

  // ---- the invoice for a car: attached by the office, downloaded by the broker once the car is marked available ----
  const INV_BUCKET = 'deal-docs'
  const INV_MAX = 3200000
  const INV_TYPES = { pdf: 'application/pdf', jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif', webp: 'image/webp', heic: 'image/heic', heif: 'image/heif', tif: 'image/tiff', tiff: 'image/tiff', doc: 'application/msword', docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', xls: 'application/vnd.ms-excel', xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', txt: 'text/plain', csv: 'text/csv' }
  const invSafeName = n => String(n).split('').map(ch => ('abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789.-_'.includes(ch) ? ch : '_')).join('').slice(-80)
  const invNeedsSql = m => /invoice_/.test(String(m)) ? 'Attaching an invoice needs a one-time database update first.' : String(m)
  if (req.method === 'GET' && action === 'invoice') {
    const session = await requireAny(req, res)
    if (!session) return
    const { data: deal } = await supabase.from('deals').select('*').eq('deal_number', req.query.deal_number).single()
    if (!deal) return err(res, 'Deal not found', 404)
    if (session.role !== 'admin' && !brokerCanSee(session, deal)) return err(res, 'Forbidden', 403)
    if (!deal.invoice_path || (session.role !== 'admin' && !deal.vehicle_available)) return err(res, 'No invoice has been attached to this deal.', 404)
    const { data: signed, error: signErr } = await supabase.storage.from(INV_BUCKET).createSignedUrl(deal.invoice_path, 120)
    if (signErr || !signed || !signed.signedUrl) return err(res, 'Could not open the invoice', 500)
    res.setHeader('Location', signed.signedUrl)
    res.status(302).end()
    return
  }
  if (req.method === 'POST' && action === 'invoice') {
    const session = await requireAdmin(req, res)
    if (!session) return
    const { data: deal } = await supabase.from('deals').select('*').eq('deal_number', body.deal_number).single()
    if (!deal) return err(res, 'Deal not found', 404)
    const name = String(body.name || '').trim().slice(0, 150)
    const ext = name.includes('.') ? name.split('.').pop().toLowerCase() : ''
    const mime = INV_TYPES[ext]
    if (!name || !mime) return err(res, 'That file type is not allowed. Use PDF, JPG, PNG, Word, Excel or a text file.')
    const buf = Buffer.from(String(body.data || ''), 'base64')
    if (!buf.length) return err(res, 'That file is empty.')
    if (buf.length > INV_MAX) return err(res, 'That file is too large (3 MB max). Try a photo instead of a scan.', 413)
    const path = 'invoices/' + deal.id + '/' + Date.now() + '-' + invSafeName(name)
    await supabase.storage.createBucket(INV_BUCKET, { public: false })
    const { error: upErr } = await supabase.storage.from(INV_BUCKET).upload(path, buf, { contentType: mime, upsert: false })
    if (upErr) return err(res, 'Could not save the invoice. Please try again.', 500)
    const fields = { invoice_name: name, invoice_path: path, invoice_size: buf.length, invoice_mime: mime, invoice_uploaded_at: new Date().toISOString() }
    const { error: dbErr } = await supabase.from('deals').update(fields).eq('id', deal.id)
    if (dbErr) {
      await supabase.storage.from(INV_BUCKET).remove([path])
      return err(res, invNeedsSql(dbErr.message), 500)
    }
    if (deal.invoice_path) await supabase.storage.from(INV_BUCKET).remove([deal.invoice_path])
    await logEvent({ dealId: deal.id, role: 'admin', userId: session.user_id, action: 'invoice_added', detail: name })
    return ok(res, { ok: true, invoice: fields }, 201)
  }
  if (req.method === 'POST' && action === 'invoice_remove') {
    const session = await requireAdmin(req, res)
    if (!session) return
    const { data: deal } = await supabase.from('deals').select('*').eq('deal_number', body.deal_number).single()
    if (!deal) return err(res, 'Deal not found', 404)
    if (!deal.invoice_path) return err(res, 'There is no invoice on this deal.', 404)
    const { error: dbErr } = await supabase.from('deals').update({ invoice_name: null, invoice_path: null, invoice_size: null, invoice_mime: null, invoice_uploaded_at: null }).eq('id', deal.id)
    if (dbErr) return err(res, invNeedsSql(dbErr.message), 500)
    await supabase.storage.from(INV_BUCKET).remove([deal.invoice_path])
    await logEvent({ dealId: deal.id, role: 'admin', userId: session.user_id, action: 'invoice_removed', detail: deal.invoice_name || '' })
    return ok(res, { ok: true })
  }

  // Staff: correct the payout amounts of a completed deal, or mark its check paid or unpaid
  if (req.method === 'PUT' && action === 'payout') {
    const session = await requireAdmin(req, res)
    if (!session) return
    const { deal_number, paid, check_ref } = body
    const { data: deal } = await supabase.from('deals').select('*').eq('deal_number', deal_number).single()
    if (!deal) return err(res, 'Deal not found', 404)
    if (deal.status !== 'Completed') return err(res, 'Payouts can be recorded once the deal is Completed.')
    const updates = {}
    const logs = []
    if (body.bird_dog_total !== undefined || body.short_cod !== undefined) {
      if (deal.check_paid_at) return err(res, 'Mark the check unpaid before changing the amounts.')
      const p = computePayout({ bird_dog_total: body.bird_dog_total !== undefined ? body.bird_dog_total : deal.bird_dog_total, short_cod: body.short_cod !== undefined ? body.short_cod : deal.short_cod })
      if (p.error) return err(res, p.error)
      Object.assign(updates, p.fields)
      logs.push({ action: deal.check_amount === null || deal.check_amount === undefined ? 'payout_recorded' : 'payout_edited', detail: 'Bird dog $' + p.fields.bird_dog_total.toFixed(2) + ', short COD $' + p.fields.short_cod.toFixed(2) + ', check $' + p.fields.check_amount.toFixed(2) })
    }
    if (paid !== undefined) {
      if (paid) {
        const amount = updates.check_amount !== undefined ? updates.check_amount : deal.check_amount
        if (amount === null || amount === undefined) return err(res, 'Enter the payout amounts first.')
        updates.check_paid_at = new Date().toISOString()
        updates.check_ref = String(check_ref || '').trim().slice(0, 60) || null
        logs.push({ action: 'check_paid', detail: '$' + Number(amount).toFixed(2) + (updates.check_ref ? ' (' + updates.check_ref + ')' : '') })
      } else {
        updates.check_paid_at = null
        updates.check_ref = null
        logs.push({ action: 'check_unpaid', detail: '$' + Number(deal.check_amount || 0).toFixed(2) })
      }
    }
    if (!Object.keys(updates).length) return err(res, 'Nothing to change')
    const { error } = await supabase.from('deals').update(updates).eq('deal_number', deal_number)
    if (error) return err(res, /bird_dog|short_cod|check_amount|check_paid|check_ref/.test(error.message) ? 'Payouts need a one-time database update first.' : error.message, 500)
    for (const l of logs) await logEvent({ dealId: deal.id, role: 'admin', userId: session.user_id, action: l.action, detail: l.detail })
    return ok(res, { ok: true, deal: updates })
  }

  // Money and deal statistics: staff for one broker (or all brokers), brokers for their own deals
  if (req.method === 'GET' && action === 'stats') {
    const session = await requireAny(req, res)
    if (!session) return
    if (session.role === 'admin') {
      let q = supabase.from('deals').select('*').order('created_at', { ascending: false }).limit(5000)
      if (req.query.broker_id) q = q.eq('broker_id', req.query.broker_id)
      const { data, error } = await q
      if (error) return err(res, error.message, 500)
      const { data: bs } = await supabase.from('brokers').select('id,company_name')
      const brokerNames = {}
      for (const b of bs || []) brokerNames[b.id] = b.company_name
      return ok(res, buildStats(data || [], { brokerNames, byBroker: !req.query.broker_id, byPerson: !!req.query.broker_id }))
    }
    const { data, error } = await supabase.from('deals').select('*').eq('broker_id', session.user_id).order('created_at', { ascending: false }).limit(5000)
    if (error) return err(res, error.message, 500)
    const rows = filterBrokerDeals(session, data || [], req.query.owner)
    const seesAll = !session.broker_user_id || session.broker_user_role === 'admin'
    return ok(res, buildStats(rows, { byPerson: seesAll }))
  }

  return err(res, 'Unknown route', 404)
}
