import supabase from './_db.js'

// Record who did what on a deal (this feeds the Log tab).
// Best effort: a failure here must never break the request that triggered it.
export async function logEvent({ dealId, dealNumber, role, userId, name, action, detail, dedupeMinutes = 0 }) {
  try {
    let id = dealId
    if (!id && dealNumber) {
      const { data } = await supabase.from('deals').select('id').eq('deal_number', dealNumber).single()
      id = data ? data.id : null
    }
    if (!id) return
    const actorRole = role || 'system'
    let actorName = name || null
    if (!actorName && userId) {
      if (actorRole === 'admin') {
        const { data } = await supabase.from('admins').select('id,name').eq('id', userId).single()
        actorName = data ? data.name : null
      } else if (actorRole === 'broker') {
        const { data } = await supabase.from('brokers').select('id,company_name').eq('id', userId).single()
        actorName = data ? data.company_name : null
      }
    }
    if (dedupeMinutes > 0) {
      // Repeat views by the same person within the window are logged once
      const since = new Date(Date.now() - dedupeMinutes * 60000).toISOString()
      let q = supabase.from('deal_events').select('id').eq('deal_id', id).eq('actor_role', actorRole).eq('action', action).gt('created_at', since).limit(1)
      if (userId) q = q.eq('actor_id', userId)
      if (detail) q = q.eq('detail', detail)
      const { data: recent } = await q
      if (recent && recent.length) return
    }
    const { error } = await supabase.from('deal_events').insert({ deal_id: id, actor_role: actorRole, actor_id: userId || null, actor_name: actorName || (actorRole === 'system' ? 'System' : null), action, detail: detail || null })
    if (error) console.error('audit log error:', error.message)
  } catch (e) {
    console.error('audit log error:', e.message)
  }
}
