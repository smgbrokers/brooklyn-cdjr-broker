import supabase from './_db.js'
import { cors, ok, err, requireAny } from './_helpers.js'
import { buildSections, renderPdf } from './_credit_app_view.js'

// A broker sees their own credit application (read-only) and can download it as a PDF. Staff can use it too.
export default async function handler(req, res) {
  cors(res)
  if (req.method === 'OPTIONS') return res.status(204).end()
  if (req.method !== 'GET') return err(res, 'Method not allowed', 405)
  const action = req.query.action

  // The PDF link downloads in its own request, so the sign-in token travels in the link (same as other file links)
  let who
  if (action === 'pdf') {
    const t = req.query._t
    if (!t) return err(res, 'Unauthorized', 401)
    const { data: sess } = await supabase.from('sessions').select('role,user_id').eq('token', t).gt('expires_at', new Date().toISOString()).single()
    if (!sess) return err(res, 'Unauthorized', 401)
    who = sess
  } else {
    const s = await requireAny(req, res)
    if (!s) return
    who = { role: s.role, user_id: s.user_id }
  }
  const isAdmin = who.role === 'admin'

  const { data: deal } = await supabase.from('deals').select('*').eq('deal_number', req.query.deal_number).single()
  if (!deal) return err(res, 'Deal not found', 404)
  if (!isAdmin && String(deal.broker_id) !== String(who.user_id)) return err(res, 'Forbidden', 403)

  const { data: broker } = await supabase.from('brokers').select('id,company_name').eq('id', deal.broker_id).single()
  let staffName = null
  if (deal.assigned_to) {
    const { data: a } = await supabase.from('admins').select('id,name').eq('id', deal.assigned_to).single()
    staffName = a ? a.name : null
  }
  const { data: apps } = await supabase.from('credit_apps').select('*').eq('deal_id', deal.id).order('id', { ascending: false }).limit(1)
  const app = apps && apps[0] ? apps[0] : null
  const view = app ? buildSections(app) : null
  const dealInfo = {
    deal_number: deal.deal_number, customer_name: deal.customer_name, customer_phone: deal.customer_phone, customer_email: deal.customer_email,
    vehicle_desc: deal.vehicle_desc, stock_num: deal.stock_num, vin: deal.vin, status: deal.status,
    request_date: deal.request_date, app_date: deal.app_date, approved_date: deal.approved_date,
    assigned_to_name: staffName, broker_name: broker ? broker.company_name : null,
  }

  if (action === 'pdf') {
    if (!app) return err(res, 'No credit application has been submitted for this deal yet.', 404)
    const when = app.submitted_at ? new Date(app.submitted_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : ''
    const bytes = await renderPdf({
      title: 'Credit Application',
      headerLines: [
        'Deal #' + deal.deal_number + '  -  ' + (deal.customer_name || ''),
        'Vehicle: ' + (deal.vehicle_desc || '') + (deal.stock_num ? '  (Stock #' + deal.stock_num + ')' : ''),
        'Broker: ' + (dealInfo.broker_name || '') + '     Type: ' + view.app_type_label + (when ? '     Submitted: ' + when : ''),
      ],
      sections: view.sections,
      footer: 'Brooklyn CDJR Broker Portal  -  Social Security numbers show the last 4 digits only.',
    })
    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', 'attachment; filename="CreditApp_' + deal.deal_number + '.pdf"')
    res.status(200)
    res.end(Buffer.from(bytes))
    return
  }

  return ok(res, { deal: dealInfo, has_app: !!app, app_type: view ? view.app_type : null, app_type_label: view ? view.app_type_label : null, submitted_at: app ? app.submitted_at : null, sections: view ? view.sections : [] })
}
