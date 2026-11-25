import supabase from './_db.js'
import { cors, ok, err, requireAdmin, generateToken, getToken, hashPassword, checkPassword } from './_helpers.js'
import { getColumns, loadColumns, seedColumns, porterFriendly, requirePorterOrStaff, addCarToBoard } from './_porter.js'
import { notifyStaff } from './_notify.js'
import { logEvent } from './_audit.js'
import { escLike } from './_team.js'

const SESSION_HOURS = 24
const colText = (cols, k) => (cols.find(c => c.key === k) || {}).label || k
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
    const cols = await getColumns()
    const hide = new Set(cols.filter(c => c.auto_hide).map(c => c.key))
    const weekAgo = Date.now() - 7 * 86400000
    const shown = (cards || []).filter(c => !hide.has(c.column_key) || new Date(c.moved_at).getTime() > weekAgo)
    const counts = {}
    if (shown.length) {
      const { data: notes } = await supabase.from('porter_log').select('card_id').eq('action', 'note').in('card_id', shown.map(c => c.id))
      for (const n of notes || []) counts[n.card_id] = (counts[n.card_id] || 0) + 1
    }
    const known = new Set(cols.map(c => c.key))
    return ok(res, { columns: cols, cards: shown.map(c => view(known.has(c.column_key) ? c : { ...c, column_key: cols[0].key }, counts)), me: { kind: who.kind, name: who.name } })
  }

  // One card with its activity (moves and notes)
  if (req.method === 'GET' && action === 'card') {
    const c = await loadCard(req.query.id)
    if (!c) return err(res, 'Card not found', 404)
    const { data: log } = await supabase.from('porter_log').select('*').eq('card_id', c.id).order('id', { ascending: true }).limit(300)
    return ok(res, { card: view(c), log: (log || []).map(logView), columns: await getColumns() })
  }

  // Move a card to another column
  if (req.method === 'POST' && action === 'move') {
    const cols = await getColumns()
    if (!cols.some(c => c.key === body.to)) return err(res, 'Unknown column')
    const c = await loadCard(body.id)
    if (!c || c.archived) return err(res, 'Card not found', 404)
    if (c.column_key === body.to) return ok(res, { ok: true, card: view(c) })
    const now = new Date().toISOString()
    const { error } = await supabase.from('porter_cards').update({ column_key: body.to, moved_at: now, moved_by: who.name }).eq('id', c.id)
    if (error) return err(res, porterFriendly(error), 500)
    const detail = colText(cols, c.column_key) + ' \u2192 ' + colText(cols, body.to)
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
    return ok(res, { card: c ? view(c) : null, log, columns: await getColumns() })
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

  // ---- Get Ready columns (office only): add, rename, recolour, reorder and remove ----
  const colorOk = c => String(c).length === 7 && String(c)[0] === '#' && String(c).slice(1).split('').every(ch => '0123456789abcdefABCDEF'.includes(ch))
  const slugOf = label => String(label).toLowerCase().split('').map(ch => ('abcdefghijklmnopqrstuvwxyz0123456789'.includes(ch) ? ch : '_')).join('').split('_').filter(Boolean).join('_').slice(0, 26) || 'column'
  const columnRows = async () => { const { data } = await supabase.from('porter_columns').select('*').order('sort_order', { ascending: true }); return data || [] }
  const renumber = async list => { for (let i = 0; i < list.length; i++) if (list[i].sort_order !== i) await supabase.from('porter_columns').update({ sort_order: i }).eq('id', list[i].id) }
  const columnsChanged = async detail => { await supabase.from('porter_log').insert({ card_id: null, actor_role: 'staff', actor_name: who.name, action: 'columns_changed', detail }) }
  const readyToEdit = async () => {
    const r = await loadColumns()
    if (r.error) return porterFriendly(r.error)
    if (!r.custom) { const sd = await seedColumns(); if (sd.error) return porterFriendly(sd.error) }
    return null
  }
  const publishColumns = async () => {
    const r = await loadColumns()
    const { data: cs } = await supabase.from('porter_cards').select('id,column_key').eq('archived', false)
    const counts = {}
    for (const c of cs || []) counts[c.column_key] = (counts[c.column_key] || 0) + 1
    return { columns: r.columns, custom: r.custom, setup_needed: !!r.error, counts }
  }
  if (req.method === 'GET' && action === 'columns') {
    if (!staffOnly()) return
    return ok(res, await publishColumns())
  }
  if (req.method === 'POST' && action === 'column_add') {
    if (!staffOnly()) return
    const label = String(body.label || '').trim().slice(0, 40)
    const color = body.color === undefined || body.color === '' ? '#6B7280' : String(body.color)
    if (!label) return err(res, 'Give the column a name')
    if (!colorOk(color)) return err(res, 'Pick a colour like #3B82F6')
    const bad = await readyToEdit()
    if (bad) return err(res, bad, 500)
    const list = await columnRows()
    if (list.length >= 12) return err(res, 'A board can have up to 12 columns')
    if (list.some(c => c.label.toLowerCase() === label.toLowerCase())) return err(res, 'There is already a column with that name')
    const taken = new Set(list.map(c => c.col_key))
    let key = slugOf(label)
    for (let n = 2; taken.has(key); n++) key = slugOf(label) + '_' + n
    const { error } = await supabase.from('porter_columns').insert({ col_key: key, label, color, sort_order: list.length, auto_hide: false })
    if (error) return err(res, porterFriendly(error), 500)
    await columnsChanged('Added column ' + label)
    return ok(res, await publishColumns(), 201)
  }
  if (req.method === 'POST' && action === 'column_update') {
    if (!staffOnly()) return
    const bad = await readyToEdit()
    if (bad) return err(res, bad, 500)
    const list = await columnRows()
    const col = list.find(c => c.col_key === body.key)
    if (!col) return err(res, 'Column not found', 404)
    const upd = {}
    if (body.label !== undefined) {
      const l = String(body.label).trim().slice(0, 40)
      if (!l) return err(res, 'Give the column a name')
      if (list.some(c => c.col_key !== col.col_key && c.label.toLowerCase() === l.toLowerCase())) return err(res, 'There is already a column with that name')
      upd.label = l
    }
    if (body.color !== undefined) { if (!colorOk(body.color)) return err(res, 'Pick a colour like #3B82F6'); upd.color = String(body.color) }
    if (body.auto_hide !== undefined) upd.auto_hide = !!body.auto_hide
    if (!Object.keys(upd).length) return err(res, 'Nothing to change')
    const { error } = await supabase.from('porter_columns').update(upd).eq('id', col.id)
    if (error) return err(res, porterFriendly(error), 500)
    await columnsChanged('Changed column ' + (upd.label || col.label))
    return ok(res, await publishColumns())
  }
  if (req.method === 'POST' && action === 'column_move') {
    if (!staffOnly()) return
    const bad = await readyToEdit()
    if (bad) return err(res, bad, 500)
    const list = await columnRows()
    const i = list.findIndex(c => c.col_key === body.key)
    if (i < 0) return err(res, 'Column not found', 404)
    const j = body.direction === 'left' ? i - 1 : body.direction === 'right' ? i + 1 : -1
    if (j < 0 || j >= list.length) return err(res, 'It cannot move any further that way')
    const arr = [...list]
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
    await renumber(arr)
    await columnsChanged('Moved column ' + list[i].label)
    return ok(res, await publishColumns())
  }
  if (req.method === 'POST' && action === 'column_remove') {
    if (!staffOnly()) return
    const bad = await readyToEdit()
    if (bad) return err(res, bad, 500)
    const list = await columnRows()
    const col = list.find(c => c.col_key === body.key)
    if (!col) return err(res, 'Column not found', 404)
    if (list.length <= 1) return err(res, 'A board needs at least one column')
    const { data: all } = await supabase.from('porter_cards').select('id,archived').eq('column_key', col.col_key)
    const active = (all || []).filter(c => !c.archived)
    let target = null
    if (active.length) {
      target = list.find(c => c.col_key === body.move_to && c.col_key !== col.col_key)
      if (!target) return err(res, 'Choose where the ' + active.length + (active.length === 1 ? ' car' : ' cars') + ' in this column should go')
    } else if ((all || []).length) {
      target = list.find(c => c.col_key !== col.col_key)
    }
    if (target && (all || []).length) {
      await supabase.from('porter_cards').update({ column_key: target.col_key, moved_at: new Date().toISOString(), moved_by: who.name }).eq('column_key', col.col_key)
      for (const c of active) await supabase.from('porter_log').insert({ card_id: c.id, actor_role: 'staff', actor_name: who.name, action: 'moved', detail: col.label + ' \u2192 ' + target.label + ' (column removed)' })
    }
    const { error } = await supabase.from('porter_columns').delete().eq('id', col.id)
    if (error) return err(res, porterFriendly(error), 500)
    await renumber(list.filter(c => c.id !== col.id))
    await columnsChanged('Removed column ' + col.label)
    return ok(res, await publishColumns())
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
