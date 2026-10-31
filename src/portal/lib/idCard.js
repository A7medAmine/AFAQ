import QRCode from 'qrcode'
import JsBarcode from 'jsbarcode'

/**
 * The member's digital ID card, drawn on a canvas so it can be saved as an
 * image or a true-size PDF. It follows the club's badge design (Brand page,
 * "Color-coded badges"): grid paper, the logo tile, circuit traces, a big
 * Minecraft title with stacked hard shadows, boxed photo and codes with hard
 * offset shadows, and a colour band along the bottom.
 *
 * The barcode is Code 128 of the member number, which the console's Quick
 * give scanner and any USB card scanner read; the QR opens the public verify
 * page. Codes always sit on white in navy so they scan on every theme.
 *
 * Layouts: "double" (name and photo on the front, codes on the back) and
 * "single" (everything on one face).
 */

export const CARD_MM = { w: 85.6, h: 54 } // CR80
const PX_PER_MM = 12 // ~305 dpi
const W = Math.round(CARD_MM.w * PX_PER_MM)
const H = Math.round(CARD_MM.h * PX_PER_MM)
const u = mm => mm * PX_PER_MM
const pt = size => u(size * 0.3528)

const NAVY = '#050A30'
// Minecraft has no Arabic; Unixel is the brand's pixel Arabic.
const PIXEL = '"Minecraft", "Unixel", "Thmanyah Sans", sans-serif'
const SANS = '"Thmanyah Sans", "Segoe UI", Arial, sans-serif'

const FONTS = [
  ['Minecraft', '/brand/fonts/Minecraft.woff2', '400'],
  ['Unixel', '/brand/fonts/unixel-Regular.ttf', '400'],
  ['Thmanyah Sans', '/brand/fonts/thmanyahsans-Medium.woff2', '500'],
  ['Thmanyah Sans', '/brand/fonts/thmanyahsans-Bold.woff2', '700'],
]

/** Team colours from the brand skill; white grid paper with that colour as accent. */
const team = (accent, name) => ({
  name,
  paper: '#FFFFFF',
  grid: `${accent}38`,
  ink: NAVY,
  title: NAVY,
  shadows: [accent, accent],
  band: accent,
  bandInk: NAVY,
  border: NAVY,
  boxShadow: accent,
  doodle: `${accent}66`,
  trace: [NAVY, accent],
})

export const CARD_THEMES = {
  blue: {
    paper: '#FFFFFF', grid: 'rgba(35,61,255,0.10)', ink: NAVY, title: NAVY, shadows: ['#233DFF', '#5CBCF9'],
    band: '#233DFF', bandInk: '#FFFFFF', border: NAVY, boxShadow: '#233DFF', doodle: 'rgba(35,61,255,0.28)', trace: [NAVY, '#233DFF'],
  },
  navy: {
    paper: NAVY, grid: 'rgba(92,188,249,0.16)', ink: '#FFFFFF', title: '#FFFFFF', shadows: ['#233DFF', '#5CBCF9'],
    band: '#233DFF', bandInk: '#FFFFFF', border: '#FFFFFF', boxShadow: '#5CBCF9', doodle: 'rgba(92,188,249,0.30)', trace: ['#FFFFFF', '#5CBCF9'],
  },
  royal: {
    paper: '#233DFF', grid: 'rgba(255,255,255,0.13)', ink: '#FFFFFF', title: '#FFFFFF', shadows: [NAVY, '#5CBCF9'],
    band: NAVY, bandInk: '#FFFFFF', border: NAVY, boxShadow: NAVY, doodle: 'rgba(255,255,255,0.28)', trace: ['#FFFFFF', '#5CBCF9'],
  },
  pink: team('#FF4F7B'),
  orange: team('#FF9F1C'),
  green: team('#20C997'),
  purple: team('#7C5CFF'),
  cyan: team('#00B4D8'),
  gold: team('#FFC531'),
}

/** CSS for a theme swatch in the picker: paper with a corner of the band colour. */
export const themeSwatch = theme => `linear-gradient(135deg, ${theme.paper} 55%, ${theme.band} 55%)`

let fontsReady = null
function loadFonts() {
  if (!fontsReady) {
    fontsReady = typeof FontFace === 'undefined' || !document.fonts?.add
      ? Promise.resolve()
      : Promise.all(FONTS.map(([family, url, weight]) => new FontFace(family, `url(${url})`, { weight })
        .load().then(face => document.fonts.add(face)).catch(() => {})))
  }
  return fontsReady
}

function loadImage(src) {
  return new Promise(resolve => {
    if (!src) { resolve(null); return }
    const img = new Image()
    // Storage serves CORS headers; without them the canvas could not be saved.
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = () => resolve(null)
    img.src = src
  })
}

function canvas() {
  const c = document.createElement('canvas')
  c.width = W
  c.height = H
  return c
}

// ---------- Building blocks ----------

function paper(ctx, theme) {
  ctx.beginPath()
  ctx.roundRect(0, 0, W, H, u(3))
  ctx.clip()
  ctx.fillStyle = theme.paper
  ctx.fillRect(0, 0, W, H)
  const cell = u(5.4)
  ctx.fillStyle = theme.grid
  for (let x = cell; x < W; x += cell) ctx.fillRect(Math.round(x), 0, 2, H)
  for (let y = cell; y < H; y += cell) ctx.fillRect(0, Math.round(y), W, 2)
}

/** Box with a navy border and a hard, unblurred offset shadow. */
function box(ctx, theme, x, y, w, h, fill = '#FFFFFF', offset = u(1.1)) {
  ctx.fillStyle = theme.boxShadow
  ctx.fillRect(x + offset, y + offset, w, h)
  ctx.fillStyle = fill
  ctx.fillRect(x, y, w, h)
  ctx.strokeStyle = theme.border
  ctx.lineWidth = u(0.45)
  ctx.strokeRect(x + ctx.lineWidth / 2, y + ctx.lineWidth / 2, w - ctx.lineWidth, h - ctx.lineWidth)
}

/** Logo tile with "AFAQ" and "Scientific club", top left. */
function lockup(ctx, theme, assets, x, y, size) {
  ctx.fillStyle = theme.boxShadow
  ctx.fillRect(x + u(0.7), y + u(0.7), size, size)
  ctx.fillStyle = '#FFFFFF'
  ctx.fillRect(x, y, size, size)
  ctx.strokeStyle = NAVY
  ctx.lineWidth = u(0.35)
  ctx.strokeRect(x + u(0.175), y + u(0.175), size - u(0.35), size - u(0.35))
  if (assets.mark) ctx.drawImage(assets.mark, x + size * 0.14, y + size * 0.14, size * 0.72, size * 0.72)
  ctx.fillStyle = theme.ink
  ctx.font = `400 ${size * 0.62}px ${PIXEL}`
  ctx.fillText('AFAQ', x + size + u(1.6), y + size * 0.56)
  ctx.font = `500 ${size * 0.34}px ${SANS}`
  ctx.globalAlpha = 0.8
  ctx.fillText('Scientific club', x + size + u(1.6), y + size * 0.98)
  ctx.globalAlpha = 1
}

/** Two stepped traces ending in square pads, entering from the right edge. */
function circuit(ctx, theme, x, y) {
  const lw = u(0.5)
  const pad = u(1.5)
  const trace = (color, sx, sy, midX, upY) => {
    ctx.strokeStyle = color
    ctx.lineWidth = lw
    ctx.beginPath()
    ctx.moveTo(sx, sy)
    ctx.lineTo(midX, sy)
    ctx.lineTo(midX, upY)
    ctx.lineTo(W + lw, upY)
    ctx.stroke()
    ctx.fillStyle = color
    ctx.fillRect(sx - pad / 2, sy - pad / 2, pad, pad)
  }
  trace(theme.trace[0], x, y, x + u(7.5), y - u(5))
  trace(theme.trace[1], x + u(4.5), y + u(2.2), x + u(10.5), y - u(2.6))
}

/** Faint line doodles (star, heart, hash, at-sign) in the empty corners. */
function doodles(ctx, theme, spots) {
  ctx.save()
  ctx.strokeStyle = theme.doodle
  ctx.lineWidth = u(0.35)
  ctx.lineJoin = 'round'
  ctx.lineCap = 'round'
  for (const [kind, x, y, s] of spots) {
    const r = u(s)
    ctx.beginPath()
    if (kind === 'star') {
      for (let i = 0; i < 10; i++) {
        const a = -Math.PI / 2 + (i * Math.PI) / 5
        const rr = i % 2 ? r * 0.45 : r
        ctx[i ? 'lineTo' : 'moveTo'](x + Math.cos(a) * rr, y + Math.sin(a) * rr)
      }
      ctx.closePath()
    } else if (kind === 'heart') {
      ctx.moveTo(x, y + r * 0.8)
      ctx.bezierCurveTo(x - r * 1.4, y - r * 0.1, x - r * 0.6, y - r * 1.1, x, y - r * 0.35)
      ctx.bezierCurveTo(x + r * 0.6, y - r * 1.1, x + r * 1.4, y - r * 0.1, x, y + r * 0.8)
    } else if (kind === 'hash') {
      ctx.moveTo(x - r * 0.35, y - r); ctx.lineTo(x - r * 0.55, y + r)
      ctx.moveTo(x + r * 0.55, y - r); ctx.lineTo(x + r * 0.35, y + r)
      ctx.moveTo(x - r, y - r * 0.35); ctx.lineTo(x + r, y - r * 0.35)
      ctx.moveTo(x - r, y + r * 0.35); ctx.lineTo(x + r, y + r * 0.35)
    } else if (kind === 'at') {
      ctx.arc(x, y, r * 0.38, 0, Math.PI * 2)
      ctx.moveTo(x + r * 0.38, y - r * 0.4)
      ctx.lineTo(x + r * 0.38, y + r * 0.15)
      ctx.arc(x + r * 0.62, y + r * 0.15, r * 0.24, Math.PI, Math.PI * 0.1, true)
      ctx.arc(x, y, r, 0.1, Math.PI * 1.75)
    }
    ctx.stroke()
  }
  ctx.restore()
}

/** Pixel title with stacked hard shadows (near shadow colour, then far). */
function pixelTitle(ctx, theme, text, x, y, size) {
  ctx.font = `400 ${size}px ${PIXEL}`
  const step = Math.max(2, Math.round(size * 0.045))
  const layers = isArabic(text)
    ? [[theme.shadows[1], 2], [theme.shadows[0], 1]]
    : [[theme.shadows[1], 4], [theme.shadows[1], 3], [theme.shadows[0], 2], [theme.shadows[0], 1]]
  for (const [color, i] of layers) {
    ctx.fillStyle = color
    ctx.fillText(text, x + step * i, y + step * i)
  }
  ctx.fillStyle = theme.title
  ctx.fillText(text, x, y)
}

/** Largest size (down to `min`) at which the name fits in at most two lines. */
function fitName(ctx, name, maxW, start, min) {
  const words = name.split(/\s+/).filter(Boolean)
  for (let size = start; size >= min; size -= u(0.25)) {
    ctx.font = `400 ${size}px ${PIXEL}`
    const lines = []
    let line = ''
    for (const word of words) {
      const next = line ? `${line} ${word}` : word
      if (ctx.measureText(next).width <= maxW || !line) line = next
      else { lines.push(line); line = word }
    }
    if (line) lines.push(line)
    if (lines.length <= 2 && lines.every(l => ctx.measureText(l).width <= maxW)) return { size, lines }
  }
  ctx.font = `400 ${min}px ${PIXEL}`
  const mid = Math.ceil(words.length / 2)
  return { size: min, lines: [words.slice(0, mid).join(' '), words.slice(mid).join(' ')].filter(Boolean) }
}

/** Letter-spaced text (canvas letterSpacing is not everywhere yet). */
function spaced(ctx, text, x, y, spacing, align = 'start') {
  const chars = [...text]
  const width = chars.reduce((sum, ch) => sum + ctx.measureText(ch).width, 0) + spacing * (chars.length - 1)
  let cx = align === 'center' ? x - width / 2 : x
  for (const ch of chars) { ctx.fillText(ch, cx, y); cx += ctx.measureText(ch).width + spacing }
  return width
}

const isArabic = text => /[؀-ۿ]/.test(text)

/** Uppercase only for Latin; Arabic has no case and stays as typed. */
const display = text => (isArabic(text) ? text : text.toUpperCase())

function photoBox(ctx, theme, member, assets, x, y, size) {
  box(ctx, theme, x, y, size, size, '#EAF4FF', u(1.2))
  const inset = u(0.45)
  ctx.save()
  ctx.beginPath()
  ctx.rect(x + inset, y + inset, size - inset * 2, size - inset * 2)
  ctx.clip()
  if (assets.photo) {
    const img = assets.photo
    const s = Math.max(size / img.width, size / img.height)
    const sw = size / s
    const sh = size / s
    ctx.drawImage(img, (img.width - sw) / 2, (img.height - sh) / 2, sw, sh, x, y, size, size)
  } else {
    // Brand photo slot: light blue with 45° stripes, initials on top.
    ctx.strokeStyle = 'rgba(35,61,255,0.10)'
    ctx.lineWidth = u(0.8)
    for (let d = -size; d < size * 2; d += u(2.2)) {
      ctx.beginPath()
      ctx.moveTo(x + d, y)
      ctx.lineTo(x + d - size, y + size)
      ctx.stroke()
    }
    ctx.fillStyle = NAVY
    ctx.font = `400 ${size * 0.38}px ${PIXEL}`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(member.initials, x + size / 2, y + size / 2)
    ctx.textAlign = 'start'
    ctx.textBaseline = 'alphabetic'
  }
  ctx.restore()
  // Redraw the border over the photo edge.
  ctx.strokeStyle = theme.border
  ctx.lineWidth = u(0.45)
  ctx.strokeRect(x + u(0.225), y + u(0.225), size - u(0.45), size - u(0.45))
}

/** Bottom band with a navy rule and "■ TEXT ■" in pixel type. */
function band(ctx, theme, text, alert) {
  const h = u(7.2)
  const y = H - h
  ctx.fillStyle = theme.border === '#FFFFFF' ? NAVY : theme.border
  ctx.fillRect(0, y - u(0.5), W, u(0.5))
  ctx.fillStyle = alert ? '#DC2626' : theme.band
  ctx.fillRect(0, y, W, h)
  const ink = alert ? '#FFFFFF' : theme.bandInk
  ctx.fillStyle = ink
  ctx.font = `400 ${pt(8)}px ${PIXEL}`
  const width = spaced(ctx, text, W / 2, y + h / 2 + pt(8) * 0.36, u(0.7), 'center')
  const sq = u(1.4)
  ctx.fillRect(W / 2 - width / 2 - u(4.5), y + h / 2 - sq / 2, sq, sq)
  ctx.fillRect(W / 2 + width / 2 + u(3.1), y + h / 2 - sq / 2, sq, sq)
}

function drawQr(ctx, value, x, y, size) {
  const qr = QRCode.create(value, { errorCorrectionLevel: 'M' })
  const n = qr.modules.size
  const cell = Math.floor(size / n)
  // Whole pixels only: a half-pixel offset leaves anti-aliased seams between
  // modules that some scanners cannot read through.
  const left = Math.round(x + (size - cell * n) / 2)
  const top = Math.round(y + (size - cell * n) / 2)
  ctx.fillStyle = NAVY
  for (let r = 0; r < n; r++) {
    for (let col = 0; col < n; col++) {
      if (qr.modules.get(r, col)) ctx.fillRect(left + col * cell, top + r * cell, cell, cell)
    }
  }
}

/** Code 128 drawn at whole-pixel bar widths so scanners read it from a screen or a print. */
function drawBarcode(ctx, value, cx, y, maxWidth, height) {
  const tmp = document.createElement('canvas')
  for (let moduleW = 6; moduleW >= 1; moduleW--) {
    JsBarcode(tmp, value, { format: 'CODE128', displayValue: false, margin: 0, width: moduleW, height: Math.round(height), lineColor: NAVY, background: '#ffffff' })
    if (tmp.width <= maxWidth) break
  }
  ctx.imageSmoothingEnabled = false
  ctx.drawImage(tmp, Math.round(cx - tmp.width / 2), Math.round(y))
  ctx.imageSmoothingEnabled = true
}

/** Name as the big pixel title, with the role spaced out under it. */
function nameBlock(ctx, theme, member, x, maxW, top, bottom, startSize) {
  const name = display(member.full_name)
  // Shrink until the name, two lines at most, and the role fit the height too.
  const roleReserve = member.role ? pt(6) * 1.9 : 0
  let fit = fitName(ctx, name, maxW - startSize * 0.2, startSize, u(3.6))
  while (fit.size > u(3.6) && fit.lines.length * fit.size * (isArabic(name) ? 1.35 : 1.12) + roleReserve > bottom - top) {
    fit = fitName(ctx, name, maxW - startSize * 0.2, fit.size - u(0.25), u(3.6))
  }
  const { size, lines } = fit
  // Names that still do not fit at the smallest size lose their tail.
  ctx.font = `400 ${size}px ${PIXEL}`
  for (let i = 0; i < lines.length; i++) {
    if (ctx.measureText(lines[i]).width <= maxW) continue
    let cut = lines[i]
    while (cut.length > 1 && ctx.measureText(`${cut}…`).width > maxW) cut = cut.slice(0, -1)
    lines[i] = `${cut.trimEnd()}…`
  }
  // Pixel Arabic (Unixel) reaches well below the baseline; leave room for it.
  const descent = Math.max(size * 0.12, ...lines.map(l => ctx.measureText(l).actualBoundingBoxDescent || 0))
  const lineH = size * 1.08 + (isArabic(name) ? descent * 0.6 : 0)
  const roleSize = pt(6)
  const roleGap = member.role ? roleSize * 1.6 + descent : 0
  const blockH = lines.length * lineH + roleGap
  let y = top + (bottom - top - blockH) / 2 + size * 0.82
  for (const line of lines) { pixelTitle(ctx, theme, line, x, y, size); y += lineH }
  if (member.role) {
    ctx.fillStyle = theme.ink
    ctx.font = `400 ${roleSize}px ${PIXEL}`
    let role = display(member.role)
    while (role.length > 3 && spaced(ctx, role, -9999, 0, u(0.55)) > maxW) role = role.slice(0, -1)
    spaced(ctx, role, x, y - lineH + roleGap + u(0.8), u(0.55))
  }
}

const bandText = member => (member.valid ? member.member_code : `${member.member_code} · ${member.statusLabel}`)

// ---------- Faces ----------

function drawFront(member, theme, assets) {
  const c = canvas()
  const ctx = c.getContext('2d')
  paper(ctx, theme)
  doodles(ctx, theme, [['star', W - u(8), u(23), 2.2], ['heart', W - u(15), u(38.5), 1.8], ['at', u(30), u(13), 1.7], ['hash', W - u(5.5), u(33), 1.6]])
  circuit(ctx, theme, W - u(17), u(10))
  lockup(ctx, theme, assets, u(4), u(3.4), u(7))

  const photo = u(21)
  photoBox(ctx, theme, member, assets, u(4.5), u(15.5), photo)
  const x0 = u(4.5) + photo + u(4.5)
  nameBlock(ctx, theme, member, x0, W - x0 - u(4), u(14.5), u(38.5), u(8.4))

  band(ctx, theme, bandText(member), !member.valid)
  return c
}

function drawBack(member, theme, assets) {
  const c = canvas()
  const ctx = c.getContext('2d')
  paper(ctx, theme)
  doodles(ctx, theme, [['star', W - u(7), u(6), 1.6], ['heart', W - u(14), u(19.5), 1.4]])

  // QR tile, top left, with the lockup and its caption beside it.
  const qr = u(19)
  const qx = u(5)
  const qy = u(3.6)
  box(ctx, theme, qx, qy, qr + u(2.4), qr + u(2.4), '#FFFFFF', u(1.1))
  drawQr(ctx, member.verifyUrl, qx + u(1.2), qy + u(1.2), qr)

  const tx = qx + qr + u(7)
  lockup(ctx, theme, assets, tx, u(4.4), u(6.2))
  ctx.fillStyle = theme.ink
  ctx.font = `400 ${pt(7.4)}px ${PIXEL}`
  spaced(ctx, 'SCAN TO VERIFY', tx, u(17.6), u(0.45))
  ctx.globalAlpha = 0.75
  ctx.font = `500 ${pt(5.4)}px ${SANS}`
  ctx.fillText('Member card · not transferable', tx, u(21.6))
  ctx.globalAlpha = 1

  // Barcode strip across the card; wide white margins are the scanner's quiet zone.
  const sx = u(5)
  const sw = W - sx - u(6.2)
  const sy = u(27.2)
  const sh = u(14.2)
  box(ctx, theme, sx, sy, sw, sh, '#FFFFFF', u(1.1))
  drawBarcode(ctx, member.member_code, sx + sw / 2, sy + u(1.8), sw - u(10), u(7.6))
  ctx.fillStyle = NAVY
  ctx.font = `400 ${pt(6.6)}px ${PIXEL}`
  spaced(ctx, member.member_code, sx + sw / 2, sy + sh - u(1.7), u(0.7), 'center')

  band(ctx, theme, 'afaq.club', false)
  return c
}

function drawSingle(member, theme, assets) {
  const c = canvas()
  const ctx = c.getContext('2d')
  paper(ctx, theme)
  doodles(ctx, theme, [['star', u(53), u(7.5), 1.6], ['heart', u(60), u(14.5), 1.3]])
  lockup(ctx, theme, assets, u(4), u(3.4), u(6.6))

  // QR tile, top right.
  const qr = u(14.5)
  const qx = W - u(5.5) - qr - u(2)
  const qy = u(3)
  box(ctx, theme, qx, qy, qr + u(2), qr + u(2), '#FFFFFF', u(1))
  drawQr(ctx, member.verifyUrl, qx + u(1), qy + u(1), qr)

  const photo = u(17)
  photoBox(ctx, theme, member, assets, u(4.5), u(13.5), photo)
  const x0 = u(4.5) + photo + u(4.2)
  nameBlock(ctx, theme, member, x0, W - x0 - u(5.5), u(20.5), u(32), u(7))

  // Barcode strip across the card.
  const sx = u(4.5)
  const sw = W - sx - u(6)
  const sy = u(34.2)
  const sh = u(9.6)
  box(ctx, theme, sx, sy, sw, sh, '#FFFFFF', u(1))
  drawBarcode(ctx, member.member_code, sx + sw / 2, sy + u(1.5), sw - u(8), sh - u(3))

  band(ctx, theme, bandText(member), !member.valid)
  return c
}

/**
 * Renders the card. `member` holds full_name, member_code, initials, role,
 * statusLabel, valid, verifyUrl and photo_url. Returns { sides: [canvas…] }:
 * front and back for "double", one face for "single".
 */
export async function renderIdCard(member, { theme: themeKey = 'blue', layout = 'double' } = {}) {
  const theme = CARD_THEMES[themeKey] || CARD_THEMES.blue
  await loadFonts()
  const [photo, mark] = await Promise.all([
    loadImage(member.photo_url),
    loadImage('/brand/logo/afaq-mark-black.png'),
  ])
  const assets = { photo, mark }
  return {
    sides: layout === 'single'
      ? [drawSingle(member, theme, assets)]
      : [drawFront(member, theme, assets), drawBack(member, theme, assets)],
  }
}

const toBlob = c => new Promise((resolve, reject) => c.toBlob(b => (b ? resolve(b) : reject(new Error('export'))), 'image/png'))

function save(blob, filename) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/** One PNG: the single face, or the front above the back, for keeping on a phone. */
export async function downloadPng({ sides }, code) {
  if (sides.length === 1) { save(await toBlob(sides[0]), `AFAQ-card-${code}.png`); return }
  const gap = u(4)
  const out = document.createElement('canvas')
  out.width = W + gap * 2
  out.height = H * sides.length + gap * (sides.length + 1)
  const ctx = out.getContext('2d')
  ctx.fillStyle = '#F1F5F9'
  ctx.fillRect(0, 0, out.width, out.height)
  sides.forEach((side, i) => ctx.drawImage(side, gap, gap + i * (H + gap)))
  save(await toBlob(out), `AFAQ-card-${code}.png`)
}

/** A4 PDF with each face at real card size, ready to print, cut and laminate. */
export async function downloadPdf({ sides }, code) {
  const { jsPDF } = await import('jspdf')
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const x = (210 - CARD_MM.w) / 2
  doc.setFontSize(9)
  doc.setTextColor(100)
  doc.text('Print at 100% (actual size). Cut along the card edges.', 105, 20, { align: 'center' })
  sides.forEach((side, i) => doc.addImage(side.toDataURL('image/png'), 'PNG', x, 30 + i * (CARD_MM.h + 8), CARD_MM.w, CARD_MM.h))
  doc.save(`AFAQ-card-${code}.pdf`)
}
