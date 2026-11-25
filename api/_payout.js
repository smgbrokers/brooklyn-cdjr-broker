// Money and statistics for closed deals
const APPS = ['Application', 'Approved', 'Docs Sent', 'Ready to Pick Up', 'Completed']
const APPROVED = ['Approved', 'Docs Sent', 'Ready to Pick Up', 'Completed']
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

// Dollars typed by a person ($1,234.50 or 1234.5) to whole cents. Returns null if it is not a valid amount.
export function toCents(v) {
  if (v === null || v === undefined || v === '') return null
  const raw = typeof v === 'number' ? v : Number(String(v).split('').filter(c => c !== '$' && c !== ',' && c !== ' ').join(''))
  if (!Number.isFinite(raw) || raw < 0 || raw > 100000000) return null
  return Math.round(raw * 100)
}

// Total bird dog and short COD in, check amount out. The check amount is always worked out here, never trusted from a screen.
export function computePayout(input) {
  const bd = toCents(input.bird_dog_total)
  const rawShort = input.short_cod === undefined || input.short_cod === null || String(input.short_cod).trim() === '' ? 0 : input.short_cod
  const sc = toCents(rawShort)
  if (bd === null) return { error: 'Enter the total bird dog amount (0 or more).' }
  if (sc === null) return { error: 'Enter the short COD amount (0 or more), or 0 if there is none.' }
  if (sc > bd) return { error: 'Short COD cannot be more than the total bird dog.' }
  return { fields: { bird_dog_total: bd / 100, short_cod: sc / 100, check_amount: (bd - sc) / 100 } }
}

const num = v => (v === null || v === undefined || v === '' ? null : Number(v))
const cents = v => Math.round((Number(v) || 0) * 100)
const monthKey = d => {
  if (!d) return null
  const s = typeof d === 'string' ? d.slice(0, 7) : new Date(d).toISOString().slice(0, 7)
  return s.length === 7 && s[4] === '-' ? s : null
}

function lastMonths(now, n) {
  const out = []
  const y = now.getUTCFullYear()
  const m = now.getUTCMonth()
  for (let i = n - 1; i >= 0; i--) {
    let mm = m - i
    let yy = y
    while (mm < 0) { mm += 12; yy -= 1 }
    out.push({ key: yy + '-' + String(mm + 1).padStart(2, '0'), label: MONTHS[mm] + (mm === 0 || i === n - 1 ? " '" + String(yy).slice(2) : ''), requests: 0, completed: 0, earned_c: 0, paid_c: 0 })
  }
  return out
}

// Everything the Stats screens show, worked out from a list of deals
export function buildStats(rows, opts = {}) {
  const now = opts.now || new Date()
  const list = rows || []
  const names = opts.brokerNames || {}
  const status_counts = {}
  const totals = { requests: list.length, applications: 0, approved: 0, completed: 0, declined: 0, dead: 0 }
  const months = lastMonths(now, 12)
  const mIdx = {}
  months.forEach((m, i) => { mIdx[m.key] = i })
  const money = { bird_c: 0, short_c: 0, check_c: 0, paid_c: 0, completed_with_payout: 0, paid_count: 0, outstanding_count: 0 }
  const payouts = []
  let awaiting = 0
  const group = {}
  const keyOf = r => (opts.byBroker ? 'b' + r.broker_id : 'u' + (r.broker_user_id || 0))
  const nameOf = r => (opts.byBroker ? names[r.broker_id] || 'Broker ' + r.broker_id : r.broker_user_name || 'Owner')
  for (const r of list) {
    status_counts[r.status] = (status_counts[r.status] || 0) + 1
    if (APPS.includes(r.status)) totals.applications++
    if (APPROVED.includes(r.status)) totals.approved++
    if (r.status === 'Completed') totals.completed++
    if (r.status === 'Declined') totals.declined++
    if (r.status === 'Dead') totals.dead++
    const rm = mIdx[monthKey(r.created_at)]
    if (rm !== undefined) months[rm].requests++
    const gk = keyOf(r)
    const g = group[gk] || (group[gk] = { name: nameOf(r), broker_id: r.broker_id, deals: 0, completed: 0, earned_c: 0, paid_c: 0 })
    g.deals++
    if (r.status !== 'Completed') continue
    g.completed++
    const cm = mIdx[monthKey(r.sold_date)]
    if (cm !== undefined) months[cm].completed++
    if (num(r.check_amount) === null) { awaiting++; continue }
    const bd = cents(r.bird_dog_total)
    const sc = cents(r.short_cod)
    const ck = cents(r.check_amount)
    const paid = !!r.check_paid_at
    money.bird_c += bd
    money.short_c += sc
    money.check_c += ck
    money.completed_with_payout++
    g.earned_c += ck
    if (cm !== undefined) months[cm].earned_c += ck
    if (paid) {
      money.paid_c += ck
      money.paid_count++
      g.paid_c += ck
      const pm = mIdx[monthKey(r.check_paid_at)]
      if (pm !== undefined) months[pm].paid_c += ck
    } else {
      money.outstanding_count++
    }
    payouts.push({ deal_number: r.deal_number, customer_name: r.customer_name, vehicle_desc: r.vehicle_desc || null, stock_num: r.stock_num || null, sold_date: r.sold_date || null, broker_id: r.broker_id, broker_name: names[r.broker_id] || null, person: r.broker_user_name || 'Owner', bird_dog_total: bd / 100, short_cod: sc / 100, check_amount: ck / 100, paid, check_paid_at: r.check_paid_at || null, check_ref: r.check_ref || null })
  }
  payouts.sort((a, b) => String(b.sold_date || '').localeCompare(String(a.sold_date || '')) || String(b.deal_number).localeCompare(String(a.deal_number)))
  const groups = Object.values(group).map(g => ({ name: g.name, broker_id: g.broker_id, deals: g.deals, completed: g.completed, earned: g.earned_c / 100, paid: g.paid_c / 100, outstanding: (g.earned_c - g.paid_c) / 100 })).sort((a, b) => b.earned - a.earned || b.deals - a.deals)
  const out = {
    totals,
    status_counts,
    money: { bird_dog_total: money.bird_c / 100, short_cod_total: money.short_c / 100, check_total: money.check_c / 100, paid_total: money.paid_c / 100, outstanding_total: (money.check_c - money.paid_c) / 100, completed_with_payout: money.completed_with_payout, paid_count: money.paid_count, outstanding_count: money.outstanding_count },
    months: months.map(m => ({ key: m.key, label: m.label, requests: m.requests, completed: m.completed, earned: m.earned_c / 100, paid: m.paid_c / 100 })),
    payouts,
    awaiting_payout_entry: awaiting,
  }
  if (opts.byBroker) out.by_broker = groups
  else if (opts.byPerson) out.by_person = groups
  return out
}
