import supabase from './_db.js'
import { cors, ok, err, requireAdmin, generateToken, getToken, hashPassword, checkPassword } from './_helpers.js'
import { CAR_COLUMNS, colLabel, porterFriendly, requirePorterOrStaff, addCarToBoard } from './_porter.js'
import { notifyStaff } from './_notify.js'
import { logEvent } from './_audit.js'
import { escLike } from './_team.js'

const SESSION_HOURS = 24
const COL_KEYS = CAR_COLUMNS.map(c => c.key)
const view = (c, counts = {}) => ({ id: c.id, deal_number: c.deal_number || null, title: c.title, vin: c.vin || null, model: c.model || null, customer_last: c.customer_last || null, broker_name: c.broker_name || null, inspection: !!c.inspection, column_key: c.column_key, moved_at: c.moved_at, moved_by: c.moved_by || null, created_at: c.created_at, notes_count: counts[c.id] || 0 })
const logView = l => ({ id: l.id, actor_role: l.actor_role, actor_name: l.actor_name, action: l.action, detail: l.detail, created_at: l.created_at })

export default async function handler(req, res) {
  cors(res)
  if (req.method === 'OPTIONS') return res.status(204).end()
  const action = req.query.action
  const body = req.body || {}

  // Porter sign in (own accounts, own sessions: a porter login can never open staff or broker data)
  if (req.method === 'POST' && action === 'login') {
    const username = String(body.username || '').trim()
    const password = String(body.password || '')
    if (!username || !password) return err(res, 'Username and password required')
    const { data: p, error: pe } = await supabase.from('porters').select('*').ilike('username', escLike(username)).single()
    if (pe && porterFriendly(pe) !== pe.message) return err(res, porterFriendly(pe), 500)
    if (!p || !checkPassword(password, p.password)) return err(res, 'Invalid username or password', 401)
    if (p.active === false) return err(res, 'This porter account is disabled. Please see the office.', 403)
    await supabase.from('porter_sessions').delete().eq('porter_id', p.id)
    const token = generateToken()
    const expires = new Date(Date.now() + SESSION_HOURS * 3600000).toISOString()
    const { error: se } = await supabase.from('porter_sessions').insert({ token, porter_id: p.id, expires_at: expires })
    if (se) return err(res, porterFriendly(se), 500)
    await supabase.from('porters').update({ last_login_at: new Date().toISOString() }).eq('id', p.id)
    return ok(res, { token, role: 'porter', porter_id: p.id, name: p.name, username: p.username })
  }
  if (req.method === 'POST' && action === 'logout') {
    const t = getToken(req)
    if (t) await supabase.from('porter_sessions').delete().eq('token', t)
    return ok(res, { ok: true })
  }

  const who = await requirePorterOrStaff(req, res)
  if (!who) return
  const isStaff = who.kind === 'staff'
  const staffOnly = () => { if (!isStaff) { err(res, 'Only the office can do this.', 403); return false } return true }
  const loadCard = async id => { const { data } = await supabase.from('porter_cards').select('*').eq('id', id).single(); return data || null }

  // A tiny fingerprint so the board can refresh itself
  if (req.method === 'GET' && action === 'pulse') {
    res.setHeader('Cache-Control', 'no-store')
    const { data: lg } = await supabase.from('porter_log').select('id').order('id', { ascending: false }).limit(1)
    const { count } = await supabase.from('porter_cards').select('id', { count: 'exact', head: true }).eq('archived', false)
    return ok(res, { sig: { cards: lg && lg[0] ? lg[0].id : 0, n: count || 0 } })
  }

  // The board: columns and cards (delivered cars disappear after a week)
  if (req.method === 'GET' && action === 'board') {
    res.setHeader('Cache-Control', 'no-store')
    const { data: cards, error } = await supabase.from('porter_cards').select('*').eq('archived', false).order('moved_at', { ascending: false }).limit(500)
    if (error) return err(res, porterFriendly(error), 500)
    const weekAgo = Date.now() - 7 * 86400000
    const shown = (cards || []).filter(c => c.column_key !== 'delivered' || new Date(c.moved_at).getTime() > weekAgo)
    const counts = {}
    if (shown.length) {
      const { data: notes } = await supabase.from('porter_log').select('card_id').eq('action', 'note').in('card_id', shown.map(c => c.id))
      for (const n of notes || []) counts[n.card_id] = (counts[n.card_id] || 0) + 1
    }
    return ok(res, { columns: CAR_COLUMNS, cards: shown.map(c => view(c, counts)), me: { kind: who.kind, name: who.name } })
  }

  // One card with its activity (moves and notes)
  if (req.method === 'GET' && action === 'card') {
    const c = await loadCard(req.query.id)
    if (!c) return err(res, 'Card not found', 404)
    const { data: log } = await supabase.from('porter_log').select('*').eq('card_id', c.id).order('id', { ascending: true }).limit(300)
    return ok(res, { card: view(c), log: (log || []).map(logView), columns: CAR_COLUMNS })
  }

  // Move a card to another column
  if (req.method === 'POST' && action === 'move') {
    if (!COL_KEYS.includes(body.to)) return err(res, 'Unknown column')
    const c = await loadCard(body.id)
    if (!c || c.archived) return err(res, 'Card not found', 404)
    if (c.column_key === body.to) return ok(res, { ok: true, card: view(c) })
    const now = new Date().toISOString()
    const { error } = await supabase.from('porter_cards').update({ column_key: body.to, moved_at: now, moved_by: who.name }).eq('id', c.id)
    if (error) return err(res, porterFriendly(error), 500)
    const detail = colLabel(c.column_key) + ' \u2192 ' + colLabel(body.to)
    await supabase.from('porter_log').insert({ card_id: c.id, actor_role: who.kind, actor_name: who.name, action: 'moved', detail })
    if (c.deal_id) await logEvent({ dealId: c.deal_id, role: isStaff ? 'admin' : 'porter', userId: who.id, name: who.name + (isStaff ? '' : ' (porter)'), action: 'car_moved', detail })
    return ok(res, { ok: true, card: view({ ...c, column_key: body.to, moved_at: now, moved_by: who.name }) })
  }

  // A note on a card. Notes from a porter ring the staff bell.
  if (req.method === 'POST' && action === 'note') {
    const text = String(body.body || '').trim().slice(0, 1000)
    if (!text) return err(res, 'Write a note first')
    const c = await loadCard(body.id)
    if (!c) return err(res, 'Card not found', 404)
    const { data: entry, error } = await supabase.from('porter_log').insert({ card_id: c.id, actor_role: who.kind, actor_name: who.name, action: 'note', detail: text }).select('*').single()
    if (error) return err(res, porterFriendly(error), 500)
    if (c.deal_id) await logEvent({ dealId: c.deal_id, role: isStaff ? 'admin' : 'porter', userId: who.id, name: who.name + (isStaff ? '' : ' (porter)'), action: 'car_note', detail: text.slice(0, 200) })
    if (!isStaff) {
      let owner = null
      if (c.deal_id) {
        const { data: d } = await supabase.from('deals').select('assigned_to').eq('id', c.deal_id).single()
        owner = d ? d.assigned_to : null
      }
      await notifyStaff({ type: 'porter_note', dealNumber: c.deal_number, onlyAdminId: owner || null, title: 'Porter note: ' + (c.model || c.vin || 'a car'), body: who.name + ': ' + text.slice(0, 140) })
    }
    return ok(res, { ok: true, entry: logView(entry) }, 201)
  }

  // ---- office only from here ----

  // Where is this deal's car on the board?
  if (req.method === 'GET' && action === 'deal_card') {
    if (!staffOnly()) return
    const { data: d } = await supabase.from('deals').select('id,deal_number').eq('deal_number', req.query.deal_number).single()
    if (!d) return err(res, 'Deal not found', 404)
    const { data: cs, error } = await supabase.from('porter_cards').select('*').eq('deal_id', d.id).eq('archived', false).limit(1)
    if (error) return err(res, porterFriendly(error), 500)
    const c = cs && cs[0]
    let log = []
    if (c) {
      const { data: lg } = await supabase.from('porter_log').select('*').eq('card_id', c.id).order('id', { ascending: true }).limit(300)
      log = (lg || []).map(logView)
    }
    return ok(res, { card: c ? view(c) : null, log, columns: CAR_COLUMNS })
  }

  // Add a deal's car to the board by hand
  if (req.method === 'POST' && action === 'card_add') {
    if (!staffOnly()) return
    const { data: d } = await supabase.from('deals').select('*').eq('deal_number', body.deal_number).single()
    if (!d) return err(res, 'Deal not found', 404)
    const r = await addCarToBoard(d, { inspection: body.inspection === true, by: who.name })
    if (r.error) return err(res, r.error, 500)
    if (!r.exists) await logEvent({ dealId: d.id, role: 'admin', userId: who.id, name: who.name, action: 'car_added', detail: r.card.title })
    return ok(res, { ok: true, exists: !!r.exists, card: view(r.card) }, r.exists ? 200 : 201)
  }

  // Take a card off the board
  if (req.method === 'POST' && action === 'card_archive') {
    if (!staffOnly()) return
    const c = await loadCard(body.id)
    if (!c) return err(res, 'Card not found', 404)
    await supabase.from('porter_cards').update({ archived: true }).eq('id', c.id)
    await supabase.from('porter_log').insert({ card_id: c.id, actor_role: 'staff', actor_name: who.name, action: 'removed', detail: 'Removed from the board' })
    if (c.deal_id) await logEvent({ dealId: c.deal_id, role: 'admin', userId: who.id, name: who.name, action: 'car_removed', detail: c.title })
    return ok(res, { ok: true })
  }

  // Porter accounts
  if (req.method === 'GET' && action === 'porters') {
    if (!staffOnly()) return
    const { data, error } = await supabase.from('porters').select('*').order('name', { ascending: true })
    if (error) return err(res, porterFriendly(error), 500)
    return ok(res, { porters: (data || []).map(p => ({ id: p.id, name: p.name, username: p.username, active: p.active !== false, last_login_at: p.last_login_at || null, created_at: p.created_at })) })
  }
  if (req.method === 'POST' && action === 'porter_add') {
    if (!staffOnly()) return
    const name = String(body.name || '').trim().slice(0, 80)
    const username = String(body.username || '').trim().toLowerCase()
    const password = String(body.password || '')
    if (!name) return err(res, 'Enter the porter name')
    if (!/^[a-z0-9._-]{3,30}$/.test(username)) return err(res, 'Username must be 3 to 30 letters, numbers, dots, dashes or underscores')
    if (password.length < 8) return err(res, 'Password must be at least 8 characters')
    const { data: taken, error: te } = await supabase.from('porters').select('id').ilike('username', escLike(username)).limit(1)
    if (te) return err(res, porterFriendly(te), 500)
    if (taken && taken.length) return err(res, 'That username is already taken')
    const { error } = await supabase.from('porters').insert({ name, username, password: hashPassword(password), active: true, created_by: who.name })
    if (error) return err(res, porterFriendly(error), 500)
    return ok(res, { ok: true }, 201)
  }
  if (req.method === 'POST' && action === 'porter_update') {
    if (!staffOnly()) return
    const { data: p } = await supabase.from('porters').select('*').eq('id', body.id).single()
    if (!p) return err(res, 'Porter not found', 404)
    const upd = {}
    let endSessions = false
    if (body.name !== undefined) { const n = String(body.name).trim().slice(0, 80); if (!n) return err(res, 'Enter the porter name'); upd.name = n }
    if (body.active !== undefined) { upd.active = !!body.active; if (!upd.active) endSessions = true }
    if (body.new_password !== undefined) { if (String(body.new_password).length < 8) return err(res, 'Password must be at least 8 characters'); upd.password = hashPassword(String(body.new_password)); endSessions = true }
    if (!Object.keys(upd).length) return err(res, 'Nothing to change')
    const { error } = await supabase.from('porters').update(upd).eq('id', p.id)
    if (error) return err(res, porterFriendly(error), 500)
    if (endSessions) await supabase.from('porter_sessions').delete().eq('porter_id', p.id)
    return ok(res, { ok: true })
  }
  if (req.method === 'POST' && action === 'porter_remove') {
    if (!staffOnly()) return
    const { data: p } = await supabase.from('porters').select('id').eq('id', body.id).single()
    if (!p) return err(res, 'Porter not found', 404)
    await supabase.from('porter_sessions').delete().eq('porter_id', p.id)
    const { error } = await supabase.from('porters').delete().eq('id', p.id)
    if (error) return err(res, porterFriendly(error), 500)
    return ok(res, { ok: true })
  }

  return err(res, 'Unknown route', 404)
}
