import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { CheckCircle2, XCircle, Loader2 } from 'lucide-react'

export default function VerifyMember() {
  const { memberCode } = useParams()
  const [state, setState] = useState({ loading: true, data: null, error: null })

  useEffect(() => {
    let cancelled = false
    fetch(`/api/members/verify/${encodeURIComponent(memberCode)}`)
      .then(res => res.json().then(data => ({ ok: res.ok, data })))
      .then(({ ok, data }) => {
        if (cancelled) return
        if (!ok) { setState({ loading: false, data: null, error: 'This card is not recognized.' }); return }
        setState({ loading: false, data, error: null })
      })
      .catch(() => { if (!cancelled) setState({ loading: false, data: null, error: 'Could not reach the server.' }) })
    return () => { cancelled = true }
  }, [memberCode])

  return (
    <div style={{ minHeight: '100vh', background: '#0F172A', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ width: '100%', maxWidth: 360, background: '#fff', borderRadius: 16, padding: 28, textAlign: 'center' }}>
        {state.loading && <Loader2 size={32} className="animate-spin" style={{ margin: '0 auto', color: '#64748b' }} />}

        {!state.loading && state.error && (
          <>
            <XCircle size={40} color="#DC2626" style={{ margin: '0 auto 12px' }} />
            <h1 style={{ fontSize: 18, fontWeight: 700, color: '#0F172A' }}>Invalid card</h1>
            <p style={{ fontSize: 14, color: '#64748b', marginTop: 6 }}>{state.error}</p>
          </>
        )}

        {!state.loading && state.data && (
          <>
            {state.data.photoUrl && (
              <img src={state.data.photoUrl} alt="" style={{ width: 84, height: 84, borderRadius: '50%', objectFit: 'cover', margin: '0 auto 14px' }} />
            )}
            {state.data.valid
              ? <CheckCircle2 size={40} color="#16A34A" style={{ margin: '0 auto 12px' }} />
              : <XCircle size={40} color="#DC2626" style={{ margin: '0 auto 12px' }} />}
            <h1 style={{ fontSize: 18, fontWeight: 700, color: '#0F172A' }}>{state.data.fullName}</h1>
            <p style={{ fontSize: 13, color: '#94a3b8', marginTop: 2, fontFamily: 'monospace' }}>{state.data.memberCode}</p>
            <p style={{
              fontSize: 13, fontWeight: 600, marginTop: 12, padding: '6px 14px', borderRadius: 999, display: 'inline-block',
              background: state.data.valid ? '#DCFCE7' : '#FEE2E2',
              color: state.data.valid ? '#166534' : '#991B1B',
            }}>
              {state.data.valid
                ? 'Active member'
                : state.data.memberStatus && state.data.memberStatus !== 'active'
                  ? `Membership ${state.data.memberStatus}`
                  : `Card ${state.data.cardStatus}`}
            </p>
          </>
        )}
      </div>
    </div>
  )
}
