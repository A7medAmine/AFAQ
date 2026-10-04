import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { BadgeCheck } from 'lucide-react'
import { read, supabase } from '../lib/db'
import { memberRoleLine } from '../lib/hr'
import { formatDate } from '../lib/format'
import {
  BADGE_SIZES, PAPERS, PIXEL_FONT, PRINT_FONT, brandMark, cellPosition, clamp, initials, isLight, marginGrid,
  mirroredSlot, orientPaper, paginate, repeat, usePrintSettings,
} from '../lib/printLayout'
import PrintWorkspace, {
  Cell, ChoiceSetting, ColorSetting, NumberSetting, SettingsGroup,
} from '../components/print/PrintWorkspace'
import { QrCode } from '../components/print/Codes'
import { BackgroundLayer, ImageSetting, useStoredImage } from '../components/print/BackgroundImage'
import '../components/print/printFonts.css'
import { CheckField, SelectField, TextField } from '../components/ui/Field'
import EmptyState, { ErrorState } from '../components/ui/EmptyState'
import Panel from '../components/ui/Panel'
import useAdminStore from '../store/adminStore'

const DEFAULTS = {
  paper: 'a4',
  size: 'p3x4',
  customW: 90,
  customH: 120,
  sides: 'single',
  flip: 'long',
  orientation: 'portrait',
  copies: 1,
  blanks: 0,
  skip: 0,
  marginTop: 8,
  marginRight: 8,
  marginBottom: 8,
  marginLeft: 8,
  gapX: 4,
  gapY: 4,
  maxCols: 0,
  maxRows: 0,
  placement: 'center',
  marks: 'corners',
  offsetX: 0,
  offsetY: 0,
  backOffsetX: 0,
  backOffsetY: 0,
  title: 'AFAQ Scientific Club',
  heading: '',
  useEventName: true,
  showDate: true,
  tag: 'Member',
  // Brand palette, used the way the opening-day flyer uses it: midnight
  // ground, cloud text, sky for tags and accents, AFAQ blue for glow and the
  // hard pixel shadows.
  bg: '#050A30',
  ink: '#F4F6FC',
  accent: '#5CBCF9',
  glow: '#233DFF',
  brandArt: true,
  imageFit: 'cover',
  imageShade: 45,
  showPhoto: true,
  showLine: true,
  showQr: true,
  splitName: true,
  slot: false,
  textScale: 100,
  rounded: false,
}

const SIDES = [
  { value: 'single', label: 'One side' },
  { value: 'duplex', label: 'Both sides (same design)' },
]

const ORIENTATIONS = [
  { value: 'portrait', label: 'Portrait' },
  { value: 'landscape', label: 'Landscape' },
]

const PLACEMENTS = [
  { value: 'center', label: 'Centred on page' },
  { value: 'start', label: 'From top-left margin' },
]

const MARKS = [
  { value: 'corners', label: 'Corner crop marks' },
  { value: 'outline', label: 'Dashed outline' },
  { value: 'none', label: 'None' },
]

const FLIPS = [
  { value: 'long', label: 'Long edge' },
  { value: 'short', label: 'Short edge' },
]

/** Same JSON the server puts in a registration's entry-pass QR, so the badge scans at check-in. */
function entryPayload(reg) {
  return JSON.stringify({ id: reg.id, event: reg.event?.title_en || '', name: reg.full_name, email: reg.email })
}

/** Both sources become the same shape so the badge doesn't care where people came from. */
function fromMember(m) {
  return {
    kind: 'member',
    name: m.full_name,
    line: memberRoleLine(m),
    lineLabel: 'Role',
    photo: m.photo_url,
    qr: m.member_code ? `${window.location.origin}/verify/${m.member_code}` : '',
    event: '',
  }
}

function fromRegistration(r) {
  return {
    kind: 'registration',
    name: r.full_name,
    line: [r.department, r.study_year].filter(Boolean).join(' · '),
    lineLabel: 'Department',
    photo: '',
    qr: entryPayload(r),
    event: r.event?.title_en || '',
    date: r.event?.date || '',
  }
}

const REGISTRATION_FIELDS = 'id, full_name, email, department, study_year, status, event:events(id, title_en, date)'

/** Which registrations of an event get a badge. Cancelled and rejected never do. */
const INCLUDE = [
  { value: 'approved', label: 'Approved', statuses: ['approved'] },
  { value: 'pending', label: 'Approved + pending', statuses: ['approved', 'pending'] },
]

const SOURCES = {
  members: {
    backTo: '/admin/members',
    backLabel: 'Back to members',
    // v2: the brand redesign changed the defaults; the image key stays put.
    storageKey: 'afaq.print.badges.members.v2',
    imageKey: 'afaq.print.badges.members.image',
    query: ids => supabase.from('members')
      .select('id, full_name, member_code, department, team, photo_url, member_positions(title, team, term_start, term_end)')
      .in('id', ids),
    map: fromMember,
    tag: 'Member',
  },
  registrations: {
    backTo: '/admin/registrations',
    backLabel: 'Back to registrations',
    storageKey: 'afaq.print.badges.registrations.v2',
    imageKey: 'afaq.print.badges.registrations.image',
    query: ids => supabase.from('event_registrations').select(REGISTRATION_FIELDS).in('id', ids),
    map: fromRegistration,
    tag: 'Participant',
  },
}

/**
 * Name badges for lanyards and badge holders, for members
 * (/admin/members/badges?ids=…) or event registrations
 * (/admin/registrations/badges?ids=…), or everyone registered for one event
 * (/admin/registrations/badges?event=…&include=approved|pending). Same sheet
 * engine as the ID cards, with a custom background image so a badge can carry
 * an event's own artwork.
 */
export default function BadgePrintPage({ source = 'members' }) {
  const src = SOURCES[source] || SOURCES.members
  const byEvent = source === 'registrations'
  const [params, setParams] = useSearchParams()
  const ids = useMemo(
    () => (params.get('ids') || '').split(',').map(Number).filter(n => Number.isFinite(n) && n > 0),
    [params]
  )
  const eventId = Number(params.get('event')) || null
  const include = INCLUDE.find(o => o.value === params.get('include')) || INCLUDE[0]

  const [people, setPeople] = useState([])
  const [events, setEvents] = useState([])
  const [state, setState] = useState({ loading: true, error: null })
  const [s, set, reset] = usePrintSettings(src.storageKey, { ...DEFAULTS, tag: src.tag })
  const image = useStoredImage(src.imageKey)
  const addToast = useAdminStore(st => st.addToast)

  // Picking an event (or who to include) rewrites the URL, so the page can be
  // bookmarked or opened straight from the events list.
  const choose = patch => setParams(prev => {
    const next = new URLSearchParams(prev)
    for (const [k, v] of Object.entries(patch)) v ? next.set(k, v) : next.delete(k)
    return next
  }, { replace: true })

  useEffect(() => {
    if (!byEvent) return
    read(supabase.from('events').select('id, title_en, date').order('date', { ascending: false }))
      .then(({ ok, data }) => ok && setEvents(data || []))
  }, [byEvent])

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      let rows
      if (byEvent && eventId) {
        const { ok, data, message } = await read(
          supabase.from('event_registrations').select(REGISTRATION_FIELDS)
            .eq('event_id', eventId).in('status', include.statuses)
            .order('full_name', { ascending: true })
        )
        if (cancelled) return
        if (!ok) { setState({ loading: false, error: message }); return }
        rows = data || []
      } else if (ids.length) {
        const { ok, data, message } = await read(src.query(ids))
        if (cancelled) return
        if (!ok) { setState({ loading: false, error: message }); return }
        // Keep the order the admin picked them in, not the database's.
        const byId = new Map((data || []).map(row => [row.id, row]))
        rows = ids.map(i => byId.get(i)).filter(Boolean)
      } else {
        rows = []
      }
      setPeople(rows.map(src.map))
      setState({ loading: false, error: null })
    }
    load()
    return () => { cancelled = true }
  }, [ids, src, byEvent, eventId, include])

  const event = events.find(e => e.id === eventId)

  const size = s.size === 'custom'
    ? { w: clamp(s.customW, 30, 200), h: clamp(s.customH, 30, 280) }
    : BADGE_SIZES[s.size] || BADGE_SIZES.p3x4
  const paper = orientPaper(PAPERS[s.paper] || PAPERS.a4, s.orientation)
  const margins = {
    top: clamp(s.marginTop, 0, 60), right: clamp(s.marginRight, 0, 60),
    bottom: clamp(s.marginBottom, 0, 60), left: clamp(s.marginLeft, 0, 60),
  }
  const gapX = clamp(s.gapX, 0, 30)
  const gapY = clamp(s.gapY, 0, 30)
  const grid = marginGrid(paper, size.w, size.h, margins, gapX, gapY, {
    maxCols: Math.floor(clamp(s.maxCols, 0, 20)),
    maxRows: Math.floor(clamp(s.maxRows, 0, 20)),
    placement: s.placement,
  })
  const perPage = grid.cols * grid.rows
  const skip = Math.floor(clamp(s.skip, 0, perPage - 1))

  const blanks = Math.floor(clamp(s.blanks, 0, 500))
  const all = useMemo(
    () => [
      ...repeat(people, s.copies),
      // Walk-in badges still carry the event's name and date.
      ...Array.from({ length: blanks }, () => ({ name: '', line: '', photo: '', qr: '', event: event?.title_en || '', date: event?.date || '' })),
    ],
    [people, s.copies, blanks, event]
  )
  const pages = useMemo(() => paginate(all, perPage, skip), [all, perPage, skip])

  if (state.loading) return null
  if (state.error) return <Panel><ErrorState message={state.error} /></Panel>
  // The event picker lives in the settings, so with an event chosen the
  // workspace stays up even when nobody matches yet.
  if (!all.length && !(byEvent && eventId)) {
    return (
      <Panel>
        <EmptyState
          icon={BadgeCheck}
          title="Nothing to print"
          description={
            ids.length ? 'None of the chosen people could be found.'
              : byEvent ? 'Choose an event, or pick registrations from the list.'
              : 'Pick people from the list first.'
          }
          action={byEvent && events.length > 0 && (
            <select className="adm-input" style={{ width: 'auto' }} value="" aria-label="Event"
              onChange={e => choose({ event: e.target.value, ids: '' })}>
              <option value="" disabled>Print badges for an event…</option>
              {events.map(ev => <option key={ev.id} value={ev.id}>{ev.title_en}{ev.date ? ` — ${formatDate(ev.date)}` : ''}</option>)}
            </select>
          )}
        />
      </Panel>
    )
  }

  const place = (slot, dx = 0, dy = 0) => {
    const { x, y } = cellPosition(grid, slot)
    return { x: x + (Number(s.offsetX) || 0) + dx, y: y + (Number(s.offsetY) || 0) + dy }
  }

  // Crop marks go down first and badges on top, so a mark that reaches into a
  // narrow gap is covered by the neighbouring badge instead of printing on it.
  const layout = placed => [
    ...(s.marks === 'corners' ? placed.map(({ pos }, i) => <CropMarks key={`m${i}`} {...pos} w={size.w} h={size.h} />) : []),
    ...placed.map(({ pos, item }, i) => (
      <Cell key={i} {...pos} w={size.w} h={size.h} guide={s.marks === 'outline'}>
        <Badge person={item} s={s} size={size} image={image.src} />
      </Cell>
    )),
  ]

  const sheets = pages.flatMap((page, p) => {
    const front = {
      key: `f${p}`,
      title: s.sides === 'duplex' ? `Sheet ${p + 1} — front side` : `Page ${p + 1}`,
      content: layout(page.map(({ slot, item }) => ({ item, pos: place(slot) }))),
    }
    if (s.sides !== 'duplex') return [front]
    const back = {
      key: `b${p}`,
      title: `Sheet ${p + 1} — back side (turn sheet over, ${s.flip} edge)`,
      content: layout(page.map(({ slot, item }) => ({
        item,
        pos: place(mirroredSlot(grid, slot, s.flip), Number(s.backOffsetX) || 0, Number(s.backOffsetY) || 0),
      }))),
    }
    return [front, back]
  })

  return (
    <PrintWorkspace
      backTo={eventId ? `${src.backTo}?event=${eventId}` : src.backTo}
      backLabel={src.backLabel}
      summary={`${all.length} badge${all.length === 1 ? '' : 's'} · ${perPage} per sheet`}
      paper={paper}
      sheets={sheets}
      onReset={() => { reset(); image.clear() }}
      settings={
        <>
          {byEvent && (
            <SettingsGroup title="Who">
              <SelectField label="Event" value={eventId ? String(eventId) : ''}
                onChange={e => choose({ event: e.target.value, ids: '' })}>
                {!eventId && <option value="">{ids.length ? `${ids.length} chosen registration${ids.length === 1 ? '' : 's'}` : 'Choose an event…'}</option>}
                {eventId && !event && <option value={eventId}>{events.length ? 'Event not found' : 'Loading events…'}</option>}
                {events.map(ev => <option key={ev.id} value={ev.id}>{ev.title_en}{ev.date ? ` — ${formatDate(ev.date)}` : ''}</option>)}
              </SelectField>
              {eventId && (
                <>
                  <ChoiceSetting label="Include" options={INCLUDE} value={include.value} onChange={v => choose({ include: v === 'approved' ? '' : v })} />
                  <p className="text-xs" style={{ color: 'var(--adm-silk-faint)' }}>
                    {people.length
                      ? `${people.length} registration${people.length === 1 ? '' : 's'}, sorted by name.`
                      : 'Nobody matches yet. Blank badges still print.'}
                  </p>
                </>
              )}
            </SettingsGroup>
          )}

          <SettingsGroup title="Badge">
            <SelectField label="Badge size" value={s.size} onChange={e => set('size', e.target.value)}>
              {Object.entries(BADGE_SIZES).map(([key, b]) => <option key={key} value={key}>{b.label}</option>)}
            </SelectField>
            {s.size === 'custom' && (
              <div className="grid grid-cols-2 gap-3">
                <NumberSetting label="Width" suffix="mm" value={s.customW} min={30} max={200} step={0.5} onChange={v => set('customW', v)} />
                <NumberSetting label="Height" suffix="mm" value={s.customH} min={30} max={280} step={0.5} onChange={v => set('customH', v)} />
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <NumberSetting label="Copies each" value={s.copies} min={1} max={50} onChange={v => set('copies', v)} />
              <NumberSetting label="Blank badges" hint="For walk-ins" value={s.blanks} min={0} max={500} onChange={v => set('blanks', v)} />
            </div>
            <CheckField label="Lanyard slot mark" description="Where to punch the clip hole" checked={s.slot} onChange={v => set('slot', v)} />
          </SettingsGroup>

          <SettingsGroup title="Sheet">
            <SelectField label="Paper" value={s.paper} onChange={e => set('paper', e.target.value)}>
              {Object.entries(PAPERS).map(([key, p]) => <option key={key} value={key}>{p.label}</option>)}
            </SelectField>
            <ChoiceSetting label="Orientation" options={ORIENTATIONS} value={s.orientation} onChange={v => set('orientation', v)} />
            <ChoiceSetting label="Print" options={SIDES} value={s.sides} onChange={v => set('sides', v)} />
            {s.sides === 'duplex' && (
              <ChoiceSetting label="Printer flips on" options={FLIPS} value={s.flip} onChange={v => set('flip', v)} />
            )}
            <div>
              <span className="adm-label">Page margins</span>
              <div className="grid grid-cols-2 gap-3">
                <NumberSetting label="Top" suffix="mm" value={s.marginTop} min={0} max={60} step={0.5} onChange={v => set('marginTop', v)} />
                <NumberSetting label="Bottom" suffix="mm" value={s.marginBottom} min={0} max={60} step={0.5} onChange={v => set('marginBottom', v)} />
                <NumberSetting label="Left" suffix="mm" value={s.marginLeft} min={0} max={60} step={0.5} onChange={v => set('marginLeft', v)} />
                <NumberSetting label="Right" suffix="mm" value={s.marginRight} min={0} max={60} step={0.5} onChange={v => set('marginRight', v)} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <NumberSetting label="Gap across" suffix="mm" value={s.gapX} min={0} max={30} step={0.5} onChange={v => set('gapX', v)} />
              <NumberSetting label="Gap down" suffix="mm" value={s.gapY} min={0} max={30} step={0.5} onChange={v => set('gapY', v)} />
              <NumberSetting label="Columns" hint="0 = as many as fit" value={s.maxCols} min={0} max={20} onChange={v => set('maxCols', v)} />
              <NumberSetting label="Rows" hint="0 = as many as fit" value={s.maxRows} min={0} max={20} onChange={v => set('maxRows', v)} />
            </div>
            <ChoiceSetting label="Place badges" options={PLACEMENTS} value={s.placement} onChange={v => set('placement', v)} />
            <NumberSetting label="Skip slots on first sheet" hint="For a sheet that was already partly used" value={s.skip} min={0} max={Math.max(0, perPage - 1)} onChange={v => set('skip', v)} />
            <ChoiceSetting label="Cut marks" options={MARKS} value={s.marks} onChange={v => set('marks', v)} />
            <p className="text-xs" style={{ color: grid.overflows ? 'var(--adm-danger, #f87171)' : 'var(--adm-silk-faint)' }}>
              {grid.overflows
                ? 'The badge is bigger than the space inside the margins. Shrink the margins or pick a smaller badge.'
                : `${grid.cols} × ${grid.rows} = ${perPage} per sheet.`}
            </p>
          </SettingsGroup>

          <SettingsGroup title="Content">
            <TextField label="Organisation" value={s.title} onChange={e => set('title', e.target.value)} />
            <TextField label="Heading" placeholder="e.g. Robotics Day 2026" value={s.heading} onChange={e => set('heading', e.target.value)} />
            {source === 'registrations' && (
              <>
                <CheckField label="Use the event's name" description="When the heading is empty" checked={s.useEventName} onChange={v => set('useEventName', v)} />
                <CheckField label="Event date" checked={s.showDate} onChange={v => set('showDate', v)} />
              </>
            )}
            <TextField label="Tag" placeholder="e.g. Member, Staff, Speaker" value={s.tag} onChange={e => set('tag', e.target.value)} />
            {source === 'members' && <CheckField label="Photo" checked={s.showPhoto} onChange={v => set('showPhoto', v)} />}
            <CheckField label="First name large" description="Surname on its own line, smaller" checked={s.splitName} onChange={v => set('splitName', v)} />
            <CheckField
              label={source === 'members' ? 'Role / team' : 'Department / year'}
              checked={s.showLine} onChange={v => set('showLine', v)}
            />
            <CheckField
              label="QR code"
              description={source === 'members' ? 'Links to the member check page' : 'Same code as the entry pass'}
              checked={s.showQr} onChange={v => set('showQr', v)}
            />
          </SettingsGroup>

          <SettingsGroup title="Design">
            <div className="grid grid-cols-2 gap-3">
              <ColorSetting label="Background" value={s.bg} onChange={v => set('bg', v)} />
              <ColorSetting label="Text" value={s.ink} onChange={v => set('ink', v)} />
              <ColorSetting label="Accent" value={s.accent} onChange={v => set('accent', v)} />
              <ColorSetting label="Glow / shadow" value={s.glow} onChange={v => set('glow', v)} />
            </div>
            <CheckField label="Brand artwork" description="Glow, pixel grid, horizon and stars" checked={s.brandArt} onChange={v => set('brandArt', v)} />
            <ImageSetting
              image={image}
              fit={s.imageFit} onFit={v => set('imageFit', v)}
              shade={s.imageShade} onShade={v => set('imageShade', v)} shadeColor={s.bg}
              onError={m => addToast(m, 'error')}
            />
            <NumberSetting label="Text size" suffix="%" value={s.textScale} min={60} max={160} step={5} onChange={v => set('textScale', v)} />
            <CheckField label="Rounded corners" checked={s.rounded} onChange={v => set('rounded', v)} />
          </SettingsGroup>

          <SettingsGroup title="Printer calibration">
            <div className="grid grid-cols-2 gap-3">
              <NumberSetting label="Shift right" suffix="mm" step={0.5} value={s.offsetX} onChange={v => set('offsetX', v)} />
              <NumberSetting label="Shift down" suffix="mm" step={0.5} value={s.offsetY} onChange={v => set('offsetY', v)} />
              {s.sides === 'duplex' && (
                <>
                  <NumberSetting label="Back shift right" suffix="mm" step={0.5} value={s.backOffsetX} onChange={v => set('backOffsetX', v)} />
                  <NumberSetting label="Back shift down" suffix="mm" step={0.5} value={s.backOffsetY} onChange={v => set('backOffsetY', v)} />
                </>
              )}
            </div>
            <p className="text-xs" style={{ color: 'var(--adm-silk-faint)' }}>
              Print at 100% scale (“Actual size”, margins “None”). For artwork that runs to the edge, set both gaps to 0 and cut on the corner marks.
            </p>
          </SettingsGroup>
        </>
      }
    />
  )
}

/** #rrggbb plus an alpha, for the glows and grid lines. */
function hexA(hex, alpha) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex || '')
  if (!m) return `rgba(0,0,0,${alpha})`
  const n = parseInt(m[1], 16)
  return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${alpha})`
}

// Pixel "stars" from the flyer: [left %, top %, big?]. Kept to the edges so
// they never sit under the name.
const STARS = [[84, 17, 1], [91, 29, 0], [72, 25, 0], [94, 44, 1], [6, 47, 0], [80, 52, 0]]

/**
 * One badge, in the language of the club's opening-day flyer: midnight ground
 * with AFAQ-blue and sky glows, a pixel grid fading down, a glowing horizon,
 * the Minecraft face for the name and labels with hard pixel shadows, and a
 * cloud strip at the foot carrying the role and the QR code.
 *
 * Everything is sized against a 76.2 mm badge and scaled with the short side,
 * so every preset keeps the same proportions.
 */
function Badge({ person, s, size, image }) {
  const wide = size.w > size.h
  const unit = (wide ? size.h : size.w) / 76.2
  const pt = n => `${n * unit * clamp(s.textScale, 60, 160) / 100}pt`
  const mm = n => `${n * unit}mm`

  const blank = !person.name
  const heading = s.heading || (s.useEventName ? person.event : '')
  const [first, ...rest] = (person.name || '').trim().split(/\s+/)
  const split = s.splitName && rest.length > 0
  const display = split ? first : person.name || ''
  // The pixel face is wide; long names step down so they stay on one line.
  const displaySize = (split ? 25 : 16) * Math.min(1, (split ? 7 : 13) / Math.max(1, display.length))
  const photo = s.showPhoto && !blank && person.kind === 'member'
  const art = s.brandArt && !image
  const tagInk = isLight(s.accent) ? s.bg : '#FFFFFF'
  const stripInk = s.bg
  const pixelShadow = `${mm(0.7)} ${mm(0.7)} 0 ${s.glow}`
  const qr = s.showQr && person.qr

  return (
    <div style={{
      width: '100%', height: '100%', boxSizing: 'border-box', position: 'relative', overflow: 'hidden',
      borderRadius: s.rounded ? mm(3) : 0, color: s.ink, '--print-font': PRINT_FONT,
      background: art
        ? `radial-gradient(120% 70% at 85% 0%, ${hexA(s.glow, 0.45)}, transparent 60%),
           radial-gradient(90% 50% at 0% 100%, ${hexA(s.accent, 0.25)}, transparent 65%), ${s.bg}`
        : s.bg,
      display: 'flex', flexDirection: 'column',
    }}>
      <BackgroundLayer src={image} fit={s.imageFit} shade={s.imageShade} tint={s.bg} />

      {art && (
        <>
          <div aria-hidden style={{
            position: 'absolute', inset: 0,
            backgroundImage: `linear-gradient(${hexA(s.ink, 0.07)} 0.2mm, transparent 0.2mm),
              linear-gradient(90deg, ${hexA(s.ink, 0.07)} 0.2mm, transparent 0.2mm)`,
            backgroundSize: `${mm(3.2)} ${mm(3.2)}`,
            WebkitMaskImage: 'linear-gradient(to bottom, #000 0%, transparent 70%)',
            maskImage: 'linear-gradient(to bottom, #000 0%, transparent 70%)',
          }} />
          <div aria-hidden style={{
            position: 'absolute', left: '-30%', right: '-30%', top: wide ? '58%' : '60%', height: `${size.w * 1.6}mm`,
            borderRadius: '50%', borderTop: `${mm(0.5)} solid ${s.accent}`,
            boxShadow: `0 -${mm(2)} ${mm(8)} ${hexA(s.accent, 0.35)}, inset 0 ${mm(3)} ${mm(10)} ${hexA(s.glow, 0.45)}`,
            background: `linear-gradient(to bottom, ${hexA(s.glow, 0.4)}, ${s.bg} 40%)`,
          }} />
          <img src={brandMark(s.ink)} alt="" aria-hidden style={{
            position: 'absolute', width: '95%', left: '-34%', top: '6%', opacity: 0.06,
          }} />
          {STARS.map(([x, y, big], i) => (
            <span key={i} aria-hidden style={{
              position: 'absolute', left: `${x}%`, top: `${y}%`,
              width: mm(big ? 1.1 : 0.75), height: mm(big ? 1.1 : 0.75), background: big ? s.ink : s.accent, opacity: 0.85,
            }} />
          ))}
        </>
      )}

      {s.slot && (
        <div aria-hidden style={{
          position: 'absolute', top: mm(3.5), left: '50%', transform: 'translateX(-50%)', width: mm(14), height: mm(3.2),
          borderRadius: mm(1.6), border: `0.25mm solid ${hexA(s.ink, 0.5)}`,
        }} />
      )}

      <div style={{
        position: 'relative', flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column',
        padding: `${mm(s.slot ? 9.5 : 5.5)} ${mm(5.5)} ${mm(4.5)}`,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: mm(2) }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: mm(2), minWidth: 0 }}>
            <img src={brandMark(s.ink)} alt="" style={{ width: mm(8.5), height: mm(8.5), flexShrink: 0 }} />
            {s.title && (
              <span style={{ fontSize: pt(8), fontWeight: 900, lineHeight: 1.05, minWidth: 0 }}>{s.title}</span>
            )}
          </div>
          {s.tag && (
            <span style={{
              '--print-font': PIXEL_FONT, fontSize: pt(6.4), letterSpacing: '0.08em', textTransform: 'uppercase',
              background: s.accent, color: tagInk, padding: `${mm(1.3)} ${mm(2)} ${mm(1)}`, whiteSpace: 'nowrap', flexShrink: 0,
            }}>
              {s.tag}
            </span>
          )}
        </div>

        {(heading || (s.showDate && person.date)) && (
          <div style={{ marginTop: mm(wide ? 3 : 6) }}>
            {heading && (
              <div style={{ '--print-font': PIXEL_FONT, fontSize: pt(6.6), letterSpacing: '0.06em', color: s.accent, lineHeight: 1.3 }}>{heading}</div>
            )}
            {s.showDate && person.date && (
              <div style={{ fontSize: pt(6.2), opacity: 0.75, marginTop: mm(0.8) }}>{formatDate(person.date)}</div>
            )}
          </div>
        )}

        <div style={{
          flex: 1, minHeight: 0, display: 'flex', gap: mm(4.5),
          flexDirection: wide ? 'row' : 'column', alignItems: wide ? 'center' : 'flex-start', justifyContent: 'center',
        }}>
          {photo && (
            <div style={{
              width: mm(wide ? 25 : 27), height: mm(wide ? 25 : 27), flexShrink: 0, overflow: 'hidden',
              border: `${mm(0.6)} solid ${s.accent}`, boxShadow: `${mm(1.3)} ${mm(1.3)} 0 ${s.glow}`,
              background: hexA(s.ink, 0.1), display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              {person.photo
                ? <img src={person.photo} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                : <span style={{ '--print-font': PIXEL_FONT, fontSize: pt(16), opacity: 0.6 }}>{initials(person.name)}</span>}
            </div>
          )}

          <div style={{ minWidth: 0, maxWidth: '100%' }}>
            {blank ? (
              // A write-in line for walk-ins.
              <div style={{ width: mm(56), height: mm(13), borderBottom: `${mm(0.5)} solid ${s.accent}` }} />
            ) : (
              <>
                <div style={{
                  '--print-font': PIXEL_FONT, fontSize: pt(displaySize), lineHeight: 1.05, textShadow: pixelShadow,
                  wordBreak: 'break-word',
                }}>
                  {display}
                </div>
                {split && (
                  <div style={{ fontSize: pt(13), fontWeight: 700, lineHeight: 1.15, marginTop: mm(2.2), opacity: 0.9, wordBreak: 'break-word' }}>
                    {rest.join(' ')}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      <div style={{
        position: 'relative', background: s.ink, color: stripInk, display: 'flex', alignItems: 'center', gap: mm(3),
        padding: `${mm(qr ? 2.6 : 3.6)} ${mm(5.5)}`, minHeight: mm(qr ? 0 : 12), boxSizing: 'border-box',
      }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: mm(1.6) }}>
            <span aria-hidden style={{ width: mm(1.5), height: mm(1.5), background: s.accent, boxShadow: `${mm(0.6)} ${mm(0.6)} 0 ${s.glow}`, flexShrink: 0 }} />
            <span style={{ '--print-font': PIXEL_FONT, fontSize: pt(5.6), letterSpacing: '0.12em', textTransform: 'uppercase', color: s.glow }}>
              {blank ? 'Guest' : s.showLine && person.line ? person.lineLabel : 'Club'}
            </span>
          </div>
          <div style={{ fontSize: pt(9.5), fontWeight: 700, lineHeight: 1.2, marginTop: mm(1.2) }}>
            {blank ? '' : s.showLine && person.line ? person.line : window.location.host}
          </div>
        </div>
        {qr && <QrCode value={person.qr} size={15 * unit} color={stripInk} />}
      </div>
    </div>
  )
}

/** Short hairlines just outside each corner, so badges can be cut with no outline printed on them. */
function CropMarks({ x, y, w, h }) {
  const len = 4
  const off = 1
  const line = (left, top, width, height, k) => (
    <div key={k} aria-hidden style={{
      position: 'absolute', left: `${left}mm`, top: `${top}mm`, width: `${width}mm`, height: `${height}mm`, background: '#000',
    }} />
  )
  const t = 0.15
  const marks = []
  for (const [cx, cy, sx, sy] of [[x, y, -1, -1], [x + w, y, 1, -1], [x, y + h, -1, 1], [x + w, y + h, 1, 1]]) {
    // Horizontal stub beside the corner, vertical stub above or below it.
    marks.push(line(sx < 0 ? cx - off - len : cx + off, cy - t / 2, len, t, `h${cx}${cy}`))
    marks.push(line(cx - t / 2, sy < 0 ? cy - off - len : cy + off, t, len, `v${cx}${cy}`))
  }
  return <>{marks}</>
}
