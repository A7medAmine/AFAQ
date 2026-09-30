// Single source for the /brand page. The static files under public/brand are
// generated from the same values by scripts/build_brand_kit.py — keep in sync.

export const BRAND_ZIP = '/brand/afaq-brand-kit.zip'

export const COLORS = [
  { key: 'midnight', hex: '#050A30', role: 'primary' },
  { key: 'deepBlue', hex: '#12229D', role: 'primary' },
  { key: 'afaqBlue', hex: '#233DFF', role: 'accent' },
  { key: 'slate', hex: '#3C4C59', role: 'neutral' },
  { key: 'sky', hex: '#5CBCF9', role: 'accent' },
  { key: 'ice', hex: '#CAE8FF', role: 'neutral' },
  { key: 'cloud', hex: '#F4F6FC', role: 'neutral' },
]

export const PALETTE_FILES = [
  { label: 'CSS variables', file: '/brand/palette/afaq-colors.css' },
  { label: 'Tailwind v4', file: '/brand/palette/afaq-tailwind.css' },
  { label: 'JSON', file: '/brand/palette/afaq-colors.json' },
  { label: 'Adobe .ase', file: '/brand/palette/afaq.ase' },
  { label: 'GIMP / Inkscape .gpl', file: '/brand/palette/afaq.gpl' },
  { label: 'Palette image', file: '/brand/palette.png' },
]

// Mark variants. `fill` is the colour the SVG is recoloured to, `bg` the tile it
// is previewed on.
export const LOGO_VARIANTS = [
  { key: 'navyOnLight', fill: '#050A30', bg: '#F4F6FC', file: 'navy' },
  { key: 'whiteOnMidnight', fill: '#FFFFFF', bg: '#050A30', file: 'white' },
  { key: 'whiteOnBlue', fill: '#FFFFFF', bg: '#233DFF', file: 'white' },
  { key: 'blueOnLight', fill: '#233DFF', bg: '#FFFFFF', file: 'blue' },
  { key: 'blackOnLight', fill: '#000000', bg: '#FFFFFF', file: 'black' },
  { key: 'midnightOnIce', fill: '#050A30', bg: '#CAE8FF', file: 'navy' },
]

export const LOGO_SVG = (file) => `/brand/logo/afaq-mark-${file}.svg`
export const LOGO_PNG = (file, size) => `/brand/logo/png/afaq-mark-${file}-${size}.png`
export const PNG_SIZES = [256, 512, 1024, 2048]

export const LOGO_EXTRAS = [
  { key: 'tileMidnight', file: '/brand/logo/png/afaq-tile-midnight-1024.png', bg: '#050A30' },
  { key: 'tileBlue', file: '/brand/logo/png/afaq-tile-afaq-blue-1024.png', bg: '#233DFF' },
  { key: 'tileCloud', file: '/brand/logo/png/afaq-tile-cloud-1024.png', bg: '#F4F6FC' },
  { key: 'squareOriginal', file: '/brand/logo/afaq-mark-navy-square.jpg', bg: '#050A30' },
]

const W = (name, weight, base) => ({
  name,
  weight,
  woff2: `/brand/fonts/${base}.woff2`,
  ttf: `/brand/fonts/${base}.ttf`,
})

export const FONTS = [
  {
    key: 'thmanyahSans',
    zip: '/brand/fonts/zip/thmanyah-sans.zip',
    family: 'Thmanyah Sans',
    css: "'Thmanyah Sans', system-ui, sans-serif",
    cls: 'bk-f-sans',
    script: 'ar',
    weights: [
      W('Light', 300, 'thmanyahsans-Light'),
      W('Regular', 400, 'thmanyahsans-Regular'),
      W('Medium', 500, 'thmanyahsans-Medium'),
      W('Bold', 700, 'thmanyahsans-Bold'),
      W('Black', 900, 'thmanyahsans-Black'),
    ],
  },
  {
    key: 'thmanyahSerif',
    zip: '/brand/fonts/zip/thmanyah-serif-display.zip',
    family: 'Thmanyah Serif Display',
    css: "'Thmanyah Serif Display', serif",
    cls: 'bk-f-serif',
    script: 'ar',
    weights: [
      W('Light', 300, 'thmanyahserifdisplay-Light'),
      W('Regular', 400, 'thmanyahserifdisplay-Regular'),
      W('Medium', 500, 'thmanyahserifdisplay-Medium'),
      W('Bold', 700, 'thmanyahserifdisplay-Bold'),
      W('Black', 900, 'thmanyahserifdisplay-Black'),
    ],
  },
  {
    key: 'minecraft',
    zip: '/brand/fonts/zip/minecraft.zip',
    family: 'Minecraft',
    css: "'Minecraft', ui-monospace, monospace",
    cls: 'bk-f-mine',
    script: 'latin',
    weights: [
      { name: 'Regular', weight: 400, woff2: '/brand/fonts/Minecraft.woff2', ttf: '/brand/fonts/Minecraft.ttf' },
    ],
  },
  {
    key: 'unixel',
    zip: '/brand/fonts/zip/unixel.zip',
    family: 'Unixel',
    css: "'Unixel', ui-monospace, monospace",
    cls: 'bk-f-unixel',
    script: 'ar',
    weights: [
      { name: 'Regular', weight: 400, ttf: '/brand/fonts/unixel-Regular.ttf' },
    ],
  },
]

// Type scale. `font` points at a FONTS key; `ar` picks the Arabic face.
export const TYPE_SCALE = [
  { key: 'display', size: 72, line: 1.05, latin: 'minecraft', ar: 'unixel', weight: 400 },
  { key: 'h1', size: 48, line: 1.1, latin: 'minecraft', ar: 'unixel', weight: 400 },
  { key: 'h2', size: 36, line: 1.15, latin: 'minecraft', ar: 'unixel', weight: 400 },
  { key: 'h3', size: 24, line: 1.25, latin: 'thmanyahSans', ar: 'thmanyahSerif', weight: 700 },
  { key: 'body', size: 16, line: 1.7, latin: 'thmanyahSans', ar: 'thmanyahSans', weight: 400 },
  { key: 'small', size: 14, line: 1.6, latin: 'thmanyahSans', ar: 'thmanyahSans', weight: 500 },
  { key: 'label', size: 12, line: 1.4, latin: 'minecraft', ar: 'thmanyahSans', weight: 700 },
]

/* ---------- colour maths ---------- */

export function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

export function rgbToHex([r, g, b]) {
  return '#' + [r, g, b].map(v => Math.round(v).toString(16).padStart(2, '0')).join('').toUpperCase()
}

export function rgbToHsl([r, g, b]) {
  r /= 255; g /= 255; b /= 255
  const max = Math.max(r, g, b), min = Math.min(r, g, b)
  const l = (max + min) / 2
  let h = 0, s = 0
  if (max !== min) {
    const d = max - min
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
    if (max === r) h = (g - b) / d + (g < b ? 6 : 0)
    else if (max === g) h = (b - r) / d + 2
    else h = (r - g) / d + 4
    h *= 60
  }
  return [Math.round(h), Math.round(s * 100), Math.round(l * 100)]
}

export function rgbToCmyk([r, g, b]) {
  const k = 1 - Math.max(r, g, b) / 255
  if (k === 1) return [0, 0, 0, 100]
  const c = (1 - r / 255 - k) / (1 - k)
  const m = (1 - g / 255 - k) / (1 - k)
  const y = (1 - b / 255 - k) / (1 - k)
  return [c, m, y, k].map(v => Math.round(v * 100))
}

export function formats(hex) {
  const rgb = hexToRgb(hex)
  const [h, s, l] = rgbToHsl(rgb)
  const [c, m, y, k] = rgbToCmyk(rgb)
  return {
    HEX: hex,
    RGB: `rgb(${rgb.join(', ')})`,
    HSL: `hsl(${h}, ${s}%, ${l}%)`,
    CMYK: `cmyk(${c}%, ${m}%, ${y}%, ${k}%)`,
  }
}

/** Mix toward white (positive amount) or black (negative). */
export function mix(hex, amount) {
  const rgb = hexToRgb(hex)
  const target = amount > 0 ? 255 : 0
  const a = Math.abs(amount)
  return rgbToHex(rgb.map(v => v + (target - v) * a))
}

export function tintScale(hex) {
  return [-0.6, -0.4, -0.2, 0, 0.2, 0.4, 0.6, 0.8].map(a => ({ step: a, hex: a === 0 ? hex : mix(hex, a) }))
}

function luminance(hex) {
  return hexToRgb(hex)
    .map(v => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4 })
    .reduce((acc, v, i) => acc + v * [0.2126, 0.7152, 0.0722][i], 0)
}

export function contrast(a, b) {
  const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p)
  return (x + 0.05) / (y + 0.05)
}

export const readableOn = (hex) => (contrast(hex, '#FFFFFF') >= contrast(hex, '#050A30') ? '#FFFFFF' : '#050A30')
