import { createContext, useContext, useEffect, useRef, useState } from 'react'
import { Minus, Plus } from 'lucide-react'
import { CATEGORIES, MAX_QUANTITY, isLowStock } from '../../lib/inventoryImport'

/**
 * Cells that edit an inventory row in place: rename, step the count, pick a
 * shelf, category, condition or status. Each change saves on its own.
 * The page provides { patch(item, changes), shelves } through this context;
 * the cells read it here so the table's columns can stay stable (a new
 * column object would remount every cell and drop a half-typed name).
 */
export const InlineEdit = createContext({ patch: async () => false, shelves: null })

export const CONDITIONS = [
  { value: 'new', label: 'New' },
  { value: 'good', label: 'Good' },
  { value: 'worn', label: 'Worn' },
  { value: 'damaged', label: 'Damaged' },
]

export const STATUSES = [
  { value: 'available', label: 'Available' },
  { value: 'repair', label: 'In repair' },
  { value: 'retired', label: 'Retired' },
]

/** Statuses the count decides; the others (repair, retired) are picked by hand. */
const COUNTED = ['available', 'borrowed', 'out_of_stock']

/** "Borrowed" means every unit is out and "Out of stock" none are left, so both follow the count. */
export function statusFor(item, quantity, wanted = item.status) {
  const onLoan = item.on_loan || 0
  if (!wanted || COUNTED.includes(wanted)) return quantity === 0 ? 'out_of_stock' : quantity > onLoan ? 'available' : 'borrowed'
  return wanted
}

/** Used-up items can be counted down to 0; lent ones keep at least one. */
export const minQuantityFor = item => Math.max(item.tracking_mode === 'consumable' ? 0 : 1, item.on_loan || 0)

// Clicks inside a cell control shouldn't open the row's details drawer.
const stop = e => e.stopPropagation()

export function NameCell({ item }) {
  const { patch } = useContext(InlineEdit)
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(item.name)

  useEffect(() => { if (!editing) setValue(item.name) }, [item.name, editing])

  const commit = async () => {
    const name = value.trim()
    setEditing(false)
    if (!name || name === item.name) { setValue(item.name); return }
    await patch(item, { name })
  }

  return (
    <span className="min-w-0 block" onClick={stop}>
      {editing ? (
        <input
          autoFocus
          className="adm-input adm-cell-input text-sm font-semibold"
          style={{ maxWidth: 240 }}
          value={value}
          onChange={e => setValue(e.target.value)}
          onFocus={e => e.target.select()}
          onBlur={commit}
          onKeyDown={e => {
            if (e.key === 'Enter') { e.preventDefault(); e.target.blur() }
            else if (e.key === 'Escape') { e.preventDefault(); setValue(item.name); setEditing(false) }
          }}
        />
      ) : (
        <button type="button" className="adm-cell-text block text-sm font-semibold adm-truncate text-left" style={{ maxWidth: 240 }}
          title="Click to rename" onClick={() => setEditing(true)}>
          {item.name}
        </button>
      )}
      <span className="adm-data block text-[11px] adm-truncate" style={{ color: 'var(--adm-silk-faint)' }}>
        {item.asset_code}
      </span>
    </span>
  )
}

/**
 * −/+ and a typed number. Rapid clicks are batched: the count saves half a
 * second after the last change, so five clicks are one write.
 */
export function QuantityCell({ item }) {
  const { patch } = useContext(InlineEdit)
  const saved = item.quantity ?? 1
  const onLoan = item.on_loan || 0
  const min = minQuantityFor(item)
  const [value, setValue] = useState(String(saved))
  const timer = useRef(null)

  useEffect(() => { if (!timer.current) setValue(String(saved)) }, [saved])
  useEffect(() => () => clearTimeout(timer.current), [])

  const save = async raw => {
    timer.current = null
    const n = Number(raw)
    if (!Number.isInteger(n) || n < min || n > MAX_QUANTITY) { setValue(String(saved)); return }
    if (n === saved) return
    const ok = await patch(item, { quantity: n, status: statusFor(item, n) })
    if (!ok) setValue(String(saved))
  }

  const schedule = next => {
    setValue(next)
    clearTimeout(timer.current)
    timer.current = setTimeout(() => save(next), 500)
  }

  const step = d => {
    const n = Number(value)
    schedule(String(Math.min(MAX_QUANTITY, Math.max(min, (Number.isInteger(n) ? n : saved) + d))))
  }

  return (
    <span className="block" onClick={stop}>
      <span className="adm-qty">
        <button type="button" aria-label="One less" disabled={Number(value) <= min} onClick={() => step(-1)}><Minus size={12} /></button>
        <input
          className="adm-data"
          type="number"
          inputMode="numeric"
          aria-label={`Quantity of ${item.name}`}
          min={min}
          max={MAX_QUANTITY}
          value={value}
          onChange={e => { clearTimeout(timer.current); timer.current = 'typing'; setValue(e.target.value) }}
          onFocus={e => e.target.select()}
          onBlur={() => { if (timer.current === 'typing') save(value) }}
          onKeyDown={e => {
            if (e.key === 'Enter') { e.preventDefault(); e.target.blur() }
            else if (e.key === 'Escape') { e.preventDefault(); timer.current = null; setValue(String(saved)); e.target.blur() }
          }}
        />
        <button type="button" aria-label="One more" disabled={Number(value) >= MAX_QUANTITY} onClick={() => step(1)}><Plus size={12} /></button>
      </span>
      {onLoan > 0 && <span className="block text-[11px] mt-0.5" style={{ color: 'var(--adm-silk-faint)' }}>{onLoan} on loan</span>}
      {isLowStock(item) && <span className="block text-[11px] mt-0.5" style={{ color: 'var(--adm-fault)' }}>Low stock</span>}
    </span>
  )
}

function CellSelect({ value, label, onChange, children, disabled, title }) {
  return (
    <select
      className="adm-input adm-cell-select"
      aria-label={label}
      title={title}
      value={value}
      disabled={disabled}
      onClick={stop}
      onChange={e => onChange(e.target.value)}
    >
      {children}
    </select>
  )
}

export function CategoryCell({ item }) {
  const { patch } = useContext(InlineEdit)
  const value = item.category || ''
  return (
    <CellSelect label={`Category of ${item.name}`} value={value} onChange={v => patch(item, { category: v || null })}>
      <option value="">—</option>
      {value && !CATEGORIES.includes(value) && <option value={value}>{value}</option>}
      {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
    </CellSelect>
  )
}

export function LocationCell({ item }) {
  const { patch, shelves } = useContext(InlineEdit)
  const value = item.location || ''
  if (!shelves) return <span className="text-[13px]" style={{ color: 'var(--adm-silk-dim)' }}>{value || '—'}</span>
  return (
    <CellSelect label={`Shelf of ${item.name}`} value={value} onChange={v => patch(item, { location: v || null })}>
      <option value="">No shelf</option>
      {value && !shelves.some(s => s.name === value) && <option value={value}>{value}</option>}
      {shelves.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
    </CellSelect>
  )
}

export function ConditionCell({ item }) {
  const { patch } = useContext(InlineEdit)
  return (
    <CellSelect label={`Condition of ${item.name}`} value={item.condition || 'good'} onChange={v => patch(item, { condition: v })}>
      {CONDITIONS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
    </CellSelect>
  )
}

export function StatusCell({ item }) {
  const { patch } = useContext(InlineEdit)
  if (item.status === 'borrowed' || item.status === 'out_of_stock') {
    const out = item.status === 'out_of_stock'
    return (
      <CellSelect label={`Status of ${item.name}`} value={item.status} disabled
        title={out ? 'None left — raise the count to restock it.' : 'Out on loan — return it from Borrowing.'} onChange={() => {}}>
        <option value={item.status}>{out ? 'Out of stock' : 'Borrowed'}</option>
      </CellSelect>
    )
  }
  return (
    <CellSelect label={`Status of ${item.name}`} value={item.status || 'available'}
      onChange={v => patch(item, { status: statusFor(item, item.quantity ?? 1, v) })}>
      {STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
    </CellSelect>
  )
}
