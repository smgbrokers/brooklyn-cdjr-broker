import supabase from './_db.js'
import { cors, ok, err, requireAny, requireAdmin } from './_helpers.js'

// When the inventory CSV was last uploaded: remembered in the private storage bucket (no database change needed)
const META_BUCKET = 'deal-docs'
const META_PATH = 'system/inventory-refresh.json'
async function readMeta() {
  try {
    const { data, error } = await supabase.storage.from(META_BUCKET).download(META_PATH)
    if (!error && data) {
      const j = JSON.parse(await data.text())
      if (j && j.refreshed_at) return j
    }
  } catch (e) { /* nothing recorded yet */ }
  // Not recorded yet (uploaded before this existed): use when the rows were created, if the table keeps that
  try {
    const { data: rows } = await supabase.from('inventory').select('created_at').order('created_at', { ascending: false }).limit(1)
    if (rows && rows[0] && rows[0].created_at) return { refreshed_at: new Date(rows[0].created_at).toISOString(), rows: null, by: null }
  } catch (e) { /* the table has no created_at */ }
  return null
}

export default async function handler(req, res) {
  cors(res)
  if (req.method === 'OPTIONS') return res.status(204).end()

  if (req.method === 'GET' && req.query.action === 'meta') {
    const session = await requireAny(req, res)
    if (!session) return
    const meta = await readMeta()
    return ok(res, meta || { refreshed_at: null })
  }

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
    const { data: dealRows } = await supabase.from('deals').select('vin,status').in('status', ['Application','Approved','All Docs In', 'eDocs Sent', 'Docs Sent','Ready to Pick Up','Completed'])
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
    // Remember when this CSV went in, for the "Inventory refreshed" line on the Inventory pages
    const refreshedAt = new Date().toISOString()
    try {
      const { data: me } = await supabase.from('admins').select('name').eq('id', session.user_id).single()
      await supabase.storage.createBucket(META_BUCKET, { public: false })
      const { error: metaErr } = await supabase.storage.from(META_BUCKET).upload(META_PATH, Buffer.from(JSON.stringify({ refreshed_at: refreshedAt, rows: mapped.length, by: me ? me.name : null })), { contentType: 'application/json', upsert: true })
      if (metaErr) console.error('[inventory] could not record the refresh time:', metaErr.message)
    } catch (e) { console.error('[inventory] could not record the refresh time:', e.message) }
    return ok(res, { ok: true, inserted: mapped.length, refreshed_at: refreshedAt })
  }

  return err(res, 'Method not allowed', 405)
}
