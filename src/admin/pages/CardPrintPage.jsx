import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { ArrowLeft, Printer, IdCard } from 'lucide-react'
import { read, supabase } from '../lib/db'
import Button from '../components/ui/Button'
import { StatusBadge } from '../components/ui/Badge'
import EmptyState, { ErrorState } from '../components/ui/EmptyState'
import Panel from '../components/ui/Panel'

/**
 * CR80 (85.6 x 54mm) — the standard ID card size, so a printed sheet lines
 * up with off-the-shelf blank card stock or a card printer.
 */
const CARD_W = '85.6mm'
const CARD_H = '54mm'

export default function CardPrintPage() {
  const { id } = useParams()
  const [member, setMember] = useState(null)
  const [state, setState] = useState({ loading: true, error: null })

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      const { ok, data, message } = await read(
        supabase.from('members').select('*').eq('id', id).single()
      )
      if (cancelled) return
      if (!ok) { setState({ loading: false, error: message }); return }
      setMember(data)
      setState({ loading: false, error: null })
    }
    load()
    return () => { cancelled = true }
  }, [id])

  if (state.loading) return null
  if (state.error || !member) {
    return <Panel><ErrorState message={state.error || 'Member not found.'} /></Panel>
  }
  if (!member.card_qr_code) {
    return (
      <Panel>
        <EmptyState
          icon={IdCard}
          title="No card issued yet"
          description="Issue a card for this member from the Members page to generate one."
        />
      </Panel>
    )
  }

  return (
    <div>
      <div className="adm-no-print flex items-center justify-between mb-6">
        <Link to="/admin/members" className="adm-btn adm-btn-ghost">
          <ArrowLeft size={15} /> Back to members
        </Link>
        <div className="flex items-center gap-2">
          <StatusBadge status={member.card_status} />
          <Button variant="primary" icon={Printer} onClick={() => window.print()}>Print</Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-8 justify-center">
        <CardFront member={member} />
        <CardBack member={member} />
      </div>
    </div>
  )
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
          <div style={{ fontSize: '8px', opacity: 0.7, marginTop: '1mm' }}>{member.department || 'Member'}</div>
        </div>
      </div>
      <div style={{ position: 'absolute', bottom: '3mm', left: '4mm', right: '4mm', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <div style={{ fontSize: '7px', fontFamily: 'monospace', letterSpacing: '0.05em', opacity: 0.85 }}>{member.member_code}</div>
        <div style={{ fontSize: '6px', opacity: 0.6, textTransform: 'uppercase' }}>{member.card_status}</div>
      </div>
    </div>
  )
}

function CardBack({ member }) {
  return (
    <div style={{ ...cardBase, background: '#fff', color: '#0F172A', border: '1px solid #E2E8F0', padding: '4mm', display: 'flex', alignItems: 'center', gap: '3mm' }}>
      <img src={member.card_qr_code} alt="Verify QR" style={{ width: '18mm', height: '18mm', flexShrink: 0 }} />
      <div style={{ fontSize: '7px', lineHeight: 1.5, color: '#475569' }}>
        <div style={{ fontWeight: 700, fontSize: '8px', color: '#0F172A' }}>Scan to verify</div>
        <div style={{ marginTop: '1mm' }}>This card certifies active membership in AFAQ Scientific Club.</div>
        <div style={{ marginTop: '1mm', fontFamily: 'monospace' }}>{member.member_code}</div>
      </div>
    </div>
  )
}
