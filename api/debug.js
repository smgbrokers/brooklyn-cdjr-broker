import supabase from './_db.js'

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  
  const token = (req.headers.authorization || '').replace('Bearer ', '').trim()
  const results = { current_utc: new Date().toISOString() }

  // Supabase connection
  const { data: admins, error: adminErr } = await supabase.from('admins').select('id').limit(1)
  results.supabase = adminErr ? `ERROR: ${adminErr.message}` : 'connected'

  // All sessions
  const { data: sessions, error: sessErr } = await supabase.from('sessions').select('id, role, user_id, expires_at')
  results.sessions = sessErr ? `ERROR: ${sessErr.message}` : sessions

  // Token from Authorization header
  results.token_received = token ? token.substring(0, 16) + '...' : 'NONE - not logged in'
  
  if (token) {
    const { data: sess, error: tokErr } = await supabase.from('sessions').select('*').eq('token', token).single()
    results.session_found = tokErr ? `ERROR: ${tokErr.message}` : sess
    if (sess) {
      results.is_expired = new Date(sess.expires_at) < new Date()
    }
  }

  res.status(200).json(results)
}
