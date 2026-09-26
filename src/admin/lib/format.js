/** Formatting shared across the console, so a date reads the same everywhere. */

const DATE = new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
const DATE_TIME = new Intl.DateTimeFormat('en-GB', {
  day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false,
})

export function formatDate(value) {
  if (!value) return '—'
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? '—' : DATE.format(d)
}

export function formatDateTime(value) {
  if (!value) return '—'
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? '—' : DATE_TIME.format(d)
}

/** ISO date for <input type="date">, in local time rather than UTC. */
export function toDateInput(value) {
  const d = value ? new Date(value) : new Date()
  if (Number.isNaN(d.getTime())) return ''
  const pad = n => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export function relativeTime(value) {
  if (!value) return '—'
  const then = new Date(value).getTime()
  if (Number.isNaN(then)) return '—'
  const seconds = Math.round((Date.now() - then) / 1000)
  if (seconds < 60) return 'just now'
  const minutes = Math.round(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.round(hours / 24)
  if (days < 30) return `${days}d ago`
  return formatDate(value)
}

export function isPast(dateString) {
  if (!dateString) return false
  return new Date(`${dateString}T23:59:59`).getTime() < Date.now()
}

export function initials(name, fallback = 'A') {
  const source = (name || '').trim()
  if (!source) return fallback
  const parts = source.split(/\s+/).slice(0, 2)
  return parts.map(p => p[0]).join('').toUpperCase()
}

/** RFC-4180 escaping — the old export broke on any value containing a quote. */
function csvCell(value) {
  if (value === null || value === undefined) return '""'
  const text = Array.isArray(value) ? value.join('; ') : String(value)
  return `"${text.replace(/"/g, '""')}"`
}

export function downloadCSV(filename, headers, rows) {
  const csv = [headers.map(csvCell).join(','), ...rows.map(r => r.map(csvCell).join(','))].join('\r\n')
  // BOM so Excel opens Arabic and French names in the right encoding.
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

/**
 * One PDF export shared by every admin table, so exports look like one
 * system instead of each page inventing its own.
 *
 * `headers`/`rows` arrive already in the document's language (ExportMenu
 * translates them) and in reading order; for Arabic the columns are laid out
 * right to left. `statusColumnIndex`, if given, sets that column in bold.
 */
export async function exportPDF({ filename, title, subtitle, headers, rows, statusColumnIndex, orientation = 'landscape', lang = 'en' }) {
  const { createPdf, drawFooters, drawHeader, mirror, sourceIndex, tableTheme } = await import('./pdf')
  const { doc, autoTable } = await createPdf({ orientation })
  const margin = 36

  const startY = drawHeader(doc, { lang, title, subtitle, margin })
  const theme = tableTheme(lang)

  autoTable(doc, {
    ...theme,
    startY,
    margin: { left: margin, right: margin, top: margin, bottom: 44 },
    head: [mirror(lang, headers)],
    body: rows.map(r => mirror(lang, r.map(v => (v === null || v === undefined ? '' : String(v))))),
    styles: { ...theme.styles, overflow: 'ellipsize' },
    alternateRowStyles: { fillColor: [251, 251, 252] },
    didParseCell: cell => {
      if (statusColumnIndex == null || cell.section !== 'body') return
      if (sourceIndex(lang, cell.column.index, headers.length) !== statusColumnIndex) return
      cell.cell.styles.fontStyle = 'bold'
      cell.cell.styles.textColor = [17, 24, 39]
    },
  })

  drawFooters(doc, { lang, margin })
  doc.save(filename)
}

export function downloadDataUrl(dataUrl, filename) {
  const a = document.createElement('a')
  a.href = dataUrl
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
}

/**
 * Load a database row into a form's shape, keeping only the fields the form
 * owns and turning nulls into empty strings.
 *
 * Spreading a row straight over the defaults left `title_ar: null` in state for
 * every untranslated record, and the save handler's `.trim()` then threw.
 */
export function toForm(blank, record) {
  if (!record) return { ...blank }
  const next = { ...blank }
  for (const key of Object.keys(blank)) {
    const value = record[key]
    if (value === null || value === undefined) continue
    next[key] = value
  }
  return next
}

export const slugify = value =>
  (value || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 60)

export const plural = (n, one, many) => `${n} ${n === 1 ? one : many ?? one + 's'}`
