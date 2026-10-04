import { useEffect, useMemo, useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { IdCard } from 'lucide-react'
import { read, supabase } from '../lib/db'
import { memberRoleLine, rememberRoleNames } from '../lib/hr'
import {
  CARD, PAPERS, PIXEL_FONT, PRINT_FONT, brandMark, cellPosition, centredGrid, clamp, fitGrid, initials, mirroredSlot, paginate,
  repeat, usePrintSettings,
} from '../lib/printLayout'
import PrintWorkspace, {
  Cell, ChoiceSetting, ColorSetting, NumberSetting, SettingsGroup,
} from '../components/print/PrintWorkspace'
import { Barcode, BARCODE_FORMATS, QrCode } from '../components/print/Codes'
import { BackgroundLayer, ImageSetting, useStoredImage } from '../components/print/BackgroundImage'
import '../components/print/printFonts.css'
import useAdminStore from '../store/adminStore'
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
  // Brand palette (public/brand/palette). New key names so colours saved by the
  // old design don't carry over, while printer calibration does.
  frontColor: '#050A30',
  frontInk: '#FFFFFF',
  frontAccent: '#5CBCF9',
  backColor: '#FFFFFF',
  backInk: '#050A30',
  frontImageFit: 'cover',
  frontImageShade: 40,
  backImageFit: 'cover',
  backImageShade: 0,
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
  const frontImage = useStoredImage('afaq.print.cards.frontImage')
  const backImage = useStoredImage('afaq.print.cards.backImage')
  const addToast = useAdminStore(st => st.addToast)

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      if (!ids.length) { setState({ loading: false, error: 'No members were chosen for printing.' }); return }
      const [{ ok, data, message }, roles] = await Promise.all([
        read(
          supabase.from('members')
            .select('id, full_name, member_code, department, team, photo_url, card_status, member_positions(title, team, term_start, term_end)')
            .in('id', ids)
        ),
        read(supabase.from('member_roles').select('name, builtin_key').not('builtin_key', 'is', null)),
      ])
      if (cancelled) return
      rememberRoleNames(roles.data || [])
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
        <CardFront member={item} s={s} image={frontImage.src} />
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
          <CardBack member={item} s={s} image={backImage.src} />
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
            <Cell x={x} y={y} w={CARD.w} h={CARD.h} guide={s.guides}><CardFront member={item} s={s} image={frontImage.src} /></Cell>
            <Cell x={x + CARD.w + gap} y={y} w={CARD.w} h={CARD.h} guide={s.guides}><CardBack member={item} s={s} image={backImage.src} /></Cell>
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
            <div className="grid grid-cols-3 gap-3">
              <ColorSetting label="Background" value={s.frontColor} onChange={v => set('frontColor', v)} />
              <ColorSetting label="Text" value={s.frontInk} onChange={v => set('frontInk', v)} />
              <ColorSetting label="Accent" value={s.frontAccent} onChange={v => set('frontAccent', v)} />
            </div>
            <ImageSetting
              image={frontImage}
              fit={s.frontImageFit} onFit={v => set('frontImageFit', v)}
              shade={s.frontImageShade} onShade={v => set('frontImageShade', v)} shadeColor={s.frontColor}
              onError={m => addToast(m, 'error')}
            />
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
              <ColorSetting label="Background" value={s.backColor} onChange={v => set('backColor', v)} />
              <ColorSetting label="Text" value={s.backInk} onChange={v => set('backInk', v)} />
            </div>
            <ImageSetting
              image={backImage}
              fit={s.backImageFit} onFit={v => set('backImageFit', v)}
              shade={s.backImageShade} onShade={v => set('backImageShade', v)} shadeColor={s.backColor}
              onError={m => addToast(m, 'error')}
            />
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

function cardBox(s, extra) {
  return {
    width: '100%',
    height: '100%',
    boxSizing: 'border-box',
    borderRadius: s.rounded ? '3.2mm' : 0,
    overflow: 'hidden',
    position: 'relative',
    '--print-font': PRINT_FONT,
    ...extra,
  }
}

function pt(s, size) {
  return `${size * clamp(s.textScale, 60, 160) / 100}pt`
}

const MONO = 'ui-monospace, "Cascadia Code", Consolas, monospace'

/** Small uppercase caption above a value ("Member no.", "Status"). */
function Caption({ s, children }) {
  return (
    <div style={{ '--print-font': PIXEL_FONT, fontSize: pt(s, 4.6), letterSpacing: '0.1em', textTransform: 'uppercase', opacity: 0.6 }}>
      {children}
    </div>
  )
}

/**
 * Front: the photo bleeds off the left edge, details sit on the right, the
 * brand mark is a large cropped watermark and a thin accent band runs along
 * the bottom — the structure of a real staff pass.
 */
function CardFront({ member, s, image }) {
  const band = '1.3mm'
  const hasFooter = s.showCode || (s.showStatus && member.card_status)

  return (
    <div style={cardBox(s, { background: s.frontColor, color: s.frontInk, display: 'flex' })}>
      <BackgroundLayer src={image} fit={s.frontImageFit} shade={s.frontImageShade} tint={s.frontColor} />
      {!image && (
        <img src={brandMark(s.frontInk)} alt="" aria-hidden style={{
          position: 'absolute', width: '46mm', height: '46mm', right: '-12mm', bottom: '-14mm', opacity: 0.07,
        }} />
      )}

      {s.showPhoto && (
        <div style={{
          position: 'relative', width: '24mm', flexShrink: 0, marginBottom: band, overflow: 'hidden',
          background: 'rgba(127,127,127,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          {member.photo_url
            ? <img src={member.photo_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
            : <span style={{ fontSize: pt(s, 16), fontWeight: 700, opacity: 0.5 }}>{initials(member.full_name)}</span>}
        </div>
      )}

      <div style={{
        position: 'relative', flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column',
        padding: `3.6mm 4mm calc(${band} + 2.6mm) ${s.showPhoto ? '3.6mm' : '4.5mm'}`,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1.6mm' }}>
          <img src={brandMark(s.frontInk)} alt="" style={{ width: '5.2mm', height: '5.2mm', flexShrink: 0 }} />
          <div style={{ minWidth: 0, lineHeight: 1.15 }}>
            <div style={{ fontSize: pt(s, 6.2), fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {s.title}
            </div>
            {s.subtitle && <div style={{ fontSize: pt(s, 4.8), opacity: 0.6 }}>{s.subtitle}</div>}
          </div>
        </div>

        <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <div style={{ fontSize: pt(s, 10.5), fontWeight: 700, lineHeight: 1.08, wordBreak: 'break-word' }}>{member.full_name}</div>
          {s.showRole && (
            <div style={{ fontSize: pt(s, 6), fontWeight: 500, color: s.frontAccent, marginTop: '1mm' }}>{memberRoleLine(member)}</div>
          )}
        </div>

        {hasFooter && (
          <div style={{ display: 'flex', gap: '6mm', borderTop: '0.15mm solid rgba(127,127,127,0.5)', paddingTop: '1.6mm' }}>
            {s.showCode && (
              <div>
                <Caption s={s}>Member no.</Caption>
                <div style={{ fontSize: pt(s, 6.8), fontWeight: 700, '--print-font': MONO, letterSpacing: '0.04em' }}>{member.member_code}</div>
              </div>
            )}
            {s.showStatus && member.card_status && (
              <div>
                <Caption s={s}>Status</Caption>
                <div style={{ fontSize: pt(s, 6.2), fontWeight: 500, textTransform: 'capitalize' }}>{member.card_status}</div>
              </div>
            )}
          </div>
        )}
      </div>

      <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: band, background: s.frontAccent }} />
    </div>
  )
}

/** Back: verification code and a line of text, with the club sign-off at the foot. */
function CardBack({ member, s, image }) {
  const color = s.backInk
  const withQr = s.backCode === 'qr' || s.backCode === 'both'
  const withBar = s.backCode === 'barcode' || s.backCode === 'both'
  const verifyUrl = `${window.location.origin}/verify/${member.member_code}`

  return (
    <div style={cardBox(s, {
      background: s.backColor,
      color,
      border: s.guides || image ? 'none' : '0.2mm solid #E2E8F0',
      display: 'flex',
      flexDirection: 'column',
    })}>
      <BackgroundLayer src={image} fit={s.backImageFit} shade={s.backImageShade} tint={s.backColor} />

      <div style={{
        position: 'relative', flex: 1, minHeight: 0, padding: '4mm 4.5mm 0',
        display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '2.2mm',
      }}>
        <div style={{ display: 'flex', gap: '3.5mm', alignItems: 'center' }}>
          {withQr && (
            // White quiet zone so the code scans on any background colour or image.
            <div style={{ background: '#fff', padding: '1mm', borderRadius: s.rounded ? '1.2mm' : 0, flexShrink: 0 }}>
              <QrCode value={verifyUrl} size={withBar ? 17 : 22} color="#050A30" />
            </div>
          )}
          <div style={{ minWidth: 0, fontSize: pt(s, 5.8), lineHeight: 1.4 }}>
            {s.backHeading && <div style={{ fontWeight: 700, fontSize: pt(s, 7.5), lineHeight: 1.15 }}>{s.backHeading}</div>}
            {s.backText && <div style={{ marginTop: '1mm', opacity: 0.75 }}>{s.backText}</div>}
            {!withBar && (
              <div style={{ marginTop: '1.6mm', '--print-font': MONO, fontWeight: 700, fontSize: pt(s, 6.5), letterSpacing: '0.06em' }}>
                {member.member_code}
              </div>
            )}
          </div>
        </div>
        {withBar && (
          <div>
            <Barcode value={member.member_code} width="100%" height={withQr ? 8 : 13} format={s.barcodeFormat} color={color} />
            <div style={{ fontSize: pt(s, 5.6), '--print-font': MONO, textAlign: 'center', letterSpacing: '0.14em', marginTop: '0.5mm' }}>
              {member.member_code}
            </div>
          </div>
        )}
      </div>

      <div style={{
        position: 'relative', margin: '0 4.5mm', padding: '1.8mm 0 2.6mm', borderTop: '0.15mm solid rgba(127,127,127,0.4)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '2mm', fontSize: pt(s, 4.8),
      }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: '1.2mm', fontWeight: 700, minWidth: 0 }}>
          <img src={brandMark(color)} alt="" style={{ width: '3.4mm', height: '3.4mm', flexShrink: 0 }} />
          <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.title}</span>
        </span>
        <span style={{ opacity: 0.6, whiteSpace: 'nowrap' }}>{window.location.host}</span>
      </div>
    </div>
  )
}
