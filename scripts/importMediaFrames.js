/**
 * Upload a folder of club photo frames into the frame studio.
 *
 *   npm run media:frames -- <frames-dir>
 *
 * The folder holds subfolders named after a canvas size (post, square, story),
 * at any depth, of transparent PNGs named like
 * `afaq-frame-01-event-hackathon-post.png` or `afaq-pinkoct-title-v1-post.png`.
 * Each file goes to the uploads bucket under frames/ and gets a media_frames
 * row. Frames already imported (same storage path) are skipped, and so are
 * byte-identical copies of a frame already in the folder, so re-running after
 * adding files only brings in the new ones.
 */
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { createClient } from '@supabase/supabase-js'

const SIZES = ['post', 'square', 'story']
const BUCKET = 'uploads'

const dir = process.argv[2]
if (!dir || !fs.existsSync(dir)) {
  console.error('Usage: npm run media:frames -- <frames-dir>')
  process.exit(1)
}

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

/** Short words in file names, spelled out for the frame picker. */
const WORDS = { pinkoct: 'Pink October' }

/**
 * afaq-frame-01-event-hackathon-post.png → { order: 1, name: 'Event · Hackathon' }
 * afaq-pinkoct-title-v2-card-post.png    → { order: 50, name: 'Pink October · Title v2 Card' }
 */
function describe(file, size) {
  const stem = path.basename(file, '.png').replace(/^afaq-/, '').replace(/^frame-/, '')
    .replace(new RegExp(`-${size}$`), '').replace(/pink-october/, 'pinkoct')
  const words = stem.split('-')
  const order = /^\d+$/.test(words[0]) ? Number(words.shift()) : 50
  const title = w => WORDS[w] || (/^v\d+$/.test(w) ? w : w.charAt(0).toUpperCase() + w.slice(1))
  const [style, ...variant] = words
  const name = variant.length ? `${title(style)} · ${variant.map(title).join(' ')}` : title(style || stem)
  return { order, name }
}

/** Every folder under `root` named post, square or story, with its size. */
function sizeFolders(root) {
  const found = []
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue
    const full = path.join(root, entry.name)
    if (SIZES.includes(entry.name)) found.push({ size: entry.name, folder: full })
    else found.push(...sizeFolders(full))
  }
  return found
}

const { data: existing, error: readError } = await supabase.from('media_frames').select('url')
if (readError) {
  console.error('Could not read media_frames:', readError.message)
  process.exit(1)
}
const known = new Set((existing || []).map(r => r.url))
const seen = new Set()

let added = 0
for (const { size, folder } of sizeFolders(dir)) {
  const files = fs.readdirSync(folder).filter(f => f.toLowerCase().endsWith('.png')).sort()
  for (const file of files) {
    const bytes = fs.readFileSync(path.join(folder, file))
    const hash = crypto.createHash('sha1').update(bytes).digest('hex')
    if (seen.has(hash)) {
      console.log(`${file}: same image as another frame, skipped`)
      continue
    }
    seen.add(hash)

    const storagePath = `frames/${size}/${file}`
    const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(storagePath)
    if (known.has(pub.publicUrl)) continue

    const { error: upError } = await supabase.storage
      .from(BUCKET)
      .upload(storagePath, bytes, { contentType: 'image/png', upsert: true })
    if (upError) {
      console.error(`${file}: upload failed — ${upError.message}`)
      continue
    }

    const { order, name } = describe(file, size)
    const { error: insError } = await supabase
      .from('media_frames')
      .insert({ name, size, url: pub.publicUrl, sort_order: order })
    if (insError) console.error(`${file}: row not saved — ${insError.message}`)
    else added += 1
  }
}

console.log(`${added} frame${added === 1 ? '' : 's'} imported.`)
