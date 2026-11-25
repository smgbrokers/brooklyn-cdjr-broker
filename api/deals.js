import supabase from './_db.js'
import { cors, ok, err, requireAdmin, requireBroker, requireAny, sendEmail, sendEmailWithAttachment, notifyAdminsNewRequest, notifyBrokerRequestReceived, notifyBrokerVehicleAvailable, generateCreditAppHtml } from './_helpers.js'

async function getBrokerMap() {
  const { data } = await supabase.from('brokers').select('id, company_name, broker_code, contact_name, email')
  const map = {}
  if (data) data.forEach(b => map[b.id] = b)
  return map
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
      const flat = data.map(d => {
        const b = brokerMap[d.broker_id] || {}
        return { ...d, assigned_to_name: (adminMap[d.assigned_to] || {}).name || null, broker_name: b.company_name, broker_code: b.broker_code, broker_contact: b.contact_name, broker_email: b.email }
      })
      return ok(res, flat)
    } else {
      let query = supabase.from('deals').select('*').eq('broker_id', session.user_id).order('created_at', { ascending: false })
      if (req.query.status && req.query.status !== 'All') query = query.eq('status', req.query.status)
      const { data, error } = await query
      if (error) return err(res, error.message, 500)
      return ok(res, data)
    }
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
    const { data: idSess } = await supabase.from('sessions').select('id').eq('token', idToken).eq('role', 'admin').gt('expires_at', new Date().toISOString()).single()
    if (!idSess) return err(res, 'Unauthorized', 401)
    const { data: idDeal } = await supabase.from('deals').select('id').eq('deal_number', req.query.deal_number).single()
    if (!idDeal) return err(res, 'Deal not found', 404)
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
    const { error } = await supabase.from('deals').insert(deal)
    if (error) return err(res, error.message, 500)
    // Start the notes thread with the broker request note (best effort)
    if (notes && String(notes).trim()) {
      const { data: newDeal } = await supabase.from('deals').select('id').eq('deal_number', deal_number).single()
      if (newDeal) await supabase.from('deal_notes').insert({ deal_id: newDeal.id, author_role: 'broker', author_id: session.user_id, author_name: broker.company_name, body: String(notes).trim().slice(0, 2000), internal: true })
    }
    await notifyAdminsNewRequest(deal, broker)
    await notifyBrokerRequestReceived(deal, broker)
    return ok(res, { ok: true, deal_number }, 201)
  }

  // POST: submit credit app
  if (req.method === 'POST' && action === 'submit_app') {
    const session = await requireBroker(req, res)
    if (!session) return
    const { deal_number, ...appData } = body
    if (!deal_number) return err(res, 'deal_number required')
    const { data: deal } = await supabase.from('deals').select('*').eq('deal_number', deal_number).eq('broker_id', session.user_id).single()
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
    const { error } = await supabase.from('credit_apps').insert(creditAppRecord)
    if (error) return err(res, error.message, 500)
    await supabase.from('deals').update({ status: 'Application', app_date: new Date().toISOString().split('T')[0] }).eq('id', deal.id)
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
    const { deal_number, assignee_id } = body
    const { data: deal } = await supabase.from('deals').select('*').eq('deal_number', deal_number).single()
    if (!deal) return err(res, 'Deal not found', 404)
    if (['Request', 'Dead'].includes(deal.status)) return err(res, 'A deal can be assigned once the credit application has been received')
    const targetId = (assignee_id === 'me' || assignee_id === undefined || assignee_id === null) ? session.user_id : parseInt(assignee_id)
    if (!targetId) return err(res, 'Choose who to assign the deal to')
    const { data: assignee } = await supabase.from('admins').select('id,name').eq('id', targetId).single()
    if (!assignee) return err(res, 'That user was not found', 404)
    const changed = String(deal.assigned_to || '') !== String(assignee.id)
    const hadAssignee = !!deal.assigned_to
    const { error: assignErr } = await supabase.from('deals').update({ assigned_to: assignee.id, assigned_at: new Date().toISOString() }).eq('id', deal.id)
    if (assignErr) return err(res, assignErr.message.includes('assigned_') ? 'The database needs the assignment update first (assigned_to column missing).' : assignErr.message, 500)
    if (changed) {
      const sysText = hadAssignee ? 'Your file is now being handled by ' + assignee.name + '.' : assignee.name + ' is now working on your file.'
      await supabase.from('deal_messages').insert({ deal_id: deal.id, sender_role: 'system', sender_id: null, sender_name: 'Brooklyn CDJR', body: sysText })
    }
    let emailed = false
    if (changed) {
      const { data: broker } = await supabase.from('brokers').select('*').eq('id', deal.broker_id).single()
      if (broker && broker.email) {
        const text = `Hi ${broker.contact_name || broker.company_name},\n\nYour credit application for ${deal.customer_name} on the ${deal.vehicle_desc} (Deal #${deal.deal_number}) was successfully received, and ${assignee.name} will be working on your file.\n\nYou can follow the status any time in the broker portal: https://brooklyn-cdjr-broker.vercel.app\n\n— Brooklyn CDJR Team`
        await sendEmail(broker.email, `Brooklyn CDJR — Credit application received (Deal #${deal.deal_number})`, text)
        emailed = true
      }
    }
    return ok(res, { ok: true, assigned_to: assignee.id, assigned_to_name: assignee.name, message: changed ? (emailed ? `Assigned to ${assignee.name} — broker notified` : `Assigned to ${assignee.name}`) : `Already assigned to ${assignee.name}` })
  }

  // PUT: update deal status
  if (req.method === 'PUT' && action === 'status') {
    const session = await requireAdmin(req, res)
    if (!session) return
    const { deal_number, status, vehicle_available } = body
    const valid = ['Request','Application','Approved','Declined','Docs Sent','Ready to Pick Up','Completed','Dead']
    if (status && !valid.includes(status)) return err(res, 'Invalid status')
    const { data: deal } = await supabase.from('deals').select('*').eq('deal_number', deal_number).single()
    if (!deal) return err(res, 'Deal not found', 404)
    const today = new Date().toISOString().split('T')[0]
    const updates = {}
    if (status) {
      updates.status = status
      if (status === 'Application' && !deal.app_date)      updates.app_date = today
      if (status === 'Approved'    && !deal.approved_date) updates.approved_date = today
      if (status === 'Completed'   && !deal.sold_date)     updates.sold_date = today
    }
    const marking_available = vehicle_available === true && !deal.vehicle_available
    if (vehicle_available !== undefined) {
      updates.vehicle_available = vehicle_available
      if (vehicle_available) updates.vehicle_available_at = new Date().toISOString()
    }
    await supabase.from('deals').update(updates).eq('deal_number', deal_number)
    if (marking_available) {
      const { data: broker } = await supabase.from('brokers').select('*').eq('id', deal.broker_id).single()
      if (broker?.email) await notifyBrokerVehicleAvailable(deal, broker)
    }
    return ok(res, { ok: true })
  }

  return err(res, 'Unknown route', 404)
}
