/**
 * The PDF foundation every export shares: an embedded font that covers Latin
 * and Arabic, correct right-to-left text, and one quiet, print-friendly
 * theme — near-black text, grey rules, no colored bands.
 */
import regularUrl from '../assets/fonts/IBMPlexSansArabic-Regular.ttf?url'
import boldUrl from '../assets/fonts/IBMPlexSansArabic-Bold.ttf?url'
import { formatDateFor, isRtl, t } from './exportI18n'

export const FONT = 'PlexArabic'

export const THEME = {
  ink: [17, 24, 39],
  text: [55, 65, 81],
  muted: [107, 114, 128],
  rule: [209, 213, 219],
  headFill: [243, 244, 246],
  stripe: [249, 250, 251],
  footFill: [243, 244, 246],
  positive: [21, 94, 62],
  negative: [155, 28, 28],
}

let fontCache = null

async function toBase64(url) {
  const buffer = await (await fetch(url)).arrayBuffer()
  const bytes = new Uint8Array(buffer)
  let binary = ''
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000))
  }
  return btoa(binary)
}

function loadFonts() {
  fontCache ||= Promise.all([toBase64(regularUrl), toBase64(boldUrl)]).catch(err => {
    fontCache = null
    throw err
  })
  return fontCache
}

const ARABIC = /[؀-ۿݐ-ݿࢠ-ࣿ]/

const hasArabic = text => (Array.isArray(text) ? text.some(line => ARABIC.test(String(line))) : ARABIC.test(String(text)))

/**
 * jsPDF shapes Arabic letters itself, but its default bidi pass assumes the
 * input is already in visual order, which scrambles any line that mixes
 * Arabic with Latin words or numbers. Every `text` call on this document —
 * including the ones jspdf-autotable makes — is told the input is logical
 * and, when it holds Arabic, right-to-left.
 */
function patchBidi(doc) {
  const text = doc.text.bind(doc)
  doc.text = (value, x, y, options, ...rest) => {
    const bidi = hasArabic(value)
      ? { isInputVisual: false, isOutputVisual: true, isInputRtl: true, isSymmetricSwapping: true }
      : { isInputVisual: false, isOutputVisual: true, isInputRtl: false }
    return text(value, x, y, { ...bidi, ...(options || {}) }, ...rest)
  }
}

/** A new A4 document with the shared font registered and bidi fixed. */
export async function createPdf({ orientation = 'portrait' } = {}) {
  const [{ default: jsPDF }, { default: autoTable }, [regular, bold]] = await Promise.all([
    import('jspdf'), import('jspdf-autotable'), loadFonts(),
  ])
  const doc = new jsPDF({ orientation, unit: 'pt', format: 'a4' })
  doc.addFileToVFS('PlexArabic-Regular.ttf', regular)
  doc.addFont('PlexArabic-Regular.ttf', FONT, 'normal')
  doc.addFileToVFS('PlexArabic-Bold.ttf', bold)
  doc.addFont('PlexArabic-Bold.ttf', FONT, 'bold')
  doc.setFont(FONT, 'normal')
  patchBidi(doc)
  return { doc, autoTable }
}

/**
 * Letterhead: club name and document title on the reading side, the
 * subtitle (period, date) on the other, and a thin rule underneath.
 * Returns the y where content can start.
 */
export function drawHeader(doc, { lang, title, subtitle, margin }) {
  const width = doc.internal.pageSize.getWidth()
  const rtl = isRtl(lang)
  const start = rtl ? width - margin : margin
  const end = rtl ? margin : width - margin
  const startAlign = rtl ? 'right' : 'left'
  const endAlign = rtl ? 'left' : 'right'

  doc.setTextColor(...THEME.muted)
  doc.setFont(FONT, 'normal')
  doc.setFontSize(9)
  doc.text(t(lang, 'club').toUpperCase(), start, margin + 4, { align: startAlign })

  doc.setTextColor(...THEME.ink)
  doc.setFont(FONT, 'bold')
  doc.setFontSize(18)
  doc.text(title, start, margin + 28, { align: startAlign })

  if (subtitle) {
    doc.setTextColor(...THEME.muted)
    doc.setFont(FONT, 'normal')
    doc.setFontSize(9)
    doc.text(subtitle, end, margin + 28, { align: endAlign })
  }

  doc.setDrawColor(...THEME.ink)
  doc.setLineWidth(1)
  doc.line(margin, margin + 40, width - margin, margin + 40)
  return margin + 62
}

/** "Generated …" and "Page n of N" on every page, under a hairline. */
export function drawFooters(doc, { lang, margin }) {
  const width = doc.internal.pageSize.getWidth()
  const height = doc.internal.pageSize.getHeight()
  const rtl = isRtl(lang)
  const pages = doc.internal.getNumberOfPages()
  const generated = t(lang, 'generated', { date: formatDateFor(lang, new Date(), { time: true }) })
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i)
    doc.setDrawColor(...THEME.rule)
    doc.setLineWidth(0.5)
    doc.line(margin, height - 30, width - margin, height - 30)
    doc.setFont(FONT, 'normal')
    doc.setFontSize(8)
    doc.setTextColor(...THEME.muted)
    doc.text(generated, rtl ? width - margin : margin, height - 18, { align: rtl ? 'right' : 'left' })
    doc.text(t(lang, 'page', { n: i, total: pages }), rtl ? margin : width - margin, height - 18, { align: rtl ? 'left' : 'right' })
  }
}

/** Table styling shared by every export; spread options over it. */
export function tableTheme(lang) {
  const align = isRtl(lang) ? 'right' : 'left'
  return {
    theme: 'plain',
    styles: {
      font: FONT, fontStyle: 'normal', fontSize: 8.5, cellPadding: { top: 5, bottom: 5, left: 6, right: 6 },
      textColor: THEME.text, lineColor: THEME.rule, halign: align, valign: 'top',
    },
    headStyles: {
      font: FONT, fontStyle: 'bold', fillColor: THEME.headFill, textColor: THEME.ink, halign: align,
      lineWidth: { bottom: 0.8 }, lineColor: THEME.ink,
    },
    bodyStyles: { lineWidth: { bottom: 0.4 }, lineColor: THEME.rule },
    footStyles: {
      font: FONT, fontStyle: 'bold', fillColor: THEME.footFill, textColor: THEME.ink, halign: align,
      lineWidth: { top: 0.8 }, lineColor: THEME.ink,
    },
  }
}

/**
 * Right-to-left tables read from the right, so their columns are laid out
 * in reverse. Returns the column index as the caller built it, for use in
 * didParseCell hooks.
 */
export const mirror = (lang, row) => (isRtl(lang) ? [...row].reverse() : row)
export const sourceIndex = (lang, index, count) => (isRtl(lang) ? count - 1 - index : index)

/** `columnStyles` keyed by the caller's column order, remapped for a mirrored table. */
export function mirrorColumnStyles(lang, styles, count) {
  if (!isRtl(lang)) return styles
  return Object.fromEntries(Object.entries(styles).map(([i, style]) => [count - 1 - Number(i), style]))
}
