import supabase from './_db.js'
import { cors, ok, err, requireAny } from './_helpers.js'
import { brokerCanSee } from './_team.js'

const MAX_LEN = 2000
const LISTED_STATUSES = ['Request', 'Application', 'Approved', 'Declined', 'All Docs In', 'eDocs Sent', 'Docs Sent', 'Ready to Pick Up', 'Completed']
// Messaging is open once a credit app is in (not Request/Dead) AND a team member has claimed the deal (a declined deal always stays open, so the broker can read why)
const isActive = d => !!d && d.status !== 'Dead' && (d.status === 'Request' ? !!d.vehicle_available : (!!d.assigned_to || d.status === 'Declined'))
const CLOSED = 'Messaging opens once the credit application has been received and claimed by a team member.'

function friendly(error) {
  const m = String((error && error.message) || '')
  return m.includes('deal_messages') || m.includes('message_reads') ? 'Messaging needs a one-time database update first.' : m
}

export default async function handler(req, res) {
  cors(res)
  if (req.method === 'OPTIONS') return res.status(204).end()

  const session = await requireAny(req, res)
  if (!session) return
  const isAdmin = session.role === 'admin'
  const me = isAdmin ? { role: 'admin', id: session.user_id } : session.broker_user_id ? { role: 'broker_user', id: session.broker_user_id } : { role: 'broker', id: session.user_id }
  const action = req.query.action
  const body = req.body || {}

  async function loadDeal(dealNumber) {
    const { data } = await supabase.from('deals').select('*').eq('deal_number', dealNumber).single()
    return data || null
  }
  const allowed = deal => isAdmin || brokerCanSee(session, deal)

  // Inbox: every active conversation this person can see, with last message and unread count
  if (req.method === 'GET' && action === 'conversations') {
    let dq = supabase.from('deals').select('*').in('status', LISTED_STATUSES)
    if (!isAdmin) dq = dq.eq('broker_id', session.user_id)
    const { data: dealRows, error: dErr } = await dq.limit(1000)
    if (dErr) return err(res, dErr.message, 500)
    const active = (dealRows || []).filter(d => isActive(d) && (isAdmin || brokerCanSee(session, d)))
    if (!active.length) return ok(res, { me, conversations: [] })
    const ids = active.map(d => d.id)
    const { data: msgs, error: mErr } = await supabase.from('deal_messages').select('*').in('deal_id', ids).order('created_at', { ascending: false }).limit(1000)
    if (mErr) return err(res, friendly(mErr), 500)
    const { data: reads } = await supabase.from('message_reads').select('deal_id,last_read_at').eq('user_role', me.role).eq('user_id', me.id)
    const readAt = {}
    for (const r of reads || []) readAt[r.deal_id] = new Date(r.last_read_at).getTime()
    const mine = m => m.sender_role === me.role && String(m.sender_id) === String(me.id)
    const last = {}
    const unread = {}
    for (const m of msgs || []) {
      if (!last[m.deal_id]) last[m.deal_id] = m
      // system lines (like claimed by X) count as unread for brokers only
      const counts = !mine(m) && (me.role !== 'admin' || m.sender_role !== 'system') && new Date(m.created_at).getTime() > (readAt[m.deal_id] || 0)
      if (counts) unread[m.deal_id] = (unread[m.deal_id] || 0) + 1
    }
    const bMap = {}
    if (isAdmin) {
      const { data: brokers } = await supabase.from('brokers').select('id,company_name,broker_code')
      for (const b of brokers || []) bMap[b.id] = b
    }
    const { data: staff } = await supabase.from('admins').select('id,name')
    const aMap = {}
    for (const a of staff || []) aMap[a.id] = a
    const conversations = active.map(d => {
      const l = last[d.id] || null
      return {
        deal_number: d.deal_number,
        customer_name: d.customer_name,
        vehicle_desc: d.vehicle_desc,
        status: d.status,
        broker_name: isAdmin ? (bMap[d.broker_id] || {}).company_name || null : null,
        assigned_to: d.assigned_to,
        assigned_to_name: (aMap[d.assigned_to] || {}).name || null,
        last: l ? { body: l.body, sender_name: l.sender_name, sender_role: l.sender_role, created_at: l.created_at } : null,
        unread: unread[d.id] || 0,
        _sort: l ? new Date(l.created_at).getTime() : 0,
        _id: d.id,
      }
    }).sort((a, b) => (b._sort - a._sort) || (b._id - a._id)).map(({ _sort, _id, ...rest }) => rest)
    return ok(res, { me, conversations })
  }

  // Mark a conversation as read for this person
  if (req.method === 'POST' && action === 'read') {
    const deal = await loadDeal(body.deal_number)
    if (!deal) return err(res, 'Deal not found', 404)
    if (!allowed(deal)) return err(res, 'Forbidden', 403)
    const { error } = await supabase.from('message_reads').upsert({ user_role: me.role, user_id: me.id, deal_id: deal.id, last_read_at: new Date().toISOString() }, { onConflict: 'user_role,user_id,deal_id' })
    if (error) return err(res, friendly(error), 500)
    return ok(res, { ok: true })
  }

  // Read one conversation
  if (req.method === 'GET') {
    const deal = await loadDeal(req.query.deal_number)
    if (!deal) return err(res, 'Deal not found', 404)
    if (!allowed(deal)) return err(res, 'Forbidden', 403)
    if (!isActive(deal)) return err(res, CLOSED, 403)
    const { data, error } = await supabase.from('deal_messages').select('*').eq('deal_id', deal.id).order('created_at', { ascending: true }).limit(500)
    if (error) return err(res, friendly(error), 500)
    return ok(res, data || [])
  }

  // Send a message
  if (req.method === 'POST') {
    const text = String(body.body || '').trim()
    if (!text) return err(res, 'Type a message first')
    if (text.length > MAX_LEN) return err(res, 'That message is too long (2000 characters max)')
    const deal = await loadDeal(body.deal_number)
    if (!deal) return err(res, 'Deal not found', 404)
    if (!allowed(deal)) return err(res, 'Forbidden', 403)
    if (!isActive(deal)) return err(res, CLOSED, 403)
    let senderName = null
    if (isAdmin) {
      const { data: a } = await supabase.from('admins').select('id,name').eq('id', me.id).single()
      senderName = a ? a.name : 'Brooklyn CDJR'
    } else {
      const { data: b } = await supabase.from('brokers').select('id,company_name').eq('id', session.user_id).single()
      senderName = b ? b.company_name : 'Broker'
      if (session.broker_user_id) {
        const { data: bu } = await supabase.from('broker_users').select('id,name').eq('id', session.broker_user_id).single()
        if (bu) senderName = bu.name + ' (' + senderName + ')'
      }
    }
    const { error } = await supabase.from('deal_messages').insert({ deal_id: deal.id, sender_role: me.role, sender_id: me.id, sender_name: senderName, body: text })
    if (error) return err(res, friendly(error), 500)
    return ok(res, { ok: true }, 201)
  }

  return err(res, 'Method not allowed', 405)
}
