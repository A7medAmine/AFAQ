/**
 * Media planner vocabulary, shared by the board, the calendar, the post drawer
 * and the frame studio, so a stage or a platform reads the same everywhere.
 */

/**
 * The road a post travels. `owner` is the post column holding the person the
 * stage waits on; `next` is the label of the button that hands it on.
 */
export const STAGES = [
  { value: 'idea', label: 'Ideas', owner: 'writer_id', next: 'Write caption', tone: 'neutral' },
  { value: 'caption', label: 'Caption', owner: 'writer_id', next: 'Ready to shoot', tone: 'wait' },
  { value: 'shooting', label: 'Shooting', owner: 'photographer_id', next: 'Send to editing', tone: 'signal' },
  { value: 'editing', label: 'Editing', owner: 'editor_id', next: 'Send for review', tone: 'signal' },
  { value: 'review', label: 'Review', owner: null, next: 'Approve', tone: 'wait' },
  { value: 'scheduled', label: 'Ready to post', owner: 'publisher_id', next: 'Mark posted', tone: 'ok' },
  { value: 'posted', label: 'Posted', owner: null, next: null, tone: 'ok' },
]

/** Off the board but kept for the record. */
export const DROPPED = { value: 'dropped', label: 'Dropped', tone: 'neutral' }

export const stageOf = status => STAGES.find(s => s.value === status) || DROPPED

/** The stage after this one, skipping the shoot when the post needs none. */
export function nextStage(post) {
  const i = STAGES.findIndex(s => s.value === post.status)
  if (i < 0 || i >= STAGES.length - 1) return null
  const next = STAGES[i + 1]
  if (next.value === 'shooting' && !post.needs_shoot) return STAGES[i + 2]
  return next
}

/** The stage before this one, for "send back". */
export function previousStage(post) {
  const i = STAGES.findIndex(s => s.value === post.status)
  if (i <= 0) return null
  const prev = STAGES[i - 1]
  if (prev.value === 'shooting' && !post.needs_shoot) return STAGES[i - 2]
  return prev
}

export const ROLES = [
  { key: 'writer_id', label: 'Ideas & caption' },
  { key: 'photographer_id', label: 'Photographer' },
  { key: 'editor_id', label: 'Editor' },
  { key: 'publisher_id', label: 'Publisher' },
]

export const FORMATS = [
  { value: 'post', label: 'Post', size: 'post' },
  { value: 'carousel', label: 'Carousel', size: 'post' },
  { value: 'story', label: 'Story', size: 'story' },
  { value: 'reel', label: 'Reel', size: 'story' },
  { value: 'video', label: 'Video', size: 'square' },
  { value: 'article', label: 'Article', size: 'square' },
]

export const formatLabel = value => FORMATS.find(f => f.value === value)?.label || value

/**
 * Caption limits are each network's own. `short` is where the text gets cut
 * behind "more" — the part people actually read.
 */
export const PLATFORMS = [
  { value: 'instagram', label: 'Instagram', short: 'IG', limit: 2200, fold: 125 },
  { value: 'facebook', label: 'Facebook', short: 'FB', limit: 63206, fold: 480 },
  { value: 'tiktok', label: 'TikTok', short: 'TT', limit: 2200, fold: 100 },
  { value: 'linkedin', label: 'LinkedIn', short: 'IN', limit: 3000, fold: 210 },
  { value: 'x', label: 'X', short: 'X', limit: 280, fold: 280 },
  { value: 'youtube', label: 'YouTube', short: 'YT', limit: 5000, fold: 157 },
]

export const platformOf = value => PLATFORMS.find(p => p.value === value)

export const CAPTION_LANGS = [
  { value: 'ar', label: 'العربية', column: 'caption_ar', dir: 'rtl' },
  { value: 'fr', label: 'Français', column: 'caption_fr', dir: 'ltr' },
  { value: 'en', label: 'English', column: 'caption_en', dir: 'ltr' },
]

export const ASSET_KINDS = [
  { value: 'raw', label: 'Raw photos' },
  { value: 'final', label: 'Final' },
  { value: 'reference', label: 'References' },
]

export const SNIPPET_KINDS = [
  { value: 'hashtags', label: 'Hashtags' },
  { value: 'template', label: 'Templates' },
  { value: 'cta', label: 'Calls to action' },
]

/** Canvas sizes the frames come in, in pixels. */
export const CANVAS_SIZES = {
  post: { label: 'Post 4:5', width: 1080, height: 1350 },
  square: { label: 'Square 1:1', width: 1080, height: 1080 },
  story: { label: 'Story 9:16', width: 1080, height: 1920 },
}

/** Past its publish time and not out yet. */
export function isLate(post, now = new Date()) {
  if (!post.publish_at || ['posted', 'dropped'].includes(post.status)) return false
  return new Date(post.publish_at) < now
}

/** Whether this post is waiting on this admin right now. */
export function waitsOn(post, adminId) {
  if (!adminId) return false
  const owner = stageOf(post.status).owner
  return owner ? post[owner] === adminId : false
}

/** Everyone named on the post, for "involves me". */
export const involves = (post, adminId) => ROLES.some(r => post[r.key] === adminId)

/** The caption with its hashtags, ready to paste into a network. */
export function fullCaption(post, lang) {
  const column = CAPTION_LANGS.find(l => l.value === lang)?.column
  const text = (column && post[column]) || ''
  const tags = (post.hashtags || '').trim()
  return [text.trim(), tags].filter(Boolean).join('\n\n')
}

/**
 * The usual run of posts around one event, as offsets from its date. The
 * "plan from event" button creates these in one go.
 */
export const EVENT_PLAN = [
  { title: 'Announcement', format: 'post', days: -7, hour: 18, needs_shoot: false },
  { title: 'Registration reminder', format: 'story', days: -2, hour: 18, needs_shoot: false },
  { title: 'Countdown — tomorrow', format: 'story', days: -1, hour: 20, needs_shoot: false },
  { title: 'Live stories', format: 'story', days: 0, hour: 12, needs_shoot: true },
  { title: 'Recap', format: 'carousel', days: 1, hour: 19, needs_shoot: true },
]

/** Local "YYYY-MM-DDTHH:mm" for a datetime-local input. */
export function toLocalInput(value) {
  if (!value) return ''
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return ''
  const pad = n => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/** Shrink a photo the upload limit would refuse. Small files pass through untouched. */
export async function fitForUpload(file, maxBytes = 14 * 1024 * 1024, maxSide = 4096) {
  if (file.size <= maxBytes || !file.type.startsWith('image/')) return file
  const bitmap = await createImageBitmap(file)
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * scale)
  canvas.height = Math.round(bitmap.height * scale)
  canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close?.()
  const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.9))
  return new File([blob], file.name.replace(/\.[^.]+$/, '') + '.jpg', { type: 'image/jpeg' })
}

/** Bundle files into one .zip download. `files` is [{ name, blob }]. */
export async function downloadZip(files, zipName) {
  const { zipSync } = await import('fflate')
  const entries = {}
  const used = new Set()
  for (const { name, blob } of files) {
    // Two photos called IMG_0001.jpg would overwrite each other in the archive.
    let unique = name
    for (let n = 2; used.has(unique); n++) unique = name.replace(/(\.[^.]+)?$/, `-${n}$1`)
    used.add(unique)
    entries[unique] = [new Uint8Array(await blob.arrayBuffer()), { level: 0 }]
  }
  const zipped = zipSync(entries)
  saveBlob(new Blob([zipped], { type: 'application/zip' }), zipName)
}

export function saveBlob(blob, filename) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/** The file name a stored URL ends in, for downloads. */
export const fileNameOf = (url, fallback = 'file') =>
  decodeURIComponent((url || '').split('?')[0].split('/').pop() || fallback)
