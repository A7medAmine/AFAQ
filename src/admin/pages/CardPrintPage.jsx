import { useEffect, useMemo, useState } from 'react'
import { useParams, useSearchParams, Link } from 'react-router-dom'
import { ArrowLeft, Printer, IdCard } from 'lucide-react'
import QRCode from 'qrcode'
import { read, supabase } from '../lib/db'
import { isCurrentTerm, positionLabel, sortPositions } from '../lib/hr'
import Button from '../components/ui/Button'
import { FilterTabs } from '../components/ui/PageHeader'
import EmptyState, { ErrorState } from '../components/ui/EmptyState'
import Panel from '../components/ui/Panel'

/**
 * CR80 (85.6 x 54mm) — the standard ID card size, so a printed sheet lines
 * up with off-the-shelf blank card stock or a card printer.
 */
const CARD_W = '85.6mm'
const CARD_H = '54mm'

/** Ten CR80 cards (2 x 5) fit an A4 sheet with room for printer margins. */
const PER_SHEET = 10

const LAYOUTS = [
  { value: 'pairs', label: 'Front + back side by side' },
  { value: 'duplex', label: 'Double-sided sheets' },
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
    return raw.map(Number).filter(Number.isFinite)
  }, [id, params])

  const [members, setMembers] = useState([])
  const [qr, setQr] = useState({})
  const [layout, setLayout] = useState('pairs')
  const [state, setState] = useState({ loading: true, error: null })

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
      const ordered = ids.map(i => byId.get(i)).filter(m => m?.member_code)
      const codes = await Promise.all(ordered.map(m =>
        QRCode.toDataURL(`${window.location.origin}/verify/${m.member_code}`, { width: 300, margin: 1 })
      ))
      if (cancelled) return
      setQr(Object.fromEntries(ordered.map((m, i) => [m.id, codes[i]])))
      setMembers(ordered)
      setState({ loading: false, error: null })
    }
    load()
    return () => { cancelled = true }
  }, [ids])

  if (state.loading) return null
  if (state.error) return <Panel><ErrorState message={state.error} /></Panel>
  if (!members.length) {
    return (
      <Panel>
        <EmptyState icon={IdCard} title="Nothing to print" description="None of the chosen members have a member number yet." />
      </Panel>
    )
  }

  return (
    <div>
      <div className="adm-no-print flex flex-wrap items-center justify-between gap-3 mb-6">
        <Link to="/admin/members" className="adm-btn adm-btn-ghost">
          <ArrowLeft size={15} /> Back to members
        </Link>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm" style={{ color: 'var(--adm-silk-faint)' }}>
            {members.length} card{members.length === 1 ? '' : 's'}
          </span>
          {members.length > 1 && <FilterTabs options={LAYOUTS} value={layout} onChange={setLayout} label="Print layout" />}
          <Button variant="primary" icon={Printer} onClick={() => window.print()}>Print</Button>
        </div>
      </div>

      {layout === 'duplex' && members.length > 1 ? (
        <DuplexSheets members={members} qr={qr} />
      ) : (
        <div className="flex flex-col gap-4 items-center">
          {members.map(m => (
            <div key={m.id} className="flex flex-wrap gap-4 justify-center" style={{ breakInside: 'avoid' }}>
              <CardFront member={m} />
              <CardBack member={m} qr={qr[m.id]} />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

/**
 * Fronts on one sheet, backs on the next. Each row of backs is mirrored so that
 * after a long-edge flip every back lands behind its own front.
 */
function DuplexSheets({ members, qr }) {
  const sheets = []
  for (let i = 0; i < members.length; i += PER_SHEET) sheets.push(members.slice(i, i + PER_SHEET))

  const grid = { display: 'grid', gridTemplateColumns: `repeat(2, ${CARD_W})`, gap: '2mm', justifyContent: 'center' }
  const page = { breakAfter: 'page', pageBreakAfter: 'always', marginBottom: '8mm' }

  return sheets.map((sheet, s) => {
    const backs = []
    for (let r = 0; r < sheet.length; r += 2) {
      const [left, right] = [sheet[r], sheet[r + 1]]
      backs.push(right || null, left)
    }
    return (
      <div key={s}>
        <div style={{ ...page, ...grid }}>
          {sheet.map(m => <CardFront key={m.id} member={m} />)}
        </div>
        <div style={{ ...page, ...grid }}>
          {backs.map((m, i) => m
            ? <CardBack key={m.id} member={m} qr={qr[m.id]} />
            : <div key={`blank-${i}`} style={{ width: CARD_W, height: CARD_H }} />)}
        </div>
      </div>
    )
  })
}

const cardBase = {
  width: CARD_W,
  height: CARD_H,
  borderRadius: '3.2mm',
  overflow: 'hidden',
  position: 'relative',
  boxShadow: '0 1px 3px rgba(0,0,0,0.25)',
  fontFamily: 'inherit',
  breakInside: 'avoid',
  WebkitPrintColorAdjust: 'exact',
  printColorAdjust: 'exact',
}

function roleLine(member) {
  const current = sortPositions(member.member_positions || []).filter(p => isCurrentTerm(p))
  if (current.length) {
    const p = current[0]
    return `${positionLabel(p.title)}${p.team ? ` · ${p.team}` : ''}`
  }
  return member.team ? `${member.team} team` : member.department || 'Member'
}

function CardFront({ member }) {
  return (
    <div style={{ ...cardBase, background: 'linear-gradient(135deg, #0F172A, #1E293B)', color: '#fff', padding: '4mm' }}>
      <div style={{ fontSize: '9px', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', opacity: 0.85 }}>
        AFAQ Scientific Club
      </div>
      <div style={{ display: 'flex', gap: '3mm', marginTop: '3mm', alignItems: 'center' }}>
        <div style={{
          width: '16mm', height: '16mm', borderRadius: '2mm', overflow: 'hidden',
          background: 'rgba(255,255,255,0.1)', flexShrink: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          {member.photo_url
            ? <img src={member.photo_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            : <IdCard size={22} color="rgba(255,255,255,0.4)" />}
        </div>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: '11px', fontWeight: 700, lineHeight: 1.2, wordBreak: 'break-word' }}>{member.full_name}</div>
          <div style={{ fontSize: '8px', opacity: 0.7, marginTop: '1mm' }}>{roleLine(member)}</div>
        </div>
      </div>
      <div style={{ position: 'absolute', bottom: '3mm', left: '4mm', right: '4mm', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <div style={{ fontSize: '7px', fontFamily: 'monospace', letterSpacing: '0.05em', opacity: 0.85 }}>{member.member_code}</div>
        <div style={{ fontSize: '6px', opacity: 0.6, textTransform: 'uppercase' }}>{member.card_status}</div>
      </div>
    </div>
  )
}

function CardBack({ member, qr }) {
  return (
    <div style={{ ...cardBase, background: '#fff', color: '#0F172A', border: '1px solid #E2E8F0', padding: '4mm', display: 'flex', alignItems: 'center', gap: '3mm' }}>
      {qr && <img src={qr} alt="Verify QR" style={{ width: '18mm', height: '18mm', flexShrink: 0 }} />}
      <div style={{ fontSize: '7px', lineHeight: 1.5, color: '#475569' }}>
        <div style={{ fontWeight: 700, fontSize: '8px', color: '#0F172A' }}>Scan to verify</div>
        <div style={{ marginTop: '1mm' }}>This card certifies active membership in AFAQ Scientific Club.</div>
        <div style={{ marginTop: '1mm', fontFamily: 'monospace' }}>{member.member_code}</div>
      </div>
    </div>
  )
}
