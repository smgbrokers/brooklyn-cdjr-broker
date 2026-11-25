import supabase from './_db.js'

// Fan a notification out to staff (admins and fleet managers).
// Best effort: a failure here must never break the request that triggered it.
export async function notifyStaff({ type, dealNumber, title, body, onlyAdminId = null, excludeAdminId = null }) {
  try {
    let ids
    if (onlyAdminId) {
      ids = [onlyAdminId]
    } else {
      const { data } = await supabase.from('admins').select('id')
      ids = (data || []).map(a => a.id).filter(id => String(id) !== String(excludeAdminId))
    }
    if (!ids.length) return
    const rows = ids.map(id => ({ admin_id: id, type, deal_number: dealNumber || null, title, body: body || null, is_read: false }))
    const { error } = await supabase.from('staff_notifications').insert(rows)
    if (error) console.error('notify error:', error.message)
  } catch (e) {
    console.error('notify error:', e.message)
  }
}
