import supabase from './_db.js'
import { brokerCanSee } from './_team.js'

// A tiny fingerprint of "what has changed" for the signed-in person. The screens ask for it every few seconds
// and reload only the parts whose number moved, so everything stays live without refreshing the page.
export async function buildPulse(session) {
  const maxId = async (table, narrow) => {
    let q = supabase.from(table).select('id').order('id', { ascending: false }).limit(1)
    if (narrow) q = narrow(q)
    const { data } = await q
    return data && data[0] ? Number(data[0].id) : 0
  }
  const countOf = async (table, narrow) => {
    let q = supabase.from(table).select('id', { count: 'exact', head: true })
    if (narrow) q = narrow(q)
    const { count } = await q
    return count || 0
  }

  // Inventory signature: how many cars, how many are hidden, how many are Select.
  // Hiding, unhiding or a new CSV moves it, so pages that are already open refresh the list.
  const invSig = async forBroker => {
    const total = await countOf('inventory')
    const hidden = await countOf('inventory', q => q.eq('hidden', true))
    const select = await countOf('inventory', q => q.eq('select_inventory', true))
    return forBroker ? (total - hidden) * 1000000 + select : total * 1000000 + hidden * 1000 + select
  }

  if (session.role === 'admin') {
    const [deals, events, msgs, notifs, inv, cars] = await Promise.all([
      countOf('deals'),
      maxId('deal_events'),
      maxId('deal_messages'),
      maxId('staff_notifications', q => q.eq('admin_id', session.user_id)),
      invSig(false),
      maxId('porter_log'),
    ])
    return { deals, events, msgs, notifs, inv, cars }
  }

  // Brokers: only the deals this login is allowed to see
  const { data: rows } = await supabase.from('deals').select('id,broker_id,broker_user_id').eq('broker_id', session.user_id)
  const ids = (rows || []).filter(d => brokerCanSee(session, d)).map(d => d.id)
  const seesTeam = !session.broker_user_id || session.broker_user_role === 'admin'
  const teamSig = async () => {
    const { data } = await supabase.from('broker_users').select('id,role,suspended').eq('broker_id', session.user_id)
    return (data || []).map(u => u.id + ':' + u.role + ':' + (u.suspended ? 1 : 0)).sort().join(',')
  }
  const [events, msgs, inv, team] = await Promise.all([
    ids.length ? maxId('deal_events', q => q.in('deal_id', ids)) : 0,
    ids.length ? maxId('deal_messages', q => q.in('deal_id', ids)) : 0,
    invSig(true),
    seesTeam ? teamSig() : '',
  ])
  return { deals: ids.length, events, msgs, inv, team }
}
