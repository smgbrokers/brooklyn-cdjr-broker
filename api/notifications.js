import supabase from './_db.js'
import { cors, ok, err, requireAny } from './_helpers.js'

const NOTE_DAYS = 14
const EVENT_DAYS = 30

export default async function handler(req, res) {
  cors(res)
  if (req.method === 'OPTIONS') return res.status(204).end()

  const session = await requireAny(req, res)
  if (!session) return
  if (session.role !== 'admin') return err(res, 'Notifications are for the Brooklyn CDJR team.', 403)
  const me = session.user_id
  const action = req.query.action
  const body = req.body || {}

  // Unread internal notes, grouped by deal (others notes newer than my last look at that deal)
  async function unreadNoteGroups() {
    const since = new Date(Date.now() - NOTE_DAYS * 86400000).toISOString()
    const { data: notes, error } = await supabase.from('deal_notes').select('*').gt('created_at', since).order('created_at', { ascending: false }).limit(300)
    if (error) return []
    const { data: views } = await supabase.from('note_views').select('deal_id,seen_at').eq('admin_id', me)
    const seen = {}
    for (const v of views || []) seen[v.deal_id] = new Date(v.seen_at).getTime()
    const mine = n => n.author_role === 'admin' && String(n.author_id) === String(me)
    const groups = new Map()
    for (const n of notes || []) {
      if (mine(n) || new Date(n.created_at).getTime() <= (seen[n.deal_id] || 0)) continue
      const g = groups.get(n.deal_id) || { deal_id: n.deal_id, count: 0, latest: n }
      g.count++
      groups.set(n.deal_id, g)
    }
    return [...groups.values()]
  }

  // Mark one notification (or everything) as read
  if (req.method === 'POST' && action === 'read') {
    if (body.all) {
      await supabase.from('staff_notifications').update({ is_read: true }).eq('admin_id', me).eq('is_read', false)
      for (const g of await unreadNoteGroups()) {
        await supabase.from('note_views').upsert({ admin_id: me, deal_id: g.deal_id, seen_at: new Date().toISOString() }, { onConflict: 'admin_id,deal_id' })
      }
      return ok(res, { ok: true })
    }
    if (body.id !== undefined && body.id !== null) {
      await supabase.from('staff_notifications').update({ is_read: true }).eq('admin_id', me).eq('id', body.id)
      return ok(res, { ok: true })
    }
    return err(res, 'Nothing to mark as read')
  }

  // The bell: recent notifications (read and unread) plus unread notes
  if (req.method === 'GET') {
    const since = new Date(Date.now() - EVENT_DAYS * 86400000).toISOString()
    const { data: rows, error: rowsErr } = await supabase.from('staff_notifications').select('*').eq('admin_id', me).gt('created_at', since).order('created_at', { ascending: false }).limit(60)
    const groups = await unreadNoteGroups()

    const numbers = [...new Set((rows || []).map(r => r.deal_number).filter(Boolean))]
    const { data: byNumber } = numbers.length ? await supabase.from('deals').select('*').in('deal_number', numbers) : { data: [] }
    const groupIds = groups.map(g => g.deal_id)
    const { data: byId } = groupIds.length ? await supabase.from('deals').select('*').in('id', groupIds) : { data: [] }
    const dealByNumber = {}
    for (const d of [...(byNumber || []), ...(byId || [])]) dealByNumber[d.deal_number] = d
    const idToNumber = {}
    for (const d of byId || []) idToNumber[d.id] = d.deal_number

    const { data: brokers } = await supabase.from('brokers').select('id,company_name,broker_code,contact_name,email')
    const { data: staff } = await supabase.from('admins').select('id,name')
    const bMap = {}
    for (const b of brokers || []) bMap[b.id] = b
    const aMap = {}
    for (const a of staff || []) aMap[a.id] = a
    const flat = d => {
      if (!d) return null
      const b = bMap[d.broker_id] || {}
      return { ...d, assigned_to_name: (aMap[d.assigned_to] || {}).name || null, broker_name: b.company_name, broker_code: b.broker_code, broker_contact: b.contact_name, broker_email: b.email }
    }

    const items = []
    for (const r of rows || []) {
      items.push({ kind: 'event', id: r.id, type: r.type, title: r.title, body: r.body, deal_number: r.deal_number, created_at: r.created_at, unread: !r.is_read, deal: flat(dealByNumber[r.deal_number]) })
    }
    for (const g of groups) {
      const dn = idToNumber[g.deal_id]
      const snippet = String(g.latest.body || '').slice(0, 100)
      items.push({ kind: 'note', id: 'note-' + g.deal_id, type: 'note', title: 'New note on Deal #' + dn, body: (g.latest.author_name || 'Team') + ': ' + snippet + (g.count > 1 ? ' (+' + (g.count - 1) + ' more)' : ''), deal_number: dn, created_at: g.latest.created_at, unread: true, deal: flat(dealByNumber[dn]) })
    }
    items.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    const count = items.filter(i => i.unread).length
    return ok(res, { count, items: items.slice(0, 40), setup_needed: !!rowsErr })
  }

  return err(res, 'Method not allowed', 405)
}
