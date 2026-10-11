// Turns database rows (snake_case, as Supabase returns them) into the plain
// text block the assistant reads. Every language a row has is included so the
// assistant can answer in Arabic, French or English.

const TIME_ZONE = 'Africa/Algiers'

function todayIso() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TIME_ZONE }).format(new Date())
}

function clip(text, max) {
  if (!text) return ''
  const clean = String(text).replace(/\s+/g, ' ').trim()
  return clean.length > max ? clean.slice(0, max).trimEnd() + '…' : clean
}

// "EN: … | AR: … | FR: …" with empty and duplicate values dropped.
function multi(row, base, max = 400) {
  const seen = new Set()
  const parts = []
  for (const [lang, key] of [['EN', `${base}_en`], ['AR', `${base}_ar`], ['FR', `${base}_fr`]]) {
    const value = clip(row[key], max)
    if (!value || seen.has(value)) continue
    seen.add(value)
    parts.push(`${lang}: ${value}`)
  }
  return parts.join(' | ')
}

function readableDate(iso) {
  if (!iso) return ''
  const d = new Date(`${iso}T12:00:00Z`)
  if (Number.isNaN(d.getTime())) return iso
  return new Intl.DateTimeFormat('en-GB', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC',
  }).format(d)
}

function formatEvent(e) {
  const lines = [`• ${multi(e, 'title', 160)}`]
  const when = [readableDate(e.date), e.time ? `at ${String(e.time).slice(0, 5)}` : ''].filter(Boolean).join(' ')
  if (when) lines.push(`  Date: ${when} (${e.date})`)
  const where = multi(e, 'location', 160)
  if (where) lines.push(`  Place: ${where}`)
  const about = multi(e, 'description', 600)
  if (about) lines.push(`  About: ${about}`)
  if (e.registration_open) {
    lines.push(`  Registration: open on the website (/events)${e.max_participants ? `, ${e.max_participants} places` : ''}`)
  } else if (e.date >= todayIso()) {
    lines.push('  Registration: not open yet')
  }
  return lines.join('\n')
}

function formatEvents(events) {
  const today = todayIso()
  const upcoming = events.filter(e => e.date >= today).sort((a, b) => a.date.localeCompare(b.date))
  const past = events.filter(e => e.date < today).sort((a, b) => b.date.localeCompare(a.date))
  const parts = []
  parts.push('=== UPCOMING EVENTS (soonest first) ===\n' +
    (upcoming.length ? upcoming.map(formatEvent).join('\n\n') : 'No upcoming events are scheduled right now.'))
  if (past.length) {
    parts.push('=== PAST EVENTS (most recent first) ===\n' + past.map(formatEvent).join('\n\n'))
  }
  return parts.join('\n\n')
}

function formatProject(p) {
  const lines = [`• ${multi(p, 'title', 160)}`]
  if (p.category) lines.push(`  Category: ${p.category}`)
  if (p.technologies?.length) lines.push(`  Technologies: ${p.technologies.join(', ')}`)
  const about = multi(p, 'description', 700)
  if (about) lines.push(`  About: ${about}`)
  if (p.github_url) lines.push(`  Code: ${p.github_url}`)
  if (p.demo_url) lines.push(`  Demo: ${p.demo_url}`)
  return lines.join('\n')
}

function formatAnnouncement(a) {
  const lines = [`• ${multi(a, 'title', 160)}${a.is_pinned ? ' (pinned)' : ''}`]
  if (a.created_at) lines.push(`  Posted: ${String(a.created_at).slice(0, 10)}`)
  const body = multi(a, 'content', 500)
  if (body) lines.push(`  ${body}`)
  return lines.join('\n')
}

function formatFaq(f) {
  const q = multi(f, 'question', 300)
  const a = multi(f, 'answer', 700)
  return `Q: ${q}\nA: ${a}`
}

function formatKnowledge(k) {
  return `[${k.category || 'General'}] ${k.title}\n${k.content}`
}

function formatLinks(links) {
  return links.map(l => `• ${l.label} (${l.platform}): ${l.url}`).join('\n')
}

export function buildContext(data) {
  if (!data) return ''
  const parts = []

  if (data.knowledge?.length) {
    parts.push('=== ABOUT THE CLUB (official knowledge) ===\n' + data.knowledge.map(formatKnowledge).join('\n\n---\n\n'))
  }
  if (data.links?.length) {
    parts.push('=== OFFICIAL LINKS AND SOCIAL MEDIA ===\n' + formatLinks(data.links))
  }
  if (data.events) {
    parts.push(formatEvents(data.events))
  }
  if (data.projects?.length) {
    parts.push(`=== CLUB PROJECTS (${data.projects.length}) ===\n` + data.projects.map(formatProject).join('\n\n'))
  }
  if (data.announcements?.length) {
    parts.push('=== RECENT ANNOUNCEMENTS ===\n' + data.announcements.map(formatAnnouncement).join('\n\n'))
  }
  if (data.faqs?.length) {
    parts.push('=== FREQUENTLY ASKED QUESTIONS ===\n' + data.faqs.map(formatFaq).join('\n\n'))
  }

  return parts.join('\n\n')
}
