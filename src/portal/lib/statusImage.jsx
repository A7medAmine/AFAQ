import { renderToStaticMarkup } from 'react-dom/server'
import { PxCrown, PxFlag, PxShield, PxSparkles, PxStar, PxTrophy, PxZap } from './pixelIcons'
import { frameArt, PHOTO_POINTS, TROPHY, VIEW } from '../PixelFrames'
import { loadFonts, loadImage, toBlob } from './idCard'

/**
 * Share images of a member's progress, drawn on a canvas in the look of the
 * club's own posters (Brand page samples):
 *
 *  - "status" follows the Open Week slide: white grid paper, a halftone AFAQ
 *    mark, a huge blue block-letter title with navy and sky depth, a blue
 *    box, short bold lines and a circuit trace that doubles as the XP bar;
 *  - "motm" (member of the month) follows the President badge: navy grid,
 *    faint line doodles, circuit traces, a stacked-shadow pixel title and a
 *    blue band along the bottom.
 *
 * Each comes as a story (1080 x 1920) or a post (1080 x 1350). All text
 * arrives translated. Loaded on demand, so react-dom/server stays out of the
 * main bundle.
 */

export const FORMATS = { story: { w: 1080, h: 1920 }, post: { w: 1080, h: 1350 } }

const NAVY = '#050A30'
const BLUE = '#233DFF'
const SKY = '#5CBCF9'
const LIGHT = '#CAE8FF'
const GREY = '#3C4C59'
const GOLD = '#FFC531'
const PINK = '#FF4F7B'
const GREEN = '#20C997'
const PURPLE = '#7C5CFF'
const SILVER = '#C0CCDA'

export const RARITY_COLORS = {
  common: SILVER, uncommon: GREEN, rare: SKY, epic: PURPLE, legendary: GOLD, mythic: PINK, role: GOLD,
}

// Minecraft has no Arabic; Unixel is the brand's pixel Arabic.
const PIXEL = '"Minecraft", "Unixel", "Thmanyah Sans", sans-serif'
const SANS = '"Thmanyah Sans", "Segoe UI", Arial, sans-serif'

const isArabic = text => /[؀-ۿ]/.test(text)
const caps = text => (isArabic(text) ? String(text) : String(text).toUpperCase())

const svgData = markup => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(markup)}`
const svgImage = (node, size) => loadImage(svgData(renderToStaticMarkup(
  <svg xmlns="http://www.w3.org/2000/svg" viewBox={VIEW} width={size} height={size} shapeRendering="crispEdges">{node}</svg>,
)))
const iconImage = (Icon, size, color, stroke = 2.4) => loadImage(svgData(renderToStaticMarkup(
  <Icon xmlns="http://www.w3.org/2000/svg" width={size} height={size} color={color} strokeWidth={stroke} />,
)))

// ---------- Type ----------

function font(ctx, size, family = PIXEL, weight = 400) {
  ctx.font = `${weight} ${size}px ${family}`
}

function spacing(ctx, px) {
  if ('letterSpacing' in ctx) ctx.letterSpacing = `${px}px`
}

/** Largest size, from `start` down to `min`, at which the text fits `maxW`. */
function fit(ctx, text, maxW, start, min, family = PIXEL, weight = 400) {
  for (let size = start; size > min; size -= 2) {
    font(ctx, size, family, weight)
    if (ctx.measureText(text).width <= maxW) return size
  }
  font(ctx, min, family, weight)
  return min
}

/** Splits text into at most `max` lines that fit `maxW` at the current font. */
function wrap(ctx, text, maxW, max = 2) {
  const words = String(text).split(/\s+/).filter(Boolean)
  const lines = []
  let line = ''
  for (const word of words) {
    const next = line ? `${line} ${word}` : word
    if (!line || ctx.measureText(next).width <= maxW) line = next
    else { lines.push(line); line = word }
  }
  if (line) lines.push(line)
  return lines.length > max ? [...lines.slice(0, max - 1), lines.slice(max - 1).join(' ')] : lines
}

/**
 * The posters' block title: blue letters with a navy step and a sky step
 * behind them, built from solid copies so the depth reads as pixels.
 */
function blockText(ctx, text, x, y, size, { fill = BLUE, near = NAVY, far = SKY, align = 'left' } = {}) {
  font(ctx, size)
  ctx.textAlign = align
  const d = Math.max(3, Math.round(size * 0.05))
  ctx.fillStyle = far
  for (let i = d * 2; i > d; i--) ctx.fillText(text, x + i, y + i)
  ctx.fillStyle = near
  for (let i = d; i > 0; i--) ctx.fillText(text, x + i, y + i)
  ctx.fillStyle = fill
  ctx.fillText(text, x, y)
}

/** Text with a few hard shadows, farthest first. */
function shadowText(ctx, text, x, y, size, color, shadows, align = 'center') {
  font(ctx, size)
  ctx.textAlign = align
  for (const [d, c] of [...shadows].sort((a, b) => b[0] - a[0])) {
    ctx.fillStyle = c
    ctx.fillText(text, x + d, y + d)
  }
  ctx.fillStyle = color
  ctx.fillText(text, x, y)
}

// ---------- Pieces ----------

function paper(ctx, w, h, fill, line, cell = 54) {
  ctx.fillStyle = fill
  ctx.fillRect(0, 0, w, h)
  ctx.fillStyle = line
  for (let x = cell; x < w; x += cell) ctx.fillRect(x, 0, 2, h)
  for (let y = cell; y < h; y += cell) ctx.fillRect(0, y, w, 2)
}

/** The AFAQ mark as a field of dots, like the posters' background pattern. */
function halftone(ctx, mark, cx, cy, size, angle, color, step = 17, dot = 3.4) {
  if (!mark) return
  const n = Math.ceil(size / step)
  const probe = document.createElement('canvas')
  probe.width = n
  probe.height = n
  const p = probe.getContext('2d', { willReadFrequently: true })
  p.drawImage(mark, 0, 0, n, n)
  const alpha = p.getImageData(0, 0, n, n).data
  ctx.save()
  ctx.translate(cx, cy)
  ctx.rotate(angle)
  ctx.fillStyle = color
  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      if (alpha[(j * n + i) * 4 + 3] < 110) continue
      ctx.beginPath()
      ctx.arc(i * step - size / 2, j * step - size / 2, dot, 0, Math.PI * 2)
      ctx.fill()
    }
  }
  ctx.restore()
}

/** Mark plus "AFAQ" and "Scientific club", as on the posters. */
function lockup(ctx, mark, x, y, size, ink, sub, tile = false) {
  if (tile) {
    ctx.fillStyle = SKY
    ctx.fillRect(x + 6, y + 6, size, size)
    ctx.fillStyle = '#FFFFFF'
    ctx.fillRect(x, y, size, size)
    if (mark) ctx.drawImage(mark, x + size * 0.15, y + size * 0.15, size * 0.7, size * 0.7)
  } else if (mark) {
    ctx.drawImage(mark, x, y, size, size)
  }
  ctx.textAlign = 'left'
  ctx.fillStyle = ink
  font(ctx, size * 0.62)
  ctx.fillText('AFAQ', x + size * 1.22, y + size * 0.52)
  font(ctx, size * 0.32, SANS, 500)
  ctx.fillStyle = sub
  ctx.fillText('Scientific club', x + size * 1.22, y + size * 0.94)
}

/** A small square, then the label, in pixel type. */
function kicker(ctx, text, x, y, size, ink, square, align = 'left') {
  font(ctx, size)
  spacing(ctx, size * 0.06)
  const label = caps(text)
  const w = ctx.measureText(label).width
  const s = size * 0.55
  const gap = size * 0.45
  const total = s + gap + w
  const left = align === 'right' ? x - total : align === 'center' ? x - total / 2 : x
  ctx.fillStyle = square
  ctx.fillRect(align === 'right' ? left + w + gap : left, y - size * 0.68, s, s)
  ctx.fillStyle = ink
  ctx.textAlign = 'left'
  ctx.fillText(label, align === 'right' ? left : left + s + gap, y)
  spacing(ctx, 0)
}

/** A filled box with a navy step and a sky step, pixel text inside. */
function blueBox(ctx, text, x, y, size, { fill = BLUE, ink = '#FFFFFF', align = 'left', padX = 0.45, near = NAVY, far = SKY } = {}) {
  font(ctx, size)
  spacing(ctx, size * 0.02)
  const w = ctx.measureText(text).width + size * padX * 2
  const h = size * 1.35
  const left = align === 'right' ? x - w : align === 'center' ? x - w / 2 : x
  const d = Math.max(4, Math.round(size * 0.09))
  ctx.fillStyle = far
  ctx.fillRect(left + d * 2, y + d * 2, w, h)
  ctx.fillStyle = near
  ctx.fillRect(left + d, y + d, w, h)
  ctx.fillStyle = fill
  ctx.fillRect(left, y, w, h)
  ctx.fillStyle = ink
  ctx.textAlign = 'left'
  ctx.fillText(text, left + size * padX, y + h * 0.74)
  spacing(ctx, 0)
}

/** A bold line led by a square, the posters' bullet. */
function bullet(ctx, text, x, y, start, { color = NAVY, square = BLUE, rtl = false, weight = 700, maxW = Infinity } = {}) {
  const size = maxW === Infinity ? start : fit(ctx, text, maxW - start, start, start * 0.6, SANS, weight)
  font(ctx, size, SANS, weight)
  const s = size * 0.42
  ctx.fillStyle = square
  ctx.fillRect(rtl ? x - s : x, y - size * 0.5, s, s)
  ctx.textAlign = rtl ? 'right' : 'left'
  ctx.fillStyle = color
  ctx.fillText(text, rtl ? x - s - size * 0.45 : x + s + size * 0.45, y)
}

/** The member's photo in the stepped square, with the frame's art around it. */
function avatar(ctx, assets, data, x, y, size) {
  const unit = size / 20
  const art = size * 1.8
  if (assets.back) ctx.drawImage(assets.back, x - unit * 8, y - unit * 8, art, art)
  ctx.save()
  ctx.beginPath()
  PHOTO_POINTS.forEach(([px, py], i) => ctx[i ? 'lineTo' : 'moveTo'](x + px * unit, y + py * unit))
  ctx.closePath()
  ctx.clip()
  if (assets.photo) {
    const img = assets.photo
    const s = Math.min(img.width, img.height)
    ctx.drawImage(img, (img.width - s) / 2, (img.height - s) / 2, s, s, x, y, size, size)
  } else {
    ctx.fillStyle = BLUE
    ctx.fillRect(x, y, size, size)
    ctx.fillStyle = 'rgba(255,255,255,0.12)'
    for (let g = size / 5; g < size; g += size / 5) {
      ctx.fillRect(x + g, y, 2, size)
      ctx.fillRect(x, y + g, size, 2)
    }
    const dir = ctx.direction
    ctx.direction = 'ltr'
    shadowText(ctx, data.initials, x + size / 2, y + size * 0.63, size * 0.36, '#FFFFFF', [[Math.round(size * 0.025), NAVY]])
    ctx.direction = dir
  }
  ctx.restore()
  if (assets.front) ctx.drawImage(assets.front, x - unit * 8, y - unit * 8, art, art)
}

/** Pixel art from rows of letters, `px` canvas pixels per art pixel. */
function sprite(ctx, rows, x, y, px, palette, mirror = false) {
  rows.forEach((row, r) => [...row].forEach((ch, c) => {
    if (!palette[ch]) return
    const col = mirror ? row.length - 1 - c : c
    ctx.fillStyle = palette[ch]
    ctx.fillRect(Math.round(x + col * px), Math.round(y + r * px), Math.ceil(px), Math.ceil(px))
  }))
}

const ARROW = [
  '....n...',
  '....nn..',
  'nnnnnnn.',
  'nnnnnnnn',
  'nnnnnnn.',
  '....nn..',
  '....n...',
]

/**
 * The XP bar as a circuit trace: it runs across the page with a step down
 * and back up, blue as far as the member got and light after, with pads.
 */
function traceBar(ctx, x0, x1, y, share, rtl, { lw = 7, drop = 44 } = {}) {
  const w = x1 - x0
  let pts = [[0, 0], [0.32, 0], [0.32, drop], [0.68, drop], [0.68, 0], [1, 0]].map(([fx, dy]) => [x0 + fx * w, y + dy])
  if (rtl) pts = pts.map(([px, py]) => [x0 + x1 - px, py])
  const seg = pts.slice(1).map((p, i) => Math.hypot(p[0] - pts[i][0], p[1] - pts[i][1]))
  const total = seg.reduce((a, b) => a + b, 0)
  const pointAt = s => {
    let run = 0
    for (let i = 0; i < seg.length; i++) {
      if (run + seg[i] >= s || i === seg.length - 1) {
        const t = seg[i] ? Math.min(1, (s - run) / seg[i]) : 0
        return [pts[i][0] + (pts[i + 1][0] - pts[i][0]) * t, pts[i][1] + (pts[i + 1][1] - pts[i][1]) * t]
      }
      run += seg[i]
    }
    return pts[pts.length - 1]
  }
  const stroke = (color, from, to) => {
    if (to <= from) return
    ctx.strokeStyle = color
    ctx.lineWidth = lw
    ctx.lineJoin = 'miter'
    ctx.beginPath()
    ctx.moveTo(...pointAt(from))
    let run = 0
    seg.forEach((len, i) => {
      run += len
      if (run > from && run < to) ctx.lineTo(...pts[i + 1])
    })
    ctx.lineTo(...pointAt(to))
    ctx.stroke()
  }
  const cut = Math.max(0, Math.min(1, share)) * total
  stroke(LIGHT, cut, total)
  stroke(BLUE, 0, cut)
  const start = pts[0]
  const end = pts[pts.length - 1]
  const here = pointAt(cut)
  ctx.fillStyle = NAVY
  ctx.fillRect(start[0] - 13, start[1] - 13, 26, 26)
  ctx.fillStyle = SKY
  ctx.fillRect(end[0] - 11, end[1] - 11, 22, 22)
  ctx.fillStyle = SKY
  ctx.fillRect(here[0] - 18, here[1] - 18, 44, 44)
  ctx.fillStyle = NAVY
  ctx.fillRect(here[0] - 22, here[1] - 22, 44, 44)
  ctx.fillStyle = '#FFFFFF'
  ctx.fillRect(here[0] - 8, here[1] - 8, 16, 16)
}

/** Two stepped traces with square ends, coming in from the right edge. */
function cornerTraces(ctx, w, y) {
  const line = (color, x, yy, midX, upY, end) => {
    ctx.strokeStyle = color
    ctx.lineWidth = 6
    ctx.beginPath()
    ctx.moveTo(x, yy)
    ctx.lineTo(midX, yy)
    ctx.lineTo(midX, upY)
    ctx.lineTo(w + 6, upY)
    ctx.stroke()
    ctx.fillStyle = end
    ctx.fillRect(x - 13, yy - 13, 26, 26)
  }
  line(BLUE, w - 300, y + 76, w - 170, y + 6, '#FFFFFF')
  line(SKY, w - 220, y + 128, w - 120, y + 44, BLUE)
}

// ---------- The member's card ----------

/** Card designs, matching the collectible cards in achievements.css. */
const CARD_THEMES = {
  rookie: {
    bg: ['linear', 160, [[0, '#f1f5f9'], [0.55, '#cbd5e1'], [1, '#94a3b8']]],
    ink: '#0f172a', soft: '#475569', chip: 'rgba(255,255,255,0.55)', edge: 'rgba(15,23,42,0.15)', pattern: 'lines',
  },
  explorer: {
    bg: ['linear', 165, [[0, '#022c22'], [0.55, '#065f46'], [1, '#10b981']]], edge: 'rgba(167,243,208,0.35)', pattern: 'dots',
  },
  builder: {
    bg: ['linear', 160, [[0, '#0b1e4a'], [0.6, '#1e40af'], [1, '#3b82f6']]], edge: 'rgba(147,197,253,0.45)', pattern: 'grid',
  },
  innovator: {
    bg: ['linear', 155, [[0, '#1e0546'], [0.5, '#6d28d9'], [1, '#c026d3']]], edge: 'rgba(240,171,252,0.55)', pattern: 'glow', foil: true,
  },
  visionary: {
    bg: ['linear', 155, [[0, '#3b1503'], [0.45, '#b45309'], [0.85, '#fbbf24'], [1, '#fff7cc']]],
    edge: 'rgba(254,240,138,0.75)', edgeW: 0.22, chip: 'rgba(59,21,3,0.35)', pattern: 'rays', foil: true,
  },
  luminary: {
    bg: ['radial', [0.5, 0.3], [[0, '#312e81'], [0.7, '#0b1020']]], edge: null, rainbow: true, pattern: 'stars', foil: true,
  },
  council: {
    bg: ['linear', 165, [[0, '#020617'], [0.55, '#0b1e4a'], [1, '#1d4ed8']]], edge: '#38bdf8', pattern: 'hex', foil: true,
  },
  vanguard: {
    bg: ['linear', 160, [[0, '#0f172a'], [0.45, '#334155'], [0.8, '#cbd5e1'], [1, '#f8fafc']]],
    edge: '#e0f2fe', edgeW: 0.2, chip: 'rgba(15,23,42,0.35)', pattern: 'stripes', foil: true,
  },
  sovereign: {
    bg: ['radial', [0.5, 0.35], [[0, '#2a2112'], [0.7, '#0a0a0a']]],
    edge: '#f5c542', ink: '#fff7d6', soft: '#e9c96b', chip: 'rgba(245,197,66,0.14)', pattern: 'diamonds', gold: true, foil: true,
  },
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

/** A CSS-style gradient (angle in degrees, or a radial centre) over a box. */
function gradient(ctx, spec, x, y, w, h) {
  const [kind, arg, stops] = spec
  let g
  if (kind === 'radial') {
    const [fx, fy] = arg
    const r = Math.hypot(Math.max(fx, 1 - fx) * w, Math.max(fy, 1 - fy) * h)
    g = ctx.createRadialGradient(x + fx * w, y + fy * h, 0, x + fx * w, y + fy * h, r)
  } else {
    const a = (arg * Math.PI) / 180
    const dx = Math.sin(a)
    const dy = -Math.cos(a)
    const len = Math.abs(w * dx) + Math.abs(h * dy)
    const cx = x + w / 2
    const cy = y + h / 2
    g = ctx.createLinearGradient(cx - (dx * len) / 2, cy - (dy * len) / 2, cx + (dx * len) / 2, cy + (dy * len) / 2)
  }
  stops.forEach(([at, color]) => g.addColorStop(at, color))
  return g
}

function cardPattern(ctx, kind, x, y, w, h, em) {
  ctx.save()
  if (kind === 'lines') {
    ctx.globalAlpha = 0.5
    ctx.fillStyle = 'rgba(255,255,255,0.4)'
    for (let px = x; px < x + w; px += em * 0.25) ctx.fillRect(px, y, Math.max(1, em * 0.06), h)
  } else if (kind === 'dots') {
    ctx.globalAlpha = 0.5
    ctx.fillStyle = 'rgba(209,250,229,0.7)'
    for (let py = y + em * 0.8; py < y + h; py += em * 1.6) {
      for (let px = x + em * 0.8; px < x + w; px += em * 1.6) { ctx.beginPath(); ctx.arc(px, py, em * 0.08, 0, Math.PI * 2); ctx.fill() }
    }
  } else if (kind === 'grid') {
    ctx.globalAlpha = 0.5
    ctx.fillStyle = 'rgba(147,197,253,0.25)'
    for (let px = x; px < x + w; px += em * 1.4) ctx.fillRect(px, y, Math.max(1, em * 0.07), h)
    for (let py = y; py < y + h; py += em * 1.4) ctx.fillRect(x, py, w, Math.max(1, em * 0.07))
  } else if (kind === 'glow') {
    ctx.globalAlpha = 0.7
    for (const [fx, fy, r, color] of [[0.2, 0.15, 0.35, 'rgba(34,211,238,0.55)'], [0.85, 0.7, 0.4, 'rgba(236,72,153,0.6)']]) {
      const rr = r * Math.hypot(w, h) * 0.75
      const g = ctx.createRadialGradient(x + fx * w, y + fy * h, 0, x + fx * w, y + fy * h, rr)
      g.addColorStop(0, color)
      g.addColorStop(1, 'rgba(0,0,0,0)')
      ctx.fillStyle = g
      ctx.fillRect(x, y, w, h)
    }
  } else if (kind === 'rays') {
    ctx.globalAlpha = 0.35
    ctx.fillStyle = 'rgba(255,247,204,0.6)'
    const cx = x + w / 2
    const cy = y + h * 0.38
    const r = Math.hypot(w, h)
    for (let a = 0; a < 360; a += 15) {
      const a0 = ((a - 90) * Math.PI) / 180
      const a1 = ((a + 5 - 90) * Math.PI) / 180
      ctx.beginPath()
      ctx.moveTo(cx, cy)
      ctx.lineTo(cx + Math.cos(a0) * r, cy + Math.sin(a0) * r)
      ctx.lineTo(cx + Math.cos(a1) * r, cy + Math.sin(a1) * r)
      ctx.fill()
    }
  } else if (kind === 'stars') {
    ctx.fillStyle = '#FFFFFF'
    for (const [fx, fy, r] of [[0.12, 0.2, 1], [0.78, 0.12, 1.5], [0.3, 0.68, 1], [0.88, 0.58, 1.5], [0.55, 0.4, 1], [0.2, 0.88, 1], [0.66, 0.84, 1.5], [0.42, 0.08, 1], [0.08, 0.5, 1.5], [0.93, 0.32, 1]]) {
      ctx.globalAlpha = 0.85
      ctx.beginPath()
      ctx.arc(x + fx * w, y + fy * h, (r * em) / 12, 0, Math.PI * 2)
      ctx.fill()
    }
  } else if (kind === 'hex' || kind === 'stripes' || kind === 'diamonds') {
    const color = { hex: 'rgba(56,189,248,0.14)', stripes: 'rgba(224,242,254,0.35)', diamonds: '#f5c542' }[kind]
    ctx.globalAlpha = { hex: 0.5, stripes: 0.4, diamonds: 0.25 }[kind]
    ctx.strokeStyle = color
    ctx.lineWidth = Math.max(1, em * (kind === 'hex' ? 0.12 : 0.07))
    const step = em * ({ hex: 1.2, stripes: 0.9, diamonds: 1.2 }[kind])
    const dirs = kind === 'stripes' ? [1] : [1, -1]
    for (const s of dirs) {
      for (let k = -h; k < w + h; k += step) {
        ctx.beginPath()
        ctx.moveTo(x + k, y)
        ctx.lineTo(x + k + s * h, y + h)
        ctx.stroke()
      }
    }
  }
  ctx.restore()
}

/**
 * The member's collectible card, as on the achievements page: theme, emblem,
 * rarity chip, framed photo, name, title, three figures and the member code.
 * Drawn at (x, y) with width `cw` (the card is 5:7).
 */
function drawCard(ctx, x, y, cw, data, labels, assets) {
  const theme = CARD_THEMES[data.card] || CARD_THEMES.rookie
  const ch = (cw * 7) / 5
  const em = cw / 18
  const r = em * 1.1
  const ink = theme.ink || '#FFFFFF'
  const soft = theme.soft || 'rgba(255,255,255,0.72)'
  const chip = theme.chip || 'rgba(255,255,255,0.16)'
  const edge = theme.edge || 'rgba(255,255,255,0.25)'

  ctx.save()
  roundRect(ctx, x, y, cw, ch, r)
  ctx.clip()
  if (theme.rainbow) {
    // Luminary: a rainbow rim around a deep-space face.
    const rim = ctx.createConicGradient ? ctx.createConicGradient(0.6, x + cw / 2, y + ch / 2) : ctx.createLinearGradient(x, y, x + cw, y + ch)
    ;['#f43f5e', '#f59e0b', '#84cc16', '#06b6d4', '#6366f1', '#d946ef', '#f43f5e'].forEach((c, i, all) => rim.addColorStop(i / (all.length - 1), c))
    ctx.fillStyle = rim
    ctx.fillRect(x, y, cw, ch)
    ctx.save()
    roundRect(ctx, x + em * 0.25, y + em * 0.25, cw - em * 0.5, ch - em * 0.5, r * 0.82)
    ctx.clip()
    ctx.fillStyle = gradient(ctx, theme.bg, x, y, cw, ch)
    ctx.fillRect(x, y, cw, ch)
    cardPattern(ctx, theme.pattern, x, y, cw, ch, em)
    ctx.restore()
  } else {
    ctx.fillStyle = gradient(ctx, theme.bg, x, y, cw, ch)
    ctx.fillRect(x, y, cw, ch)
    cardPattern(ctx, theme.pattern, x, y, cw, ch, em)
  }

  // Edge: a thin inset line; the sovereign card gets gold, black, gold.
  const inset = (color, at, width) => {
    ctx.strokeStyle = color
    ctx.lineWidth = width
    roundRect(ctx, x + at + width / 2, y + at + width / 2, cw - (at + width / 2) * 2, ch - (at + width / 2) * 2, Math.max(1, r - at))
    ctx.stroke()
  }
  if (theme.gold) {
    inset('#f5c542', 0, em * 0.15)
    inset('#b7791f', em * 0.45, em * 0.1)
  } else if (edge) {
    inset(edge, 0, em * (theme.edgeW || 0.18))
  }

  const pad = theme.gold ? em * 1.4 : em * 1.1
  const left = x + pad
  const right = x + cw - pad
  const top = y + pad

  // Emblem tile and rarity chip.
  const tile = em * 2.2
  ctx.fillStyle = chip
  roundRect(ctx, left, top, tile, tile, em * 0.6)
  ctx.fill()
  ctx.strokeStyle = edge || 'rgba(255,255,255,0.25)'
  ctx.lineWidth = Math.max(1, em * 0.06)
  ctx.stroke()
  if (assets.emblem) ctx.drawImage(assets.emblem, left + (tile - em * 1.25) / 2, top + (tile - em * 1.25) / 2, em * 1.25, em * 1.25)

  const dir = ctx.direction
  font(ctx, em * 0.72 * 0.95)
  spacing(ctx, em * 0.1)
  const rarity = caps(labels.cardRarity)
  const rw = ctx.measureText(rarity).width + em * 1.5
  const rh = em * 1.25
  ctx.fillStyle = chip
  roundRect(ctx, right - rw, top + (tile - rh) / 2, rw, rh, rh / 2)
  ctx.fill()
  ctx.stroke()
  ctx.fillStyle = ink
  ctx.textAlign = 'center'
  ctx.fillText(rarity, right - rw / 2, top + tile / 2 + em * 0.25)
  spacing(ctx, 0)

  // Framed photo in the middle of the free space.
  const textBlock = em * (1.3 + 0.82 + 0.7 + 3.5 + 1.6)
  const artTop = top + tile
  const artBottom = y + ch - pad - textBlock
  const size = cw * (104 / 288)
  avatar(ctx, assets, data, x + (cw - size) / 2, artTop + (artBottom - artTop - size) / 2, size)

  // Name, title, figures, code.
  let ty = artBottom + em * 1.35
  const name = data.name
  const nameSize = fit(ctx, name, cw - pad * 2, em * 1.3, em * 0.8)
  ctx.textAlign = 'center'
  if (theme.gold) {
    const g = ctx.createLinearGradient(0, ty - nameSize, 0, ty)
    g.addColorStop(0, '#fff3b0')
    g.addColorStop(0.55, '#f5c542')
    g.addColorStop(1, '#b7791f')
    ctx.fillStyle = g
  } else {
    ctx.fillStyle = ink
  }
  font(ctx, nameSize)
  ctx.fillText(name, x + cw / 2, ty)
  ty += em * 1.15
  font(ctx, fit(ctx, caps(labels.cardTitle), cw - pad * 2, em * 0.8, em * 0.5))
  spacing(ctx, em * 0.06)
  ctx.fillStyle = soft
  ctx.fillText(caps(labels.cardTitle), x + cw / 2, ty)
  spacing(ctx, 0)

  ty += em * 0.75
  const gap = em * 0.35
  const bw = (cw - pad * 2 - gap * 2) / 3
  const bh = em * 2.7
  ctx.direction = 'ltr'
  ;[[String(data.xp), labels.xp], [data.rank ? `#${data.rank}` : '—', labels.rank], [String(data.since), labels.since]].forEach(([value, label], i) => {
    const bx = left + i * (bw + gap)
    ctx.fillStyle = chip
    roundRect(ctx, bx, ty, bw, bh, em * 0.6)
    ctx.fill()
    ctx.strokeStyle = edge || 'rgba(255,255,255,0.25)'
    ctx.lineWidth = Math.max(1, em * 0.06)
    ctx.stroke()
    ctx.fillStyle = ink
    ctx.textAlign = 'center'
    font(ctx, fit(ctx, value, bw - em * 0.4, em * 1.05, em * 0.6))
    ctx.fillText(value, bx + bw / 2, ty + em * 1.35)
    ctx.fillStyle = soft
    font(ctx, fit(ctx, caps(label), bw - em * 0.3, em * 0.62, em * 0.4))
    ctx.fillText(caps(label), bx + bw / 2, ty + em * 2.2)
  })
  ty += bh + em * 1.1
  ctx.font = `600 ${em * 0.7}px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace`
  spacing(ctx, em * 0.16)
  ctx.fillStyle = soft
  ctx.fillText(`AFAQ · ${data.code}`, x + cw / 2, ty)
  spacing(ctx, 0)
  ctx.direction = dir

  // Foil sheen on epic cards and up.
  if (theme.foil) {
    const g = ctx.createLinearGradient(x, y, x + cw, y + ch)
    g.addColorStop(0.2, 'rgba(255,255,255,0)')
    g.addColorStop(0.3, 'rgba(255,255,255,0.22)')
    g.addColorStop(0.38, 'rgba(255,255,255,0)')
    g.addColorStop(0.58, 'rgba(255,255,255,0)')
    g.addColorStop(0.64, 'rgba(255,255,255,0.12)')
    g.addColorStop(0.7, 'rgba(255,255,255,0)')
    ctx.fillStyle = g
    ctx.fillRect(x, y, cw, ch)
  }
  ctx.restore()
  return ch
}

/** The card tilted, over the posters' hard navy and sky shadows. */
function heroCard(ctx, cx, top, cw, angle, data, labels, assets, shadows = [[14, NAVY], [28, SKY]]) {
  const ch = (cw * 7) / 5
  const em = cw / 18
  ctx.save()
  ctx.translate(cx, top + ch / 2)
  ctx.rotate(angle)
  for (const [d, color] of [...shadows].sort((a, b) => b[0] - a[0])) {
    ctx.fillStyle = color
    roundRect(ctx, -cw / 2 + d, -ch / 2 + d, cw, ch, em * 1.1)
    ctx.fill()
  }
  drawCard(ctx, -cw / 2, -ch / 2, cw, data, labels, assets)
  ctx.restore()
  return ch
}

// ---------- Status (white, Open Week style) ----------

const STATUS = {
  story: {
    M: 72, header: 72, logo: 74, kicker: 262, kickerSize: 38, title: [430, 170, 90],
    card: [640, 532], facts: [1560, 36, 56], trace: [1726, 1680], footer: 1860,
  },
  post: {
    M: 64, header: 52, logo: 62, kicker: 214, kickerSize: 32, title: [356, 140, 80],
    card: [440, 446], col: 590, facts: [560, 30, 62], trace: [1172, 1128], footer: 1300,
  },
}

function drawStatus(ctx, { w, h }, L, data, labels, assets, size) {
  const { M } = L
  const rtl = data.rtl
  // In Arabic the content mirrors; the logo header and footer stay as they are.
  const X = (x, width = 0) => (rtl ? w - x - width : x)
  const A = a => (rtl ? { left: 'right', right: 'left' }[a] || a : a)
  const tilt = rtl ? 0.05 : -0.05

  paper(ctx, w, h, '#FFFFFF', 'rgba(35,61,255,0.07)')
  halftone(ctx, assets.mark, rtl ? w * 0.2 : w * 0.8, h * 0.56, h * 0.66, rtl ? 0.22 : -0.22, 'rgba(92,188,249,0.5)')

  const dir = ctx.direction
  ctx.direction = 'ltr'
  lockup(ctx, assets.mark, M, L.header, L.logo, NAVY, GREY)
  shadowText(ctx, data.code, w - M, L.header + L.logo * 0.68, L.logo * 0.5, BLUE, [[3, SKY]], 'right')
  ctx.direction = dir

  kicker(ctx, labels.kicker, X(M), L.kicker, L.kickerSize, NAVY, BLUE, A('left'))
  const [titleY, titleMax, titleMin] = L.title
  const title = caps(labels.cardTitle)
  blockText(ctx, title, X(M), titleY, fit(ctx, title, w - M * 2 - 30, titleMax, titleMin), { align: A('left') })

  const [cw, top] = L.card
  if (size === 'story') {
    heroCard(ctx, w / 2, top, cw, tilt, data, labels, assets)
    const [fy, fsize, fgap] = L.facts
    bullet(ctx, labels.collectedLine, X(M), fy, fsize, { square: data.rarityColor, rtl, maxW: w - M * 2 })
    font(ctx, fsize * 0.86, SANS, 500)
    ctx.fillStyle = GREY
    ctx.textAlign = A('left')
    ctx.fillText(labels.progress, X(M + fsize * 0.87), fy + fgap)
  } else {
    heroCard(ctx, X(M + 12 + cw / 2), top, cw, tilt, data, labels, assets, [[10, NAVY], [20, SKY]])
    const colX = X(L.col)
    const colW = w - M - L.col
    const [fy, fsize, fgap] = L.facts
    bullet(ctx, labels.collectedLine, colX, fy, fsize, { square: data.rarityColor, rtl, maxW: colW })
    let y = fy + fgap
    for (const line of labels.factLines) { bullet(ctx, line, colX, y, fsize, { rtl, maxW: colW }); y += fgap }
    font(ctx, fsize * 0.86, SANS, 500)
    ctx.fillStyle = GREY
    ctx.textAlign = A('left')
    wrap(ctx, labels.progress, colW - fsize, 3).forEach(line => {
      ctx.fillText(line, X(L.col + fsize * 0.87), y + fsize * 0.2)
      y += fsize * 1.3
    })
  }

  // Progress to the next tier, as a circuit trace across the page.
  const [ty, labelY] = L.trace
  traceBar(ctx, M + 13, w - M - 11, ty, data.share, rtl)
  font(ctx, L.kickerSize * 0.62)
  spacing(ctx, 2)
  ctx.fillStyle = NAVY
  ctx.textAlign = A('left')
  ctx.fillText(caps(labels.tier), X(M), labelY)
  ctx.fillStyle = BLUE
  ctx.textAlign = A('right')
  ctx.fillText(caps(labels.nextTier), X(w - M), labelY)
  spacing(ctx, 0)

  // Footer: handle on one side, the site with a pixel arrow on the other.
  ctx.direction = 'ltr'
  font(ctx, L.kickerSize * 0.78, SANS, 700)
  ctx.fillStyle = NAVY
  ctx.textAlign = 'left'
  ctx.fillText('@afaq_scientific_club', M, L.footer)
  const arrowPx = L.kickerSize * 0.11
  const arrowW = 8 * arrowPx
  sprite(ctx, ARROW, w - M - arrowW, L.footer - L.kickerSize * 0.62, arrowPx, { n: BLUE })
  shadowText(ctx, 'AFAQ.CLUB', w - M - arrowW - 18, L.footer, L.kickerSize * 0.95, BLUE, [[2, SKY]], 'right')
  ctx.direction = dir
}

// ---------- Member of the month (navy, badge style) ----------

const MOTM = {
  story: {
    M: 72, header: 72, logo: 84, trophy: [196, 9], title: [622, 140, 2], month: 722, monthSize: 40,
    card: [570, 800], box: 1658, boxSize: 38, band: 1790,
  },
  post: {
    M: 64, header: 52, logo: 66, trophy: [148, 6], title: [318, 100, 1], month: 388, monthSize: 30,
    card: [400, 452], box: 1084, boxSize: 30, band: 1226,
  },
}

function drawMotm(ctx, { w, h }, L, data, labels, assets) {
  const { M } = L
  const cx = w / 2
  paper(ctx, w, h, NAVY, 'rgba(92,188,249,0.14)', 72)

  // Faint line doodles, like the badges.
  const spots = [[0.09, 0.32], [0.9, 0.37], [0.08, 0.56], [0.92, 0.6], [0.1, 0.8], [0.9, 0.82], [0.16, 0.44]]
  ctx.globalAlpha = 0.28
  spots.forEach(([fx, fy], i) => {
    const icon = assets.doodles[i % assets.doodles.length]
    const s = w * 0.075
    if (icon) ctx.drawImage(icon, fx * w - s / 2, fy * h - s / 2, s, s)
  })
  ctx.globalAlpha = 1

  const dir = ctx.direction
  ctx.direction = 'ltr'
  cornerTraces(ctx, w, L.header)
  lockup(ctx, assets.mark, M, L.header, L.logo, '#FFFFFF', LIGHT, true)
  ctx.direction = dir

  // Pixel trophy, then the title with stacked shadows, then the month.
  const [trophyY, px] = L.trophy
  sprite(ctx, TROPHY, cx - (15 * px) / 2 + px, trophyY + px, px, { n: BLUE, h: BLUE, y: BLUE, d: BLUE })
  sprite(ctx, TROPHY, cx - (15 * px) / 2, trophyY, px, { n: NAVY, h: '#FFF1B8', y: GOLD, d: '#C98A00' })

  const [titleY, titleMax, maxLines] = L.title
  const title = caps(labels.motmTitle)
  let size = titleMax
  let lines = [title]
  for (; size > titleMax * 0.4; size -= 2) {
    font(ctx, size)
    lines = wrap(ctx, title, w - M * 2, maxLines)
    if (lines.every(l => ctx.measureText(l).width <= w - M * 2)) break
  }
  const lineH = size * 1.02
  const first = titleY - (lines.length - 1) * lineH
  const d = Math.max(3, Math.round(size * 0.035))
  lines.forEach((line, i) => shadowText(ctx, line, cx, first + i * lineH, size, '#FFFFFF',
    [[d, BLUE], [d * 2, BLUE], [d * 3, SKY], [d * 4, SKY]]))

  font(ctx, L.monthSize)
  spacing(ctx, L.monthSize * 0.12)
  const month = caps(labels.month)
  const mw = ctx.measureText(month).width
  ctx.fillStyle = SKY
  ctx.textAlign = 'center'
  ctx.fillText(month, cx, L.month)
  spacing(ctx, 0)
  const sq = L.monthSize * 0.4
  ctx.fillStyle = GOLD
  ctx.fillRect(cx - mw / 2 - sq * 2.4, L.month - L.monthSize * 0.62, sq, sq)
  ctx.fillRect(cx + mw / 2 + sq * 1.4, L.month - L.monthSize * 0.62, sq, sq)

  const [cw, top] = L.card
  heroCard(ctx, cx, top, cw, 0.04, data, labels, assets, [[12, BLUE], [24, SKY]])

  blueBox(ctx, caps(labels.pointsLine), cx, L.box, L.boxSize, { align: 'center', fill: GOLD, ink: NAVY, near: BLUE, far: SKY })

  // Blue band along the bottom: "■ AFAQ SCIENTIFIC CLUB ■", then the site.
  ctx.direction = 'ltr'
  ctx.fillStyle = SKY
  ctx.fillRect(0, L.band - 8, w, 8)
  ctx.fillStyle = BLUE
  ctx.fillRect(0, L.band, w, h - L.band)
  const bandMid = L.band + (h - L.band) * 0.42
  const clubSize = h === FORMATS.post.h ? 32 : 40
  font(ctx, clubSize)
  spacing(ctx, 4)
  const club = 'AFAQ SCIENTIFIC CLUB'
  const clubW = ctx.measureText(club).width
  ctx.fillStyle = '#FFFFFF'
  ctx.textAlign = 'center'
  ctx.fillText(club, cx, bandMid + clubSize * 0.35)
  ctx.fillStyle = SKY
  ctx.fillRect(cx - clubW / 2 - clubSize * 1.15, bandMid - clubSize * 0.18, clubSize * 0.45, clubSize * 0.45)
  ctx.fillRect(cx + clubW / 2 + clubSize * 0.7, bandMid - clubSize * 0.18, clubSize * 0.45, clubSize * 0.45)
  font(ctx, clubSize * 0.65, SANS, 700)
  spacing(ctx, 1)
  ctx.fillStyle = LIGHT
  ctx.fillText('afaq.club · @afaq_scientific_club', cx, bandMid + clubSize * 1.6)
  spacing(ctx, 0)
  ctx.direction = dir
}

/**
 * Draws the share image around the member's card. `data` holds the member's
 * figures and the card's key, `labels` every text already translated,
 * `emblem` the card's icon component.
 */
export async function renderStatusImage({ edition = 'status', format = 'story', data, labels, emblem }) {
  const size = FORMATS[format] ? format : 'story'
  const dims = FORMATS[size]
  const motm = edition === 'motm'
  const L = (motm ? MOTM : STATUS)[size]
  const art = frameArt(data.frame)
  const photoSize = L.card[0] * (104 / 288)
  const artSize = Math.round(photoSize * 1.8 * 2)
  const theme = CARD_THEMES[data.card] || CARD_THEMES.rookie
  await loadFonts()
  const [photo, mark, back, front, emblemImg, ...doodles] = await Promise.all([
    loadImage(data.photo_url),
    loadImage('/brand/logo/afaq-mark-black.png'),
    art?.back ? svgImage(art.back, artSize) : null,
    art?.front ? svgImage(art.front, artSize) : null,
    emblem ? iconImage(emblem, 96, theme.ink || '#FFFFFF', 2.2) : null,
    ...(motm ? [PxStar, PxCrown, PxTrophy, PxFlag, PxShield, PxZap, PxSparkles].map(I => iconImage(I, 96, SKY, 1.6)) : []),
  ])
  const assets = { photo, mark, back, front, emblem: emblemImg, doodles }

  const c = document.createElement('canvas')
  c.width = dims.w
  c.height = dims.h
  const ctx = c.getContext('2d')
  ctx.textBaseline = 'alphabetic'
  ctx.direction = data.rtl ? 'rtl' : 'ltr'
  if (motm) drawMotm(ctx, dims, L, data, labels, assets)
  else drawStatus(ctx, dims, L, data, labels, assets, size)
  return c
}

export { toBlob }
