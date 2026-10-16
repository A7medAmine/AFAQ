// Instagram handles: letters, digits, dots and underscores, at most 30 characters.
// People paste all sorts of things into the field -- "@name", a profile link
// copied from the app, a link with ?igsh= tracking on the end -- so whatever
// arrives is reduced to the bare handle before it is shown or stored.

export const INSTAGRAM_RE = /^(?!.*\.\.)(?!\.)(?!.*\.$)[a-z0-9._]{1,30}$/

export function normalizeInstagram(raw) {
  let value = String(raw || '').trim()
  const link = value.match(/instagram\.com\/([^/?#\s]+)/i) || value.match(/instagr\.am\/([^/?#\s]+)/i)
  if (link) value = link[1]
  return value
    .replace(/^@+/, '')
    .toLowerCase()
    .replace(/[^a-z0-9._]/g, '')
    .slice(0, 30)
}

export const isValidInstagram = handle => INSTAGRAM_RE.test(handle)

export const instagramUrl = handle => `https://www.instagram.com/${handle}/`
