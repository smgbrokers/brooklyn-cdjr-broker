import supabase from './_db.js'
import { cors, ok, err, requireAny, requireAdmin } from './_helpers.js'

export default async function handler(req, res) {
  cors(res)
  if (req.method === 'OPTIONS') return res.status(204).end()

  if (req.method === 'GET') {
    const session = await requireAny(req, res)
    if (!session) return
    let query = supabase.from('inventory').select('*').order('age_days', { ascending: true })
    if (req.query.search) {
      const s = `%${req.query.search}%`
      query = query.or(`year_make_model.ilike.${s},trim.ilike.${s},stock_num.ilike.${s},exterior_color.ilike.${s},vin.ilike.${s}`)
    }
    const { data, error } = await query
    if (error) return err(res, error.message, 500)
    // Flags from deals: a submitted credit app marks the car CREDIT PENDING;
    // once a deal is Approved (or later) the car is hidden from brokers.
    const { data: dealRows } = await supabase.from('deals').select('vin,status').in('status', ['Application','Approved','Docs Sent','Ready to Pick Up','Completed'])
    const pending = new Set()
    const taken = new Set()
    for (const d of dealRows || []) { if (d.status === 'Application') pending.add(d.vin); else taken.add(d.vin) }
    const flagged = data.map(v => ({ ...v, credit_pending: pending.has(v.vin), unavailable: taken.has(v.vin) }))
    return ok(res, session.role === 'admin' ? flagged : flagged.filter(v => !v.unavailable))
  }

  if (req.method === 'POST') {
    const session = await requireAdmin(req, res)
    if (!session) return
    const { rows } = req.body || {}
    if (!rows?.length) return err(res, 'No inventory data provided')
    // Clear existing inventory
    await supabase.from('inventory').delete().neq('id', 0)
    const mapped = rows.filter(r => r['VIN #'] || r['VIN'] || r['vin']).map(r => ({
      vin:              r['VIN #'] || r['VIN'] || r['vin'] || '',
      stock_num:        r['Stock #'] || r['Stock#'] || r['stock_num'] || '',
      year_make_model:  r['Year Make Model'] || r['YearMakeModel'] || '',
      model_number:     r['Model Number'] || '',
      trim:             r['Trim'] || '',
      inv_status:       r['Status'] || 'Stocked In',
      msrp:             r['MSRP'] || '',
      invoice_price:    r['Invoice Price'] || '',
      exterior_color:   r['Exterior Color'] || '',
      interior_color:   r['Interior Color'] || '',
      vehicle_sub_type: r['Vehicle Sub Type'] || '',
      age_days:         parseInt(r['Enterprise Age (Days)'] || '0') || 0,
    }))
    const { error } = await supabase.from('inventory').insert(mapped)
    if (error) return err(res, 'Import failed: ' + error.message, 500)
    return ok(res, { ok: true, inserted: mapped.length })
  }

  return err(res, 'Method not allowed', 405)
}
