import supabase from './_db.js'
import { cors, ok, err, requireAny } from './_helpers.js'
import { logEvent } from './_audit.js'

const MAX_LEN = 2000
const RECENT_DAYS = 14
const STAFF_ONLY = 'Notes are internal to the Brooklyn CDJR team. Use Messages to reach us.'

function friendly(error) {
  return String(error.message || '').includes('deal_notes') ? 'Notes need a one-time database update first.' : error.message
}

async function loadDeal(dealNumber) {
  const { data } = await supabase.from('deals').select('*').eq('deal_number', dealNumber).single()
  return data || null
}

export default async function handler(req, res) {
  cors(res)
  if (req.method === 'OPTIONS') return res.status(204).end()

  const session = await requireAny(req, res)
  if (!session) return
  // Notes are internal: staff (admins and fleet managers) only. Brokers use Messages.
  if (session.role !== 'admin') return err(res, STAFF_ONLY, 403)
  const action = req.query.action
  const body = req.body || {}

  // Bell: deals that have notes this person has not seen yet
  if (req.method === 'GET' && action === 'unread') {
    const since = new Date(Date.now() - RECENT_DAYS * 86400000).toISOString()
    const { data: notes, error } = await supabase.from('deal_notes').select('*').gt('created_at', since).order('created_at', { ascending: false }).limit(300)
    if (error) return err(res, friendly(error), 500)
    const { data: views } = await supabase.from('note_views').select('deal_id,seen_at').eq('admin_id', session.user_id)
    const seen = {}
    for (const v of views || []) seen[v.deal_id] = new Date(v.seen_at).getTime()
    const mine = n => n.author_role === 'admin' && String(n.author_id) === String(session.user_id)
    const unread = (notes || []).filter(n => !mine(n) && new Date(n.created_at).getTime() > (seen[n.deal_id] || 0))
    const byDeal = new Map()
    for (const n of unread) {
      const g = byDeal.get(n.deal_id) || { count: 0, latest: n }
      g.count++
      byDeal.set(n.deal_id, g)
    }
    if (!byDeal.size) return ok(res, { count: 0, deals: [] })
    const { data: dealRows } = await supabase.from('deals').select('*').in('id', [...byDeal.keys()])
    const { data: brokers } = await supabase.from('brokers').select('id,company_name,broker_code,contact_name,email')
    const { data: staff } = await supabase.from('admins').select('id,name')
    const bMap = {}
    for (const b of brokers || []) bMap[b.id] = b
    const aMap = {}
    for (const a of staff || []) aMap[a.id] = a
    const list = (dealRows || []).map(d => {
      const g = byDeal.get(d.id)
      const b = bMap[d.broker_id] || {}
      return {
        count: g.count,
        latest: { body: g.latest.body, author_name: g.latest.author_name, author_role: g.latest.author_role, created_at: g.latest.created_at, internal: g.latest.internal },
        deal: { ...d, assigned_to_name: (aMap[d.assigned_to] || {}).name || null, broker_name: b.company_name, broker_code: b.broker_code, broker_contact: b.contact_name, broker_email: b.email },
      }
    }).sort((a, b) => new Date(b.latest.created_at) - new Date(a.latest.created_at))
    return ok(res, { count: unread.length, deals: list })
  }

  // Opened a deal: mark its notes as seen
  if (req.method === 'POST' && action === 'seen') {
    const deal = await loadDeal(body.deal_number)
    if (!deal) return err(res, 'Deal not found', 404)
    const { error } = await supabase.from('note_views').upsert({ admin_id: session.user_id, deal_id: deal.id, seen_at: new Date().toISOString() }, { onConflict: 'admin_id,deal_id' })
    if (error) return err(res, friendly(error), 500)
    return ok(res, { ok: true })
  }

  // Read a deal's notes (includes the note the broker typed when requesting the car)
  if (req.method === 'GET') {
    const deal = await loadDeal(req.query.deal_number)
    if (!deal) return err(res, 'Deal not found', 404)
    const { data, error } = await supabase.from('deal_notes').select('*').eq('deal_id', deal.id).order('created_at', { ascending: true })
    if (error) return err(res, friendly(error), 500)
    return ok(res, data || [])
  }

  // Add an internal note
  if (req.method === 'POST') {
    const text = String(body.body || '').trim()
    if (!text) return err(res, 'Write a note first')
    if (text.length > MAX_LEN) return err(res, 'That note is too long (2000 characters max)')
    const deal = await loadDeal(body.deal_number)
    if (!deal) return err(res, 'Deal not found', 404)
    const { data: a } = await supabase.from('admins').select('id,name').eq('id', session.user_id).single()
    const { error } = await supabase.from('deal_notes').insert({ deal_id: deal.id, author_role: 'admin', author_id: session.user_id, author_name: a ? a.name : 'Brooklyn CDJR', body: text, internal: true })
    if (error) return err(res, friendly(error), 500)
    await logEvent({ dealId: deal.id, role: 'admin', userId: session.user_id, name: a ? a.name : null, action: 'note_added', detail: 'Internal note added' })
    return ok(res, { ok: true }, 201)
  }

  return err(res, 'Method not allowed', 405)
}
