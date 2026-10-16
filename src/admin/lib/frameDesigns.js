/**
 * Built-in frames for the frame studio, drawn in code instead of shipped as
 * PNGs, so each one works at every canvas size and takes any accent colour.
 * A design only draws shapes and the club mark; its words are ordinary text
 * layers, seeded by `texts` when the design is picked, so they can be edited,
 * moved and restyled like any other text.
 *
 * Seeded layers carry a `role` (title, subtitle, tag, handle); switching
 * designs keeps the words already typed for a role and only restyles them.
 *
 * Everything is measured in u (canvas width / 1080), so a post, a square and
 * a story all get the same proportions.
 */

export const DESIGN_DEFAULTS = { accent: '#233DFF', ink: '#FFFFFF', logo: true }

const NAVY = '#050A30'
const SKY = '#5CBCF9'
const ICE = '#CAE8FF'

/** Draw the club mark centred on (x, y), `size` pixels across. */
export function drawLogo(ctx, path, x, y, size, color) {
  if (!path) return
  ctx.save()
  ctx.translate(x, y)
  const k = size / 1880
  ctx.scale(k, k)
  ctx.translate(-1000, -1000) // the SVG viewBox starts at 60 and is 1880 across
  ctx.fillStyle = color
  ctx.fill(path)
  ctx.restore()
}

function rgba(hex, a) {
  const n = parseInt(hex.slice(1), 16)
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath()
  if (ctx.roundRect) ctx.roundRect(x, y, w, h, r)
  else ctx.rect(x, y, w, h)
}

const title = (text, extra) => ({ role: 'title', text, weight: 900, size: 72, shadow: false, ...extra })
const subtitle = (text, extra) => ({ role: 'subtitle', text, weight: 500, size: 32, color: ICE, shadow: false, ...extra })

export const DESIGNS = [
  {
    key: 'band',
    label: 'Bottom band',
    draw(ctx, { width: W, height: H, u, accent, ink, logo, logoPath }) {
      const bandH = 200 * u
      ctx.fillStyle = accent
      ctx.fillRect(0, H - bandH, W, bandH)
      ctx.fillStyle = rgba('#FFFFFF', 0.25)
      ctx.fillRect(0, H - bandH, W, 6 * u)
      if (logo) drawLogo(ctx, logoPath, W - 115 * u, H - bandH / 2, 120 * u, ink)
    },
    texts: ({ width: W, height: H }) => {
      const u = W / 1080
      return [
        title('Event title', { align: 'left', x: (60 * u) / W, y: (H - 125 * u) / H, size: 60 }),
        subtitle('Date · Place', { align: 'left', x: (60 * u) / W, y: (H - 62 * u) / H }),
      ]
    },
  },
  {
    key: 'cinematic',
    label: 'Cinematic',
    draw(ctx, { width: W, height: H, u, accent, ink, logo, logoPath }) {
      const g = ctx.createLinearGradient(0, H * 0.45, 0, H)
      g.addColorStop(0, rgba(NAVY, 0))
      g.addColorStop(1, rgba(NAVY, 0.94))
      ctx.fillStyle = g
      ctx.fillRect(0, H * 0.45, W, H * 0.55)
      ctx.fillStyle = accent
      ctx.fillRect(60 * u, H - 345 * u, 130 * u, 9 * u)
      if (logo) drawLogo(ctx, logoPath, W - 95 * u, 95 * u, 100 * u, ink)
    },
    texts: ({ width: W, height: H }) => {
      const u = W / 1080
      return [
        title('Event title', { align: 'left', x: (60 * u) / W, y: (H - 250 * u) / H, size: 88 }),
        subtitle('Date · Place', { align: 'left', x: (60 * u) / W, y: (H - 150 * u) / H, size: 36, weight: 400 }),
      ]
    },
  },
  {
    key: 'corners',
    label: 'Tech corners',
    draw(ctx, { width: W, height: H, u, accent, ink, logo, logoPath }) {
      const m = 48 * u
      const len = 150 * u
      ctx.strokeStyle = accent
      ctx.lineWidth = 10 * u
      ctx.lineCap = 'square'
      for (const [x, y, sx, sy] of [[m, m, 1, 1], [W - m, m, -1, 1], [m, H - m, 1, -1], [W - m, H - m, -1, -1]]) {
        ctx.beginPath()
        ctx.moveTo(x, y + sy * len)
        ctx.lineTo(x, y)
        ctx.lineTo(x + sx * len, y)
        ctx.stroke()
      }
      // A few crosshairs, like a viewfinder.
      ctx.lineWidth = 3 * u
      ctx.strokeStyle = rgba('#FFFFFF', 0.7)
      for (const [x, y] of [[W / 2, m], [W / 2, H - m], [m, H / 2], [W - m, H / 2]]) {
        ctx.beginPath()
        ctx.moveTo(x - 14 * u, y)
        ctx.lineTo(x + 14 * u, y)
        ctx.moveTo(x, y - 14 * u)
        ctx.lineTo(x, y + 14 * u)
        ctx.stroke()
      }
      if (logo) drawLogo(ctx, logoPath, W - m - 85 * u, H - m - 85 * u, 100 * u, ink)
    },
    texts: ({ width: W, height: H }) => {
      const u = W / 1080
      const m = 48 * u
      return [
        { role: 'tag', text: 'AFAQ CLUB', font: 'Minecraft', weight: 400, size: 28, align: 'left', x: (m + 40 * u) / W, y: (m + 62 * u) / H, bg: '#233DFF', bgOpacity: 1, pad: 14, radius: 4, shadow: false, spacing: 2 },
        title('Event title', { align: 'left', x: (m + 40 * u) / W, y: (H - m - 95 * u) / H, size: 64, weight: 800, shadow: true }),
      ]
    },
  },
  {
    key: 'polaroid',
    label: 'Polaroid',
    draw(ctx, { width: W, height: H, u, accent, logo, logoPath }) {
      const side = 40 * u
      const bottom = 230 * u
      ctx.fillStyle = '#F7F7F2'
      ctx.beginPath()
      ctx.rect(0, 0, W, H)
      ctx.rect(side, side, W - side * 2, H - side - bottom)
      ctx.fill('evenodd')
      ctx.fillStyle = rgba('#000000', 0.08)
      ctx.fillRect(side, H - bottom, W - side * 2, 3 * u)
      if (logo) drawLogo(ctx, logoPath, W - side - 70 * u, H - bottom / 2, 90 * u, accent)
    },
    texts: ({ width: W, height: H }) => {
      const u = W / 1080
      return [
        { role: 'title', text: 'A day to remember', font: 'Caveat', weight: 700, size: 78, color: NAVY, align: 'left', x: (60 * u) / W, y: (H - 115 * u) / H, shadow: false },
      ]
    },
  },
  {
    key: 'ribbon',
    label: 'Corner ribbon',
    draw(ctx, { width: W, height: H, u, accent, ink, logo, logoPath }) {
      ctx.strokeStyle = accent
      ctx.lineWidth = 16 * u
      ctx.strokeRect(8 * u, 8 * u, W - 16 * u, H - 16 * u)
      ctx.fillStyle = accent
      ctx.beginPath()
      ctx.moveTo(W - 340 * u, 0)
      ctx.lineTo(W - 220 * u, 0)
      ctx.lineTo(W, 220 * u)
      ctx.lineTo(W, 340 * u)
      ctx.closePath()
      ctx.fill()
      if (logo) drawLogo(ctx, logoPath, 100 * u, 100 * u, 100 * u, ink)
    },
    texts: ({ width: W, height: H }) => {
      const u = W / 1080
      return [
        { role: 'tag', text: 'NEW', weight: 900, size: 46, x: (W - 140 * u) / W, y: (140 * u) / H, rotate: 45, shadow: false, spacing: 4 },
        title('Event title', { x: 0.5, y: (H - 140 * u) / H, size: 54, weight: 800, bg: NAVY, bgOpacity: 0.85, pad: 26 }),
      ]
    },
  },
  {
    key: 'circuit',
    label: 'Circuit',
    draw(ctx, { width: W, height: H, u, accent, ink, logo, logoPath }) {
      const g = ctx.createLinearGradient(0, 0, 0, H * 0.35)
      g.addColorStop(0, rgba(NAVY, 0.9))
      g.addColorStop(1, rgba(NAVY, 0))
      ctx.fillStyle = g
      ctx.fillRect(0, 0, W, H * 0.35)
      // [start y as a fraction of H, first run, diagonal, second run] per trace; mirrored on the right.
      const traces = [[0.08, 40, 40, 60], [0.14, 90, -30, 40], [0.62, 60, 50, 50], [0.7, 110, 40, 30], [0.86, 50, -40, 80]]
      ctx.lineWidth = 5 * u
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'
      for (const mirror of [false, true]) {
        const X = x => (mirror ? W - x * u : x * u)
        for (const [fy, a, d, b] of traces) {
          const y = H * fy
          ctx.strokeStyle = accent
          ctx.beginPath()
          ctx.moveTo(X(0), y)
          ctx.lineTo(X(a), y)
          ctx.lineTo(X(a + Math.abs(d)), y + d * u)
          ctx.lineTo(X(a + Math.abs(d) + b), y + d * u)
          ctx.stroke()
          ctx.fillStyle = NAVY
          ctx.beginPath()
          ctx.arc(X(a + Math.abs(d) + b), y + d * u, 10 * u, 0, Math.PI * 2)
          ctx.fill()
          ctx.stroke()
        }
      }
      if (logo) drawLogo(ctx, logoPath, W / 2, H - 95 * u, 90 * u, ink)
    },
    texts: ({ width: W, height: H }) => {
      const u = W / 1080
      return [
        title('Event title', { x: 0.5, y: (140 * u) / H, size: 76 }),
        subtitle('Date · Place', { x: 0.5, y: (225 * u) / H, color: SKY }),
      ]
    },
  },
  {
    key: 'panel',
    label: 'Side panel',
    draw(ctx, { width: W, height: H, u, accent, ink, logo, logoPath }) {
      ctx.fillStyle = rgba(NAVY, 0.92)
      ctx.beginPath()
      ctx.moveTo(0, 0)
      ctx.lineTo(W * 0.42, 0)
      ctx.lineTo(W * 0.32, H)
      ctx.lineTo(0, H)
      ctx.closePath()
      ctx.fill()
      ctx.strokeStyle = accent
      ctx.lineWidth = 14 * u
      ctx.beginPath()
      ctx.moveTo(W * 0.42 + 7 * u, 0)
      ctx.lineTo(W * 0.32 + 7 * u, H)
      ctx.stroke()
      if (logo) drawLogo(ctx, logoPath, 105 * u, 105 * u, 100 * u, ink)
    },
    texts: ({ width: W }) => {
      const u = W / 1080
      return [
        title('EVENT\nTITLE', { align: 'left', x: (60 * u) / W, y: 0.46, size: 76, lineHeight: 1.05 }),
        subtitle('Date · Place', { align: 'left', x: (60 * u) / W, y: 0.6, size: 28, color: SKY }),
      ]
    },
  },
  {
    key: 'glass',
    label: 'Glass card',
    draw(ctx, { width: W, height: H, u, accent, ink, logo, logoPath }) {
      const x = 48 * u
      const w = W - 96 * u
      const h = 230 * u
      const y = H - 48 * u - h
      roundRect(ctx, x, y, w, h, 28 * u)
      ctx.fillStyle = rgba(NAVY, 0.62)
      ctx.fill()
      ctx.lineWidth = 2 * u
      ctx.strokeStyle = rgba('#FFFFFF', 0.2)
      ctx.stroke()
      roundRect(ctx, x + 30 * u, y + 45 * u, 9 * u, h - 90 * u, 5 * u)
      ctx.fillStyle = accent
      ctx.fill()
      if (logo) drawLogo(ctx, logoPath, x + w - 105 * u, y + h / 2, 110 * u, ink)
    },
    texts: ({ width: W, height: H }) => {
      const u = W / 1080
      const y = H - 48 * u - 230 * u
      return [
        title('Event title', { align: 'left', x: (110 * u) / W, y: (y + 88 * u) / H, size: 56, weight: 800 }),
        subtitle('Date · Place', { align: 'left', x: (110 * u) / W, y: (y + 155 * u) / H, size: 30 }),
      ]
    },
  },
  {
    key: 'stamp',
    label: 'Logo stamp',
    draw(ctx, { width: W, height: H, u, ink, logo, logoPath }) {
      if (!logo) return
      ctx.save()
      ctx.shadowColor = 'rgba(0, 0, 0, 0.45)'
      ctx.shadowBlur = 16 * u
      drawLogo(ctx, logoPath, W - 100 * u, H - 100 * u, 110 * u, ink)
      ctx.restore()
    },
    texts: ({ width: W, height: H }) => {
      const u = W / 1080
      return [
        { role: 'handle', text: 'afaq.club', font: 'Space Grotesk', weight: 500, size: 30, align: 'right', x: (W - 175 * u) / W, y: (H - 100 * u) / H },
      ]
    },
  },
]

export const designOf = key => DESIGNS.find(d => d.key === key) || null
