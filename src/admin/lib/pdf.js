/**
 * The PDF foundation every export shares: an embedded font that covers Latin
 * and Arabic, correct right-to-left text, and one quiet, print-friendly
 * theme — near-black text, grey rules, no colored bands.
 */
import regularUrl from '../assets/fonts/IBMPlexSansArabic-Regular.ttf?url'
import boldUrl from '../assets/fonts/IBMPlexSansArabic-Bold.ttf?url'
import universityLogoUrl from '../assets/letterhead/univ-bouira.png?url'
import clubLogoUrl from '../assets/letterhead/afaq-bolt.jpg?url'
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
let logoCache = null

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

function loadLogos() {
  logoCache ||= Promise.all([toBase64(universityLogoUrl), toBase64(clubLogoUrl)]).catch(err => {
    logoCache = null
    throw err
  })
  return logoCache
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
  const [{ default: jsPDF }, { default: autoTable }, [regular, bold], [university, club]] = await Promise.all([
    import('jspdf'), import('jspdf-autotable'), loadFonts(), loadLogos(),
  ])
  const doc = new jsPDF({ orientation, unit: 'pt', format: 'a4' })
  doc.addFileToVFS('PlexArabic-Regular.ttf', regular)
  doc.addFont('PlexArabic-Regular.ttf', FONT, 'normal')
  doc.addFileToVFS('PlexArabic-Bold.ttf', bold)
  doc.addFont('PlexArabic-Bold.ttf', FONT, 'bold')
  doc.setFont(FONT, 'normal')
  patchBidi(doc)
  doc.letterheadLogos = { university, club }
  return { doc, autoTable }
}

// The club's official letterhead. It is an institutional document, so it
// stays in French whatever language the rest of the export is in.
const LETTERHEAD = [
  'République Algérienne Démocratique et Populaire',
  'Le Ministère de l’Enseignement Supérieur et de la Recherche Scientifique.',
  'L’Université Akli Mohand Oulhadj – Bouira-',
  'Tasadawit Akli Muhend Ulhag -Tubirett-',
  'La Faculté des Sciences Appliquées.',
  'Club Scientifique AFAQ',
]
const LETTERHEAD_RULE = [160, 160, 160]

/**
 * Letterhead: the university logo, the institutional lines centred and the
 * club logo across the top, then the document title (the letter's "objet")
 * and its subtitle centred between two grey rules. Drawn on the first page
 * only. Returns the y where content can start.
 */
export function drawHeader(doc, { title, subtitle, margin }) {
  const width = doc.internal.pageSize.getWidth()
  const center = width / 2
  const top = margin - 12
  const logo = 62
  const lineHeight = 12

  const { university, club } = doc.letterheadLogos || {}
  if (university) doc.addImage(university, 'PNG', margin, top + 4, logo, logo, 'letterhead-university')
  if (club) doc.addImage(club, 'JPEG', width - margin - logo, top + 4, logo, logo, 'letterhead-club')

  // Fit the institutional lines between the two logos.
  const room = width - (margin + logo + 10) * 2
  doc.setFont(FONT, 'bold')
  doc.setTextColor(...THEME.ink)
  let size = 9.5
  doc.setFontSize(size)
  while (size > 7 && Math.max(...LETTERHEAD.map(line => doc.getTextWidth(line))) > room) {
    size -= 0.5
    doc.setFontSize(size)
  }
  LETTERHEAD.forEach((line, i) => doc.text(line, center, top + 10 + i * lineHeight, { align: 'center' }))

  let y = top + 10 + (LETTERHEAD.length - 1) * lineHeight + 12
  doc.setDrawColor(...LETTERHEAD_RULE)
  doc.setLineWidth(0.6)
  doc.line(margin, y, width - margin, y)

  y += 24
  doc.setFont(FONT, 'bold')
  doc.setFontSize(15)
  doc.setTextColor(...THEME.ink)
  const titleLines = doc.splitTextToSize(String(title), width - margin * 2)
  titleLines.forEach((line, i) => doc.text(line, center, y + i * 18, { align: 'center' }))
  y += (titleLines.length - 1) * 18

  if (subtitle) {
    y += 15
    doc.setFont(FONT, 'normal')
    doc.setFontSize(9)
    doc.setTextColor(...THEME.muted)
    doc.text(subtitle, center, y, { align: 'center' })
  }

  y += 12
  doc.setDrawColor(...LETTERHEAD_RULE)
  doc.setLineWidth(0.6)
  doc.line(margin, y, width - margin, y)
  return y + 22
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
