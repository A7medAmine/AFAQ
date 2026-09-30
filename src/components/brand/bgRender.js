// Canvas renderer for the brand background generator. Everything is drawn in
// units relative to the canvas width so the small preview and the full-size
// export produce the same picture.

export const BG_THEMES = {
  midnight: { bg: ['#050A30', '#0B1450'], ink: '#5CBCF9', glow: ['#233DFF'], logo: '#FFFFFF', text: '#FFFFFF', sub: '#CAE8FF' },
  aurora: { bg: ['#050A30', '#050A30'], ink: '#5CBCF9', glow: ['#233DFF', '#5CBCF9', '#12229D'], logo: '#FFFFFF', text: '#FFFFFF', sub: '#CAE8FF' },
  electric: { bg: ['#233DFF', '#12229D'], ink: '#CAE8FF', glow: ['#5CBCF9'], logo: '#FFFFFF', text: '#FFFFFF', sub: '#CAE8FF' },
  deep: { bg: ['#12229D', '#050A30'], ink: '#5CBCF9', glow: ['#233DFF'], logo: '#CAE8FF', text: '#FFFFFF', sub: '#CAE8FF' },
  slate: { bg: ['#3C4C59', '#1C252D'], ink: '#CAE8FF', glow: ['#5CBCF9'], logo: '#FFFFFF', text: '#FFFFFF', sub: '#CAE8FF' },
  sky: { bg: ['#5CBCF9', '#233DFF'], ink: '#F4F6FC', glow: ['#CAE8FF'], logo: '#FFFFFF', text: '#FFFFFF', sub: '#F4F6FC' },
  ice: { bg: ['#CAE8FF', '#F4F6FC'], ink: '#12229D', glow: ['#5CBCF9'], logo: '#050A30', text: '#050A30', sub: '#3C4C59' },
  cloud: { bg: ['#F4F6FC', '#FFFFFF'], ink: '#233DFF', glow: ['#CAE8FF'], logo: '#050A30', text: '#050A30', sub: '#3C4C59' },
}

export const BG_PATTERNS = ['horizon', 'grid', 'dots', 'circuit', 'dither', 'rings', 'monogram', 'stripes', 'stars', 'mosaic', 'none']

export const BG_SIZES = [
  { key: 'desktop', w: 1920, h: 1080 },
  { key: '4k', w: 3840, h: 2160 },
  { key: 'phone', w: 1080, h: 1920 },
  { key: 'post', w: 1080, h: 1080 },
  { key: 'portrait', w: 1080, h: 1350 },
  { key: 'story', w: 1080, h: 1920 },
  { key: 'facebook', w: 1640, h: 624 },
  { key: 'linkedin', w: 1584, h: 396 },
  { key: 'twitter', w: 1500, h: 500 },
  { key: 'youtube', w: 2560, h: 1440 },
  { key: 'a4', w: 2480, h: 3508 },
]

function rng(seed) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function withAlpha(hex, a) {
  const n = parseInt(hex.slice(1), 16)
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`
}

// Logo path lives in a 1880-unit box starting at (60, 60) — see the SVG viewBox.
const LOGO_BOX = 1880
function drawMark(ctx, path, x, y, size, color, rot = 0) {
  ctx.save()
  ctx.translate(x, y)
  if (rot) ctx.rotate(rot)
  const k = size / LOGO_BOX
  ctx.scale(k, k)
  ctx.translate(-60 - LOGO_BOX / 2, -60 - LOGO_BOX / 2)
  ctx.fillStyle = color
  ctx.fill(path)
  ctx.restore()
}

const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5]

const PATTERNS = {
  none() {},

  grid(ctx, { W, H, u, ink, density }) {
    const step = 40 * u / density
    ctx.lineWidth = Math.max(1, u)
    let i = 0
    for (let x = 0; x <= W; x += step, i++) {
      ctx.strokeStyle = withAlpha(ink, i % 4 === 0 ? 1 : 0.45)
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke()
    }
    i = 0
    for (let y = 0; y <= H; y += step, i++) {
      ctx.strokeStyle = withAlpha(ink, i % 4 === 0 ? 1 : 0.45)
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke()
    }
  },

  dots(ctx, { W, H, u, ink, density }) {
    const step = 28 * u / density
    const r = 2.2 * u
    ctx.fillStyle = ink
    for (let y = step / 2; y < H; y += step)
      for (let x = step / 2; x < W; x += step) ctx.fillRect(x - r, y - r, r * 2, r * 2)
  },

  circuit(ctx, { W, H, u, ink, density, rand }) {
    const g = 32 * u
    const n = Math.round(((W * H) / (g * g)) * 0.05 * density)
    const dirs = [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]]
    ctx.strokeStyle = ink
    ctx.fillStyle = ink
    ctx.lineWidth = 2.5 * u
    ctx.lineJoin = 'round'
    for (let i = 0; i < n; i++) {
      let x = Math.round((rand() * W) / g) * g
      let y = Math.round((rand() * H) / g) * g
      let d = Math.floor(rand() * 4) * 2
      ctx.beginPath(); ctx.moveTo(x, y)
      const steps = 3 + Math.floor(rand() * 10)
      for (let s = 0; s < steps; s++) {
        if (rand() < 0.3) d = (d + (rand() < 0.5 ? 1 : 7)) % 8
        x += dirs[d][0] * g; y += dirs[d][1] * g
        ctx.lineTo(x, y)
      }
      ctx.stroke()
      ctx.beginPath(); ctx.arc(x, y, 6 * u, 0, Math.PI * 2); ctx.lineWidth = 2.5 * u; ctx.stroke()
      ctx.fillRect(x - 2 * u, y - 2 * u, 4 * u, 4 * u)
    }
  },

  dither(ctx, { W, H, u, ink, density }) {
    // Ordered-dither fade from the bottom: a pixel-art horizon.
    const p = 12 * u / Math.sqrt(density)
    ctx.fillStyle = ink
    for (let y = 0, j = 0; y < H; y += p, j++) {
      const t = Math.pow(y / H, 1.6)
      for (let x = 0, i = 0; x < W; x += p, i++) {
        if (BAYER[(j % 4) * 4 + (i % 4)] / 16 < t) ctx.fillRect(x, y, p, p)
      }
    }
  },

  rings(ctx, { W, H, u, ink, density }) {
    const cx = W * 0.82, cy = H * 0.78
    const step = 46 * u / density
    const max = Math.hypot(W, H)
    ctx.strokeStyle = ink
    for (let r = step, i = 0; r < max; r += step, i++) {
      ctx.lineWidth = (i % 3 === 0 ? 10 : 3) * u
      // A gap in each ring, echoing the cut in the logo circle.
      const gap = 0.35
      const start = -2.0 + i * 0.07
      ctx.beginPath(); ctx.arc(cx, cy, r, start + gap, start + Math.PI * 2 - gap); ctx.stroke()
    }
  },

  monogram(ctx, { W, H, u, ink, density, logoPath }) {
    if (!logoPath) return
    const step = 150 * u / density
    const size = step * 0.42
    let row = 0
    for (let y = step / 2; y < H + step; y += step * 0.866, row++) {
      for (let x = (row % 2 ? step / 2 : 0); x < W + step; x += step) {
        drawMark(ctx, logoPath, x, y, size, ink)
      }
    }
  },

  stripes(ctx, { W, H, u, ink, density }) {
    // Same slant as the bolt.
    const angle = -1.2
    const step = 38 * u / density
    ctx.save()
    ctx.translate(W / 2, H / 2)
    ctx.rotate(angle)
    const R = Math.hypot(W, H)
    ctx.fillStyle = ink
    for (let x = -R; x < R; x += step) ctx.fillRect(x, -R, step * 0.28, R * 2)
    ctx.restore()
  },

  stars(ctx, { W, H, u, ink, density, rand }) {
    const n = Math.round((W * H) / (90 * u) ** 2 * 1.4 * density)
    ctx.fillStyle = ink
    for (let i = 0; i < n; i++) {
      const x = rand() * W, y = rand() * H
      const s = Math.ceil(rand() * 3) * 2 * u
      ctx.globalAlpha = 0.3 + rand() * 0.7
      ctx.fillRect(x, y, s, s)
      if (rand() < 0.06) {
        // pixel sparkle
        ctx.fillRect(x - s * 2, y, s, s); ctx.fillRect(x + s * 2, y, s, s)
        ctx.fillRect(x, y - s * 2, s, s); ctx.fillRect(x, y + s * 2, s, s)
      }
    }
    ctx.globalAlpha = 1
  },

  mosaic(ctx, { W, H, u, density, rand }) {
    const p = 64 * u / density
    const pal = ['#050A30', '#12229D', '#233DFF', '#3C4C59', '#5CBCF9', '#CAE8FF']
    for (let y = 0; y < H; y += p)
      for (let x = 0; x < W; x += p) {
        if (rand() < 0.55) continue
        ctx.fillStyle = pal[Math.floor(rand() * pal.length)]
        ctx.globalAlpha = 0.25 + rand() * 0.75
        ctx.fillRect(x, y, p, p)
      }
    ctx.globalAlpha = 1
  },

  horizon(ctx, { W, H, u, ink, density }) {
    // Perspective grid under a horizon line — آفاق literally means horizons.
    const hy = H * 0.58
    const vx = W / 2
    ctx.strokeStyle = ink
    ctx.lineWidth = 2 * u
    const cols = Math.round(26 * density)
    for (let i = -cols; i <= cols; i++) {
      ctx.beginPath(); ctx.moveTo(vx, hy); ctx.lineTo(vx + (i / cols) * W * 2.2, H); ctx.stroke()
    }
    const rows = Math.round(14 * density)
    for (let i = 1; i <= rows; i++) {
      const t = (i / rows) ** 2.2
      const y = hy + (H - hy) * t
      ctx.globalAlpha = 0.25 + 0.75 * t
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke()
    }
    ctx.globalAlpha = 1
    ctx.lineWidth = 4 * u
    ctx.beginPath(); ctx.moveTo(0, hy); ctx.lineTo(W, hy); ctx.stroke()
  },
}

/**
 * opts: { theme, pattern, density, opacity, seed, glow, logo, logoSize, title, subtitle, textPos, grain }
 */
export function renderBackground(ctx, W, H, opts, logoPath) {
  const th = BG_THEMES[opts.theme]
  const u = Math.min(W, H) / 1080
  const rand = rng(opts.seed)

  // base gradient
  const g = ctx.createLinearGradient(0, 0, W * 0.3, H)
  g.addColorStop(0, th.bg[0]); g.addColorStop(1, th.bg[1])
  ctx.fillStyle = g
  ctx.fillRect(0, 0, W, H)

  // glows
  if (opts.glow) {
    const spots = th.glow.length > 1
      ? th.glow.map(() => [rand() * W, rand() * H])
      : [[W * (0.65 + rand() * 0.25), H * (0.15 + rand() * 0.3)]]
    th.glow.forEach((c, i) => {
      const [x, y] = spots[i]
      const r = Math.max(W, H) * 0.6
      const rg = ctx.createRadialGradient(x, y, 0, x, y, r)
      rg.addColorStop(0, withAlpha(c, 0.55)); rg.addColorStop(1, withAlpha(c, 0))
      ctx.fillStyle = rg
      ctx.fillRect(0, 0, W, H)
    })
  }

  // pattern
  ctx.save()
  ctx.globalAlpha = opts.opacity
  PATTERNS[opts.pattern]?.(ctx, { W, H, u, ink: th.ink, density: opts.density, rand, logoPath })
  ctx.restore()

  // film grain for print-like texture
  if (opts.grain) {
    const gr = rng(opts.seed + 1)
    const p = Math.max(1, Math.round(2 * u))
    for (let i = 0; i < (W * H) / (p * p) / 6; i++) {
      ctx.fillStyle = gr() < 0.5 ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.06)'
      ctx.fillRect(Math.floor(gr() * W / p) * p, Math.floor(gr() * H / p) * p, p, p)
    }
  }

  // logo
  if (logoPath && opts.logo !== 'none') {
    const s = Math.min(W, H) * opts.logoSize
    const m = Math.min(W, H) * 0.08
    if (opts.logo === 'center') drawMark(ctx, logoPath, W / 2, H / 2 - (opts.title ? s * 0.35 : 0), s, th.logo)
    if (opts.logo === 'corner') drawMark(ctx, logoPath, m + s * 0.25, m + s * 0.25, s * 0.5, th.logo)
    if (opts.logo === 'watermark') {
      ctx.globalAlpha = 0.12
      drawMark(ctx, logoPath, W * 0.78, H * 0.62, Math.max(W, H) * 0.7, th.logo)
      ctx.globalAlpha = 1
    }
  }

  // text
  if (opts.title || opts.subtitle) {
    const ar = (t) => /[؀-ۿ]/.test(t)
    const ts = Math.min(W, H) * 0.09 * opts.textSize
    const center = opts.textPos === 'center'
    const m = Math.min(W, H) * 0.08
    let y = center
      ? H / 2 + (opts.logo === 'center' ? Math.min(W, H) * opts.logoSize * 0.35 + ts : 0)
      : H - m - (opts.subtitle ? ts * 0.9 : 0)
    ctx.textBaseline = 'alphabetic'
    if (opts.title) {
      const rtl = ar(opts.title)
      ctx.direction = rtl ? 'rtl' : 'ltr'
      ctx.textAlign = center ? 'center' : rtl ? 'right' : 'left'
      ctx.font = `${ts}px ${rtl ? '"Unixel"' : '"Minecraft"'}, monospace`
      ctx.fillStyle = th.text
      ctx.fillText(opts.title, center ? W / 2 : rtl ? W - m : m, y)
    }
    if (opts.subtitle) {
      const rtl = ar(opts.subtitle)
      ctx.direction = rtl ? 'rtl' : 'ltr'
      ctx.textAlign = center ? 'center' : rtl ? 'right' : 'left'
      ctx.font = `500 ${ts * 0.36}px "Thmanyah Sans", sans-serif`
      ctx.fillStyle = th.sub
      ctx.fillText(opts.subtitle, center ? W / 2 : rtl ? W - m : m, y + ts * 0.75)
    }
  }
}
