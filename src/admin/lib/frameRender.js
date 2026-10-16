/**
 * Drawing for the frame studio: one photo, placed and adjusted, under one of
 * the club's transparent frame PNGs or a built-in design, with text on top.
 * The preview and the export both call renderFrame, so what you see is
 * exactly what downloads.
 */
import { nearestWeight } from './frameFonts'
import { designOf } from './frameDesigns'

/**
 * Load an image the canvas may read back. Remote files need CORS, which
 * Supabase storage sends. The extra query keeps the browser from reusing a
 * copy an <img> tag cached without CORS, which would taint the canvas.
 */
export function loadImage(src) {
  if (/^https?:/.test(src)) src += `${src.includes('?') ? '&' : '?'}cors=1`
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.decoding = 'async'
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('The image could not be loaded.'))
    img.src = src
  })
}

let logoPromise
/** The club mark as a Path2D in its 1880-unit box (see the SVG viewBox). */
export function loadLogoPath() {
  logoPromise ??= fetch('/brand/logo/afaq-mark-navy.svg')
    .then(r => r.text())
    .then(svg => new Path2D(svg.match(/ d="([^"]+)"/)[1]))
    .catch(() => null)
  return logoPromise
}

// ---------- photo adjustments ----------

export const NEUTRAL_ADJUST = {
  brightness: 100, contrast: 100, saturation: 100, warmth: 0, hue: 0, grayscale: 0, blur: 0, fade: 0, vignette: 0,
}

/** One-click looks. Each is a full set of adjustments, so picking one replaces the sliders. */
export const ADJUST_PRESETS = [
  { key: 'original', label: 'Original', adjust: {} },
  { key: 'vivid', label: 'Vivid', adjust: { brightness: 104, contrast: 112, saturation: 135 } },
  { key: 'warm', label: 'Warm', adjust: { brightness: 104, saturation: 110, warmth: 18 } },
  { key: 'airy', label: 'Airy', adjust: { brightness: 112, contrast: 90, saturation: 95, fade: 18 } },
  { key: 'faded', label: 'Faded', adjust: { contrast: 88, saturation: 78, fade: 32 } },
  { key: 'drama', label: 'Drama', adjust: { brightness: 95, contrast: 130, saturation: 90, vignette: 45 } },
  { key: 'bw', label: 'B&W', adjust: { contrast: 115, grayscale: 100 } },
  { key: 'noir', label: 'Noir', adjust: { brightness: 90, contrast: 140, grayscale: 100, vignette: 55 } },
  { key: 'sepia', label: 'Sepia', adjust: { saturation: 80, warmth: 60, vignette: 25 } },
].map(p => ({ ...p, adjust: { ...NEUTRAL_ADJUST, ...p.adjust } }))

const filterOf = (a, u) =>
  `brightness(${a.brightness}%) contrast(${a.contrast}%) saturate(${a.saturation}%)` +
  (a.warmth > 0 ? ` sepia(${a.warmth}%)` : '') +
  (a.hue ? ` hue-rotate(${a.hue}deg)` : '') +
  (a.grayscale > 0 ? ` grayscale(${a.grayscale}%)` : '') +
  (a.blur > 0 ? ` blur(${a.blur * u}px)` : '')

// ---------- photo placement ----------

const turned = photo => ((photo?.rotate || 0) / 90) % 2 === 1

/** Scale and offsets for a photo, with the pan kept inside the canvas when it covers it. */
export function placement(img, width, height, { zoom = 1, x = 0, y = 0, rotate = 0 }, fit = 'cover') {
  let iw = img.naturalWidth || img.width
  let ih = img.naturalHeight || img.height
  if (turned({ rotate })) [iw, ih] = [ih, iw]
  const base = fit === 'cover' ? Math.max(width / iw, height / ih) : Math.min(width / iw, height / ih)
  const scale = base * zoom
  const dw = iw * scale
  const dh = ih * scale
  let ox = x * width
  let oy = y * height
  if (fit === 'cover') {
    const mx = Math.max(0, (dw - width) / 2)
    const my = Math.max(0, (dh - height) / 2)
    ox = Math.min(mx, Math.max(-mx, ox))
    oy = Math.min(my, Math.max(-my, oy))
  }
  return { dx: (width - dw) / 2 + ox, dy: (height - dh) / 2 + oy, dw, dh, ox, oy }
}

/** Draw the photo into the placed box, turned and flipped. */
function drawPhoto(ctx, photo, p) {
  ctx.save()
  ctx.translate(p.dx + p.dw / 2, p.dy + p.dh / 2)
  if (photo.rotate) ctx.rotate((photo.rotate * Math.PI) / 180)
  if (photo.flipX || photo.flipY) ctx.scale(photo.flipX ? -1 : 1, photo.flipY ? -1 : 1)
  const [w, h] = turned(photo) ? [p.dh, p.dw] : [p.dw, p.dh]
  ctx.drawImage(photo.img, -w / 2, -h / 2, w, h)
  ctx.restore()
}

// ---------- text ----------

export const TEXT_DEFAULTS = {
  text: 'Your text',
  font: 'Thmanyah Sans',
  weight: 700,
  size: 72, // px on a 1080-wide canvas
  color: '#FFFFFF',
  align: 'center',
  x: 0.5, // anchor, as fractions of the canvas
  y: 0.5,
  lineHeight: 1.2,
  spacing: 0,
  upper: false,
  italic: false,
  stroke: 0,
  strokeColor: '#050A30',
  shadow: true,
  bg: '', // box colour behind the text, empty for none
  bgOpacity: 0.85,
  pad: 24,
  radius: 14,
  opacity: 1,
  rotate: 0,
  scope: 'all', // 'all' or one photo's id
}

const ARABIC = /[؀-ۿݐ-ݿﭐ-﷿ﹰ-﻿]/

const fontString = (l, u) =>
  `${l.italic ? 'italic ' : ''}${nearestWeight(l.font, l.weight)} ${l.size * u}px "${l.font}", "Thmanyah Sans", sans-serif`

const linesOf = l => (l.upper ? l.text.toUpperCase() : l.text).split('\n')

/** Where a text layer sits, in canvas pixels, before its rotation. */
export function textBox(ctx, l, width, height) {
  const u = width / 1080
  ctx.save()
  ctx.font = fontString(l, u)
  if ('letterSpacing' in ctx) ctx.letterSpacing = `${l.spacing * u}px`
  const lines = linesOf(l)
  const widths = lines.map(t => ctx.measureText(t).width)
  ctx.restore()
  const lh = l.size * u * l.lineHeight
  const w = Math.max(1, ...widths)
  const h = lh * lines.length
  const cx = l.x * width
  const cy = l.y * height
  const left = l.align === 'left' ? cx : l.align === 'right' ? cx - w : cx - w / 2
  const pad = l.bg ? l.pad * u : 0
  return { lines, lh, w, h, cx, cy, left, top: cy - h / 2, pad, u }
}

/** Whether the canvas point (px, py) falls on this text layer. */
export function hitText(ctx, l, width, height, px, py) {
  const b = textBox(ctx, l, width, height)
  const a = (-l.rotate * Math.PI) / 180
  const dx = px - b.cx
  const dy = py - b.cy
  const rx = dx * Math.cos(a) - dy * Math.sin(a) + b.cx
  const ry = dx * Math.sin(a) + dy * Math.cos(a) + b.cy
  const slack = Math.max(b.pad, 12 * b.u)
  return rx >= b.left - slack && rx <= b.left + b.w + slack && ry >= b.top - slack && ry <= b.top + b.h + slack
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath()
  if (ctx.roundRect) ctx.roundRect(x, y, w, h, r)
  else ctx.rect(x, y, w, h)
}

export function drawText(ctx, l, width, height, selected = false) {
  if (!l.text.trim()) return
  const b = textBox(ctx, l, width, height)
  const { u } = b
  ctx.save()
  ctx.translate(b.cx, b.cy)
  if (l.rotate) ctx.rotate((l.rotate * Math.PI) / 180)
  ctx.translate(-b.cx, -b.cy)
  ctx.globalAlpha = l.opacity

  if (l.bg) {
    ctx.save()
    ctx.globalAlpha = l.opacity * l.bgOpacity
    ctx.fillStyle = l.bg
    roundRect(ctx, b.left - b.pad, b.top - b.pad, b.w + b.pad * 2, b.h + b.pad * 2, l.radius * u)
    ctx.fill()
    ctx.restore()
  }

  ctx.font = fontString(l, u)
  if ('letterSpacing' in ctx) ctx.letterSpacing = `${l.spacing * u}px`
  ctx.textBaseline = 'middle'
  ctx.textAlign = l.align
  ctx.direction = ARABIC.test(l.text) ? 'rtl' : 'ltr'
  ctx.lineJoin = 'round'
  if (l.shadow) {
    ctx.shadowColor = 'rgba(0, 0, 0, 0.55)'
    ctx.shadowBlur = 18 * u
    ctx.shadowOffsetY = 4 * u
  }
  const x = l.align === 'left' ? b.left : l.align === 'right' ? b.left + b.w : b.cx
  b.lines.forEach((line, i) => {
    const y = b.top + b.lh * (i + 0.5)
    if (l.stroke > 0) {
      ctx.strokeStyle = l.strokeColor
      ctx.lineWidth = l.stroke * u * 2
      ctx.strokeText(line, x, y)
      ctx.shadowColor = 'transparent'
    }
    ctx.fillStyle = l.color
    ctx.fillText(line, x, y)
  })

  if (selected) {
    ctx.shadowColor = 'transparent'
    ctx.globalAlpha = 1
    ctx.setLineDash([10 * u, 8 * u])
    ctx.lineWidth = 3 * u
    ctx.strokeStyle = '#5CBCF9'
    const s = b.pad + 12 * u
    ctx.strokeRect(b.left - s, b.top - s, b.w + s * 2, b.h + s * 2)
  }
  ctx.restore()
}

/**
 * The text layers that show on this photo. A photo with its own frame
 * (photo.frame set) skips the shared design's words; it has its own.
 */
export const textsFor = (texts, photo) => (texts || []).filter(t =>
  t.scope === photo?.id || (t.scope === 'all' && !(t.role && photo?.frame != null)))

// ---------- the whole picture ----------

/**
 * @param ctx       2d context of a canvas already sized width × height
 * @param photo     { img, zoom, x, y, rotate, flipX, flipY, adjust? } — x and y are pan offsets as fractions of the canvas
 * @param frame     loaded frame image, or null for none
 * @param design    { key, accent, ink, logo } for a built-in design, or null
 * @param texts     text layers (see TEXT_DEFAULTS); only those scoped to this photo are drawn
 * @param adjust    see NEUTRAL_ADJUST; the photo's own adjust wins when it has one
 * @param fit       'cover' fills the canvas; 'contain' shows the whole photo on a blurred copy of itself
 * @param selected  id of the text layer to outline (preview only)
 */
export function renderFrame(ctx, {
  width, height, photo, frame, design, logoPath, texts, adjust = NEUTRAL_ADJUST, fit = 'cover', background = '#050A30', selected,
}) {
  const u = width / 1080
  ctx.save()
  ctx.clearRect(0, 0, width, height)
  ctx.fillStyle = background
  ctx.fillRect(0, 0, width, height)

  if (photo?.img) {
    const a = { ...NEUTRAL_ADJUST, ...(photo.adjust || adjust) }
    const filter = filterOf(a, u)
    if (fit === 'contain') {
      // Blurred, darkened cover copy behind, so a portrait shot in a square
      // doesn't sit between flat bars.
      const back = placement(photo.img, width, height, { zoom: 1, rotate: photo.rotate }, 'cover')
      ctx.filter = `${filter} blur(${40 * u}px) brightness(70%)`
      drawPhoto(ctx, photo, { dx: back.dx - 40 * u, dy: back.dy - 40 * u, dw: back.dw + 80 * u, dh: back.dh + 80 * u })
    }
    ctx.filter = filter
    drawPhoto(ctx, photo, placement(photo.img, width, height, photo, fit))
    ctx.filter = 'none'

    if (a.fade > 0) {
      ctx.fillStyle = `rgba(235, 235, 240, ${(a.fade / 100) * 0.45})`
      ctx.fillRect(0, 0, width, height)
    }
    if (a.vignette > 0) {
      const r = Math.hypot(width, height) / 2
      const g = ctx.createRadialGradient(width / 2, height / 2, r * 0.35, width / 2, height / 2, r)
      g.addColorStop(0, 'rgba(0, 0, 0, 0)')
      g.addColorStop(1, `rgba(0, 0, 0, ${(a.vignette / 100) * 0.85})`)
      ctx.fillStyle = g
      ctx.fillRect(0, 0, width, height)
    }
  }

  if (frame) ctx.drawImage(frame, 0, 0, width, height)
  if (design) designOf(design.key)?.draw(ctx, { width, height, u, ...design, logoPath })

  for (const t of textsFor(texts, photo)) drawText(ctx, t, width, height, t.id === selected)
  ctx.restore()
}

/** Render to a blob at full size, off screen. */
export async function exportFrame(options, type = 'image/jpeg', quality = 0.92) {
  const canvas = document.createElement('canvas')
  canvas.width = options.width
  canvas.height = options.height
  renderFrame(canvas.getContext('2d'), { ...options, selected: null })
  return new Promise((resolve, reject) => {
    canvas.toBlob(blob => (blob ? resolve(blob) : reject(new Error('The image could not be exported.'))), type, quality)
  })
}
