import { useEffect, useMemo, useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { Tag } from 'lucide-react'
import { read, supabase } from '../lib/db'
import {
  LABEL_TEMPLATES, PAPERS, cellPosition, clamp, paginate, repeat, usePrintSettings,
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
  nameSize: 9,
  codeSize: 7,
  detailSize: 6.5,
  clubSize: 5.5,
  fontFamily: 'default',
  nameBold: true,
  nameLines: 2,
  padding: 2.5,
  copies: 1,
  skip: 0,
  guides: true,
  offsetX: 0,
  offsetY: 0,
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

const CODE_OPTIONS = [
  { value: 'qr', label: 'QR code' },
  { value: 'barcode', label: 'Barcode' },
  { value: 'both', label: 'Both' },
  { value: 'none', label: 'Text only' },
]

/**
 * Inventory labels for one item (/admin/inventory/:id/label) or a batch
 * (/admin/inventory/labels?ids=1,2,3), laid out on pre-cut label sheets.
 */
export default function LabelPrintPage() {
  const { id } = useParams()
  const [params] = useSearchParams()
  const ids = useMemo(() => {
    const raw = id ? [id] : (params.get('ids') || '').split(',')
    return raw.map(Number).filter(n => Number.isFinite(n) && n > 0)
  }, [id, params])

  const [items, setItems] = useState([])
  const [state, setState] = useState({ loading: true, error: null })
  const [s, set, reset] = usePrintSettings('afaq.print.labels', DEFAULTS)

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      if (!ids.length) { setState({ loading: false, error: 'No items were chosen for printing.' }); return }
      const { ok, data, message } = await read(
        supabase.from('inventory_items').select('id, name, asset_code, category, location').in('id', ids)
      )
      if (cancelled) return
      if (!ok) { setState({ loading: false, error: message }); return }
      const byId = new Map((data || []).map(i => [i.id, i]))
      setItems(ids.map(i => byId.get(i)).filter(i => i?.asset_code))
      setState({ loading: false, error: null })
    }
    load()
    return () => { cancelled = true }
  }, [ids])

  const custom = s.template === 'custom'
  const grid = useMemo(() => {
    const t = custom ? s : LABEL_TEMPLATES[s.template] || LABEL_TEMPLATES.l7160
    const num = (v, min, max) => clamp(v, min, max)
    return {
      cols: num(t.cols, 1, 20), rows: num(t.rows, 1, 40),
      w: num(t.w, 10, 300), h: num(t.h, 5, 300),
      top: num(t.top, 0, 100) + (Number(s.offsetY) || 0), left: num(t.left, 0, 100) + (Number(s.offsetX) || 0),
      gapX: num(t.gapX, 0, 50), gapY: num(t.gapY, 0, 50),
    }
  }, [custom, s])
  const paper = PAPERS[custom ? s.paper : 'a4'] || PAPERS.a4

  const perPage = grid.cols * grid.rows
  const pages = useMemo(
    () => paginate(repeat(items, s.copies), perPage, clamp(s.skip, 0, perPage - 1)),
    [items, s.copies, s.skip, perPage]
  )

  if (state.loading) return null
  if (state.error) return <Panel><ErrorState message={state.error} /></Panel>
  if (!items.length) {
    return (
      <Panel>
        <EmptyState icon={Tag} title="Nothing to print" description="None of the chosen items have an asset code yet." />
      </Panel>
    )
  }

  const sheets = pages.map((page, p) => ({
    key: p,
    title: `Sheet ${p + 1} of ${pages.length}`,
    content: page.map(({ slot, item }, i) => {
      const { x, y } = cellPosition(grid, slot)
      return (
        <Cell key={i} x={x} y={y} w={grid.w} h={grid.h} guide={s.guides}>
          <Label item={item} w={grid.w} h={grid.h} s={s} />
        </Cell>
      )
    }),
  }))

  const total = items.length * Math.max(1, Math.floor(s.copies) || 1)

  return (
    <PrintWorkspace
      backTo="/admin/inventory"
      backLabel="Back to inventory"
      summary={`${total} label${total === 1 ? '' : 's'} (${items.length} item${items.length === 1 ? '' : 's'})`}
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
            <div className="grid grid-cols-2 gap-3">
              <NumberSetting label="Copies per item" value={s.copies} min={1} max={500} onChange={v => set('copies', v)} />
              <NumberSetting label="Skip first" value={s.skip} min={0} max={perPage - 1} onChange={v => set('skip', v)}
                hint="Labels already used" />
            </div>
          </SettingsGroup>

          <SettingsGroup title="Content">
            <ChoiceSetting label="Code" options={CODE_OPTIONS} value={s.code} onChange={v => set('code', v)} />
            {(s.code === 'barcode' || s.code === 'both') && (
              <ChoiceSetting label="Barcode type" options={BARCODE_FORMATS} value={s.barcodeFormat} onChange={v => set('barcodeFormat', v)} />
            )}
            <CheckField label="Item name" checked={s.showName} onChange={v => set('showName', v)} />
            <CheckField label="Asset code (text)" checked={s.showCode} onChange={v => set('showCode', v)} />
            <CheckField label="Category" checked={s.showCategory} onChange={v => set('showCategory', v)} />
            <CheckField label="Location" checked={s.showLocation} onChange={v => set('showLocation', v)} />
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

function Label({ item, w, h, s }) {
  const pad = clamp(s.padding, 0, Math.min(w, h) / 3)
  const iw = w - 2 * pad
  const ih = h - 2 * pad
  // Font sizes in pt: either derived from the label height, or set exactly.
  const base = clamp(h * 0.2, 4.5, 11) * clamp(s.textScale, 50, 200) / 100
  const size = s.fontMode === 'custom'
    ? { name: clamp(s.nameSize, 3, 48), code: clamp(s.codeSize, 3, 48), detail: clamp(s.detailSize, 3, 48), club: clamp(s.clubSize, 3, 48) }
    : { name: base, code: base * 0.8, detail: base * 0.72, club: base * 0.62 }
  const family = (FONT_FAMILIES[s.fontFamily] || FONT_FAMILIES.default).css
  const withQr = s.code === 'qr' || s.code === 'both'
  const withBar = s.code === 'barcode' || s.code === 'both'

  const lines = [
    s.showName && { text: item.name, size: size.name, weight: s.nameBold ? 700 : 400, color: '#0F172A', clamp: clamp(s.nameLines, 1, 5) },
    s.showCode && !withBar && { text: item.asset_code, size: size.code, mono: true, color: '#334155' },
    s.showCategory && item.category && { text: item.category, size: size.detail, color: '#475569' },
    s.showLocation && item.location && { text: item.location, size: size.detail, color: '#475569' },
    s.showClub && s.clubName && { text: s.clubName, size: size.club, color: '#94A3B8' },
  ].filter(Boolean)

  const text = lines.map((l, i) => (
    <div key={i} style={{
      fontSize: `${l.size}pt`, fontWeight: l.weight || 400, color: l.color, lineHeight: 1.15,
      fontFamily: l.mono ? 'ui-monospace, monospace' : family,
      overflow: 'hidden', wordBreak: 'break-word',
      display: '-webkit-box', WebkitBoxOrient: 'vertical', WebkitLineClamp: l.clamp || 1,
    }}>{l.text}</div>
  ))

  const barBlock = height => (
    <div style={{ width: '100%' }}>
      <Barcode value={item.asset_code} width="100%" height={height} format={s.barcodeFormat} />
      {s.showCode && (
        <div style={{ fontSize: `${size.code}pt`, fontFamily: 'ui-monospace, monospace', textAlign: 'center', letterSpacing: '0.08em', color: '#0F172A', marginTop: '0.5mm' }}>
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
}
