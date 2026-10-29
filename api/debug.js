import supabase from './_db.js'

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  
  const token = (req.headers.authorization || '').replace('Bearer ', '').trim()
  
  const results = {}
  
  // Test 1: Can we connect to Supabase at all?
  const { data: admins, error: adminErr } = await supabase.from('admins').select('id, username').limit(1)
  results.supabase_connection = adminErr ? `ERROR: ${adminErr.message}` : `OK - found ${admins?.length} admin(s)`
  
  // Test 2: Check sessions table
  const { data: sessions, error: sessErr } = await supabase.from('sessions').select('id, role, expires_at').limit(5)
  results.sessions = sessErr ? `ERROR: ${sessErr.message}` : sessions
  
  // Test 3: If token provided, look it up
  if (token) {
    const { data: sess, error: tokErr } = await supabase.from('sessions').select('*').eq('token', token).single()
    results.token_lookup = tokErr ? `ERROR: ${tokErr.message}` : sess
    results.current_time = new Date().toISOString()
    results.expires_at = sess?.expires_at
    results.is_expired = sess ? new Date(sess.expires_at) < new Date() : 'no session found'
  }
  
  // Test 4: Check brokers table
  const { data: brokers, error: brokerErr } = await supabase.from('brokers').select('id, broker_code, username').limit(3)
  results.brokers = brokerErr ? `ERROR: ${brokerErr.message}` : brokers

  res.status(200).json(results)
}
