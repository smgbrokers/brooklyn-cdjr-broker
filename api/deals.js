import supabase from './_db.js'
import { cors, ok, err, requireAdmin, requireBroker, requireAny, sendEmail, sendEmailWithAttachment, notifyAdminsNewRequest, notifyBrokerRequestReceived, notifyBrokerVehicleAvailable, generateCreditAppHtml } from './_helpers.js'

async function getBrokerMap() {
  const { data } = await supabase.from('brokers').select('id, company_name, broker_code, contact_name, email')
  const map = {}
  if (data) data.forEach(b => map[b.id] = b)
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
      const flat = data.map(d => {
        const b = brokerMap[d.broker_id] || {}
        return { ...d, broker_name: b.company_name, broker_code: b.broker_code, broker_contact: b.contact_name, broker_email: b.email }
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
    const { error } = await supabase.from('credit_apps').insert({ deal_id: deal.id, ...appData })
    if (error) return err(res, error.message, 500)
    await supabase.from('deals').update({ status: 'Application', app_date: new Date().toISOString().split('T')[0] }).eq('id', deal.id)
    const { data: admins } = await supabase.from('admins').select('name,email').eq('notify_email', true).not('email', 'is', null)
    if (admins) {
      const html = generateCreditAppHtml(appData, deal, broker)
      const subject = `Credit Application — Deal #${deal_number} — ${appData.first_name} ${appData.last_name}`
      const text = `A credit application has been submitted.\n\nDeal #: ${deal_number}\nBroker: ${broker.company_name}\nCustomer: ${appData.first_name} ${appData.last_name}\nVehicle: ${deal.vehicle_desc}\n\nLog in: https://brooklyn-cdjr-broker-wrzb.vercel.app`
      for (const admin of admins) await sendEmailWithAttachment(admin.email, subject, text, html, `CreditApp_${deal_number}_${appData.last_name}.html`)
    }
    return ok(res, { ok: true })
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
