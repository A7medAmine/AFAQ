import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { CheckCircle2, Circle, Clock, Loader2, XCircle } from 'lucide-react'

const STATUS = {
  needed: { label: 'Needed', color: '#B45309', bg: '#FEF3C7', Icon: Circle },
  ordered: { label: 'Ordered', color: '#1D4ED8', bg: '#DBEAFE', Icon: Clock },
  ready: { label: 'Ready', color: '#166534', bg: '#DCFCE7', Icon: CheckCircle2 },
}
const KIND = { equipment: 'Equipment', consumable: 'Consumable', other: 'Other' }

/**
 * A needs list as seen through its share link: items by department and how
 * far along each is. Read-only, no account, nothing about who does what.
 */
export default function SharedNeeds() {
  const { token } = useParams()
  const [state, setState] = useState({ loading: true, data: null, error: null })

  useEffect(() => {
    let cancelled = false
    fetch(`/api/needs/share/${encodeURIComponent(token)}`)
      .then(res => res.json().then(data => ({ ok: res.ok, data })))
      .then(({ ok, data }) => {
        if (cancelled) return
        if (!ok) { setState({ loading: false, data: null, error: data?.error || 'This link does not work.' }); return }
        setState({ loading: false, data, error: null })
      })
      .catch(() => { if (!cancelled) setState({ loading: false, data: null, error: 'Could not reach the server.' }) })
    return () => { cancelled = true }
  }, [token])

  const groups = useMemo(() => {
    if (!state.data) return []
    const { items, departments } = state.data
    const known = new Set(departments.map(d => d.id))
    const list = departments.map(d => ({ key: d.id, name: d.name, color: d.color, items: items.filter(i => i.department_id === d.id) }))
    list.push({ key: 'none', name: 'No department', color: '#94a3b8', items: items.filter(i => !known.has(i.department_id)) })
    return list.filter(g => g.items.length)
  }, [state.data])

  const items = state.data?.items || []
  const ready = items.filter(i => i.status === 'ready').length
  const pct = items.length ? Math.round((ready / items.length) * 100) : 0
  const list = state.data?.list

  return (
    <div dir="ltr" lang="en" style={{ minHeight: '100vh', background: '#F1F5F9', padding: '32px 16px', color: '#0F172A', textAlign: 'left' }}>
      <div style={{ maxWidth: 820, margin: '0 auto' }}>
        {state.loading && <Loader2 size={32} className="animate-spin" style={{ margin: '80px auto', color: '#64748b' }} />}

        {!state.loading && state.error && (
          <div style={{ background: '#fff', borderRadius: 16, padding: 28, textAlign: 'center', maxWidth: 380, margin: '60px auto' }}>
            <XCircle size={40} color="#DC2626" style={{ margin: '0 auto 12px' }} />
            <h1 style={{ fontSize: 18, fontWeight: 700 }}>List not available</h1>
            <p style={{ fontSize: 14, color: '#64748b', marginTop: 6 }}>{state.error}</p>
          </div>
        )}

        {list && (
          <>
            <header style={{ marginBottom: 20 }}>
              <p style={{ fontSize: 12, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: '#64748b' }}>AFAQ Scientific Club · Needs list</p>
              <h1 dir="auto" style={{ fontSize: 26, fontWeight: 800, marginTop: 6 }}>{list.title}</h1>
              <p dir="auto" style={{ fontSize: 14, color: '#475569', marginTop: 4 }}>
                {[list.event?.title_en, list.department?.name, list.due_date && `Needed by ${list.due_date}`].filter(Boolean).join(' · ')}
              </p>
              <div style={{ marginTop: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: '#475569', marginBottom: 6 }}>
                  <span>{ready} of {items.length} ready</span><span>{pct}%</span>
                </div>
                <div style={{ height: 8, borderRadius: 999, background: '#E2E8F0', overflow: 'hidden' }}>
                  <div style={{ width: `${pct}%`, height: '100%', background: pct === 100 ? '#16A34A' : '#2563EB' }} />
                </div>
              </div>
            </header>

            {groups.length === 0 && <p style={{ color: '#64748b' }}>Nothing on this list yet.</p>}

            {groups.map(g => (
              <section key={g.key} style={{ background: '#fff', borderRadius: 14, marginBottom: 14, overflow: 'hidden', border: '1px solid #E2E8F0' }}>
                <h2 style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 16px', fontSize: 15, fontWeight: 700, borderBottom: '1px solid #E2E8F0' }}>
                  <span style={{ width: 10, height: 10, borderRadius: 999, background: g.color || '#94a3b8' }} />
                  <span dir="auto">{g.name}</span>
                  <span style={{ marginLeft: 'auto', fontSize: 12, fontWeight: 500, color: '#64748b' }}>
                    {g.items.filter(i => i.status === 'ready').length} / {g.items.length}
                  </span>
                </h2>
                <ul>
                  {g.items.map(item => {
                    const st = STATUS[item.status] || STATUS.needed
                    return (
                      <li key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px', borderTop: '1px solid #F1F5F9' }}>
                        <st.Icon size={18} color={st.color} style={{ flexShrink: 0 }} />
                        <span style={{ flex: 1, minWidth: 0 }}>
                          <span dir="auto" style={{ display: 'block', fontSize: 14, fontWeight: 600 }}>{item.name}</span>
                          <span style={{ fontSize: 12, color: '#64748b' }}>
                            {item.quantity}{item.unit ? ` ${item.unit}` : ''} · {KIND[item.kind] || item.kind}{item.priority === 'nice' ? ' · nice to have' : ''}
                          </span>
                        </span>
                        <span style={{ fontSize: 12, fontWeight: 600, padding: '3px 10px', borderRadius: 999, background: st.bg, color: st.color }}>{st.label}</span>
                      </li>
                    )
                  })}
                </ul>
              </section>
            ))}
            <p style={{ fontSize: 12, color: '#94a3b8', textAlign: 'center', marginTop: 20 }}>Read-only view. Refresh to see the latest.</p>
          </>
        )}
      </div>
    </div>
  )
}
