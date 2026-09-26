import { useEffect, useMemo, useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { IdCard } from 'lucide-react'
import { read, supabase } from '../lib/db'
import { isCurrentTerm, positionLabel, sortPositions } from '../lib/hr'
import {
  CARD, PAPERS, cellPosition, centredGrid, clamp, fitGrid, mirroredSlot, paginate, repeat, usePrintSettings,
} from '../lib/printLayout'
import PrintWorkspace, {
  Cell, ChoiceSetting, ColorSetting, NumberSetting, SettingsGroup,
} from '../components/print/PrintWorkspace'
import { Barcode, BARCODE_FORMATS, QrCode } from '../components/print/Codes'
import { CheckField, SelectField, TextField } from '../components/ui/Field'
import EmptyState, { ErrorState } from '../components/ui/EmptyState'
import Panel from '../components/ui/Panel'

const DEFAULTS = {
  paper: 'a4',
  mode: 'duplex',
  flip: 'long',
  copies: 1,
  gap: 2,
  guides: true,
  offsetX: 0,
  offsetY: 0,
  backOffsetX: 0,
  backOffsetY: 0,
  title: 'AFAQ Scientific Club',
  subtitle: 'Member card',
  frontBg1: '#0F172A',
  frontBg2: '#1E293B',
  frontText: '#FFFFFF',
  accent: '#38BDF8',
  backBg: '#FFFFFF',
  backTextColor: '#0F172A',
  showPhoto: true,
  showRole: true,
  showStatus: true,
  showCode: true,
  rounded: true,
  textScale: 100,
  backCode: 'qr',
  barcodeFormat: 'CODE128',
  backHeading: 'Scan to verify',
  backText: 'This card certifies active membership in AFAQ Scientific Club.',
}

const MODES = [
  { value: 'duplex', label: 'Double-sided' },
  { value: 'pairs', label: 'Front + back side by side' },
  { value: 'fronts', label: 'Fronts only' },
  { value: 'backs', label: 'Backs only' },
]

const FLIPS = [
  { value: 'long', label: 'Long edge' },
  { value: 'short', label: 'Short edge' },
]

const BACK_CODES = [
  { value: 'qr', label: 'QR code' },
  { value: 'barcode', label: 'Barcode' },
  { value: 'both', label: 'Both' },
  { value: 'none', label: 'None' },
]

/**
 * Prints one card (/admin/members/:id/card) or a batch
 * (/admin/members/cards?ids=1,2,3). Cards are generated here from the member
 * number, so nobody has to "issue" a card before printing it.
 */
export default function CardPrintPage() {
  const { id } = useParams()
  const [params] = useSearchParams()
  const ids = useMemo(() => {
    const raw = id ? [id] : (params.get('ids') || '').split(',')
    return raw.map(Number).filter(n => Number.isFinite(n) && n > 0)
  }, [id, params])

  const [members, setMembers] = useState([])
  const [state, setState] = useState({ loading: true, error: null })
  const [s, set, reset] = usePrintSettings('afaq.print.cards', DEFAULTS)

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      if (!ids.length) { setState({ loading: false, error: 'No members were chosen for printing.' }); return }
      const { ok, data, message } = await read(
        supabase.from('members')
          .select('id, full_name, member_code, department, team, photo_url, card_status, member_positions(title, team, term_start, term_end)')
          .in('id', ids)
      )
      if (cancelled) return
      if (!ok) { setState({ loading: false, error: message }); return }
      // Keep the order the admin picked them in, not the database's.
      const byId = new Map((data || []).map(m => [m.id, m]))
      setMembers(ids.map(i => byId.get(i)).filter(m => m?.member_code))
      setState({ loading: false, error: null })
    }
    load()
    return () => { cancelled = true }
  }, [ids])

  const paper = PAPERS[s.paper] || PAPERS.a4
  const gap = clamp(s.gap, 0, 20)
  const cellW = s.mode === 'pairs' ? CARD.w * 2 + gap : CARD.w
  const grid = useMemo(() => {
    const { cols, rows } = fitGrid(paper, cellW, CARD.h, gap, 5)
    return centredGrid(paper, cols, rows, cellW, CARD.h, gap, gap)
  }, [paper, cellW, gap])
  const perPage = grid.cols * grid.rows

  const pages = useMemo(() => paginate(repeat(members, s.copies), perPage), [members, s.copies, perPage])

  if (state.loading) return null
  if (state.error) return <Panel><ErrorState message={state.error} /></Panel>
  if (!members.length) {
    return (
      <Panel>
        <EmptyState icon={IdCard} title="Nothing to print" description="None of the chosen members have a member number yet." />
      </Panel>
    )
  }

  const offX = Number(s.offsetX) || 0
  const offY = Number(s.offsetY) || 0
  const place = (slot, extraX = 0, extraY = 0) => {
    const { x, y } = cellPosition(grid, slot)
    return { x: x + offX + extraX, y: y + offY + extraY }
  }

  const fronts = (page, p) => ({
    key: `f${p}`,
    title: s.mode === 'duplex' ? `Sheet ${p + 1} — front side` : `Page ${p + 1}`,
    content: page.map(({ slot, item }, i) => (
      <Cell key={i} {...place(slot)} w={CARD.w} h={CARD.h} guide={s.guides}>
        <CardFront member={item} s={s} />
      </Cell>
    )),
  })

  const backs = (page, p, mirrored) => ({
    key: `b${p}`,
    title: mirrored ? `Sheet ${p + 1} — back side (turn sheet over, ${s.flip} edge)` : `Page ${p + 1}`,
    content: page.map(({ slot, item }, i) => {
      const at = mirrored ? mirroredSlot(grid, slot, s.flip) : slot
      return (
        <Cell key={i} {...place(at, mirrored ? Number(s.backOffsetX) || 0 : 0, mirrored ? Number(s.backOffsetY) || 0 : 0)}
          w={CARD.w} h={CARD.h} guide={s.guides}>
          <CardBack member={item} s={s} />
        </Cell>
      )
    }),
  })

  let sheets
  if (s.mode === 'duplex') sheets = pages.flatMap((page, p) => [fronts(page, p), backs(page, p, true)])
  else if (s.mode === 'fronts') sheets = pages.map(fronts)
  else if (s.mode === 'backs') sheets = pages.map((page, p) => backs(page, p, false))
  else {
    sheets = pages.map((page, p) => ({
      key: `p${p}`,
      title: `Page ${p + 1}`,
      content: page.map(({ slot, item }, i) => {
        const { x, y } = place(slot)
        return (
          <div key={i}>
            <Cell x={x} y={y} w={CARD.w} h={CARD.h} guide={s.guides}><CardFront member={item} s={s} /></Cell>
            <Cell x={x + CARD.w + gap} y={y} w={CARD.w} h={CARD.h} guide={s.guides}><CardBack member={item} s={s} /></Cell>
          </div>
        )
      }),
    }))
  }

  const total = members.length * Math.max(1, Math.floor(s.copies) || 1)

  return (
    <PrintWorkspace
      backTo="/admin/members"
      backLabel="Back to members"
      summary={`${total} card${total === 1 ? '' : 's'} · ${perPage} per sheet`}
      paper={paper}
      sheets={sheets}
      onReset={reset}
      settings={
        <>
          <SettingsGroup title="Layout">
            <SelectField label="Paper" value={s.paper} onChange={e => set('paper', e.target.value)}>
              {Object.entries(PAPERS).map(([key, p]) => <option key={key} value={key}>{p.label}</option>)}
            </SelectField>
            <ChoiceSetting label="Print" options={MODES} value={s.mode} onChange={v => set('mode', v)} />
            {s.mode === 'duplex' && (
              <>
                <ChoiceSetting label="Printer flips on" options={FLIPS} value={s.flip} onChange={v => set('flip', v)} />
                <p className="text-xs" style={{ color: 'var(--adm-silk-faint)' }}>
                  Print with duplex on (or print odd pages, reload the sheets, then even pages). Backs are mirrored so each lands behind its own front.
                </p>
              </>
            )}
            <div className="grid grid-cols-2 gap-3">
              <NumberSetting label="Copies per member" value={s.copies} min={1} max={100} onChange={v => set('copies', v)} />
              <NumberSetting label="Gap between cards" suffix="mm" value={s.gap} min={0} max={20} step={0.5} onChange={v => set('gap', v)} />
            </div>
            <CheckField label="Cut guides" description="Dashed outline around each card" checked={s.guides} onChange={v => set('guides', v)} />
          </SettingsGroup>

          <SettingsGroup title="Front">
            <TextField label="Title" value={s.title} onChange={e => set('title', e.target.value)} />
            <TextField label="Subtitle" value={s.subtitle} onChange={e => set('subtitle', e.target.value)} />
            <div className="grid grid-cols-2 gap-3">
              <ColorSetting label="Background" value={s.frontBg1} onChange={v => set('frontBg1', v)} />
              <ColorSetting label="Gradient to" value={s.frontBg2} onChange={v => set('frontBg2', v)} />
              <ColorSetting label="Text" value={s.frontText} onChange={v => set('frontText', v)} />
              <ColorSetting label="Accent" value={s.accent} onChange={v => set('accent', v)} />
            </div>
            <CheckField label="Photo" checked={s.showPhoto} onChange={v => set('showPhoto', v)} />
            <CheckField label="Role / team" checked={s.showRole} onChange={v => set('showRole', v)} />
            <CheckField label="Member number" checked={s.showCode} onChange={v => set('showCode', v)} />
            <CheckField label="Card status" checked={s.showStatus} onChange={v => set('showStatus', v)} />
          </SettingsGroup>

          <SettingsGroup title="Back">
            <ChoiceSetting label="Code" options={BACK_CODES} value={s.backCode} onChange={v => set('backCode', v)} />
            {(s.backCode === 'barcode' || s.backCode === 'both') && (
              <ChoiceSetting label="Barcode type" options={BARCODE_FORMATS} value={s.barcodeFormat} onChange={v => set('barcodeFormat', v)} />
            )}
            <TextField label="Heading" value={s.backHeading} onChange={e => set('backHeading', e.target.value)} />
            <TextField label="Text" value={s.backText} onChange={e => set('backText', e.target.value)} />
            <div className="grid grid-cols-2 gap-3">
              <ColorSetting label="Background" value={s.backBg} onChange={v => set('backBg', v)} />
              <ColorSetting label="Text" value={s.backTextColor} onChange={v => set('backTextColor', v)} />
            </div>
          </SettingsGroup>

          <SettingsGroup title="Style">
            <NumberSetting label="Text size" suffix="%" value={s.textScale} min={60} max={160} step={5} onChange={v => set('textScale', v)} />
            <CheckField label="Rounded corners" checked={s.rounded} onChange={v => set('rounded', v)} />
          </SettingsGroup>

          <SettingsGroup title="Printer calibration">
            <div className="grid grid-cols-2 gap-3">
              <NumberSetting label="Shift right" suffix="mm" step={0.5} value={s.offsetX} onChange={v => set('offsetX', v)} />
              <NumberSetting label="Shift down" suffix="mm" step={0.5} value={s.offsetY} onChange={v => set('offsetY', v)} />
              {s.mode === 'duplex' && (
                <>
                  <NumberSetting label="Back shift right" suffix="mm" step={0.5} value={s.backOffsetX} onChange={v => set('backOffsetX', v)} />
                  <NumberSetting label="Back shift down" suffix="mm" step={0.5} value={s.backOffsetY} onChange={v => set('backOffsetY', v)} />
                </>
              )}
            </div>
            <p className="text-xs" style={{ color: 'var(--adm-silk-faint)' }}>
              Print at 100% scale (“Actual size”, margins “None”). If backs don’t line up with fronts, print one test sheet and adjust the back shift.
            </p>
          </SettingsGroup>
        </>
      }
    />
  )
}

function roleLine(member) {
  const current = sortPositions(member.member_positions || []).filter(p => isCurrentTerm(p))
  if (current.length) {
    const p = current[0]
    return `${positionLabel(p.title)}${p.team ? ` · ${p.team}` : ''}`
  }
  return member.team ? `${member.team} team` : member.department || 'Member'
}

function cardBox(s, extra) {
  return {
    width: '100%',
    height: '100%',
    boxSizing: 'border-box',
    borderRadius: s.rounded ? '3.2mm' : 0,
    overflow: 'hidden',
    position: 'relative',
    ...extra,
  }
}

function pt(s, size) {
  return `${size * clamp(s.textScale, 60, 160) / 100}pt`
}

function CardFront({ member, s }) {
  return (
    <div style={cardBox(s, {
      background: `linear-gradient(135deg, ${s.frontBg1}, ${s.frontBg2})`,
      color: s.frontText,
      padding: '4mm 4mm 3mm 5.5mm',
      display: 'flex',
      flexDirection: 'column',
    })}>
      <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: '1.5mm', background: s.accent }} />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '2mm' }}>
        <div style={{ fontSize: pt(s, 7), fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase' }}>{s.title}</div>
        {s.subtitle && <div style={{ fontSize: pt(s, 5.5), color: s.accent, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', whiteSpace: 'nowrap' }}>{s.subtitle}</div>}
      </div>

      <div style={{ display: 'flex', gap: '3.5mm', alignItems: 'center', flex: 1, minHeight: 0 }}>
        {s.showPhoto && (
          <div style={{
            width: '19mm', height: '24mm', borderRadius: s.rounded ? '2mm' : 0, overflow: 'hidden', flexShrink: 0,
            background: 'rgba(255,255,255,0.1)', border: `0.4mm solid ${s.accent}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            {member.photo_url
              ? <img src={member.photo_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              : <IdCard size={26} color="currentColor" style={{ opacity: 0.4 }} />}
          </div>
        )}
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: pt(s, 10), fontWeight: 800, lineHeight: 1.15, wordBreak: 'break-word' }}>{member.full_name}</div>
          {s.showRole && <div style={{ fontSize: pt(s, 6.5), opacity: 0.8, marginTop: '1.2mm' }}>{roleLine(member)}</div>}
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        {s.showCode ? <div style={{ fontSize: pt(s, 6.5), fontFamily: 'ui-monospace, monospace', letterSpacing: '0.06em' }}>{member.member_code}</div> : <span />}
        {s.showStatus && member.card_status && <div style={{ fontSize: pt(s, 5), opacity: 0.65, textTransform: 'uppercase' }}>{member.card_status}</div>}
      </div>
    </div>
  )
}

function CardBack({ member, s }) {
  const color = s.backTextColor
  const withQr = s.backCode === 'qr' || s.backCode === 'both'
  const withBar = s.backCode === 'barcode' || s.backCode === 'both'
  const verifyUrl = `${window.location.origin}/verify/${member.member_code}`

  return (
    <div style={cardBox(s, {
      background: s.backBg,
      color,
      padding: '4mm',
      border: s.guides ? 'none' : '0.2mm solid #E2E8F0',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      gap: '2.5mm',
    })}>
      <div style={{ display: 'flex', gap: '3.5mm', alignItems: 'center' }}>
        {withQr && <QrCode value={verifyUrl} size={withBar ? 20 : 26} color={color} />}
        <div style={{ minWidth: 0, fontSize: pt(s, 6), lineHeight: 1.45 }}>
          {s.backHeading && <div style={{ fontWeight: 800, fontSize: pt(s, 7.5) }}>{s.backHeading}</div>}
          {s.backText && <div style={{ marginTop: '1mm', opacity: 0.8 }}>{s.backText}</div>}
          {!withBar && <div style={{ marginTop: '1mm', fontFamily: 'ui-monospace, monospace' }}>{member.member_code}</div>}
        </div>
      </div>
      {withBar && (
        <div>
          <Barcode value={member.member_code} width="100%" height={withQr ? 9 : 14} format={s.barcodeFormat} color={color} />
          <div style={{ fontSize: pt(s, 6), fontFamily: 'ui-monospace, monospace', textAlign: 'center', letterSpacing: '0.1em', marginTop: '0.6mm' }}>
            {member.member_code}
          </div>
        </div>
      )}
    </div>
  )
}
