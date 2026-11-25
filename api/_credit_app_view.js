import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'

export const TYPE_LABELS = {
  individual: 'Individual',
  individual_cosigner: 'Individual + Co-Signer',
  business: 'Business',
  business_cosigner: 'Business + Co-Signer',
}

const parse = v => {
  if (!v) return null
  if (typeof v === 'object') return v
  try { return JSON.parse(v) } catch (e) { return null }
}
const join = parts => parts.filter(Boolean).join(', ')
const time = (y, m) => (y || 0) + ' yrs ' + (m || 0) + ' mos'
const mask = ssn => (ssn ? 'XXX-XX-' + String(ssn).slice(-4) : '')
const clean = s => String(s === null || s === undefined ? '' : s).replace(/[\r\t]/g, ' ').replace(/[^\x0A\x20-\x7E\xA0-\xFF\u2018\u2019\u201C\u201D\u2013\u2014\u2022\u2026]/gu, '?')

// One applicant (primary or co-signer) as display sections: [{ title, fields: [[label, value, fullWidth?]] }]
function applicantSections(a, who) {
  if (!a) return []
  const keep = list => list.filter(f => f[1])
  const months = (parseInt(a.housing_years) || 0) * 12 + (parseInt(a.housing_months) || 0)
  const showPrev = months < 24
  const prefix = who ? who + ' - ' : ''
  return [
    { title: prefix + 'Personal Information', fields: keep([
      ['First Name', a.first_name], ['Last Name', a.last_name], ['Date of Birth', a.dob], ['SSN', mask(a.ssn)],
      ['Cell Phone', a.cell_phone], ['Work Phone', a.work_phone], ['Email', a.email, true],
    ]) },
    { title: prefix + 'Housing', fields: [
      ...keep([['Current Address', join([a.address, a.city, a.state, a.zip]), true], ['Housing Status', a.housing_status], ['Monthly Payment', a.housing_monthly_pmt]]),
      ['Time at Address', time(a.housing_years, a.housing_months)],
      ...(showPrev ? keep([['Previous Address', join([a.prev_address, a.prev_city, a.prev_state, a.prev_zip]), true]]) : []),
      ...(showPrev ? [['Time at Previous Address', time(a.prev_years, a.prev_months)]] : []),
    ] },
    { title: prefix + 'Employment', fields: [
      ...keep([['Employer', a.employer], ['Job Title', a.job_title]]),
      ['Time on Job', time(a.years_on_job, a.months_on_job)],
      ...keep([['Monthly Income', a.monthly_income], ['Employment Type', a.employment_type]]),
    ] },
  ].filter(s => s.fields.length)
}

// The whole saved application (a credit_apps row) as display sections. SSNs are always masked.
export function buildSections(app) {
  const type = app.app_type || 'individual'
  const isBiz = type === 'business' || type === 'business_cosigner'
  const hasCo = type === 'individual_cosigner' || type === 'business_cosigner'
  const biz = parse(app.business_data)
  const co = parse(app.cosigner_data)
  const sections = []
  if (isBiz && biz) {
    sections.push({ title: 'Business Information', fields: [
      ['Business Name', biz.business_name, true], ['Business Type', biz.business_type], ['EIN / Tax ID', biz.ein],
      ['Business Phone', biz.business_phone], ['Years in Business', biz.years_in_business], ['Annual Revenue', biz.annual_revenue],
      ['Business Address', join([biz.business_address, biz.business_city, biz.business_state, biz.business_zip]), true],
    ].filter(f => f[1]) })
  }
  sections.push(...applicantSections(app, isBiz ? 'Authorized Signer' : (hasCo ? 'Applicant' : '')))
  if (hasCo && co) sections.push(...applicantSections(co, 'Co-Signer'))
  if (app.notes) sections.push({ title: 'Notes', fields: [['Notes', app.notes, true]] })
  return { app_type: type, app_type_label: TYPE_LABELS[type] || 'Individual', sections }
}

// A clean, text-based PDF of those sections (Helvetica only, so it works anywhere)
export async function renderPdf({ title, headerLines, sections, footer }) {
  const pdf = await PDFDocument.create()
  const font = await pdf.embedFont(StandardFonts.Helvetica)
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold)
  const W = 612
  const H = 792
  const M = 48
  const dark = rgb(0.07, 0.09, 0.15)
  const gray = rgb(0.42, 0.45, 0.5)
  let page = pdf.addPage([W, H])
  let y = H - M
  const need = h => { if (y - h < M + 24) { page = pdf.addPage([W, H]); y = H - M } }
  const wrap = (text, f, size, maxW) => {
    const out = []
    for (const para of clean(text).split('\n')) {
      let line = ''
      for (const word of para.split(/\s+/).filter(Boolean)) {
        const t = line ? line + ' ' + word : word
        if (f.widthOfTextAtSize(t, size) <= maxW) { line = t; continue }
        if (line) out.push(line)
        line = word
        while (f.widthOfTextAtSize(line, size) > maxW) {
          let cut = line.length - 1
          while (cut > 1 && f.widthOfTextAtSize(line.slice(0, cut), size) > maxW) cut--
          out.push(line.slice(0, cut))
          line = line.slice(cut)
        }
      }
      out.push(line)
    }
    return out.length ? out : ['']
  }
  page.drawText(clean(title), { x: M, y: y - 18, size: 18, font: bold, color: dark })
  y -= 32
  for (const l of headerLines || []) {
    for (const w of wrap(l, font, 10, W - 2 * M)) { page.drawText(w, { x: M, y: y - 10, size: 10, font, color: gray }); y -= 14 }
  }
  y -= 10
  const colW = (W - 2 * M - 16) / 2
  for (const sec of sections) {
    need(70)
    page.drawRectangle({ x: M, y: y - 20, width: W - 2 * M, height: 20, color: rgb(0.93, 0.95, 0.98) })
    page.drawText(clean(sec.title).toUpperCase(), { x: M + 8, y: y - 14, size: 9.5, font: bold, color: rgb(0.2, 0.25, 0.33) })
    y -= 30
    const fields = sec.fields
    let i = 0
    while (i < fields.length) {
      const f1 = fields[i]
      if (f1[2]) {
        const lines = wrap(f1[1], font, 10.5, W - 2 * M - 8)
        const h = 14 + lines.length * 13 + 6
        need(h)
        page.drawText(clean(f1[0]).toUpperCase(), { x: M + 4, y: y - 9, size: 7.5, font: bold, color: gray })
        lines.forEach((ln, k) => page.drawText(ln, { x: M + 4, y: y - 22 - k * 13, size: 10.5, font, color: dark }))
        y -= h
        i += 1
        continue
      }
      const f2 = fields[i + 1] && !fields[i + 1][2] ? fields[i + 1] : null
      const a = wrap(f1[1], font, 10.5, colW - 8)
      const b = f2 ? wrap(f2[1], font, 10.5, colW - 8) : []
      const h = 14 + Math.max(a.length, b.length) * 13 + 6
      need(h)
      page.drawText(clean(f1[0]).toUpperCase(), { x: M + 4, y: y - 9, size: 7.5, font: bold, color: gray })
      a.forEach((ln, k) => page.drawText(ln, { x: M + 4, y: y - 22 - k * 13, size: 10.5, font, color: dark }))
      if (f2) {
        page.drawText(clean(f2[0]).toUpperCase(), { x: M + 12 + colW, y: y - 9, size: 7.5, font: bold, color: gray })
        b.forEach((ln, k) => page.drawText(ln, { x: M + 12 + colW, y: y - 22 - k * 13, size: 10.5, font, color: dark }))
      }
      y -= h
      i += f2 ? 2 : 1
    }
    y -= 8
  }
  const pages = pdf.getPages()
  pages.forEach((p, idx) => p.drawText(clean(footer || '') + '   Page ' + (idx + 1) + ' of ' + pages.length, { x: M, y: 28, size: 8, font, color: gray }))
  return pdf.save()
}
