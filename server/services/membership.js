import { supabaseAdmin } from '../db/client.js'
import { sendEmail } from './mailer.js'

export const escapeHtml = str => {
  if (typeof str !== 'string') return ''
  return str.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))
}

export class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status }
}

/** The club's plain email shell, shared by the membership emails. */
export function clubEmail(heading, paragraphs) {
  return `
    <div style="font-family: Arial, sans-serif; max-width: 560px; margin: 0 auto;">
      <div style="background: #0F172A; padding: 24px; text-align: center;">
        <h1 style="color: #fff; margin: 0; font-size: 22px;">AFAQ Scientific Club</h1>
      </div>
      <div style="padding: 32px 24px; background: #f8fafc;">
        <h2 style="margin: 0 0 8px;">${heading}</h2>
        ${paragraphs.map(p => `<p style="color: #475569; font-size: 15px; line-height: 1.6;">${p}</p>`).join('')}
        <p style="color: #94a3b8; font-size: 13px; margin-top: 24px;">
          Best regards,<br/>AFAQ Scientific Club Team
        </p>
      </div>
    </div>
  `
}

/** "We got your application" email, sent on submit and on demand from the review queue. */
export function sendApplicationReceived({ email, full_name }) {
  return sendEmail({
    to: email,
    subject: 'Membership Application Received — AFAQ Scientific Club',
    html: clubEmail(`Thank You, ${escapeHtml(full_name)}!`, [
      'We have received your membership application. Our team will review it and get back to you soon.',
    ]),
  })
}

/**
 * Turn a pending application into a member and send the welcome email.
 * Shared by the Applications screen and the review queue, so both paths
 * create exactly one member per application.
 */
export async function approveApplication(id, { decidedBy = null } = {}) {
  const { data: application, error: fetchErr } = await supabaseAdmin
    .from('membership_applications').select('*').eq('id', id).maybeSingle()
  if (fetchErr) throw fetchErr
  if (!application) throw new HttpError(404, 'Application not found')
  if (application.status === 'approved') throw new HttpError(409, 'This application was already approved.')

  const { data: member, error: insertErr } = await supabaseAdmin
    .from('members')
    .insert({
      application_id: application.id,
      full_name: application.full_name,
      email: application.email,
      phone: application.phone,
      student_id: application.student_id,
      department: application.department,
      study_year: application.study_year,
      skills: application.skills,
      interests: application.interests,
    })
    .select('*')
    .single()
  if (insertErr) throw insertErr

  const now = new Date().toISOString()
  const { error: statusErr } = await supabaseAdmin
    .from('membership_applications')
    .update({ status: 'approved', decided_at: now, decided_by: decidedBy, last_activity_at: now })
    .eq('id', id)
  if (statusErr) throw statusErr

  const safeName = escapeHtml(application.full_name)
  await sendEmail({
    to: application.email,
    subject: 'Membership Approved — Welcome to AFAQ!',
    html: clubEmail(`Welcome to AFAQ, ${safeName}!`, [
      'Your membership application has been <strong>approved</strong>! We are thrilled to have you on board.',
      'Stay tuned for upcoming events, workshops, and projects. You are now part of a community where technology meets innovation.',
    ]),
  }).catch(err => console.error('Welcome email error:', err.message))

  return { application, member }
}
