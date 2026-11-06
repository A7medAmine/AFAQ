// Small remark/rehype plugins for tutorial Markdown. Written by hand so they
// add no dependencies; each one walks the tree once.

const CALLOUT = /^\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\][ \t]*\n?/i

export const CALLOUT_TYPES = ['note', 'tip', 'important', 'warning', 'caution']

function walk(node, visit, parent = null) {
  visit(node, parent)
  if (node.children) for (const child of node.children) walk(child, visit, node)
}

/**
 * GitHub-style callouts: a quote whose first line is `[!NOTE]` (or TIP,
 * IMPORTANT, WARNING, CAUTION) becomes a coloured box.
 */
export function remarkCallouts() {
  return tree => walk(tree, node => {
    if (node.type !== 'blockquote') return
    const first = node.children?.[0]
    const text = first?.type === 'paragraph' ? first.children?.[0] : null
    if (text?.type !== 'text') return
    const match = text.value.match(CALLOUT)
    if (!match) return
    text.value = text.value.slice(match[0].length)
    if (!text.value) first.children.shift()
    // A break straight after the marker would leave an empty first line.
    if (first.children[0]?.type === 'break') first.children.shift()
    if (!first.children.length) node.children.shift()
    node.data = { ...node.data, hProperties: { dataCallout: match[1].toLowerCase() } }
  })
}

const YOUTUBE = /^https?:\/\/(?:www\.|m\.)?(?:youtube\.com\/(?:watch\?(?:.*&)?v=|shorts\/|embed\/)|youtu\.be\/)([\w-]{11})/

export function youtubeId(url) {
  return url?.match(YOUTUBE)?.[1] || null
}

/** A YouTube link alone on its own line becomes an embedded player. */
export function remarkYoutube() {
  return tree => walk(tree, node => {
    if (node.type !== 'paragraph' || node.children?.length !== 1) return
    const link = node.children[0]
    if (link.type !== 'link') return
    const id = youtubeId(link.url)
    const label = link.children?.[0]?.value
    // Only bare links ("https://youtu.be/…"), not "[watch this](…)" in a sentence.
    if (!id || (label && label !== link.url)) return
    node.data = { hName: 'div', hProperties: { dataYoutube: id }, hChildren: [] }
  })
}

export function slugify(text) {
  return String(text || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/[\s-]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function hastText(node) {
  if (node.type === 'text') return node.value
  return (node.children || []).map(hastText).join('')
}

/** Gives h2–h4 stable ids so the contents list and shared links can jump to them. */
export function rehypeHeadingIds() {
  return tree => {
    const seen = new Map()
    walk(tree, node => {
      if (node.type !== 'element' || !/^h[2-4]$/.test(node.tagName)) return
      const base = slugify(hastText(node)) || 'section'
      const count = seen.get(base) || 0
      seen.set(base, count + 1)
      node.properties = { ...node.properties, id: count ? `${base}-${count + 1}` : base }
    })
  }
}

/** Reading time at a relaxed 200 words a minute; code counts too. */
export function readingMinutes(markdown) {
  const words = String(markdown || '').split(/\s+/).filter(Boolean).length
  return Math.max(1, Math.round(words / 200))
}
