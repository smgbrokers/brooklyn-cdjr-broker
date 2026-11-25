import supabase from './_db.js'
import { getToken, err } from './_helpers.js'

// The starting columns of the Get Ready board, left to right. Staff can change them in Settings
// (they are then kept in the porter_columns table); until then these are used.
export const DEFAULT_COLUMNS = [
  { key: 'new', label: 'New Request / RSU Check', color: '#3B82F6', auto_hide: false },
  { key: 'in_transit', label: 'In Transit', color: '#8B5CF6', auto_hide: false },
  { key: 'issues', label: 'Vehicle With Issues', color: '#EF4444', auto_hide: false },
  { key: 'inspection_done', label: 'Inspection Done', color: '#F59E0B', auto_hide: false },
  { key: 'wash_bay', label: 'Wash Bay', color: '#06B6D4', auto_hide: false },
  { key: 'ready', label: 'Ready for Delivery', color: '#10B981', auto_hide: false },
  { key: 'delivered', label: 'Delivered', color: '#6B7280', auto_hide: true },
]
export const CAR_COLUMNS = DEFAULT_COLUMNS
export const colLabel = k => (DEFAULT_COLUMNS.find(c => c.key === k) || {}).label || k

// The columns in use: the saved ones, or the starting set when none are saved (or the table is not there yet)
export async function loadColumns() {
  const { data, error } = await supabase.from('porter_columns').select('*').order('sort_order', { ascending: true })
  if (error) return { columns: DEFAULT_COLUMNS, custom: false, error }
  if (!data || !data.length) return { columns: DEFAULT_COLUMNS, custom: false, error: null }
  return { columns: data.map(r => ({ key: r.col_key, label: r.label, color: r.color || '#6B7280', auto_hide: !!r.auto_hide })), custom: true, error: null }
}
export async function getColumns() {
  return (await loadColumns()).columns
}
export async function seedColumns() {
  const rows = DEFAULT_COLUMNS.map((c, i) => ({ col_key: c.key, label: c.label, color: c.color, sort_order: i, auto_hide: !!c.auto_hide }))
  const { error } = await supabase.from('porter_columns').insert(rows)
  return { error: error || null }
}

export const PORTER_SETUP_MSG = 'The Get Ready board needs a one-time database update first.'
// Turns a database error into a plain message. When it is about the porter tables, the real reason is
// added in brackets (and logged), so a missing table, a missing column and a stale table list can be told apart.
export function porterFriendly(error) {
  const m = String((error && error.message) || '')
  if (!/porter_cards|porter_log|porter_sessions|porter_columns|porters/.test(m)) return m
  // The first part of the database address is the Supabase project ID (not a secret): it shows which project the portal is using
  const project = String(process.env.SUPABASE_URL || '').split('//').pop().split('.')[0]
  console.error('[porter] database problem:', m, '| portal is connected to Supabase project:', project || 'unknown')
  return PORTER_SETUP_MSG + ' [' + m.slice(0, 200) + ']'
}

const SUFFIXES = ['jr', 'sr', 'ii', 'iii', 'iv']
export function lastNameOf(name) {
  const parts = String(name || '').trim().split(' ').filter(Boolean)
  if (!parts.length) return ''
  const last = parts[parts.length - 1]
  const bare = last.split('.').join('').toLowerCase()
  return parts.length > 1 && SUFFIXES.includes(bare) ? parts[parts.length - 2] : last
}

// VIN - Model - Customer last name - Broker - INSPECTION NEEDED (or NO INSPECTION)
export function buildCardTitle({ vin, model, last, broker, inspection }) {
  return [vin, model, last, broker, inspection ? 'INSPECTION NEEDED' : 'NO INSPECTION'].filter(Boolean).join(' - ')
}

// Put an approved deal's car on the board. Safe to call twice: a car already on the board is not added again.
export async function addCarToBoard(deal, { inspection = false, by = null } = {}) {
  try {
    const { data: existing, error: exErr } = await supabase.from('porter_cards').select('*').eq('deal_id', deal.id).eq('archived', false).limit(1)
    if (exErr) return { error: porterFriendly(exErr) }
    if (existing && existing[0]) return { exists: true, card: existing[0] }
    const { data: broker } = await supabase.from('brokers').select('company_name').eq('id', deal.broker_id).single()
    const firstKey = (await getColumns())[0].key
    const fields = { vin: deal.vin || null, model: deal.vehicle_desc || null, customer_last: lastNameOf(deal.customer_name) || null, broker_name: broker ? broker.company_name : null }
    const title = buildCardTitle({ vin: fields.vin, model: fields.model, last: fields.customer_last, broker: fields.broker_name, inspection })
    const { data: card, error } = await supabase.from('porter_cards').insert({ deal_id: deal.id, deal_number: deal.deal_number, ...fields, inspection: !!inspection, title, column_key: firstKey, moved_at: new Date().toISOString(), moved_by: by, archived: false, created_by: by }).select('*').single()
    if (error) return { error: porterFriendly(error) }
    await supabase.from('porter_log').insert({ card_id: card.id, actor_role: 'staff', actor_name: by, action: 'created', detail: 'Added to Get Ready' + (inspection ? ' (inspection needed)' : ' (no inspection)') })
    return { card }
  } catch (e) {
    return { error: e.message }
  }
}

// A porter signed in with their own login (separate from staff and brokers), still enabled
export async function porterFromToken(token) {
  if (!token) return null
  const { data: s } = await supabase.from('porter_sessions').select('*').eq('token', token).gt('expires_at', new Date().toISOString()).single()
  if (!s) return null
  const { data: p } = await supabase.from('porters').select('*').eq('id', s.porter_id).single()
  if (!p || p.active === false) return null
  return p
}

// Either a porter or a staff member may use the board
export async function requirePorterOrStaff(req, res) {
  const t = getToken(req)
  if (!t) { err(res, 'Unauthorized', 401); return null }
  const p = await porterFromToken(t)
  if (p) return { kind: 'porter', id: p.id, name: p.name }
  const { data: s } = await supabase.from('sessions').select('*').eq('token', t).eq('role', 'admin').gt('expires_at', new Date().toISOString()).single()
  if (s) {
    const { data: a } = await supabase.from('admins').select('id,name').eq('id', s.user_id).single()
    return { kind: 'staff', id: s.user_id, name: a ? a.name : 'Staff' }
  }
  err(res, 'Session expired', 401)
  return null
}
