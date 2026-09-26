/**
 * Notification email rendering, shared by the server (which sends) and the
 * admin console (which previews live while a template is edited). Pure JS
 * with no imports so Node can load it straight from src/.
 *
 * Templates hold {{variables}}. Values are always HTML-escaped; `content`
 * also keeps its line breaks. Template text itself is written by admins and
 * trusted: the structured fields support **bold** and blank-line paragraphs,
 * and `custom_html` is used as-is.
 */

export const CLUB_NAME = 'AFAQ Scientific Club'

export const TEMPLATE_KINDS = [
  { value: 'announcement', label: 'Announcement' },
  { value: 'event', label: 'Event' },
  { value: 'general', label: 'General' },
]

export const EMAIL_LANGUAGES = [
  { value: 'en', label: 'English' },
  { value: 'fr', label: 'Français' },
  { value: 'ar', label: 'العربية' },
]

/** What an admin can type into a template, with a sample for the preview. */
export const TEMPLATE_VARIABLES = [
  { key: 'first_name', label: 'Member first name', sample: 'Amina' },
  { key: 'member_name', label: 'Member full name', sample: 'Amina Benali' },
  { key: 'member_code', label: 'Member code', sample: 'AFAQ-0042' },
  { key: 'title', label: 'Announcement / event title', sample: 'Arduino workshop' },
  { key: 'content', label: 'Announcement / event text', sample: 'Bring your laptop — boards are provided.' },
  { key: 'event_date', label: 'Event date', sample: 'Saturday 3 October 2026' },
  { key: 'event_time', label: 'Event time', sample: '14:00' },
  { key: 'event_location', label: 'Event location', sample: 'Lab 2, Faculty of Science' },
  { key: 'link', label: 'Link to the page on the site', sample: 'https://example.com/events' },
  { key: 'club_name', label: 'Club name', sample: CLUB_NAME },
  { key: 'site_url', label: 'Site address', sample: 'https://example.com' },
]

export const SAMPLE_VARIABLES = Object.fromEntries(TEMPLATE_VARIABLES.map(v => [v.key, v.sample]))

const LOCALES = { en: 'en-GB', fr: 'fr-FR', ar: 'ar-DZ' }

export function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, c => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ))
}

const VARIABLE = /\{\{\s*([a-z_]+)\s*\}\}/g

/** Plain-text substitution, for the subject line. Unknown names become empty. */
export function fillText(text, vars) {
  return String(text ?? '').replace(VARIABLE, (_, key) => String(vars[key] ?? '')).replace(/\s+/g, ' ').trim()
}

/** Substitution into HTML: every value is escaped, multi-line values keep their breaks. */
function fillHtml(html, vars) {
  return String(html ?? '').replace(VARIABLE, (_, key) => escapeHtml(vars[key] ?? '').replace(/\r?\n/g, '<br>'))
}

/** Admin-written text → paragraphs. Escaped first, then **bold**, then variables. */
function formatText(text, vars, style) {
  const escaped = escapeHtml(text).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
  return escaped
    .split(/\r?\n\s*\r?\n/)
    .map(p => p.trim())
    .filter(Boolean)
    .map(p => `<p style="${style}">${fillHtml(p.replace(/\r?\n/g, '<br>'), vars)}</p>`)
    .join('')
}

const isHexColor = value => /^#[0-9a-f]{6}$/i.test(value || '')

/** Only http(s) and mailto links survive into the button. */
function safeUrl(url) {
  const trimmed = String(url || '').trim()
  return /^(https?:\/\/|mailto:)/i.test(trimmed) ? trimmed : ''
}

/**
 * Render a template for one recipient.
 * @returns {{ subject: string, html: string }}
 */
export function renderEmail(template, vars, { language = 'en' } = {}) {
  const dir = language === 'ar' ? 'rtl' : 'ltr'
  const align = dir === 'rtl' ? 'right' : 'left'
  const subject = fillText(template.subject, vars) || fillText('{{title}}', vars) || CLUB_NAME

  if (template.custom_html && template.custom_html.trim()) {
    return { subject, html: fillHtml(template.custom_html, vars) }
  }

  const accent = isHexColor(template.accent_color) ? template.accent_color : '#0F172A'
  const font = "font-family:'Segoe UI',Tahoma,Arial,sans-serif;"
  const header = fillHtml(escapeHtml(template.header_text || ''), vars)
  const heading = fillHtml(escapeHtml(template.heading || ''), vars)
  const body = formatText(template.body || '', vars,
    `margin:0 0 14px;color:#334155;font-size:15px;line-height:1.65;text-align:${align};`)
  const footer = formatText(template.footer || '', vars,
    `margin:0 0 6px;color:#94a3b8;font-size:12px;line-height:1.5;text-align:center;`)
  const buttonUrl = safeUrl(fillText(template.button_url, vars))
  const buttonLabel = fillText(template.button_label, vars)

  const html = `<!doctype html>
<html lang="${escapeHtml(language)}" dir="${dir}">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${escapeHtml(subject)}</title></head>
<body style="margin:0;padding:0;background:#f1f5f9;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;">
<tr><td align="center" style="padding:24px 12px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" dir="${dir}" style="max-width:560px;background:#ffffff;border-radius:12px;overflow:hidden;${font}">
${header ? `<tr><td style="background:${accent};padding:22px 28px;text-align:center;color:#ffffff;font-size:20px;font-weight:700;${font}">${header}</td></tr>` : ''}
<tr><td style="padding:30px 28px 14px;">
${heading ? `<h1 style="margin:0 0 16px;color:#0f172a;font-size:22px;line-height:1.3;text-align:${align};${font}">${heading}</h1>` : ''}
${body}
${buttonUrl && buttonLabel ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:22px 0 10px;"><tr><td style="border-radius:8px;background:${accent};"><a href="${escapeHtml(buttonUrl)}" style="display:inline-block;padding:12px 24px;color:#ffffff;font-size:15px;font-weight:600;text-decoration:none;${font}">${escapeHtml(buttonLabel)}</a></td></tr></table>` : ''}
</td></tr>
${footer ? `<tr><td style="padding:18px 28px 24px;border-top:1px solid #e2e8f0;">${footer}</td></tr>` : ''}
</table>
</td></tr>
</table>
</body>
</html>`

  return { subject, html }
}

/** Pick the field in the requested language, falling back to English. */
function localized(record, field, language) {
  return record?.[`${field}_${language}`] || record?.[`${field}_en`] || ''
}

function formatEventDate(date, language) {
  if (!date) return ''
  const [y, m, d] = String(date).slice(0, 10).split('-').map(Number)
  if (!y || !m || !d) return String(date)
  try {
    return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString(LOCALES[language] || 'en-GB', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC',
    })
  } catch {
    return String(date)
  }
}

/**
 * Variables shared by every recipient of one send: what is being announced
 * and where it lives on the site. `message` is used when there is no source
 * record (a general email written in the composer).
 */
export function buildSharedVariables({ sourceType, record, message, language = 'en', siteUrl = '' }) {
  const site = String(siteUrl || '').replace(/\/+$/, '')
  const base = { club_name: CLUB_NAME, site_url: site }

  if (sourceType === 'announcement' && record) {
    return {
      ...base,
      title: localized(record, 'title', language),
      content: localized(record, 'content', language),
      link: site ? `${site}/announcements` : '',
    }
  }
  if (sourceType === 'event' && record) {
    return {
      ...base,
      title: localized(record, 'title', language),
      content: localized(record, 'description', language),
      event_date: formatEventDate(record.date, language),
      event_time: record.time ? String(record.time).slice(0, 5) : '',
      event_location: localized(record, 'location', language),
      link: site ? `${site}/events` : '',
    }
  }
  return {
    ...base,
    title: message?.title || '',
    content: message?.content || '',
    link: site,
  }
}

/** Variables that differ per recipient. */
export function memberVariables(member) {
  const fullName = String(member?.full_name || member?.name || '').trim()
  return {
    member_name: fullName,
    first_name: fullName.split(/\s+/)[0] || '',
    member_code: member?.member_code || '',
  }
}
