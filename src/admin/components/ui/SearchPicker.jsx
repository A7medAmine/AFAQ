import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { Camera, Search, X } from 'lucide-react'
import Button from './Button'

/** Scanned or typed codes may be a bare code or a `/verify/<code>` URL. */
export function normalizeCode(raw) {
  const text = String(raw || '').trim()
  const code = text.includes('/verify/') ? text.split('/verify/').pop() : text
  return code.replace(/[/?#].*$/, '').trim().toUpperCase()
}

function fold(text) {
  return String(text || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
}

/**
 * Type-ahead picker over a list already in memory. Matches every word of the
 * query against `getSearchText(option)`, so "arduino uno" and "INV-0004" both
 * work. A hardware scanner types the code and presses Enter — an exact code
 * match is picked straight away.
 *
 * @param options        the full list to search
 * @param value          the selected option, or null
 * @param getKey         option → stable key
 * @param getCode        option → its asset/member code, for exact matches
 * @param getSearchText  option → text the query is matched against
 * @param renderOption   option → row content in the suggestion list
 * @param isDisabled     option → reason string when it can't be picked
 * @param onFreeText     optional: query → offer "use this text" as a last row
 */
export default function SearchPicker({
  label, placeholder, options, value, onChange,
  getKey, getCode, getSearchText, renderOption, renderSelected,
  isDisabled = () => null, onScan, onFreeText, freeTextLabel,
  emptyText = 'No matches.', limit = 8, autoFocus,
}) {
  const id = useId()
  const inputRef = useRef(null)
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)

  const matches = useMemo(() => {
    const words = fold(query).split(/\s+/).filter(Boolean)
    if (!words.length) return options.slice(0, limit)
    const code = normalizeCode(query)
    const scored = []
    for (const option of options) {
      const text = fold(getSearchText(option))
      if (!words.every(w => text.includes(w))) continue
      const optionCode = String(getCode(option) || '').toUpperCase()
      // exact code first, then prefix hits, then anything else
      const score = optionCode === code ? 0 : text.startsWith(words[0]) || optionCode.startsWith(code) ? 1 : 2
      scored.push({ option, score })
    }
    scored.sort((a, b) => a.score - b.score)
    return scored.slice(0, limit).map(s => s.option)
  }, [query, options, getSearchText, getCode, limit])

  const freeText = onFreeText && query.trim() ? query.trim() : ''
  const rowCount = matches.length + (freeText ? 1 : 0)

  useEffect(() => { setActive(0) }, [query])

  const pick = option => {
    if (isDisabled(option)) return
    onChange(option)
    setQuery('')
    setOpen(false)
  }

  const pickRow = index => {
    if (index < matches.length) pick(matches[index])
    else if (freeText) { onFreeText(freeText); setQuery(''); setOpen(false) }
  }

  const onKeyDown = e => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setOpen(true); setActive(i => Math.min(i + 1, rowCount - 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(i => Math.max(i - 1, 0)) }
    else if (e.key === 'Escape') { setOpen(false) }
    else if (e.key === 'Enter') {
      e.preventDefault()
      const code = normalizeCode(query)
      const exact = code && options.find(o => String(getCode(o) || '').toUpperCase() === code)
      if (exact) pick(exact)
      else if (rowCount) pickRow(active)
    }
  }

  if (value) {
    return (
      <div>
        {label && <span className="adm-label">{label}</span>}
        <div className="adm-picker-selected">
          <div className="min-w-0 flex-1">{(renderSelected || renderOption)(value)}</div>
          <button type="button" className="adm-picker-clear" aria-label={`Clear ${label || 'selection'}`}
            onClick={() => { onChange(null); setTimeout(() => inputRef.current?.focus(), 0) }}>
            <X size={15} />
          </button>
        </div>
      </div>
    )
  }

  return (
    <div>
      {label && <label className="adm-label" htmlFor={id}>{label}</label>}
      <div className="flex items-start gap-2">
        <div className="adm-picker flex-1">
          <Search size={15} className="adm-picker-icon" aria-hidden="true" />
          <input
            ref={inputRef}
            id={id}
            className="adm-input"
            style={{ paddingLeft: 34 }}
            role="combobox"
            aria-expanded={open}
            aria-controls={`${id}-list`}
            aria-autocomplete="list"
            autoComplete="off"
            autoFocus={autoFocus}
            placeholder={placeholder}
            value={query}
            onChange={e => { setQuery(e.target.value); setOpen(true) }}
            onFocus={() => setOpen(true)}
            onBlur={() => setTimeout(() => setOpen(false), 120)}
            onKeyDown={onKeyDown}
          />
          {open && (
            <ul id={`${id}-list`} role="listbox" className="adm-picker-list">
              {matches.map((option, i) => {
                const reason = isDisabled(option)
                return (
                  <li
                    key={getKey(option)}
                    role="option"
                    aria-selected={i === active}
                    aria-disabled={!!reason}
                    className={`adm-picker-option ${i === active ? 'is-active' : ''} ${reason ? 'is-disabled' : ''}`}
                    onMouseDown={e => { e.preventDefault(); pick(option) }}
                    onMouseEnter={() => setActive(i)}
                  >
                    <div className="min-w-0 flex-1">{renderOption(option)}</div>
                    {reason && <span className="adm-picker-reason">{reason}</span>}
                  </li>
                )
              })}
              {freeText && (
                <li
                  role="option"
                  aria-selected={active === matches.length}
                  className={`adm-picker-option ${active === matches.length ? 'is-active' : ''}`}
                  onMouseDown={e => { e.preventDefault(); pickRow(matches.length) }}
                  onMouseEnter={() => setActive(matches.length)}
                >
                  <span className="text-sm">{freeTextLabel ? freeTextLabel(freeText) : `Use “${freeText}”`}</span>
                </li>
              )}
              {!rowCount && <li className="adm-picker-empty">{emptyText}</li>}
            </ul>
          )}
        </div>
        {onScan && <Button type="button" onClick={onScan} icon={Camera}>Scan</Button>}
      </div>
    </div>
  )
}
