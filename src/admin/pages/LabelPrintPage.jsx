import { memo, useDeferredValue, useEffect, useMemo, useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { Minus, Plus, Tag } from 'lucide-react'
import { read, supabase } from '../lib/db'
import {
  LABEL_TEMPLATES, PAPERS, cellPosition, clamp, paginate, usePrintSettings,
} from '../lib/printLayout'
import PrintWorkspace, {
  Cell, ChoiceSetting, NumberSetting, SettingsGroup,
} from '../components/print/PrintWorkspace'
import { Barcode, BARCODE_FORMATS, QrCode } from '../components/print/Codes'
import { CheckField, SelectField, TextField } from '../components/ui/Field'
import EmptyState, { ErrorState } from '../components/ui/EmptyState'
import Panel from '../components/ui/Panel'

const DEFAULTS = {
  template: 'l7160',
  paper: 'a4',
  cols: 3, rows: 7, w: 63.5, h: 38.1, top: 15.15, left: 7.25, gapX: 2.5, gapY: 0,
  code: 'both',
  barcodeFormat: 'CODE128',
  showName: true,
  showCode: true,
  showCategory: false,
  showLocation: false,
  showClub: true,
  clubName: 'AFAQ Scientific Club',
  textScale: 100,
  fontMode: 'auto',
  nameSize: 11,
  codeSize: 9,
  detailSize: 8,
  clubSize: 6.5,
  fontFamily: 'default',
  nameBold: true,
  nameLines: 2,
  padding: 2.5,
  copies: 1,
  copyMode: 'all',
  perUnit: false,
  showQty: true,
  skip: 0,
  guides: true,
  offsetX: 0,
  offsetY: 0,
}

// Shelf labels lead with the shelf number, so they default to QR + text only.
const SHELF_DEFAULTS = {
  ...DEFAULTS,
  code: 'qr',
  showLocation: true,
  showCount: true,
  showClub: false,
  nameLines: 1,
}

const FONT_MODES = [
  { value: 'auto', label: 'Fit to label' },
  { value: 'custom', label: 'Exact sizes' },
]

const FONT_FAMILIES = {
  default: { label: 'Admin default', css: 'inherit' },
  sans: { label: 'Sans (Arial)', css: 'Arial, Helvetica, sans-serif' },
  condensed: { label: 'Condensed', css: '"Arial Narrow", "Roboto Condensed", Arial, sans-serif' },
  serif: { label: 'Serif', css: 'Georgia, "Times New Roman", serif' },
  mono: { label: 'Monospace', css: 'ui-monospace, Consolas, monospace' },
}

// How many to print is decided per print run, so these always open at 1 / 0.
const PER_JOB = ['copies', 'skip']

// A box of 50 resistors gets one label; a multimeter gets one on itself.
const PER_OPTIONS = [
  { value: 'box', label: 'Each box' },
  { value: 'unit', label: 'Each component' },
]

const COPY_MODES = [
  { value: 'all', label: 'Same for all' },
  { value: 'each', label: 'Per label' },
]

const CODE_OPTIONS = [
  { value: 'qr', label: 'QR code' },
  { value: 'barcode', label: 'Barcode' },
  { value: 'both', label: 'Both' },
  { value: 'none', label: 'Text only' },
]

/**
 * Inventory labels for one item (/admin/inventory/:id/label) or a batch
 * (/admin/inventory/labels?ids=1,2,3), laid out on pre-cut label sheets.
 * With kind="shelves" it prints shelf labels (/admin/inventory/shelves/labels?ids=…):
 * the shelf code goes where an asset code would, its description under the name.
 */
export default function LabelPrintPage({ kind = 'items' }) {
  const shelves = kind === 'shelves'
  const { id } = useParams()
  const [params] = useSearchParams()
  const ids = useMemo(() => {
    const raw = id ? [id] : (params.get('ids') || '').split(',')
    return raw.map(Number).filter(n => Number.isFinite(n) && n > 0)
  }, [id, params])

  const [items, setItems] = useState([])
  const [state, setState] = useState({ loading: true, error: null })
  const [s, set, reset] = usePrintSettings(
    shelves ? 'afaq.print.shelf-labels.v2' : 'afaq.print.labels',
    shelves ? SHELF_DEFAULTS : DEFAULTS,
    PER_JOB
  )
  // Labels for one item set by hand, overriding the copies setting (id → count).
  const [own, setOwn] = useState({})
  // Settings apply to the sheets a beat later, so typing stays instant even
  // when hundreds of labels redraw.
  const view = useDeferredValue(s)
  const ownView = useDeferredValue(own)

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      if (!ids.length) { setState({ loading: false, error: 'No items were chosen for printing.' }); return }
      const { ok, data, message } = await read(shelves
        ? supabase.from('shelves').select('id, name, code, description').in('id', ids)
        : supabase.from('inventory_items').select('id, name, asset_code, category, location, quantity').in('id', ids)
      )
      if (cancelled) return
      if (!ok) { setState({ loading: false, error: message }); return }
      let rows = data || []
      if (shelves) {
        // How many things sit on each shelf, for the label's item count.
        const counts = new Map()
        const names = rows.map(r => r.name)
        if (names.length) {
          const stock = await read(
            supabase.from('inventory_items').select('location, quantity').in('location', names).neq('status', 'retired')
          )
          if (cancelled) return
          for (const it of stock.data || []) counts.set(it.location, (counts.get(it.location) || 0) + (it.quantity ?? 1))
        }
        rows = rows.map(r => ({ id: r.id, name: r.name, asset_code: r.code, category: null, location: r.description, count: counts.get(r.name) || 0 }))
      }
      const byId = new Map(rows.map(i => [i.id, i]))
      setItems(ids.map(i => byId.get(i)).filter(i => i?.asset_code))
      setState({ loading: false, error: null })
    }
    load()
    return () => { cancelled = true }
  }, [ids, shelves])

  const custom = view.template === 'custom'
  const grid = useMemo(() => {
    const t = custom ? view : LABEL_TEMPLATES[view.template] || LABEL_TEMPLATES.l7160
    const num = (v, min, max) => clamp(v, min, max)
    return {
      cols: num(t.cols, 1, 20), rows: num(t.rows, 1, 40),
      w: num(t.w, 10, 300), h: num(t.h, 5, 300),
      top: num(t.top, 0, 100) + (Number(view.offsetY) || 0), left: num(t.left, 0, 100) + (Number(view.offsetX) || 0),
      gapX: num(t.gapX, 0, 50), gapY: num(t.gapY, 0, 50),
    }
  }, [custom, view])
  const paper = PAPERS[custom ? view.paper : 'a4'] || PAPERS.a4

  const perPage = grid.cols * grid.rows
  const pages = useMemo(
    () => paginate(
      items.flatMap(i => Array.from({ length: labelCount(i, view, ownView, shelves) }, () => i)),
      perPage,
      clamp(view.skip, 0, perPage - 1)
    ),
    [items, view, ownView, shelves, perPage]
  )

  if (state.loading) return null
  if (state.error) return <Panel><ErrorState message={state.error} /></Panel>
  if (!items.length) {
    return (
      <Panel>
        <EmptyState icon={Tag} title="Nothing to print" description={shelves ? 'None of the chosen shelves have a code yet.' : 'None of the chosen items have an asset code yet.'} />
      </Panel>
    )
  }

  const sheets = pages.map((page, p) => ({
    key: p,
    title: `Sheet ${p + 1} of ${pages.length}`,
    content: page.map(({ slot, item }, i) => {
      const { x, y } = cellPosition(grid, slot)
      return (
        <Cell key={i} x={x} y={y} w={grid.w} h={grid.h} guide={view.guides}>
          {shelves
            ? <ShelfLabel shelf={item} w={grid.w} h={grid.h} s={view} />
            : <Label item={item} w={grid.w} h={grid.h} s={view} />}
        </Cell>
      )
    }),
  }))

  const total = items.reduce((n, i) => n + labelCount(i, s, own, shelves), 0)

  return (
    <PrintWorkspace
      backTo={shelves ? '/admin/inventory/shelves' : '/admin/inventory'}
      backLabel={shelves ? 'Back to shelves' : 'Back to inventory'}
      summary={`${total} label${total === 1 ? '' : 's'} (${items.length} ${shelves ? (items.length === 1 ? 'shelf' : 'shelves') : (items.length === 1 ? 'item' : 'items')})`}
      paper={paper}
      sheets={sheets}
      onReset={reset}
      settings={
        <>
          <SettingsGroup title="Sheet">
            <SelectField label="Label sheet" value={s.template} onChange={e => set('template', e.target.value)}>
              {Object.entries(LABEL_TEMPLATES).map(([key, t]) => <option key={key} value={key}>{t.label}</option>)}
            </SelectField>
            {custom && (
              <>
                <SelectField label="Paper" value={s.paper} onChange={e => set('paper', e.target.value)}>
                  {Object.entries(PAPERS).map(([key, p]) => <option key={key} value={key}>{p.label}</option>)}
                </SelectField>
                <div className="grid grid-cols-2 gap-3">
                  <NumberSetting label="Columns" value={s.cols} min={1} max={20} onChange={v => set('cols', v)} />
                  <NumberSetting label="Rows" value={s.rows} min={1} max={40} onChange={v => set('rows', v)} />
                  <NumberSetting label="Label width" suffix="mm" step={0.1} value={s.w} onChange={v => set('w', v)} />
                  <NumberSetting label="Label height" suffix="mm" step={0.1} value={s.h} onChange={v => set('h', v)} />
                  <NumberSetting label="Top margin" suffix="mm" step={0.1} value={s.top} onChange={v => set('top', v)} />
                  <NumberSetting label="Left margin" suffix="mm" step={0.1} value={s.left} onChange={v => set('left', v)} />
                  <NumberSetting label="Gap across" suffix="mm" step={0.1} value={s.gapX} onChange={v => set('gapX', v)} />
                  <NumberSetting label="Gap down" suffix="mm" step={0.1} value={s.gapY} onChange={v => set('gapY', v)} />
                </div>
              </>
            )}
          </SettingsGroup>

          <SettingsGroup title="Quantity">
            {!shelves && (
              <ChoiceSetting label="Print a label for" options={PER_OPTIONS} value={s.perUnit ? 'unit' : 'box'} onChange={v => { set('perUnit', v === 'unit'); setOwn({}) }} />
            )}
            {items.length > 1 && (
              <ChoiceSetting label="Copies" options={COPY_MODES} value={s.copyMode} onChange={v => set('copyMode', v)} />
            )}
            {s.copyMode === 'each' && items.length > 1 ? (
              <EachLabelCopies items={items} s={s} own={own} setOwn={setOwn} shelves={shelves} />
            ) : (
              <NumberSetting
                label={shelves ? 'Copies of each shelf' : s.perUnit ? 'Copies of each component label' : 'Copies of each box label'}
                value={s.copies} min={1} max={500} onChange={v => set('copies', v)}
                hint={!shelves && s.perUnit ? 'Times the item’s quantity: 1 copy of a box of 5 is 5 labels.' : undefined}
              />
            )}
            <NumberSetting label="Skip first" value={s.skip} min={0} max={perPage - 1} onChange={v => set('skip', v)}
              hint="Labels already used on the sheet" />
          </SettingsGroup>

          <SettingsGroup title="Content">
            <ChoiceSetting label="Code" options={CODE_OPTIONS} value={s.code} onChange={v => set('code', v)} />
            {(s.code === 'barcode' || s.code === 'both') && (
              <ChoiceSetting label="Barcode type" options={BARCODE_FORMATS} value={s.barcodeFormat} onChange={v => set('barcodeFormat', v)} />
            )}
            <CheckField label={shelves ? 'Shelf name' : 'Item name'} checked={s.showName} onChange={v => set('showName', v)} />
            <CheckField label={shelves ? 'Shelf number (big)' : 'Asset code (text)'} checked={s.showCode} onChange={v => set('showCode', v)} />
            {shelves && <CheckField label="Items on shelf" description="How many things are stored there" checked={s.showCount} onChange={v => set('showCount', v)} />}
            {!shelves && !s.perUnit && <CheckField label="Quantity in the box" description="“Box of 50” under the name" checked={s.showQty} onChange={v => set('showQty', v)} />}
            {!shelves && <CheckField label="Category" checked={s.showCategory} onChange={v => set('showCategory', v)} />}
            <CheckField label={shelves ? 'Description' : 'Location'} checked={s.showLocation} onChange={v => set('showLocation', v)} />
            <CheckField label="Club name" checked={s.showClub} onChange={v => set('showClub', v)} />
            {s.showClub && <TextField label="Club name text" value={s.clubName} onChange={e => set('clubName', e.target.value)} />}
          </SettingsGroup>

          <SettingsGroup title="Text">
            <SelectField label="Font" value={s.fontFamily} onChange={e => set('fontFamily', e.target.value)}>
              {Object.entries(FONT_FAMILIES).map(([key, f]) => <option key={key} value={key}>{f.label}</option>)}
            </SelectField>
            <ChoiceSetting label="Font size" options={FONT_MODES} value={s.fontMode} onChange={v => set('fontMode', v)} />
            {s.fontMode === 'custom' ? (
              <div className="grid grid-cols-2 gap-3">
                <NumberSetting label="Item name" suffix="pt" value={s.nameSize} min={3} max={48} step={0.5} onChange={v => set('nameSize', v)} />
                <NumberSetting label="Asset code" suffix="pt" value={s.codeSize} min={3} max={48} step={0.5} onChange={v => set('codeSize', v)} />
                <NumberSetting label="Category / location" suffix="pt" value={s.detailSize} min={3} max={48} step={0.5} onChange={v => set('detailSize', v)} />
                <NumberSetting label="Club name" suffix="pt" value={s.clubSize} min={3} max={48} step={0.5} onChange={v => set('clubSize', v)} />
              </div>
            ) : (
              <NumberSetting label="Text size" suffix="%" value={s.textScale} min={50} max={200} step={5} onChange={v => set('textScale', v)}
                hint="Sizes follow the label height, scaled by this" />
            )}
            <div className="grid grid-cols-2 gap-3">
              <NumberSetting label="Name max lines" value={s.nameLines} min={1} max={5} onChange={v => set('nameLines', v)} />
            </div>
            <CheckField label="Bold item name" checked={s.nameBold} onChange={v => set('nameBold', v)} />
          </SettingsGroup>

          <SettingsGroup title="Design">
            <NumberSetting label="Inner padding" suffix="mm" value={s.padding} min={0} max={10} step={0.5} onChange={v => set('padding', v)} />
            <CheckField label="Cut guides" description="Dashed outline around each label" checked={s.guides} onChange={v => set('guides', v)} />
          </SettingsGroup>

          <SettingsGroup title="Printer calibration">
            <div className="grid grid-cols-2 gap-3">
              <NumberSetting label="Shift right" suffix="mm" step={0.5} value={s.offsetX} onChange={v => set('offsetX', v)} />
              <NumberSetting label="Shift down" suffix="mm" step={0.5} value={s.offsetY} onChange={v => set('offsetY', v)} />
            </div>
            <p className="text-xs" style={{ color: 'var(--adm-silk-faint)' }}>
              Print at 100% scale (“Actual size”, margins “None”). If labels land off the stickers, nudge them here.
            </p>
          </SettingsGroup>
        </>
      }
    />
  )
}

const Label = memo(function Label({ item, w, h, s }) {
  const pad = clamp(s.padding, 0, Math.min(w, h) / 3)
  const iw = w - 2 * pad
  const ih = h - 2 * pad
  // Font sizes in pt: either derived from the label height, or set exactly.
  const base = clamp(h * 0.27, 5.5, 14) * clamp(s.textScale, 50, 200) / 100
  const size = s.fontMode === 'custom'
    ? { name: clamp(s.nameSize, 3, 48), code: clamp(s.codeSize, 3, 48), detail: clamp(s.detailSize, 3, 48), club: clamp(s.clubSize, 3, 48) }
    : { name: base, code: base * 0.85, detail: base * 0.75, club: base * 0.62 }
  const family = (FONT_FAMILIES[s.fontFamily] || FONT_FAMILIES.default).css
  const withQr = s.code === 'qr' || s.code === 'both'
  const withBar = s.code === 'barcode' || s.code === 'both'

  const lines = [
    s.showName && { text: item.name, size: size.name, weight: s.nameBold ? 700 : 400, color: '#0F172A', clamp: clamp(s.nameLines, 1, 5) },
    s.showCode && !withBar && { text: item.asset_code, size: size.code, mono: true, color: '#334155' },
    !s.perUnit && s.showQty && (item.quantity ?? 1) > 1 && { text: `Box of ${item.quantity}`, size: size.detail, weight: 600, color: '#334155' },
    s.showCategory && item.category && { text: item.category, size: size.detail, color: '#475569' },
    s.showLocation && item.location && { text: item.location, size: size.detail, color: '#475569' },
    s.showClub && s.clubName && { text: s.clubName, size: size.club, color: '#94A3B8' },
  ].filter(Boolean)

  const text = lines.map((l, i) => (
    <div key={i} style={{
      fontSize: `${l.size}pt`, fontWeight: l.weight || 400, color: l.color, lineHeight: 1.15,
      '--print-font': l.mono ? 'ui-monospace, monospace' : family,
      overflow: 'hidden', wordBreak: 'break-word',
      display: '-webkit-box', WebkitBoxOrient: 'vertical', WebkitLineClamp: l.clamp || 1,
    }}>{l.text}</div>
  ))

  const barBlock = height => (
    <div style={{ width: '100%' }}>
      <Barcode value={item.asset_code} width="100%" height={height} format={s.barcodeFormat} />
      {s.showCode && (
        <div style={{ fontSize: `${size.code}pt`, '--print-font': 'ui-monospace, monospace', textAlign: 'center', letterSpacing: '0.08em', color: '#0F172A', marginTop: '0.5mm' }}>
          {item.asset_code}
        </div>
      )}
    </div>
  )

  const box = { width: '100%', height: '100%', padding: `${pad}mm`, boxSizing: 'border-box', display: 'flex', background: '#fff' }

  if (s.code === 'barcode') {
    return (
      <div style={{ ...box, flexDirection: 'column', justifyContent: 'space-between', gap: '1mm' }}>
        <div style={{ minWidth: 0 }}>{text}</div>
        {barBlock(Math.max(4, ih * (lines.length ? 0.42 : 0.7)))}
      </div>
    )
  }

  const qrSize = Math.min(ih, iw * (withBar ? 0.4 : 0.48))
  return (
    <div style={{ ...box, alignItems: 'center', gap: `${Math.max(1, pad)}mm` }}>
      {withQr && <QrCode value={item.asset_code} size={qrSize} />}
      <div style={{ minWidth: 0, flex: 1, height: '100%', display: 'flex', flexDirection: 'column', justifyContent: withBar ? 'space-between' : 'center', gap: '0.8mm' }}>
        <div>{text}</div>
        {withBar && barBlock(Math.max(3.5, ih * 0.3))}
      </div>
    </div>
  )
})

const PT_PER_MM = 2.835

const MAX_COPIES = 500

/** One per box, or one per component (the item's quantity). */
const baseCount = (item, s, shelves) => (s.perUnit && !shelves ? Math.max(1, item.quantity ?? 1) : 1)

/** Labels to print for one item: its own count in per-label mode, else base × copies. */
function labelCount(item, s, own, shelves) {
  if (s.copyMode === 'each' && own[item.id] !== undefined) return own[item.id]
  return baseCount(item, s, shelves) * Math.max(1, Math.floor(s.copies) || 1)
}

/** A count for every label; each starts at what "Same for all" would print. */
function EachLabelCopies({ items, s, own, setOwn, shelves }) {
  const put = (id, value) => setOwn(o => ({ ...o, [id]: value }))
  return (
    <div className="flex flex-col gap-1.5">
      <ul className="flex flex-col gap-1 rounded-lg p-2" style={{ maxHeight: 320, overflowY: 'auto', border: '1px solid var(--adm-trace)' }}>
        {items.map(item => (
          <li key={item.id} className="flex items-center gap-2">
            <span className="min-w-0 flex-1">
              <span className="block text-[12.5px] adm-truncate" style={{ color: 'var(--adm-silk)' }}>{item.name}</span>
              <span className="adm-data block text-[10.5px]" style={{ color: 'var(--adm-silk-faint)' }}>
                {[item.asset_code, !shelves && s.perUnit && (item.quantity ?? 1) > 1 ? `${item.quantity} components` : null].filter(Boolean).join(' · ')}
              </span>
            </span>
            <CopyStepper label={`Labels for ${item.name}`} value={labelCount(item, s, own, shelves)} onChange={v => put(item.id, v)} />
          </li>
        ))}
      </ul>
      {Object.keys(own).length > 0 && (
        <button type="button" className="self-start text-[12px] font-semibold" style={{ color: 'var(--adm-signal)' }} onClick={() => setOwn({})}>
          Reset counts
        </button>
      )}
    </div>
  )
}

/** −/+ with a typed number; 0 leaves the item off the sheets. */
function CopyStepper({ label, value, onChange }) {
  const [draft, setDraft] = useState(null) // text while typing
  const commit = raw => {
    setDraft(null)
    const n = Number(raw)
    if (Number.isInteger(n) && n >= 0) onChange(Math.min(MAX_COPIES, n))
  }
  return (
    <span className="adm-qty adm-qty-shown shrink-0">
      <button type="button" aria-label="One less" disabled={value <= 0} onClick={() => onChange(value - 1)}><Minus size={12} /></button>
      <input
        className="adm-data"
        type="number"
        inputMode="numeric"
        aria-label={label}
        min={0}
        max={MAX_COPIES}
        value={draft ?? value}
        onChange={e => setDraft(e.target.value)}
        onFocus={e => e.target.select()}
        onBlur={e => commit(e.target.value)}
        onKeyDown={e => {
          if (e.key === 'Enter') { e.preventDefault(); e.target.blur() }
          else if (e.key === 'Escape') { e.preventDefault(); setDraft(null) }
        }}
      />
      <button type="button" aria-label="One more" disabled={value >= MAX_COPIES} onClick={() => onChange(value + 1)}><Plus size={12} /></button>
    </span>
  )
}

/**
 * A shelf label: the shelf number is the headline, sized to fill the space
 * next to the QR so it reads from across the room; name, description and
 * item count sit under it.
 */
const ShelfLabel = memo(function ShelfLabel({ shelf, w, h, s }) {
  const pad = clamp(s.padding, 0, Math.min(w, h) / 3)
  const iw = w - 2 * pad
  const ih = h - 2 * pad
  const family = (FONT_FAMILIES[s.fontFamily] || FONT_FAMILIES.default).css
  const scale = clamp(s.textScale, 50, 200) / 100
  const withQr = s.code === 'qr' || s.code === 'both'
  const withBar = s.code === 'barcode' || s.code === 'both'

  // "SHF-007" → small "SHF" tag over a big "007".
  const [prefix, number] = /^(.*?)-?(\d+)$/.test(shelf.asset_code || '')
    ? shelf.asset_code.match(/^(.*?)-?(\d+)$/).slice(1)
    : ['', shelf.asset_code || '']

  const qrSize = withQr ? Math.min(ih, iw * 0.42) : 0
  const gap = withQr ? Math.max(1.5, pad) : 0
  const textW = iw - qrSize - gap

  const detail = s.fontMode === 'custom' ? clamp(s.detailSize, 3, 48) : clamp(h * 0.16, 5, 12) * scale
  const nameSize = s.fontMode === 'custom' ? clamp(s.nameSize, 3, 48) : clamp(h * 0.2, 6, 16) * scale
  // Digits in a bold sans run about 0.6em wide; fit the width, and leave
  // roughly half the height for the lines under the number.
  const numberSize = s.fontMode === 'custom'
    ? clamp(s.codeSize, 3, 120)
    : Math.min((textW * PT_PER_MM) / (Math.max(2, number.length) * 0.62), ih * PT_PER_MM * (withBar ? 0.38 : 0.5)) * scale

  const lines = [
    s.showName && shelf.name && { text: shelf.name, size: nameSize, weight: s.nameBold ? 700 : 500, color: '#0F172A', clamp: clamp(s.nameLines, 1, 5) },
    s.showLocation && shelf.location && { text: shelf.location, size: detail, color: '#475569', clamp: 2 },
    s.showCount && { text: `${shelf.count} item${shelf.count === 1 ? '' : 's'}`, size: detail, color: '#475569', weight: 600 },
    s.showClub && s.clubName && { text: s.clubName, size: detail * 0.85, color: '#94A3B8' },
  ].filter(Boolean)

  return (
    <div style={{ width: '100%', height: '100%', padding: `${pad}mm`, boxSizing: 'border-box', display: 'flex', alignItems: 'center', gap: `${gap}mm`, background: '#fff' }}>
      {withQr && <QrCode value={shelf.asset_code} size={qrSize} />}
      <div style={{ minWidth: 0, flex: 1, height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '0.6mm', '--print-font': family }}>
        {s.showCode && (
          <div style={{ lineHeight: 0.95, color: '#0F172A' }}>
            {prefix && (
              <div style={{ fontSize: `${Math.max(5, numberSize * 0.22)}pt`, fontWeight: 700, letterSpacing: '0.18em', color: '#64748B' }}>
                {prefix.toUpperCase()}
              </div>
            )}
            <div style={{ fontSize: `${numberSize}pt`, fontWeight: 800, letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums' }}>
              {number}
            </div>
          </div>
        )}
        {lines.map((l, i) => (
          <div key={i} style={{
            fontSize: `${l.size}pt`, fontWeight: l.weight || 400, color: l.color, lineHeight: 1.15,
            overflow: 'hidden', wordBreak: 'break-word',
            display: '-webkit-box', WebkitBoxOrient: 'vertical', WebkitLineClamp: l.clamp || 1,
          }}>{l.text}</div>
        ))}
        {withBar && <Barcode value={shelf.asset_code} width="100%" height={Math.max(4, ih * 0.22)} format={s.barcodeFormat} />}
      </div>
    </div>
  )
})
