/**
 * Builds src/admin/data/partsCatalog.json — the offline list the inventory
 * "Name" field suggests from while you type.
 *
 * Source: the Fritzing core parts library (CC-BY-SA), ~1,800 maker parts with
 * clean names, families, tags and breadboard artwork. Thumbnails are served
 * from jsDelivr pinned to the commit we read, so they never drift.
 *
 * Fritzing is thin on newer hobby modules (ESP32 dev kits, HC-SR04, L298N…)
 * and has no tools at all, so scripts/data/partsExtra.json is merged on top.
 * Edit that file to add anything the club stocks that is missing here.
 *
 *   node scripts/buildPartsCatalog.js
 *
 * Fetched .fzp files are cached in node_modules/.cache/fritzing-parts, so a
 * re-run only downloads what changed upstream.
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import path from 'node:path'

const REPO = 'fritzing/fritzing-parts'
const BRANCH = 'develop'
const ROOT = path.resolve(import.meta.dirname, '..')
const CACHE = path.join(ROOT, 'node_modules/.cache/fritzing-parts')
const OUT = path.join(ROOT, 'src/admin/data/partsCatalog.json')
const EXTRA = path.join(ROOT, 'scripts/data/partsExtra.json')

// PCB-editor furniture and abstract symbols, not things anyone stocks.
const SKIP_FAMILY = /^(via|hole|pad|copper fill|logo|ground plane|jumper item|net label|power label|frame|ruler|note|schematic|breadboard view|mystery part|pcb|printed circuit board|plain vanilla pcb|generic female header|generic male header|wire|power|ground|dc power|ac power|battery symbol)$/i
const SKIP_TITLE = /(silkscreen|copper (fill|image)|logo|schematic|ruler|^via$|^pad$|^hole$|blocker|net label|power label|ground symbol|frame|heatsink|socket|header|jack|connector|terminal|screw|standoff|fiducial|test point|jumper pad)/i
// Connectors, sockets and hardware nobody tracks as an inventory item.
const SKIP_FAMILY_LIKE = /(header|connector|jack|socket|terminal|heatsink|ctb0|isp|crystal|resonator|inductor|ferrite|fuse holder|textile|eeprom|flash memory|logic gate|74xx|40xx|logic ic|hex ic|mosfet|op-amp|analog mux|stand ?off|donut|generic ic|littlebits|frc|magnet$)/i
// Bare surface-mount chips: the club stocks boards and breakouts, not reels of ICs.
const SMD_PACKAGE = /^(qfn|qfp|tqfp|tqfn|lqfp|tssop|ssop|msop|soic|so\d|sot|sod|lga|bga|dfn|son|wson|uqfn|vqfn|mlf|lcc|plcc|0201|0402|0603|0805|1206|1210|2512|smd|sop|d2pak|dpak|to-?252|to-?263|powerpak|melf|sc-?70|sma|smb|smc|\[smd\])/i
const SPEC_SKIP = new Set(['family', 'layer', 'variant', 'editable pin labels', 'chip label', 'type', 'package', 'pcb pad', 'hole size', 'pin spacing', 'part number', 'mn', 'mpn', 'form', 'shape', 'sparkfun product', 'sku', 'url', 'editable', 'chip', 'view', 'headers', 'connectors', 'target'])

async function getJson(url) {
  const res = await fetch(url, { headers: { 'User-Agent': 'afaq-parts-catalog' } })
  if (!res.ok) throw new Error(`${url} → ${res.status}`)
  return res.json()
}

async function getText(url, attempt = 0) {
  const res = await fetch(url)
  if (res.ok) return res.text()
  if (attempt < 3) return getText(url, attempt + 1)
  throw new Error(`${url} → ${res.status}`)
}

async function mapLimit(items, limit, fn) {
  const out = new Array(items.length)
  let next = 0
  await Promise.all(Array.from({ length: limit }, async () => {
    while (next < items.length) {
      const i = next++
      out[i] = await fn(items[i], i)
    }
  }))
  return out
}

const decode = s => s
  .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&#39;/g, "'")
  .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(n))
  .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
  .replace(/&amp;/g, '&')

const stripHtml = s => decode(s)
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const tag = (xml, name) => {
  const m = xml.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`, 'i'))
  return m ? decode(m[1]).trim() : ''
}

function parseFzp(xml) {
  // Only the module header matters; connector descriptions come after <views>.
  const head = xml.split(/<views>/i)[0]
  const title = tag(head, 'title').replace(/\s+/g, ' ')
  const props = {}
  for (const m of head.matchAll(/<property\s+name=["']([^"']+)["'][^>]*>([\s\S]*?)<\/property>/gi)) {
    const value = decode(m[2]).trim()
    if (value) props[m[1].toLowerCase()] = value
  }
  const tags = [...head.matchAll(/<tag>([\s\S]*?)<\/tag>/gi)].map(m => decode(m[1]).trim()).filter(Boolean)
  const description = stripHtml(tag(head, 'description')).slice(0, 140)
  const icon = xml.match(/<iconView>\s*<layers\s+image=["']([^"']+)["']/i)?.[1]
  const breadboard = xml.match(/<breadboardView>\s*<layers\s+image=["']([^"']+)["']/i)?.[1]
  return { title, props, tags, description, image: breadboard || icon }
}

/** Fritzing families → the inventory categories the form offers. */
function categoryFor(family, title) {
  const text = `${family} ${title}`.toLowerCase()
  if (/multimeter|oscilloscope|power supply unit|soldering|tool/.test(text)) return 'Tools'
  if (/wire|jumper|resistor|capacitor|diode|fuse/.test(text) && !/module|board/.test(text)) return 'Consumables'
  return 'Electronics'
}

/** Tidy family names for display: "microcontroller board (arduino)" → "Microcontroller board". */
function prettyFamily(family) {
  const f = family.replace(/\s*\(.*?\)\s*/g, ' ').replace(/^sparkfun\s+/i, '').replace(/\s+/g, ' ').trim().toLowerCase()
  return f ? f[0].toUpperCase() + f.slice(1) : ''
}

async function main() {
  const commit = await getJson(`https://api.github.com/repos/${REPO}/commits/${BRANCH}`)
  const sha = commit.sha
  const tree = await getJson(`https://api.github.com/repos/${REPO}/git/trees/${sha}?recursive=1`)
  const files = tree.tree.filter(t => /^core\/[^/]+\.fzp$/.test(t.path))
  console.log(`fritzing-parts@${sha.slice(0, 7)}: ${files.length} core parts`)

  await mkdir(CACHE, { recursive: true })
  let fetched = 0
  const parts = await mapLimit(files, 24, async file => {
    // The blob sha changes only when the file does, so it makes a safe cache key.
    const cached = path.join(CACHE, `${file.sha}.fzp`)
    let xml
    if (existsSync(cached)) xml = await readFile(cached, 'utf8')
    else {
      xml = await getText(`https://raw.githubusercontent.com/${REPO}/${sha}/${file.path.split('/').map(encodeURIComponent).join('/')}`)
      await writeFile(cached, xml)
      if (++fetched % 200 === 0) console.log(`  fetched ${fetched}`)
    }
    return parseFzp(xml)
  })

  const imageBase = `https://cdn.jsdelivr.net/gh/${REPO}@${sha}/svg/core/`
  const byName = new Map()

  for (const p of parts) {
    const family = p.props.family || ''
    if (!p.title || SKIP_FAMILY.test(family) || SKIP_FAMILY_LIKE.test(family) || SKIP_TITLE.test(p.title)) continue
    if (SMD_PACKAGE.test(p.props.package || '')) continue

    // A few titles carry editor markup ("_h3_MPL115A1 …__h3_") or file-name underscores.
    const name = p.title.replace(/_+h\d_+/gi, ' ').replace(/_/g, ' ').replace(/\s+/g, ' ').trim()
    if (name.length < 2) continue
    const key = name.toLowerCase()
    // Many parts ship as variants (fix/icsp/bottom) under one title; keep the first.
    if (byName.has(key)) continue

    const specs = Object.entries(p.props)
      .filter(([k, v]) => !SPEC_SKIP.has(k) && v.length < 40 && !v.includes('<'))
      .slice(0, 4)
      .map(([k, v]) => `${k}: ${v}`)

    byName.set(key, {
      name,
      family: prettyFamily(family),
      category: categoryFor(family, name),
      keywords: [...new Set([...p.tags, p.props['part number'], p.props.type, p.props.chip].filter(Boolean))].join(' ').slice(0, 160),
      specs: specs.join(' · '),
      description: p.description,
      image: p.image ? imageBase + p.image.split('/').map(encodeURIComponent).join('/') : null,
      source: 'fritzing',
    })
  }

  const extra = JSON.parse(await readFile(EXTRA, 'utf8'))
  for (const e of extra) {
    byName.set(e.name.toLowerCase(), { family: '', keywords: '', specs: '', description: '', image: null, ...e, source: 'curated' })
  }

  // Curated entries first: they are the parts the club actually buys.
  const catalog = [...byName.values()].sort((a, b) =>
    (a.source === 'curated' ? 0 : 1) - (b.source === 'curated' ? 0 : 1) || a.name.localeCompare(b.name))

  await mkdir(path.dirname(OUT), { recursive: true })
  await writeFile(OUT, JSON.stringify({
    source: `Fritzing parts (CC-BY-SA) ${REPO}@${sha}`,
    builtAt: new Date().toISOString().slice(0, 10),
    parts: catalog,
  }))
  console.log(`wrote ${catalog.length} parts (${extra.length} curated) → ${path.relative(ROOT, OUT)}`)
}

main().catch(err => { console.error(err); process.exit(1) })
