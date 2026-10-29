import supabase from './_db.js'
import crypto from 'crypto'
import nodemailer from 'nodemailer'

export function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
}

export function ok(res, data, status = 200) {
  res.status(status).json(data)
}

export function err(res, msg, status = 400) {
  res.status(status).json({ error: msg })
}

export function generateToken() {
  return crypto.randomBytes(32).toString('hex')
}

export function getToken(req) {
  const h = req.headers.authorization || ''
  return h.startsWith('Bearer ') ? h.slice(7).trim() : null
}

export async function requireAdmin(req, res) {
  const token = getToken(req)
  if (!token) { err(res, 'Unauthorized', 401); return null }
  const { data } = await supabase
    .from('sessions')
    .select('*')
    .eq('token', token)
    .eq('role', 'admin')
    .gt('expires_at', new Date().toISOString())
    .single()
  if (!data) { err(res, 'Session expired', 401); return null }
  return data
}

export async function requireBroker(req, res) {
  const token = getToken(req)
  if (!token) { err(res, 'Unauthorized', 401); return null }
  const { data: session } = await supabase
    .from('sessions')
    .select('*')
    .eq('token', token)
    .eq('role', 'broker')
    .gt('expires_at', new Date().toISOString())
    .single()
  if (!session) { err(res, 'Session expired', 401); return null }
  const { data: broker } = await supabase
    .from('brokers')
    .select('broker_code, company_name, contact_name, email')
    .eq('id', session.user_id)
    .single()
  return { ...session, brokers: broker || {} }
}

export async function requireAny(req, res) {
  const token = getToken(req)
  if (!token) { err(res, 'Unauthorized', 401); return null }
  const { data } = await supabase
    .from('sessions')
    .select('*')
    .eq('token', token)
    .gt('expires_at', new Date().toISOString())
    .single()
  if (!data) { err(res, 'Session expired', 401); return null }
  return data
}

export function checkPassword(input, stored) {
  if (stored.startsWith('plain:')) return input === stored.slice(6)
  const [salt, hash] = stored.split(':')
  const check = crypto.createHmac('sha256', salt).update(input).digest('hex')
  return check === hash
}

export function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex')
  const hash = crypto.createHmac('sha256', salt).update(password).digest('hex')
  return `${salt}:${hash}`
}

export async function sendEmail(to, subject, body) {
  if (!to) return
  try {
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '465'),
      secure: true,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
    })
    await transporter.sendMail({
      from: `"${process.env.SMTP_FROM_NAME || 'Brooklyn CDJR'}" <${process.env.SMTP_USER}>`,
      to, subject, text: body
    })
  } catch(e) { console.error('Email error:', e.message) }
}

export async function sendEmailWithAttachment(to, subject, body, attachmentHtml, filename) {
  if (!to) return
  try {
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '465'),
      secure: true,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
    })
    await transporter.sendMail({
      from: `"${process.env.SMTP_FROM_NAME || 'Brooklyn CDJR'}" <${process.env.SMTP_USER}>`,
      to, subject, text: body,
      attachments: [{ filename, content: attachmentHtml, contentType: 'text/html' }]
    })
  } catch(e) { console.error('Email error:', e.message) }
}

export async function notifyAdminsNewRequest(deal, broker) {
  const { data: admins } = await supabase
    .from('admins')
    .select('name, email')
    .eq('notify_email', true)
    .not('email', 'is', null)
  if (!admins) return
  const subject = `New Vehicle Request — ${deal.deal_number}`
  const body = `A new vehicle request has been submitted.\n\nDeal #: ${deal.deal_number}\nBroker: ${broker.company_name} (${broker.broker_code})\nCustomer: ${deal.customer_name}\nVehicle: ${deal.vehicle_desc}\nStock #: ${deal.stock_num}\nMSRP: ${deal.msrp}\nSubmitted: ${new Date().toLocaleString()}\n\nLog in: https://brooklyn-cdjr-broker.vercel.app\n\n— Brooklyn CDJR Portal`
  for (const admin of admins) await sendEmail(admin.email, subject, body)
}

export async function notifyBrokerRequestReceived(deal, broker) {
  if (!broker.email) return
  const subject = `We received your request — Deal #${deal.deal_number}`
  const body = `Hi ${broker.contact_name},\n\nThank you for submitting a vehicle request.\n\nDeal #: ${deal.deal_number}\nCustomer: ${deal.customer_name}\nVehicle: ${deal.vehicle_desc}\nStock #: ${deal.stock_num}\nMSRP: ${deal.msrp}\n\nA team member will confirm vehicle availability shortly.\n\nTrack your deal: https://brooklyn-cdjr-broker.vercel.app\n\n— Brooklyn CDJR Team`
  await sendEmail(broker.email, subject, body)
}

export async function notifyBrokerVehicleAvailable(deal, broker) {
  if (!broker.email) return
  const subject = `Vehicle Available — Please Submit Your Credit Application`
  const body = `Hi ${broker.contact_name},\n\nGreat news! The vehicle you requested is confirmed available.\n\nDeal #: ${deal.deal_number}\nCustomer: ${deal.customer_name}\nVehicle: ${deal.vehicle_desc}\nStock #: ${deal.stock_num}\nMSRP: ${deal.msrp}\n\nNEXT STEP: Log in and submit the credit application.\n\nhttps://brooklyn-cdjr-broker.vercel.app\n\n— Brooklyn CDJR Team`
  await sendEmail(broker.email, subject, body)
}

export function generateCreditAppHtml(app, deal, broker) {
  const primary = app.primary || app;
  const cosigner = app.cosigner || null;
  const business = app.business || null;
  const appType = app.app_type || 'individual';
  const isBiz = appType === 'business' || appType === 'business_cosigner';
  const hasCosigner = appType === 'individual_cosigner' || appType === 'business_cosigner';
  const showPrevAddr = (a) => {
    const y = parseInt(a.housing_years) || 0;
    const m = parseInt(a.housing_months) || 0;
    return (y * 12 + m) < 24;
  };

  const appTypeLabel = {
    individual: 'Individual',
    individual_cosigner: 'Individual + Co-Signer',
    business: 'Business',
    business_cosigner: 'Business + Co-Signer'
  }[appType] || 'Individual';

  const field = (label, val) => val ? `<div class="field"><label>${label}</label><span>${val}</span></div>` : '';
  const fieldFull = (label, val) => val ? `<div class="field full"><label>${label}</label><span>${val}</span></div>` : '';

  const applicantHtml = (a, title) => {
    if (!a) return '';
    const showPrev = showPrevAddr(a);
    return `
    ${title ? `<div class="applicant-label">${title}</div>` : ''}
    <div class="section"><div class="st">Personal Information</div><div class="grid">
      ${field('First Name', a.first_name)}
      ${field('Last Name', a.last_name)}
      ${field('Date of Birth', a.dob)}
      ${field('SSN', a.ssn ? 'XXX-XX-' + String(a.ssn).slice(-4) : '')}
      ${field('Cell Phone', a.cell_phone)}
      ${field('Work Phone', a.work_phone)}
      ${fieldFull('Email', a.email)}
    </div></div>
    <div class="section"><div class="st">Housing</div><div class="grid">
      ${fieldFull('Current Address', [a.address, a.city, a.state, a.zip].filter(Boolean).join(', '))}
      ${field('Housing Status', a.housing_status)}
      ${field('Monthly Payment', a.housing_monthly_pmt)}
      ${field('Time at Address', (a.housing_years || 0) + ' yrs ' + (a.housing_months || 0) + ' mos')}
      ${showPrev ? fieldFull('Previous Address', [a.prev_address, a.prev_city, a.prev_state, a.prev_zip].filter(Boolean).join(', ')) : ''}
      ${showPrev ? field('Time at Prev Address', (a.prev_years || 0) + ' yrs ' + (a.prev_months || 0) + ' mos') : ''}
    </div></div>
    <div class="section"><div class="st">Employment</div><div class="grid">
      ${field('Employer', a.employer)}
      ${field('Job Title', a.job_title)}
      ${field('Time on Job', (a.years_on_job || 0) + ' yrs ' + (a.months_on_job || 0) + ' mos')}
      ${field('Monthly Income', a.monthly_income)}
      ${field('Employment Type', a.employment_type)}
    </div></div>`;
  };

  const bizHtml = business ? `
    <div class="section"><div class="st">Business Information</div><div class="grid">
      ${fieldFull('Business Name', business.business_name)}
      ${field('Business Type', business.business_type)}
      ${field('EIN / Tax ID', business.ein)}
      ${field('Business Phone', business.business_phone)}
      ${field('Years in Business', business.years_in_business)}
      ${field('Annual Revenue', business.annual_revenue)}
      ${fieldFull('Business Address', [business.business_address, business.business_city, business.business_state, business.business_zip].filter(Boolean).join(', '))}
    </div></div>` : '';

  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>
    @media print{.no-print{display:none!important}}
    @page{margin:0.75in;size:letter}
    body{font-family:Arial,sans-serif;font-size:11px;color:#1a1a1a;margin:0;padding:20px}
    .header{background:#0F172A;color:#fff;padding:16px 20px;border-radius:6px;margin-bottom:20px}
    .header h1{margin:0;font-size:18px;letter-spacing:1px}
    .header p{margin:4px 0 0;font-size:11px;opacity:.8}
    .app-type-badge{display:inline-block;background:#1D4ED8;color:#fff;padding:3px 12px;border-radius:20px;font-size:10px;font-weight:700;letter-spacing:.05em;margin-top:6px}
    .applicant-label{background:#DBEAFE;color:#1E40AF;font-weight:700;font-size:12px;padding:8px 14px;border-radius:6px;margin:16px 0 8px}
    .section{margin-bottom:12px;border:1px solid #e2e8f0;border-radius:6px;overflow:hidden}
    .st{background:#f8fafc;padding:8px 14px;font-weight:bold;font-size:11px;text-transform:uppercase;letter-spacing:.05em;color:#374151;border-bottom:1px solid #e2e8f0}
    .grid{display:grid;grid-template-columns:1fr 1fr}
    .field{padding:8px 14px;border-bottom:1px solid #f1f5f9}
    .field:nth-child(odd){border-right:1px solid #f1f5f9}
    .field label{display:block;font-size:9px;text-transform:uppercase;color:#9ca3af;margin-bottom:2px}
    .field span{font-weight:600;color:#111827}
    .full{grid-column:1/-1}
    .deal-box{background:#f0f9ff;border:1px solid #bae6fd;border-radius:6px;padding:12px 16px;margin-bottom:16px;display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px}
    .deal-box .item label{display:block;font-size:9px;text-transform:uppercase;color:#0369a1;margin-bottom:2px}
    .deal-box .item span{font-weight:700;color:#0c4a6e}
    .cosigner-block{border:2px solid #E5E7EB;border-radius:8px;padding:12px;margin-top:16px}
    .footer{margin-top:20px;padding-top:12px;border-top:1px solid #e2e8f0;font-size:9px;color:#9ca3af;text-align:center}
    .print-btn{position:fixed;top:16px;right:16px;display:flex;gap:10px;z-index:999}
    .btn{border:none;padding:10px 20px;border-radius:8px;font-size:14px;font-weight:700;cursor:pointer}
  </style></head><body>
  <div class="no-print print-btn">
    <button class="btn" style="background:#1D4ED8;color:#fff" onclick="window.print()">🖨️ Print / Save as PDF</button>
    <button class="btn" style="background:#6B7280;color:#fff" onclick="window.close()">✕ Close</button>
  </div>
  <div class="header">
    <h1>BROOKLYN CDJR — CREDIT APPLICATION</h1>
    <p>Deal #${deal.deal_number} &nbsp;|&nbsp; Submitted: ${new Date().toLocaleString()}</p>
    <div class="app-type-badge">${appTypeLabel}</div>
  </div>
  <div class="deal-box">
    <div class="item"><label>Broker</label><span>${broker.company_name || ''}</span></div>
    <div class="item"><label>Vehicle</label><span>${deal.vehicle_desc || ''}</span></div>
    <div class="item"><label>Stock # / MSRP</label><span>${deal.stock_num || ''} / ${deal.msrp || ''}</span></div>
  </div>
  ${bizHtml}
  ${applicantHtml(primary, hasCosigner ? (isBiz ? 'Authorized Signer / Primary' : 'Primary Applicant') : null)}
  ${hasCosigner ? '<div class="cosigner-block">' + applicantHtml(cosigner, 'Co-Signer') + '</div>' : ''}
  ${app.notes ? `<div class="section"><div class="st">Notes</div><div class="grid"><div class="field full"><span>${app.notes}</span></div></div></div>` : ''}
  <div class="footer">Brooklyn CDJR Broker Portal &nbsp;|&nbsp; Generated ${new Date().toISOString()}</div>
  </body></html>`;
}

