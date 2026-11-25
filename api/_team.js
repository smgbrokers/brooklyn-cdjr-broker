import supabase from './_db.js'
import { ok, err, requireAny, hashPassword, checkPassword, sendEmail } from './_helpers.js'

const SITE = 'https://brooklyn-cdjr-broker.vercel.app'
export const TEAM_UPDATE_MSG = 'Team accounts need a one-time database update first.'
const BS = String.fromCharCode(92)

// Make a value safe to use with ilike (so _ and % are matched literally)
export function escLike(s) {
  return Array.from(String(s === null || s === undefined ? '' : s)).map(c => (c === BS || c === '%' || c === '_' ? BS + c : c)).join('')
}

export function teamFriendly(error) {
  const m = String((error && error.message) || '')
  return /broker_users|broker_user_id|broker_user_name|broker_user_role/.test(m) ? TEAM_UPDATE_MSG : m
}

// Can this broker-side login see this deal? The owner and company admins see the whole company; salespeople only their own.
export function brokerCanSee(session, deal) {
  if (!session || !deal) return false
  if (String(deal.broker_id) !== String(session.user_id)) return false
  if (!session.broker_user_id) return true
  if (session.broker_user_role === 'admin') return true
  return String(deal.broker_user_id || '') === String(session.broker_user_id)
}

// The deals a broker-side login may see, optionally narrowed by person (me | owner | a team member id)
export function filterBrokerDeals(session, data, ownerQ) {
  const q = String(ownerQ || 'all')
  if (session.broker_user_id && session.broker_user_role !== 'admin') return data.filter(d => String(d.broker_user_id || '') === String(session.broker_user_id))
  if (q === 'me') return data.filter(d => (session.broker_user_id ? String(d.broker_user_id || '') === String(session.broker_user_id) : !d.broker_user_id))
  if (q === 'owner') return data.filter(d => !d.broker_user_id)
  if (/^[0-9]+$/.test(q)) return data.filter(d => String(d.broker_user_id || '') === q)
  return data
}

// Who should hear about a deal by email: the company address plus the salesperson who created the deal
export async function brokerRecipients(broker, deal) {
  const list = []
  const add = e => {
    const v = String(e || '').trim()
    if (v && !list.some(x => x.toLowerCase() === v.toLowerCase())) list.push(v)
  }
  add(broker && broker.email)
  if (deal && deal.broker_user_id) {
    try {
      const { data: u } = await supabase.from('broker_users').select('email,suspended').eq('id', deal.broker_user_id).single()
      if (u && !u.suspended) add(u.email)
    } catch (e) {
      // the company address still gets it
    }
  }
  return list.join(', ')
}

const looksLikeEmail = e => e.includes('@') && e.indexOf('@') > 0 && e.indexOf('.', e.indexOf('@')) > e.indexOf('@') + 1 && !e.includes(' ')

async function usernameTaken(username, exceptUserId) {
  const like = escLike(username)
  const { data: b1 } = await supabase.from('brokers').select('id').ilike('username', like).limit(1)
  if (b1 && b1.length) return true
  const { data: b2 } = await supabase.from('brokers').select('id').ilike('broker_code', like).limit(1)
  if (b2 && b2.length) return true
  const { data: u } = await supabase.from('broker_users').select('id').ilike('username', like).limit(1)
  return !!(u && u.length && String(u[0].id) !== String(exceptUserId || ''))
}

export async function emailTaken(email, exceptUserId) {
  const like = escLike(email)
  const { data: b } = await supabase.from('brokers').select('id').ilike('email', like).limit(1)
  if (b && b.length) return true
  const { data: a } = await supabase.from('admins').select('id').ilike('email', like).limit(1)
  if (a && a.length) return true
  const { data: u } = await supabase.from('broker_users').select('id').ilike('email', like).limit(1)
  return !!(u && u.length && String(u[0].id) !== String(exceptUserId || ''))
}

// A team member editing their own details or password (My Account)
export async function updateOwnTeamProfile(session, body, res) {
  const { data: bu } = await supabase.from('broker_users').select('*').eq('id', session.broker_user_id).single()
  if (!bu || bu.suspended) return err(res, 'Session expired', 401)
  if (body.new_password) {
    if (!checkPassword(body.current_password || '', bu.password)) return err(res, 'Current password incorrect', 401)
    if (String(body.new_password).length < 8) return err(res, 'Password must be at least 8 characters')
    await supabase.from('broker_users').update({ password: hashPassword(String(body.new_password)) }).eq('id', bu.id)
    return ok(res, { ok: true, message: 'Password updated' })
  }
  const upd = {}
  if (body.contact_name !== undefined) upd.name = String(body.contact_name).trim().slice(0, 80) || bu.name
  if (body.phone !== undefined) upd.phone = String(body.phone).trim().slice(0, 40)
  if (body.email !== undefined) {
    const e = String(body.email).trim().toLowerCase()
    if (e && !looksLikeEmail(e)) return err(res, 'Enter a valid email address')
    if (e && await emailTaken(e, bu.id)) return err(res, 'That email is already used by another account')
    upd.email = e || null
  }
  if (Object.keys(upd).length) {
    await supabase.from('broker_users').update(upd).eq('id', bu.id)
    if (upd.name) await supabase.from('deals').update({ broker_user_name: upd.name }).eq('broker_user_id', bu.id)
  }
  return ok(res, { ok: true, message: 'Profile updated' })
}

// Team management for the broker owner and company admins
export async function handleTeam(req, res, action) {
  const session = await requireAny(req, res)
  if (!session) return
  const staff = session.role === 'admin'
  if (!staff && session.role !== 'broker') return err(res, 'Team management is for broker accounts.', 403)
  const body = req.body || {}

  // Brooklyn CDJR staff manage any broker's team; brokers manage only their own
  const companyId = staff ? (req.query.broker_id || body.broker_id) : session.user_id
  if (!companyId) return err(res, 'broker_id required')

  let actor = staff ? { role: 'staff', id: null } : { role: 'owner', id: null }
  if (!staff && session.broker_user_id) {
    const { data: me } = await supabase.from('broker_users').select('*').eq('id', session.broker_user_id).single()
    if (!me || me.suspended) return err(res, 'Session expired', 401)
    actor = { role: me.role, id: me.id }
  }
  if (actor.role === 'sales') return err(res, 'Only company admins can manage the team.', 403)
  const isOwner = actor.role === 'owner' || actor.role === 'staff'
  const { data: company } = await supabase.from('brokers').select('*').eq('id', companyId).single()
  if (!company) return err(res, 'Company not found', 404)

  const loadTarget = async id => {
    const { data } = await supabase.from('broker_users').select('*').eq('id', id).single()
    return data && String(data.broker_id) === String(companyId) ? data : null
  }
  // Admins manage sales users; only the owner manages admins. Nobody manages themselves here.
  const mayManage = t => String(t.id) !== String(actor.id) && (isOwner || t.role === 'sales')

  if (action === 'team') {
    if (req.method !== 'GET') return err(res, 'Method not allowed', 405)
    const { data: users, error } = await supabase.from('broker_users').select('*').eq('broker_id', companyId).order('name', { ascending: true })
    if (error) return err(res, teamFriendly(error), 500)
    const { data: dealRows } = await supabase.from('deals').select('id,broker_user_id').eq('broker_id', companyId)
    const counts = {}
    let ownerCount = 0
    for (const d of dealRows || []) {
      if (d.broker_user_id) counts[d.broker_user_id] = (counts[d.broker_user_id] || 0) + 1
      else ownerCount++
    }
    return ok(res, {
      me: { role: actor.role, id: actor.id },
      can_add_admin: isOwner,
      owner: { name: company.contact_name || company.company_name, email: company.email || null, deal_count: ownerCount },
      users: (users || []).map(u => ({ id: u.id, name: u.name, username: u.username, email: u.email || null, phone: u.phone || null, role: u.role, suspended: !!u.suspended, created_at: u.created_at, last_login_at: u.last_login_at || null, deal_count: counts[u.id] || 0, can_manage: mayManage(u) })),
    })
  }

  if (req.method !== 'POST') return err(res, 'Method not allowed', 405)

  if (action === 'team_add') {
    const name = String(body.name || '').trim().slice(0, 80)
    const username = String(body.username || '').trim().toLowerCase()
    const email = String(body.email || '').trim().toLowerCase()
    const phone = String(body.phone || '').trim().slice(0, 40)
    const role = body.role === 'admin' ? 'admin' : 'sales'
    const password = String(body.password || '')
    if (!name) return err(res, 'Enter the person name')
    if (!/^[a-z0-9._-]{3,30}$/.test(username)) return err(res, 'Username must be 3 to 30 letters, numbers, dots, dashes or underscores')
    if (/^b[0-9]+$/.test(username)) return err(res, 'That username is reserved. Please choose another.')
    if (email && !looksLikeEmail(email)) return err(res, 'Enter a valid email address')
    if (password.length < 8) return err(res, 'Password must be at least 8 characters')
    if (role === 'admin' && !isOwner) return err(res, 'Only the account owner can add company admins.', 403)
    if (await usernameTaken(username)) return err(res, 'That username is already taken')
    if (email && await emailTaken(email)) return err(res, 'That email is already used by another account')
    const { data: created, error } = await supabase.from('broker_users').insert({ broker_id: companyId, name, username, email: email || null, phone: phone || null, password: hashPassword(password), role, suspended: false, created_by: staff ? 'Brooklyn CDJR staff' : isOwner ? (company.contact_name || company.company_name) : 'Company admin' }).select('*').single()
    if (error) return err(res, teamFriendly(error), 500)
    if (email) {
      await sendEmail(email, 'You have been added to ' + company.company_name + ' on the Brooklyn CDJR broker portal', 'Hi ' + name + ',\n\nYou now have your own login for the Brooklyn CDJR broker portal (' + (role === 'admin' ? 'Admin' : 'Sales') + ').\n\nSign in here: ' + SITE + '\nUsername: ' + username + '\n\nYour company will give you your password. If you forget it, use Forgot password on the sign in page.\n\n- Brooklyn CDJR Team')
    }
    return ok(res, { ok: true, user: { id: created ? created.id : null, name, username, email: email || null, role } }, 201)
  }

  if (action === 'team_update') {
    const target = await loadTarget(body.id)
    if (!target) return err(res, 'Team member not found', 404)
    if (String(target.id) === String(actor.id)) return err(res, 'Use My Account to change your own details.')
    if (!mayManage(target)) return err(res, 'Only the account owner can change company admins.', 403)
    const upd = {}
    let endSessions = false
    if (body.name !== undefined) {
      const n = String(body.name).trim().slice(0, 80)
      if (!n) return err(res, 'Enter the person name')
      upd.name = n
    }
    if (body.phone !== undefined) upd.phone = String(body.phone).trim().slice(0, 40) || null
    if (body.email !== undefined) {
      const e = String(body.email).trim().toLowerCase()
      if (e && !looksLikeEmail(e)) return err(res, 'Enter a valid email address')
      if (e && await emailTaken(e, target.id)) return err(res, 'That email is already used by another account')
      upd.email = e || null
    }
    if (body.role !== undefined) {
      if (!isOwner) return err(res, 'Only the account owner can change roles.', 403)
      if (!['sales', 'admin'].includes(body.role)) return err(res, 'Role must be Sales or Admin')
      upd.role = body.role
      endSessions = true
    }
    if (body.suspended !== undefined) {
      upd.suspended = !!body.suspended
      if (upd.suspended) endSessions = true
    }
    if (body.new_password !== undefined) {
      if (String(body.new_password).length < 8) return err(res, 'Password must be at least 8 characters')
      upd.password = hashPassword(String(body.new_password))
      endSessions = true
    }
    if (!Object.keys(upd).length) return err(res, 'Nothing to change')
    const { error } = await supabase.from('broker_users').update(upd).eq('id', target.id)
    if (error) return err(res, teamFriendly(error), 500)
    if (upd.name) await supabase.from('deals').update({ broker_user_name: upd.name }).eq('broker_user_id', target.id)
    // Signed-in sessions end right away, so a suspension or a new role or password takes effect immediately
    if (endSessions) await supabase.from('sessions').delete().eq('broker_user_id', target.id)
    return ok(res, { ok: true })
  }

  if (action === 'team_remove') {
    const target = await loadTarget(body.id)
    if (!target) return err(res, 'Team member not found', 404)
    if (String(target.id) === String(actor.id)) return err(res, 'You cannot remove your own login.')
    if (!mayManage(target)) return err(res, 'Only the account owner can remove company admins.', 403)
    await supabase.from('sessions').delete().eq('broker_user_id', target.id)
    const { error } = await supabase.from('broker_users').delete().eq('id', target.id)
    if (error) return err(res, teamFriendly(error), 500)
    return ok(res, { ok: true })
  }

  return err(res, 'Unknown team action', 404)
}
