import supabase from './_db.js'
import { cors, ok, err, requireAdmin, requireAny, checkPassword, hashPassword } from './_helpers.js'

export default async function handler(req, res) {
  cors(res)
  if (req.method === 'OPTIONS') return res.status(204).end()

  const body = req.body || {}

  if (req.method === 'GET') {
    const session = await requireAny(req, res)
    if (!session) return
    if (session.role === 'admin') {
      const { data: brokers } = await supabase.from('brokers').select('*').order('company_name')
      const { data: deals } = await supabase.from('deals').select('broker_id, status')
      const result = brokers.map(b => {
        const bd = deals.filter(d => d.broker_id === b.id)
        return { ...b, total_requests: bd.length, total_apps: bd.filter(d => ['Application','Approved','Docs Sent','Ready to Pick Up','Completed'].includes(d.status)).length, total_approved: bd.filter(d => ['Approved','Docs Sent','Ready to Pick Up','Completed'].includes(d.status)).length, total_sold: bd.filter(d => d.status === 'Completed').length }
      }).sort((a,b) => b.total_sold - a.total_sold)
      return ok(res, result)
    } else {
      const { data } = await supabase.from('brokers').select('id,broker_code,username,company_name,contact_name,email,phone,active').eq('id', session.user_id).single()
      return ok(res, data)
    }
  }

  if (req.method === 'POST') {
    const session = await requireAdmin(req, res)
    if (!session) return
    const { company_name, contact_name, email, phone, username, password, notes } = body
    if (!company_name) return err(res, 'Company name required')
    const { data: last } = await supabase.from('brokers').select('broker_code').order('broker_code', { ascending: false }).limit(1).single()
    const lastNum = last ? parseInt(last.broker_code.slice(1)) : 0
    const broker_code = 'B' + String(lastNum + 1).padStart(3, '0')
    let uname = username || company_name.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 20)
    const { data: existing } = await supabase.from('brokers').select('id').eq('username', uname)
    if (existing?.length) uname = uname + (lastNum + 1)
    const hash = password ? hashPassword(password) : 'plain:Brooklyn2024!'
    const { error } = await supabase.from('brokers').insert({ broker_code, username: uname, password: hash, company_name, contact_name: contact_name||'', email: email||'', phone: phone||'', notes: notes||'' })
    if (error) return err(res, error.message, 500)
    return ok(res, { ok: true, broker_code, username: uname, company_name, default_pass: password || 'Brooklyn2024!' }, 201)
  }

  if (req.method === 'PUT') {
    const session = await requireAny(req, res)
    if (!session) return
    const isAdmin = session.role === 'admin'
    const broker_code = body.broker_code
    let broker
    if (isAdmin) {
      if (!broker_code) return err(res, 'broker_code required')
      const { data } = await supabase.from('brokers').select('*').eq('broker_code', broker_code).single()
      broker = data
    } else {
      const { data } = await supabase.from('brokers').select('*').eq('id', session.user_id).single()
      broker = data
    }
    if (!broker) return err(res, 'Broker not found', 404)

    if (body.new_password) {
      if (!isAdmin) {
        if (!checkPassword(body.current_password || '', broker.password)) return err(res, 'Current password incorrect', 401)
      }
      if (body.new_password.length < 6) return err(res, 'Password must be at least 6 chars')
      await supabase.from('brokers').update({ password: hashPassword(body.new_password) }).eq('id', broker.id)
      return ok(res, { ok: true, message: 'Password updated' })
    }

    if (body.active !== undefined && isAdmin) {
      await supabase.from('brokers').update({ active: body.active }).eq('id', broker.id)
      return ok(res, { ok: true })
    }

    const allowed = isAdmin ? ['company_name','contact_name','email','phone','username','notes'] : ['contact_name','email','phone']
    const updates = {}
    for (const f of allowed) if (body[f] !== undefined) updates[f] = body[f]
    if (Object.keys(updates).length) await supabase.from('brokers').update(updates).eq('id', broker.id)
    return ok(res, { ok: true, message: 'Profile updated' })
  }

  return err(res, 'Method not allowed', 405)
}
