import supabase from './_db.js'
import { cors, ok, err, requireAdmin, checkPassword, hashPassword } from './_helpers.js'

export default async function handler(req, res) {
  cors(res)
  if (req.method === 'OPTIONS') return res.status(204).end()

  const body = req.body || {}

  if (req.method === 'GET') {
    const session = await requireAdmin(req, res)
    if (!session) return
    const { data } = await supabase.from('admins').select('id,username,name,email,notify_email,created_at').order('id')
    return ok(res, data)
  }

  if (req.method === 'POST') {
    const session = await requireAdmin(req, res)
    if (!session) return
    const { username, name, email, password, notify_email } = body
    if (!username || !name || !email) return err(res, 'Username, name, and email required')
    if (!password || password.length < 8) return err(res, 'Password must be at least 8 characters')
    const { data: existing } = await supabase.from('admins').select('id').or(`username.eq.${username},email.eq.${email}`)
    if (existing?.length) return err(res, 'Username or email already in use')
    await supabase.from('admins').insert({ username, name, email, password: hashPassword(password), notify_email: notify_email !== false })
    return ok(res, { ok: true, message: `Admin ${name} created` }, 201)
  }

  if (req.method === 'PUT') {
    const session = await requireAdmin(req, res)
    if (!session) return

    // Toggle notify_email for any admin
    if (body.admin_id !== undefined && body.notify_email !== undefined) {
      await supabase.from('admins').update({ notify_email: body.notify_email }).eq('id', body.admin_id)
      return ok(res, { ok: true })
    }

    const { data: admin } = await supabase.from('admins').select('*').eq('id', session.user_id).single()
    if (!admin) return err(res, 'Admin not found', 404)

    const updates = {}
    if (body.name)  updates.name  = body.name
    if (body.email) updates.email = body.email
    if (body.notify_email !== undefined) updates.notify_email = body.notify_email

    if (body.new_password) {
      if (!checkPassword(body.current_password || '', admin.password)) return err(res, 'Current password incorrect', 401)
      if (body.new_password.length < 8) return err(res, 'New password must be at least 8 characters')
      if (body.new_password !== body.confirm_password) return err(res, 'Passwords do not match')
      updates.password = hashPassword(body.new_password)
    }

    if (Object.keys(updates).length) await supabase.from('admins').update(updates).eq('id', admin.id)
    return ok(res, { ok: true, message: 'Profile updated' })
  }

  if (req.method === 'DELETE') {
    const session = await requireAdmin(req, res)
    if (!session) return
    if (body.id === session.user_id) return err(res, 'Cannot delete your own account')
    await supabase.from('admins').delete().eq('id', body.id)
    return ok(res, { ok: true })
  }

  return err(res, 'Method not allowed', 405)
}
