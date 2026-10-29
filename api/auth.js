import supabase from './_db.js'
import { cors, ok, err, generateToken, checkPassword, hashPassword, sendEmail } from './_helpers.js'

const SESSION_HOURS = 12

export default async function handler(req, res) {
  cors(res)
  if (req.method === 'OPTIONS') return res.status(204).end()

  const action = req.query.action
  const body = req.body || {}

  // Admin login
  if (req.method === 'POST' && action === 'admin_login') {
    const { username, password } = body
    if (!username || !password) return err(res, 'Username and password required')
    const { data: admin } = await supabase.from('admins').select('*').or(`username.eq.${username},email.eq.${username}`).single()
    if (!admin || !checkPassword(password, admin.password)) return err(res, 'Invalid username or password', 401)
    await supabase.from('sessions').delete().eq('user_id', admin.id).eq('role', 'admin')
    const token = generateToken()
    const expires = new Date(Date.now() + SESSION_HOURS * 3600000).toISOString()
    await supabase.from('sessions').insert({ token, role: 'admin', user_id: admin.id, expires_at: expires })
    return ok(res, { token, role: 'admin', name: admin.name, email: admin.email, username: admin.username })
  }

  // Broker login
  if (req.method === 'POST' && action === 'broker_login') {
    const login = (body.login || body.broker_code || '').trim()
    const password = (body.password || '').trim()
    if (!login) return err(res, 'Username or Broker ID required')
    const { data: broker } = await supabase.from('brokers')
      .select('*').eq('active', true)
      .or(`broker_code.eq.${login.toUpperCase()},username.eq.${login},email.eq.${login}`)
      .single()
    if (!broker) return err(res, 'Account not found. Contact Brooklyn CDJR to get registered.', 401)
    if (broker.password) {
      if (!password) return err(res, 'Password required')
      if (!checkPassword(password, broker.password)) return err(res, 'Invalid username or password', 401)
    }
    await supabase.from('sessions').delete().eq('user_id', broker.id).eq('role', 'broker')
    const token = generateToken()
    const expires = new Date(Date.now() + SESSION_HOURS * 3600000).toISOString()
    const { error: sessErr } = await supabase.from('sessions').insert({ token, role: 'broker', user_id: broker.id, expires_at: expires })
    if (sessErr) return err(res, 'Session creation failed: ' + sessErr.message, 500)
    return ok(res, { token, role: 'broker', broker_id: broker.id, broker_code: broker.broker_code, username: broker.username, company_name: broker.company_name, contact_name: broker.contact_name, email: broker.email, phone: broker.phone })
  }

  // Forgot password
  if (req.method === 'POST' && action === 'forgot_password') {
    const email = (body.email || '').toLowerCase().trim()
    if (!email) return err(res, 'Email required')
    let user = null, role = null
    const { data: admin } = await supabase.from('admins').select('id,name,email').eq('email', email).single()
    if (admin) { user = admin; role = 'admin' }
    else {
      const { data: broker } = await supabase.from('brokers').select('id,contact_name,email').eq('email', email).eq('active', true).single()
      if (broker) { user = { ...broker, name: broker.contact_name }; role = 'broker' }
    }
    if (user) {
      await supabase.from('password_resets').delete().eq('email', email).eq('role', role)
      const token = generateToken()
      const expires = new Date(Date.now() + 3600000).toISOString()
      await supabase.from('password_resets').insert({ email, role, token, expires_at: expires })
      const url = `https://brooklyn-cdjr-broker.vercel.app?reset_token=${token}`
      await sendEmail(email, 'Brooklyn CDJR — Password Reset', `Hi ${user.name},\n\nClick to reset your password (expires in 1 hour):\n\n${url}\n\n— Brooklyn CDJR Team`)
    }
    return ok(res, { ok: true, message: 'If that email is registered, a reset link has been sent.' })
  }

  // Reset password
  if (req.method === 'POST' && action === 'reset_password') {
    const { token, password, confirm_password } = body
    if (!token) return err(res, 'Token required')
    if (!password || password.length < 8) return err(res, 'Password must be at least 8 characters')
    if (password !== confirm_password) return err(res, 'Passwords do not match')
    const { data: reset } = await supabase.from('password_resets').select('*').eq('token', token).eq('used', false).gt('expires_at', new Date().toISOString()).single()
    if (!reset) return err(res, 'Reset link is invalid or expired', 400)
    const hash = hashPassword(password)
    if (reset.role === 'admin') await supabase.from('admins').update({ password: hash }).eq('email', reset.email)
    else await supabase.from('brokers').update({ password: hash }).eq('email', reset.email)
    await supabase.from('password_resets').update({ used: true }).eq('token', token)
    return ok(res, { ok: true, message: 'Password updated. You can now log in.' })
  }

  // Validate reset token
  if (req.method === 'GET' && action === 'validate_reset_token') {
    const { data } = await supabase.from('password_resets').select('role,email').eq('token', req.query.token || '').eq('used', false).gt('expires_at', new Date().toISOString()).single()
    if (!data) return err(res, 'Invalid or expired token', 400)
    return ok(res, { ok: true, role: data.role })
  }

  // Logout
  if (req.method === 'POST' && action === 'logout') {
    const h = req.headers.authorization || ''
    const token = h.startsWith('Bearer ') ? h.slice(7).trim() : null
    if (token) await supabase.from('sessions').delete().eq('token', token)
    return ok(res, { ok: true })
  }

  return err(res, 'Unknown action', 404)
}
