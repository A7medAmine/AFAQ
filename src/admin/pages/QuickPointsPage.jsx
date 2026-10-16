import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, Camera, CameraOff, Check, CircleAlert, PenLine, Settings2, Undo2 } from 'lucide-react'
import { logActivity, read, run, supabase } from '../lib/db'
import useAdminStore from '../store/adminStore'
import { MANUAL_CATEGORIES, categoryLabel, formatPoints, pointsTone } from '../lib/points'
import PageHeader from '../components/ui/PageHeader'
import Panel, { PanelHead } from '../components/ui/Panel'
import { ErrorState } from '../components/ui/EmptyState'
import Button from '../components/ui/Button'
import Badge from '../components/ui/Badge'
import SearchPicker, { normalizeCode } from '../components/ui/SearchPicker'
import CameraScanner from '../components/ui/CameraScanner'
import PresetsModal from '../components/hr/PresetsModal'

const UNDO_MINUTES = 10
const CUSTOM = 'custom'

/**
 * Giving points at the door of a workshop: pick a reason once, then scan
 * cards or type names one after another. Every member is saved the moment
 * they are picked, and the last ten minutes can be undone.
 */
export default function QuickPointsPage() {
  const userId = useAdminStore(s => s.adminProfile?.user_id)
  const addToast = useAdminStore(s => s.addToast)
  const [members, setMembers] = useState([])
  const [presets, setPresets] = useState([])
  const [state, setState] = useState({ loading: true, error: null })
  const [presetId, setPresetId] = useState(null)
  const [custom, setCustom] = useState({ points: '5', reason: '', category: 'contribution' })
  const [camera, setCamera] = useState(false)
  const [feed, setFeed] = useState([]) // newest first
  const [presetsOpen, setPresetsOpen] = useState(false)
  const [, tick] = useState(0)
  const busy = useRef(new Set())

  const loadPresets = useCallback(async () => {
    const res = await read(supabase.from('point_presets').select('*').order('sort_order'))
    if (res.ok) setPresets(res.data || [])
    return res
  }, [])

  useEffect(() => {
    (async () => {
      const [memberRes, presetRes] = await Promise.all([
        read(supabase.from('members').select('id, full_name, member_code, email, status, photo_url').order('full_name')),
        loadPresets(),
      ])
      const failed = [memberRes, presetRes].find(r => !r.ok)
      if (failed) { setState({ loading: false, error: failed.message }); return }
      setMembers(memberRes.data || [])
      setPresetId(id => id ?? presetRes.data?.[0]?.id ?? CUSTOM)
      setState({ loading: false, error: null })
    })()
  }, [loadPresets])

  // Undo buttons disappear on their own once their ten minutes are up.
  useEffect(() => {
    const timer = setInterval(() => tick(n => n + 1), 30000)
    return () => clearInterval(timer)
  }, [])

  const preset = presets.find(p => p.id === presetId)
  const reason = useMemo(() => {
    if (preset) return { points: preset.points, reason: preset.label, category: preset.category, key: `p${preset.id}` }
    const points = Math.round(Number(custom.points))
    if (!points || !custom.reason.trim()) return null
    return { points, reason: custom.reason.trim(), category: custom.category, key: `c${points}:${custom.reason.trim()}` }
  }, [preset, custom])

  const byCode = useMemo(() => Object.fromEntries(members.filter(m => m.member_code).map(m => [m.member_code.toUpperCase(), m])), [members])

  const give = useCallback(async (member, { again = false } = {}) => {
    if (!reason) { addToast('Pick a reason first, or fill in the custom one.', 'error'); return }
    // A card held up twice, or picked twice by mistake, is not counted twice.
    if (!again && feed.some(f => f.member.id === member.id && f.key === reason.key && f.entryId)) {
      setFeed(list => [{ id: `${Date.now()}`, member, ...reason, duplicate: true }, ...list])
      return
    }
    if (busy.current.has(member.id)) return
    busy.current.add(member.id)
    const { ok, data } = await run(
      supabase.from('point_entries').insert({
        member_id: member.id, points: reason.points, reason: reason.reason, category: reason.category, awarded_by: userId,
      }).select('id, created_at').single(),
      { failure: `${member.full_name} did not get the points.` }
    )
    busy.current.delete(member.id)
    if (!ok) return
    navigator.vibrate?.(40)
    logActivity('created', 'point_entries', data.id, { points: reason.points, reason: reason.reason, members: [member.full_name] })
    setFeed(list => [{ id: `e${data.id}`, entryId: data.id, at: data.created_at, member, ...reason }, ...list])
  }, [reason, feed, userId, addToast])

  const onScan = useCallback(text => {
    const member = byCode[normalizeCode(text)]
    if (member) give(member)
    else setFeed(list => [{ id: `${Date.now()}`, unknown: normalizeCode(text) || text }, ...list])
  }, [byCode, give])

  const undo = async item => {
    const tooLate = 'That could not be undone. More than ten minutes have passed: give the opposite points instead.'
    const { ok, data } = await run(supabase.from('point_entries').delete().eq('id', item.entryId).select('id'), { failure: tooLate })
    if (!ok) return
    // A refused delete returns no rows rather than an error.
    if (!data?.length) { addToast(tooLate, 'error'); return }
    logActivity('deleted', 'point_entries', item.entryId, { undo: true, member: item.member.full_name, points: item.points })
    setFeed(list => list.map(f => (f.id === item.id ? { ...f, entryId: null, undone: true } : f)))
  }

  const given = feed.filter(f => f.entryId)
  const canUndo = item => item.entryId && Date.now() - new Date(item.at).getTime() < UNDO_MINUTES * 60000

  if (state.error) return <Panel><ErrorState message={state.error} /></Panel>

  return (
    <div>
      <PageHeader
        eyebrow="People"
        title="Quick give"
        description="Pick what the points are for, then scan cards or type names. Each member is saved straight away."
        actions={<Link to="/admin/points" className="adm-btn"><ArrowLeft size={15} /> Points</Link>}
      />

      <div className="grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-5 items-start">
        <div className="space-y-5">
          <Panel>
            <PanelHead eyebrow="1" title="What for"
              action={<Button size="sm" variant="ghost" icon={Settings2} onClick={() => setPresetsOpen(true)}>Presets</Button>} />
            <div className="p-4 pt-0 grid grid-cols-2 gap-2">
              {presets.map(p => (
                <PresetButton key={p.id} active={presetId === p.id} onClick={() => setPresetId(p.id)}
                  label={p.label} points={p.points} />
              ))}
              <PresetButton active={presetId === CUSTOM} onClick={() => setPresetId(CUSTOM)} label="Something else" icon={PenLine} />
            </div>
            {presetId === CUSTOM && (
              <div className="px-4 pb-4 flex flex-wrap gap-2">
                <input className="adm-input adm-data" style={{ width: 80 }} type="number" step="1" aria-label="Points"
                  value={custom.points} onChange={e => setCustom(c => ({ ...c, points: e.target.value }))} />
                <input className="adm-input flex-1" style={{ minWidth: 160 }} aria-label="Reason" placeholder="Reason"
                  value={custom.reason} onChange={e => setCustom(c => ({ ...c, reason: e.target.value }))} />
                <select className="adm-input" style={{ width: 140 }} aria-label="Category" value={custom.category}
                  onChange={e => setCustom(c => ({ ...c, category: e.target.value }))}>
                  {MANUAL_CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
              </div>
            )}
          </Panel>

          <Panel>
            <PanelHead eyebrow="2" title="Who"
              description={reason ? `${formatPoints(reason.points)} · ${reason.reason}` : 'Pick a reason first.'}
              action={
                <Button size="sm" variant={camera ? 'primary' : 'default'} icon={camera ? CameraOff : Camera} onClick={() => setCamera(c => !c)}>
                  {camera ? 'Stop camera' : 'Scan cards'}
                </Button>
              } />
            <div className="p-4 pt-0 space-y-3">
              {camera && <CameraScanner onScan={onScan} />}
              <SearchPicker
                placeholder="Name or member number, then Enter"
                options={members}
                value={null}
                onChange={m => m && give(m)}
                getKey={m => m.id}
                getCode={m => m.member_code}
                getSearchText={m => `${m.full_name} ${m.member_code || ''} ${m.email || ''}`}
                renderOption={m => (
                  <span className="flex items-center justify-between gap-2">
                    <span className="text-sm font-semibold adm-truncate">{m.full_name}</span>
                    <span className="adm-data text-[11px]" style={{ color: 'var(--adm-silk-faint)' }}>{m.member_code}</span>
                  </span>
                )}
                autoFocus
              />
              <p className="text-[11px]" style={{ color: 'var(--adm-silk-faint)' }}>
                A card scanner that types the code and presses Enter works in this box too.
              </p>
            </div>
          </Panel>
        </div>

        <Panel>
          <PanelHead eyebrow="This session" title={`${given.length} member${given.length === 1 ? '' : 's'} given points`}
            description={`Undo is open for ${UNDO_MINUTES} minutes after each one.`} />
          {feed.length === 0 ? (
            <p className="px-4 pb-4 text-sm" style={{ color: 'var(--adm-silk-faint)' }}>Nobody yet.</p>
          ) : (
            <ul className="px-2 pb-2">
              {feed.map(item => (
                <li key={item.id} className="flex items-center gap-3 px-2 py-2.5" style={{ borderTop: '1px solid var(--adm-trace)' }}>
                  {item.unknown ? (
                    <>
                      <CircleAlert size={16} style={{ color: 'var(--adm-fault)' }} />
                      <span className="text-sm flex-1">No member with the code <span className="adm-data">{item.unknown}</span></span>
                    </>
                  ) : (
                    <>
                      {item.duplicate
                        ? <CircleAlert size={16} style={{ color: 'var(--adm-wait)' }} />
                        : <Check size={16} style={{ color: item.undone ? 'var(--adm-silk-faint)' : 'var(--adm-ok)' }} />}
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-semibold adm-truncate" style={{ textDecoration: item.undone ? 'line-through' : 'none' }}>
                          {item.member.full_name}
                        </span>
                        <span className="block text-[11px]" style={{ color: 'var(--adm-silk-faint)' }}>
                          {item.duplicate ? 'Already given for this reason, skipped' : item.undone ? 'Undone' : `${item.reason} · ${categoryLabel(item.category)}`}
                        </span>
                      </span>
                      {!item.duplicate && <Badge tone={item.undone ? 'neutral' : pointsTone(item.points)}>{formatPoints(item.points)}</Badge>}
                      {item.duplicate && <Button size="sm" onClick={() => give(item.member, { again: true })}>Give again</Button>}
                      {canUndo(item) && <Button size="sm" variant="ghost" icon={Undo2} onClick={() => undo(item)}>Undo</Button>}
                    </>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      <PresetsModal open={presetsOpen} presets={presets} onClose={() => setPresetsOpen(false)} onChanged={loadPresets} />
    </div>
  )
}

function PresetButton({ active, onClick, label, points, icon: Icon }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className="flex items-center justify-between gap-2 text-left px-3 py-3 rounded-xl text-sm font-semibold transition-colors"
      style={{
        border: `1px solid ${active ? 'var(--adm-signal-edge)' : 'var(--adm-trace)'}`,
        background: active ? 'var(--adm-signal-wash)' : 'var(--adm-panel)',
        color: 'var(--adm-silk)',
        minHeight: 52,
      }}
    >
      <span className="min-w-0">{label}</span>
      {Icon ? <Icon size={15} style={{ color: 'var(--adm-silk-faint)' }} />
        : <Badge tone={pointsTone(points)}>{formatPoints(points)}</Badge>}
    </button>
  )
}
