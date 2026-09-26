import nodemailer from 'nodemailer'

/** Single SMTP transport for the whole server (confirmations and bulk notifications). */
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: process.env.SMTP_PORT === '465',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
})

export const isEmailConfigured = () => !!(process.env.SMTP_USER && process.env.SMTP_PASS)

export async function sendEmail({ to, subject, html }) {
  if (!isEmailConfigured()) {
    console.log(`[EMAIL SKIPPED] No SMTP configured. Would send to ${to}: ${subject}`)
    return { ok: true, skipped: true }
  }
  await transporter.sendMail({
    from: process.env.EMAIL_FROM || '"AFAQ Scientific Club" <noreply@afaq-club.dz>',
    to,
    subject,
    html,
  })
  return { ok: true }
}
