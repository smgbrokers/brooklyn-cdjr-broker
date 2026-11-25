import supabase from './_db.js'
import { cors, ok, err, generateToken, checkPassword, hashPassword, sendEmail } from './_helpers.js'
import { escLike } from './_team.js'

const SESSION_HOURS = 12

// A team member (sales or company admin) signing in with their own username or email.
// Returns true when it has answered the request.
async function loginTeamMember(res, login, password) {
  const like = escLike(login)
  let { data: bu } = await supabase.from('broker_users').select('*').ilike('username', like).single()
  if (!bu) {
    const r = await supabase.from('broker_users').select('*').ilike('email', like).single()
    bu = r.data
  }
  if (!bu) return false
  if (!password) { err(res, 'Password required'); return true }
  if (!checkPassword(password, bu.password)) { err(res, 'Invalid username or password', 401); return true }
  if (bu.suspended) { err(res, 'This account is suspended. Please contact your company admin.', 403); return true }
  const { data: company } = await supabase.from('brokers').select('*').eq('id', bu.broker_id).eq('active', true).single()
  if (!company) { err(res, 'Your company account is inactive. Please contact Brooklyn CDJR.', 403); return true }
  await supabase.from('sessions').delete().eq('broker_user_id', bu.id)
  const token = generateToken()
  const expires = new Date(Date.now() + SESSION_HOURS * 3600000).toISOString()
  const { error: sessErr } = await supabase.from('sessions').insert({ token, role: 'broker', user_id: company.id, broker_user_id: bu.id, broker_user_role: bu.role, expires_at: expires })
  if (sessErr) { err(res, /broker_user/.test(sessErr.message) ? 'Team logins need a one-time database update first.' : 'Session creation failed: ' + sessErr.message, 500); return true }
  await supabase.from('broker_users').update({ last_login_at: new Date().toISOString() }).eq('id', bu.id)
  ok(res, { token, role: 'broker', broker_id: company.id, broker_code: company.broker_code, username: bu.username, company_name: company.company_name, contact_name: bu.name, email: bu.email, phone: bu.phone, user_role: bu.role, user_name: bu.name, broker_user_id: bu.id })
  return true
}

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
    return ok(res, { token, role: 'admin', name: admin.name, email: admin.email, username: admin.username, admin_id: admin.id, admin_role: admin.role || 'admin' })
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
    if (!broker) {
      // Not a company login: maybe one of their team members
      if (await loginTeamMember(res, login, password)) return
      return err(res, 'Account not found. Contact Brooklyn CDJR to get registered.', 401)
    }
    if (broker.password) {
      if (!password) return err(res, 'Password required')
      if (!checkPassword(password, broker.password)) return err(res, 'Invalid username or password', 401)
    }
    // Only replace the owner's own session, never a team member's
    const delOwn = await supabase.from('sessions').delete().eq('user_id', broker.id).eq('role', 'broker').is('broker_user_id', null)
    if (delOwn.error) await supabase.from('sessions').delete().eq('user_id', broker.id).eq('role', 'broker')
    const token = generateToken()
    const expires = new Date(Date.now() + SESSION_HOURS * 3600000).toISOString()
    const { error: sessErr } = await supabase.from('sessions').insert({ token, role: 'broker', user_id: broker.id, expires_at: expires })
    if (sessErr) return err(res, 'Session creation failed: ' + sessErr.message, 500)
    return ok(res, { token, role: 'broker', broker_id: broker.id, broker_code: broker.broker_code, username: broker.username, company_name: broker.company_name, contact_name: broker.contact_name, email: broker.email, phone: broker.phone, user_role: 'owner', user_name: broker.contact_name || broker.company_name })
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
      else {
        const { data: tu } = await supabase.from('broker_users').select('id,name,email').ilike('email', escLike(email)).eq('suspended', false).single()
        if (tu) { user = tu; role = 'broker' }
      }
    }
    if (!user) {
      const { data: pt } = await supabase.from('porters').select('id,name,email').ilike('email', escLike(email)).eq('active', true).single()
      if (pt) { user = pt; role = 'porter' }
    }
    if (user) {
      await supabase.from('password_resets').delete().eq('email', email).eq('role', role)
      const token = generateToken()
      const expires = new Date(Date.now() + 3600000).toISOString()
      let ins = await supabase.from('password_resets').insert({ email, role, token, expires_at: expires })
      if (ins.error && role === 'porter') {
        // an older database may only allow admin or broker here: keep it as broker, the reset finds the porter by email
        ins = await supabase.from('password_resets').insert({ email, role: 'broker', token, expires_at: expires })
      }
      if (ins.error) console.error('[auth] could not store the reset token:', ins.error.message)
      const url = `https://brooklyn-cdjr-broker.vercel.app?reset_token=${token}`
      await sendEmail(email, 'Brooklyn CDJR — Password Reset', `Hi ${user.name},\n\nClick to reset your password (expires in 1 hour)${role === 'porter' ? '. Afterwards sign in with the Porter Login button at the top right of the sign-in page' : ''}:\n\n${url}\n\n— Brooklyn CDJR Team`)
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
    else {
      await supabase.from('brokers').update({ password: hash }).eq('email', reset.email)
      await supabase.from('broker_users').update({ password: hash }).ilike('email', escLike(reset.email))
      const { data: pts } = await supabase.from('porters').select('id').ilike('email', escLike(reset.email))
      if (pts && pts.length) {
        await supabase.from('porters').update({ password: hash }).ilike('email', escLike(reset.email))
        await supabase.from('porter_sessions').delete().in('porter_id', pts.map(x => x.id))
      }
    }
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
