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

const PDF_STATUS_COLOR = {
  approved: [23, 146, 79], available: [23, 146, 79], active: [23, 146, 79], returned: [23, 146, 79], resolved: [23, 146, 79],
  pending: [201, 122, 4], borrowed: [201, 122, 4], repair: [201, 122, 4], draft: [201, 122, 4],
  rejected: [216, 64, 47], overdue: [216, 64, 47], retired: [216, 64, 47], cancelled: [216, 64, 47], lost: [216, 64, 47],
}

/**
 * One branded PDF export shared by every admin table — same club-blue header
 * band and dark striped table regardless of which page calls it, so exports
 * look like one system instead of each page inventing its own.
 *
 * `rows` are arrays already shaped for the table (same shape `downloadCSV`
 * takes), so a page can pass the exact headers/rows it built for CSV.
 * `statusColumnIndex`, if given, colors that column like the on-screen
 * StatusBadge instead of plain text.
 */
export async function exportPDF({ filename, title, subtitle, headers, rows, statusColumnIndex, orientation = 'landscape' }) {
  const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([
    import('jspdf'), import('jspdf-autotable'),
  ])

  const doc = new jsPDF({ orientation, unit: 'pt', format: 'a4' })
  const pageWidth = doc.internal.pageSize.getWidth()

  doc.setFillColor(36, 96, 231)
  doc.rect(0, 0, pageWidth, 64, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(16)
  doc.text('AFAQ Scientific Club', 32, 30)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.text(title, 32, 46)
  doc.text(subtitle, pageWidth - 32, 46, { align: 'right' })

  autoTable(doc, {
    startY: 84,
    margin: { left: 32, right: 32 },
    head: [headers],
    body: rows,
    styles: { font: 'helvetica', fontSize: 9, cellPadding: 6, textColor: [10, 18, 32], overflow: 'ellipsize' },
    headStyles: { fillColor: [10, 18, 32], textColor: 255, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [244, 245, 240] },
    didParseCell: cell => {
      if (statusColumnIndex == null || cell.section !== 'body' || cell.column.index !== statusColumnIndex) return
      const raw = String(rows[cell.row.index]?.[statusColumnIndex] || '').toLowerCase()
      const color = PDF_STATUS_COLOR[raw]
      if (color) { cell.cell.styles.textColor = color; cell.cell.styles.fontStyle = 'bold' }
    },
    didDrawPage: () => {
      doc.setFontSize(8)
      doc.setTextColor(140, 148, 158)
      doc.text(
        `Page ${doc.internal.getCurrentPageInfo().pageNumber} of ${doc.internal.getNumberOfPages()}`,
        pageWidth - 32, doc.internal.pageSize.getHeight() - 16, { align: 'right' }
      )
    },
  })

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
