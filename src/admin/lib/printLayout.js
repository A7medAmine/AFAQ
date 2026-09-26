import { useEffect, useState } from 'react'

/**
 * Sheet geometry shared by the card and label print pages. Everything is in
 * millimetres and positioned absolutely on a page-sized box, so what the
 * preview shows is exactly where the printer puts ink — no flow layout that
 * shifts depending on the browser's margins.
 */

export const PAPERS = {
  a4: { label: 'A4 (210 × 297 mm)', w: 210, h: 297 },
  letter: { label: 'Letter (8.5 × 11 in)', w: 215.9, h: 279.4 },
}

/** CR80 — the standard ID card, so sheets line up with blank card stock. */
export const CARD = { w: 85.6, h: 54 }

/**
 * Common pre-cut A4 label sheets (Avery/Herma-compatible measurements).
 * "custom" takes its numbers from the settings instead.
 */
export const LABEL_TEMPLATES = {
  l7160: { label: '21 per sheet — 63.5 × 38.1 mm (L7160)', cols: 3, rows: 7, w: 63.5, h: 38.1, top: 15.15, left: 7.25, gapX: 2.5, gapY: 0 },
  l7159: { label: '24 per sheet — 63.5 × 33.9 mm (L7159)', cols: 3, rows: 8, w: 63.5, h: 33.9, top: 12.9, left: 7.25, gapX: 2.5, gapY: 0 },
  l7163: { label: '14 per sheet — 99.1 × 38.1 mm (L7163)', cols: 2, rows: 7, w: 99.1, h: 38.1, top: 15.15, left: 4.65, gapX: 2.5, gapY: 0 },
  l7173: { label: '10 per sheet — 99.1 × 57 mm (L7173)', cols: 2, rows: 5, w: 99.1, h: 57, top: 6, left: 4.65, gapX: 2.5, gapY: 0 },
  l7651: { label: '65 per sheet — 38.1 × 21.2 mm (L7651)', cols: 5, rows: 13, w: 38.1, h: 21.2, top: 10.7, left: 4.75, gapX: 2.5, gapY: 0 },
  custom: { label: 'Custom size…' },
}

/** How many w×h cells fit on the paper with the given gap and minimum margin. */
export function fitGrid(paper, w, h, gap, minMargin = 6) {
  const cols = Math.max(1, Math.floor((paper.w - 2 * minMargin + gap) / (w + gap)))
  const rows = Math.max(1, Math.floor((paper.h - 2 * minMargin + gap) / (h + gap)))
  return { cols, rows }
}

/** A grid centred on the paper. */
export function centredGrid(paper, cols, rows, w, h, gapX, gapY) {
  return {
    cols, rows, w, h, gapX, gapY,
    left: (paper.w - (cols * w + (cols - 1) * gapX)) / 2,
    top: (paper.h - (rows * h + (rows - 1) * gapY)) / 2,
  }
}

/** Top-left corner of the cell at a slot index, in mm. */
export function cellPosition(grid, slot) {
  const col = slot % grid.cols
  const row = Math.floor(slot / grid.cols)
  return { x: grid.left + col * (grid.w + grid.gapX), y: grid.top + row * (grid.h + grid.gapY) }
}

/**
 * Where a back must go so it lands behind its front once the sheet is turned
 * over. Long-edge flipping mirrors columns; short-edge flipping mirrors rows.
 */
export function mirroredSlot(grid, slot, flip) {
  const col = slot % grid.cols
  const row = Math.floor(slot / grid.cols)
  return flip === 'short'
    ? (grid.rows - 1 - row) * grid.cols + col
    : row * grid.cols + (grid.cols - 1 - col)
}

/**
 * Splits items into pages of `perPage`, leaving the first `skip` slots of the
 * first page empty (for a label sheet that was already partly used).
 */
export function paginate(items, perPage, skip = 0) {
  const pages = []
  let slot = Math.min(Math.max(0, skip), perPage - 1)
  let page = []
  for (const item of items) {
    page.push({ slot, item })
    slot += 1
    if (slot === perPage) { pages.push(page); page = []; slot = 0 }
  }
  if (page.length) pages.push(page)
  return pages
}

export function repeat(items, copies) {
  const n = Math.max(1, Math.floor(copies) || 1)
  return items.flatMap(item => Array.from({ length: n }, () => item))
}

export function clamp(value, min, max) {
  const n = Number(value)
  if (!Number.isFinite(n)) return min
  return Math.min(max, Math.max(min, n))
}

/** Print settings survive reloads, so a calibrated printer stays calibrated. */
export function usePrintSettings(key, defaults) {
  const [settings, setSettings] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(key) || 'null')
      return saved ? { ...defaults, ...saved } : defaults
    } catch {
      return defaults
    }
  })

  useEffect(() => {
    try { localStorage.setItem(key, JSON.stringify(settings)) } catch { /* storage blocked */ }
  }, [key, settings])

  const set = (name, value) => setSettings(s => ({ ...s, [name]: value }))
  const reset = () => setSettings(defaults)
  return [settings, set, reset]
}
