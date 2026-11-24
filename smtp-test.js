import nodemailer from 'nodemailer'

export default async function handler(req, res) {
  const t = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || '465'),
    secure: true,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    connectionTimeout: 8000,
    greetingTimeout: 8000,
    socketTimeout: 8000
  })
  try {
    await t.verify()
    res.status(200).json({ ok: true, host: process.env.SMTP_HOST, user: process.env.SMTP_USER })
  } catch (e) {
    res.status(200).json({ ok: false, code: e.code, command: e.command, message: e.message })
  }
}
