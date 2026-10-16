/**
 * Typefaces for text in the frame studio. The brand faces are served from
 * /brand/fonts; the rest come from Google Fonts. A canvas only draws with a
 * web font once the browser has loaded it, so the studio awaits ensureFonts()
 * before every render that uses one.
 */

const BRAND_FACES = [
  ['Thmanyah Sans', 'thmanyahsans', [[300, 'Light'], [400, 'Regular'], [500, 'Medium'], [700, 'Bold'], [900, 'Black']]],
  ['Thmanyah Serif', 'thmanyahserifdisplay', [[300, 'Light'], [400, 'Regular'], [500, 'Medium'], [700, 'Bold'], [900, 'Black']]],
]

/**
 * weights: the ones offered in the picker. script: which text the face is
 * good for, so the picker can group Arabic faces apart from Latin ones.
 */
export const FONTS = [
  { family: 'Thmanyah Sans', weights: [300, 400, 500, 700, 900], script: 'brand' },
  { family: 'Thmanyah Serif', weights: [300, 400, 500, 700, 900], script: 'brand' },
  { family: 'Minecraft', weights: [400], script: 'brand' },
  { family: 'Unixel', weights: [400], script: 'brand' },
  { family: 'Cairo', weights: [400, 600, 700, 900], script: 'arabic', google: true },
  { family: 'Tajawal', weights: [400, 500, 700, 900], script: 'arabic', google: true },
  { family: 'Almarai', weights: [400, 700, 800], script: 'arabic', google: true },
  { family: 'Changa', weights: [400, 600, 800], script: 'arabic', google: true },
  { family: 'El Messiri', weights: [400, 600, 700], script: 'arabic', google: true },
  { family: 'Reem Kufi', weights: [400, 600, 700], script: 'arabic', google: true },
  { family: 'Lalezar', weights: [400], script: 'arabic', google: true },
  { family: 'Amiri', weights: [400, 700], script: 'arabic', google: true },
  { family: 'Aref Ruqaa', weights: [400, 700], script: 'arabic', google: true },
  { family: 'Poppins', weights: [300, 400, 600, 800], script: 'latin', google: true },
  { family: 'Montserrat', weights: [400, 600, 800, 900], script: 'latin', google: true },
  { family: 'Bebas Neue', weights: [400], script: 'latin', google: true },
  { family: 'Oswald', weights: [400, 600, 700], script: 'latin', google: true },
  { family: 'Anton', weights: [400], script: 'latin', google: true },
  { family: 'Playfair Display', weights: [400, 700, 900], script: 'latin', google: true },
  { family: 'Space Grotesk', weights: [400, 500, 700], script: 'latin', google: true },
  { family: 'Orbitron', weights: [400, 700, 900], script: 'latin', google: true },
  { family: 'Press Start 2P', weights: [400], script: 'latin', google: true },
  { family: 'Pacifico', weights: [400], script: 'latin', google: true },
  { family: 'Caveat', weights: [400, 700], script: 'latin', google: true },
]

export const FONT_GROUPS = [
  { script: 'brand', label: 'Club' },
  { script: 'arabic', label: 'Arabic' },
  { script: 'latin', label: 'Latin' },
]

export const fontOf = family => FONTS.find(f => f.family === family) || FONTS[0]

/** The listed weight closest to the one asked for. */
export function nearestWeight(family, weight) {
  const { weights } = fontOf(family)
  return weights.reduce((best, w) => (Math.abs(w - weight) < Math.abs(best - weight) ? w : best), weights[0])
}

let installed = false

/** Register the brand faces and request the Google ones, once per page. */
export function installFonts() {
  if (installed || typeof document === 'undefined') return
  installed = true
  for (const [family, file, cuts] of BRAND_FACES) {
    for (const [weight, cut] of cuts) {
      const face = new FontFace(family, `url(/brand/fonts/${file}-${cut}.woff2) format("woff2")`, { weight: String(weight) })
      document.fonts.add(face)
    }
  }
  const families = FONTS.filter(f => f.google)
    .map(f => `family=${f.family.replace(/ /g, '+')}${f.weights.length > 1 || f.weights[0] !== 400 ? `:wght@${f.weights.join(';')}` : ''}`)
    .join('&')
  const link = document.createElement('link')
  link.rel = 'stylesheet'
  link.href = `https://fonts.googleapis.com/css2?${families}&display=swap`
  document.head.appendChild(link)
}

const ready = new Map()

/**
 * Wait until every (family, weight) used by these text layers can be drawn.
 * Arabic and Latin are both requested, since Google splits faces by script.
 */
export function ensureFonts(layers) {
  installFonts()
  const jobs = []
  for (const l of layers) {
    const key = `${nearestWeight(l.font, l.weight)} 40px "${l.font}"`
    if (!ready.has(key)) {
      ready.set(key, Promise.all([
        document.fonts.load(key, 'Aa'),
        document.fonts.load(key, 'آفاق'),
      ]).catch(() => {}))
    }
    jobs.push(ready.get(key))
  }
  return Promise.all(jobs)
}
