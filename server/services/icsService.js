import ical from 'node-ical'

const PRODID = '-//AFAQ Scientific Club//Events//EN'

// RFC 5545 §3.3.11 — escape backslash, semicolon, comma, then real newlines.
function escapeText(value) {
  return String(value ?? '')
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n')
}

// Lines over 75 octets must be folded with a leading space on the continuation.
function foldLine(line) {
  if (line.length <= 75) return line
  const parts = []
  let rest = line
  while (rest.length > 75) {
    parts.push(rest.slice(0, 75))
    rest = ' ' + rest.slice(75)
  }
  parts.push(rest)
  return parts.join('\r\n')
}

function pad(n) { return String(n).padStart(2, '0') }

function stampNow() {
  const d = new Date()
  return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`
}

const DEFAULT_DURATION_HOURS = 2

/** One AFAQ `events` row -> a VEVENT block (floating local time — no timezone stored). */
function buildEvent(event) {
  const [y, m, d] = event.date.split('-').map(Number)
  let dtstart, dtend, allDay = !event.time

  if (allDay) {
    dtstart = `${y}${pad(m)}${pad(d)}`
    const next = new Date(y, m - 1, d + 1)
    dtend = `${next.getFullYear()}${pad(next.getMonth() + 1)}${pad(next.getDate())}`
  } else {
    const [hh, mm] = event.time.split(':').map(Number)
    dtstart = `${y}${pad(m)}${pad(d)}T${pad(hh)}${pad(mm)}00`
    const end = new Date(y, m - 1, d, hh, mm)
    end.setHours(end.getHours() + DEFAULT_DURATION_HOURS)
    dtend = `${end.getFullYear()}${pad(end.getMonth() + 1)}${pad(end.getDate())}T${pad(end.getHours())}${pad(end.getMinutes())}00`
  }

  const lines = [
    'BEGIN:VEVENT',
    `UID:afaq-event-${event.id}@afaq-club.com`,
    `DTSTAMP:${stampNow()}`,
    allDay ? `DTSTART;VALUE=DATE:${dtstart}` : `DTSTART:${dtstart}`,
    allDay ? `DTEND;VALUE=DATE:${dtend}` : `DTEND:${dtend}`,
    `SUMMARY:${escapeText(event.title_en)}`,
  ]
  if (event.description_en) lines.push(`DESCRIPTION:${escapeText(event.description_en)}`)
  if (event.location_en) lines.push(`LOCATION:${escapeText(event.location_en)}`)
  lines.push('URL:https://afaq-club.com/events')
  lines.push('END:VEVENT')
  return lines.map(foldLine).join('\r\n')
}

/** Events -> a full .ics calendar document, ready to write to a response. */
export function buildICS(events) {
  const body = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    `PRODID:${PRODID}`,
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    ...events.map(buildEvent),
    'END:VCALENDAR',
  ]
  return body.join('\r\n') + '\r\n'
}

/**
 * Parse an .ics document (uploaded file or a fetched feed, e.g. a Google
 * Calendar secret address) into plain candidate events for the import
 * preview — never saved here, the caller decides what to keep.
 */
export function parseICS(text) {
  const parsed = ical.sync.parseICS(text)
  const events = []

  for (const key of Object.keys(parsed)) {
    const item = parsed[key]
    if (item.type !== 'VEVENT' || !item.start) continue

    const start = item.start
    const allDay = start.dateOnly === true
    const pad2 = n => String(n).padStart(2, '0')

    events.push({
      uid: item.uid || key,
      title: item.summary || 'Untitled event',
      description: item.description || '',
      location: item.location || '',
      date: `${start.getFullYear()}-${pad2(start.getMonth() + 1)}-${pad2(start.getDate())}`,
      time: allDay ? '' : `${pad2(start.getHours())}:${pad2(start.getMinutes())}`,
    })
  }

  return events.sort((a, b) => a.date.localeCompare(b.date))
}
