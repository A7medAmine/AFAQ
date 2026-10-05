import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { Boxes, Globe } from 'lucide-react'
import { Field } from '../ui/Field'
import { fold, index, loadCatalog, score, squash } from '../../lib/partsCatalog'

/*
  The inventory "Name" box, with suggestions as you type.

  Suggestions come from three places, best first:
    1. items already in our inventory, so the same board keeps the same name;
    2. src/admin/data/partsCatalog.json, built offline from the Fritzing parts
       library plus a curated list (scripts/buildPartsCatalog.js) — instant,
       free and no rate limit, unlike DigiKey;
    3. a last row that hands the text to the DigiKey search for anything else.
*/

export default function PartNameField({ value, onChange, onPick, onSearchOnline, existing = [], error, placeholder, inputRef }) {
  const id = useId()
  const listId = `${id}-list`
  const [catalog, setCatalog] = useState(null)
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const blurTimer = useRef(null)

  const prime = () => { if (!catalog) loadCatalog().then(setCatalog).catch(() => setCatalog([])) }

  // Names already in stock, with a count, so picking one keeps naming consistent.
  const stocked = useMemo(() => {
    const byName = new Map()
    for (const item of existing) {
      const key = fold(item.name).trim()
      if (!key) continue
      const entry = byName.get(key)
      if (entry) entry.count++
      else byName.set(key, { name: item.name, category: item.category, image: item.photo_url, count: 1, source: 'inventory' })
    }
    return [...byName.values()].map(e => index({ ...e, family: '', keywords: '' }))
  }, [existing])

  const query = value.trim()
  const matches = useMemo(() => {
    const words = fold(query).split(/[^a-z0-9.]+/).filter(Boolean)
    if (!words.length || !open) return []
    const whole = squash(query)
    const seen = new Set()
    const pick = (list, limit) => list
      .map(part => ({ part, s: score(part, words, whole) }))
      .filter(r => r.s !== null && !seen.has(r.part._name))
      .sort((a, b) => a.s - b.s)
      .slice(0, limit)
      .map(r => { seen.add(r.part._name); return r.part })
    const own = pick(stocked, 3)
    return [...own, ...pick(catalog || [], 8 - own.length)]
  }, [query, open, stocked, catalog])

  const online = onSearchOnline && query.length >= 2
  const rowCount = matches.length + (online ? 1 : 0)
  const showList = open && query.length > 0 && (rowCount > 0 || !catalog)

  useEffect(() => { setActive(0) }, [query])

  const choose = i => {
    if (i < matches.length) {
      const part = matches[i]
      onPick(part)
    } else if (online) {
      onSearchOnline(query)
    }
    setOpen(false)
  }

  const onKeyDown = e => {
    if (!showList) {
      if (e.key === 'ArrowDown') { setOpen(true); e.preventDefault() }
      return
    }
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive(i => Math.min(i + 1, rowCount - 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(i => Math.max(i - 1, 0)) }
    else if (e.key === 'Escape') { e.preventDefault(); setOpen(false) }
    else if (e.key === 'Enter' && rowCount) { e.preventDefault(); choose(active) }
    else if (e.key === 'Tab') setOpen(false)
  }

  return (
    <Field label="Name" required error={error}
      hint="Start typing — boards, modules, sensors and tools are suggested.">
      {a11y => (
        <div className="adm-picker">
          <input
            {...a11y}
            ref={inputRef}
            className="adm-input"
            role="combobox"
            aria-expanded={showList}
            aria-controls={listId}
            aria-autocomplete="list"
            aria-activedescendant={showList && rowCount ? `${id}-opt-${active}` : undefined}
            autoComplete="off"
            placeholder={placeholder}
            value={value}
            onChange={e => { onChange(e.target.value); setOpen(true) }}
            onFocus={() => { prime(); setOpen(true) }}
            onBlur={() => { blurTimer.current = setTimeout(() => setOpen(false), 120) }}
            onKeyDown={onKeyDown}
          />
          {showList && (
            <ul id={listId} role="listbox" className="adm-picker-list" style={{ maxHeight: 380 }}>
              {!catalog && !matches.length && <li className="adm-picker-empty">Loading parts…</li>}
              {matches.map((part, i) => (
                <li
                  key={`${part.source}:${part._name}`}
                  id={`${id}-opt-${i}`}
                  role="option"
                  aria-selected={i === active}
                  className={`adm-picker-option ${i === active ? 'is-active' : ''}`}
                  onMouseDown={e => { e.preventDefault(); choose(i) }}
                  onMouseEnter={() => setActive(i)}
                >
                  <PartThumb src={part.image} />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold adm-truncate">{part.name}</span>
                    <span className="adm-data block text-[11px] adm-truncate" style={{ color: 'var(--adm-silk-faint)' }}>
                      {part.source === 'inventory'
                        ? `Already in inventory${part.count > 1 ? ` · ${part.count} units` : ''}`
                        : [part.family, part.specs].filter(Boolean).join(' · ') || part.category}
                    </span>
                  </span>
                  {part.source === 'inventory' && (
                    <span className="adm-picker-reason">In stock</span>
                  )}
                </li>
              ))}
              {online && (
                <li
                  id={`${id}-opt-${matches.length}`}
                  role="option"
                  aria-selected={active === matches.length}
                  className={`adm-picker-option ${active === matches.length ? 'is-active' : ''}`}
                  onMouseDown={e => { e.preventDefault(); choose(matches.length) }}
                  onMouseEnter={() => setActive(matches.length)}
                >
                  <span className="grid place-items-center shrink-0" style={{ width: 36, height: 36, color: 'var(--adm-silk-dim)' }}>
                    <Globe size={16} aria-hidden="true" />
                  </span>
                  <span className="text-sm">
                    Search DigiKey for “{query}”
                  </span>
                </li>
              )}
            </ul>
          )}
        </div>
      )}
    </Field>
  )
}

function PartThumb({ src }) {
  const [failed, setFailed] = useState(false)
  return (
    <span className="grid place-items-center rounded overflow-hidden shrink-0"
      style={{ width: 36, height: 36, background: 'var(--adm-panel-raise)', color: 'var(--adm-silk-faint)' }}>
      {src && !failed
        ? <img src={src} alt="" className="w-full h-full object-contain" loading="lazy" onError={() => setFailed(true)} />
        : <Boxes size={16} aria-hidden="true" />}
    </span>
  )
}
