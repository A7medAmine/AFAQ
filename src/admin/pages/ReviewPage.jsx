import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowRightLeft, Check, Hand, Inbox, Moon, RefreshCw, Star, Sun, Undo2, UserPlus, X,
} from 'lucide-react'
import { api, logActivity } from '../lib/db'
import useCounts from '../hooks/useCounts'
import useQueryParam from '../hooks/useQueryParam'
import { formatDate, formatDateTime } from '../lib/format'
import { EVENT_LABELS, daysSince, toLocalInput, useInterestLabels } from '../lib/review'
import PageHeader, { FilterTabs } from '../components/ui/PageHeader'
import DataTable from '../components/ui/DataTable'
import Drawer, { DetailRow, TagList } from '../components/ui/Drawer'
import ConfirmDialog from '../components/ui/ConfirmDialog'
import EmptyState, { ErrorState } from '../components/ui/EmptyState'
import Button from '../components/ui/Button'
import Badge, { StatusBadge } from '../components/ui/Badge'
import Panel, { PanelHead } from '../components/ui/Panel'
import { CheckField, SelectField, TextArea, TextField } from '../components/ui/Field'
import useAdminStore from '../store/adminStore'

/**
 * Membership interviews, spread across review teams. Each application lands
 * with the team its interests point to and that team's least-loaded reviewer;
 * this screen is where reviewers work their queue and managers watch the load.
 */
export default function ReviewPage() {
  const addToast = useAdminStore(s => s.addToast)
  const { refresh: refreshCounts } = useCounts()
  const labels = useInterestLabels()

  const [data, setData] = useState(null)
  const [state, setState] = useState({ loading: true, error: null })
  const [view, setView] = useQueryParam('view', 'mine')
  const [detailId, setDetailId] = useState(null)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    setState(s => ({ ...s, error: null }))
    const { ok, data: payload, message } = await api('/api/review/queue')
    if (!ok) { setState({ loading: false, error: message }); return }
    setData(payload)
    setState({ loading: false, error: null })
  }, [])

  useEffect(() => { load() }, [load])

  const me = data?.me
  const teamsById = useMemo(() => Object.fromEntries((data?.teams || []).map(t => [t.id, t])), [data])
  const reviewersById = useMemo(() => Object.fromEntries((data?.reviewers || []).map(r => [r.id, r])), [data])

  const views = useMemo(() => {
    if (!data) return []
    const open = data.open
    const list = [
      { value: 'mine', label: 'Mine', rows: open.filter(a => a.reviewer_id === me.id) },
      { value: 'team', label: 'My teams', rows: open.filter(a => a.team_id && me.teamIds.includes(a.team_id) && a.reviewer_id !== me.id) },
      { value: 'pool', label: 'General pool', rows: open.filter(a => !a.team_id && !a.reviewer_id) },
    ]
    if (me.isManager) {
      list.push({ value: 'all', label: 'All open', rows: open })
      list.push({ value: 'stale', label: 'Stale', rows: open.filter(a => a.stale) })
    }
    list.push({ value: 'decided', label: 'Decided', rows: data.decided })
    if (me.isManager) list.push({ value: 'load', label: 'Load', rows: null })
    return list
  }, [data, me])

  const current = views.find(v => v.value === view) || views[0]
  const rows = current?.rows || []
  const detail = useMemo(
    () => (data ? [...data.open, ...data.decided].find(a => a.id === detailId) : null),
    [data, detailId]
  )

  /** Run a review action, toast its outcome, reload the queue. */
  const act = async (path, body, success, { method = 'POST', close = false } = {}) => {
    setBusy(true)
    const { ok, data: result, message } = await api(path, { method, body })
    setBusy(false)
    if (!ok) { addToast(message, 'error'); return null }
    if (success) addToast(typeof success === 'function' ? success(result) : success)
    if (close) setDetailId(null)
    await load()
    refreshCounts()
    return result || {}
  }

  const toggleAvailability = () =>
    act('/api/review/me', { available: !me.available },
      me.available ? 'You are away. New applications skip you.' : 'You are back. New applications can reach you.',
      { method: 'PATCH' })

  const [handoff, setHandoff] = useState(false)
  const mineCount = data ? data.open.filter(a => a.reviewer_id === me.id).length : 0

  const columns = useMemo(() => [
    {
      header: 'Applicant',
      accessorKey: 'full_name',
      cell: ({ row }) => (
        <span className="min-w-0 block">
          <span className="block text-sm font-semibold adm-truncate" style={{ maxWidth: 200 }}>{row.original.full_name}</span>
          <span className="adm-data block text-[11px] adm-truncate" style={{ color: 'var(--adm-silk-faint)', maxWidth: 200 }}>
            {row.original.email}
          </span>
        </span>
      ),
    },
    {
      header: 'Interests',
      id: 'interests',
      accessorFn: r => (r.interests || []).map(k => labels[k] || k).join(', '),
      cell: ({ getValue }) => (
        <span className="text-[13px] adm-truncate block" style={{ color: 'var(--adm-silk-dim)', maxWidth: 220 }}>{getValue() || '—'}</span>
      ),
    },
    {
      header: 'Team',
      id: 'team',
      accessorFn: r => teamsById[r.team_id]?.name_en || 'General pool',
      cell: ({ row }) => <TeamTag team={teamsById[row.original.team_id]} />,
    },
    {
      header: 'Reviewer',
      id: 'reviewer',
      accessorFn: r => reviewerName(reviewersById[r.reviewer_id]) || '',
      cell: ({ row }) => {
        const r = row.original
        if (!r.reviewer_id) return <span className="text-[13px]" style={{ color: 'var(--adm-silk-faint)' }}>Unassigned</span>
        return (
          <span className="text-[13px]">
            {r.reviewer_id === me?.id ? 'You' : reviewerName(reviewersById[r.reviewer_id]) || 'Former admin'}
          </span>
        )
      },
    },
    {
      header: 'Stage',
      id: 'stage',
      accessorFn: r => (r.status === 'pending' ? r.stage : r.status),
      cell: ({ row }) => {
        const r = row.original
        if (r.status !== 'pending') return <StatusBadge status={r.status} />
        return (
          <span className="flex items-center gap-1.5">
            <StatusBadge status={r.stage} />
            {r.stale && <Badge tone="fault">Stale</Badge>}
          </span>
        )
      },
    },
    {
      header: 'Waiting',
      id: 'waiting',
      accessorFn: r => (r.status === 'pending' ? daysSince(r.created_at) : -1),
      cell: ({ row }) => {
        const r = row.original
        if (r.status !== 'pending') return <span className="adm-data text-[12px]">{formatDate(r.decided_at)}</span>
        if (r.stage === 'interview' && r.interview_at) {
          return <span className="adm-data text-[12px]">Interview {formatDateTime(r.interview_at)}</span>
        }
        const d = daysSince(r.created_at)
        return <span className="adm-data text-[12px]">{d === 0 ? 'Today' : `${d}d`}</span>
      },
    },
  ], [labels, teamsById, reviewersById, me])

  const emptyCopy = {
    mine: ['Nothing on your desk', me?.teamIds.length
      ? 'Applications for your teams come to you automatically, a fair share at a time.'
      : 'You are not on a review team yet. A membership manager can add you under Review teams.'],
    team: ['Your teams are clear', 'Applications your teammates hold, or that wait for a free reviewer, show here.'],
    pool: ['The pool is empty', 'Applications whose interests match no team wait here for anyone to claim.'],
    all: ['No open applications', 'New applications are routed as they arrive.'],
    stale: ['Nothing is stale', `An application goes stale after ${data?.staleDays ?? 5} days without progress.`],
    decided: ['No decisions yet', 'Accepted and rejected applications show here.'],
  }[current?.value] || ['Nothing here', '']

  return (
    <div>
      <PageHeader
        eyebrow="Operate"
        title="Review queue"
        description="Applications are routed to the team that matches their interests and shared among its reviewers. Accepting one makes them a member."
        actions={me && (
          <>
            {me.teamIds.length > 0 && (
              <Button icon={me.available ? Moon : Sun} onClick={toggleAvailability} disabled={busy}>
                {me.available ? 'Go away' : 'I’m back'}
              </Button>
            )}
            {mineCount > 0 && <Button icon={Undo2} onClick={() => setHandoff(true)}>Hand off mine</Button>}
            {me.isManager && (
              <Button icon={RefreshCw} disabled={busy}
                onClick={() => act('/api/review/rebalance', { reroutePool: true },
                  r => (r.rerouted ? `Rebalanced. ${r.rerouted} pooled applications found a team.` : 'Rebalanced.'))}>
                Rebalance
              </Button>
            )}
          </>
        )}
      >
        {me && !me.available && (
          <p className="text-xs mt-2" style={{ color: 'var(--adm-wait)' }}>
            You are marked away: new applications go to your teammates.
          </p>
        )}
      </PageHeader>

      {state.error ? (
        <Panel><ErrorState message={state.error} onRetry={load} /></Panel>
      ) : current?.value === 'load' ? (
        <>
          <div className="mb-4">
            <FilterTabs options={tabOptions(views)} value={view} onChange={setView} label="Queue" />
          </div>
          <LoadBoard onChanged={load} />
        </>
      ) : (
        <DataTable
          columns={columns}
          data={rows}
          loading={state.loading}
          getRowId={row => String(row.id)}
          onRowClick={r => setDetailId(r.id)}
          searchPlaceholder="Search by name, email, interest…"
          toolbar={<FilterTabs options={tabOptions(views)} value={current?.value} onChange={setView} label="Queue" />}
          emptyState={<EmptyState icon={Inbox} title={emptyCopy[0]} description={emptyCopy[1]} />}
        />
      )}

      <ReviewDrawer
        app={detail}
        data={data}
        labels={labels}
        teamsById={teamsById}
        reviewersById={reviewersById}
        busy={busy}
        act={act}
        onClose={() => setDetailId(null)}
      />

      <ConfirmDialog
        open={handoff}
        onClose={() => setHandoff(false)}
        onConfirm={async () => {
          await act(`/api/review/reviewers/${me.id}/handoff`, {},
            r => `${r.moved} application${r.moved === 1 ? '' : 's'} handed to your teammates.`)
          setHandoff(false)
        }}
        title="Hand off your applications?"
        danger={false}
        confirmLabel="Hand off"
        busyLabel="Handing off…"
        message={`Your ${mineCount} open application${mineCount === 1 ? '' : 's'} go to the least-loaded reviewers in each team. Ones nobody can take wait unassigned in their team, or go back to the pool. Mark yourself away too if you should get no new ones.`}
      />
    </div>
  )
}

const tabOptions = views => views.map(v => ({ value: v.value, label: v.label, count: v.rows ? v.rows.length : undefined }))

const reviewerName = r => (r ? r.full_name || r.email : null)

function TeamTag({ team }) {
  if (!team) return <span className="text-[13px]" style={{ color: 'var(--adm-silk-faint)' }}>General pool</span>
  return (
    <span className="inline-flex items-center gap-1.5 text-[13px]">
      <span className="rounded-full shrink-0" style={{ width: 8, height: 8, background: team.color }} aria-hidden="true" />
      {team.name_en}
    </span>
  )
}

function ReviewDrawer({ app, data, labels, teamsById, reviewersById, busy, act, onClose }) {
  const [form, setForm] = useState({})
  const [events, setEvents] = useState([])
  const [mode, setMode] = useState(null) // null | 'transfer' | 'assign'
  const [move, setMove] = useState({ teamId: '', reviewerId: '', note: '' })
  const [decision, setDecision] = useState(null) // { decision, note }

  const id = app?.id
  useEffect(() => {
    if (!app) return
    setForm({
      interviewAt: toLocalInput(app.interview_at),
      location: '',
      message: '',
      sendInvite: !app.interview_at,
      rating: app.review_rating || null,
      notes: app.review_notes || '',
    })
    setMode(null)
    setMove({ teamId: '', reviewerId: '', note: '' })
  }, [id]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!id) return
    let alive = true
    api(`/api/review/applications/${id}/events`).then(({ ok, data: rows }) => { if (alive && ok) setEvents(rows) })
    return () => { alive = false }
  }, [id, app?.last_activity_at, app?.status])

  if (!data) return null
  const me = data.me
  const open = app?.status === 'pending'
  const mine = app?.reviewer_id === me.id
  const canAct = open && app?.can_act
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const save = () => {
    const interviewIso = form.interviewAt ? new Date(form.interviewAt).toISOString() : null
    act(`/api/review/applications/${app.id}`, {
      notes: form.notes,
      rating: form.rating,
      interviewAt: interviewIso,
      location: form.location,
      message: form.message,
      sendInvite: form.sendInvite,
    }, interviewIso && form.sendInvite && toLocalInput(app.interview_at) !== form.interviewAt
      ? 'Saved. The interview invitation is on its way.'
      : 'Review saved.', { method: 'PATCH' })
  }

  const decide = async () => {
    const result = await act(`/api/review/applications/${app.id}/decide`, decision,
      decision.decision === 'approved'
        ? `${app.full_name} is now a member. A welcome email is on the way.`
        : `${app.full_name} rejected.`, { close: true })
    if (result) logActivity(decision.decision, 'membership_applications', app.id, { name: app.full_name })
    setDecision(null)
  }

  const submitMove = async () => {
    const result = mode === 'transfer'
      ? await act(`/api/review/applications/${app.id}/transfer`,
        { teamId: move.teamId === 'pool' ? null : Number(move.teamId), note: move.note },
        'Transferred.', { close: true })
      : await act(`/api/review/applications/${app.id}/assign`,
        { reviewerId: move.reviewerId === 'none' ? null : Number(move.reviewerId) }, 'Reassigned.')
    if (result) setMode(null)
  }

  const teamName = tid => teamsById[tid]?.name_en || 'General pool'
  const personName = rid => (rid === me.id ? 'you' : reviewerName(reviewersById[rid]) || 'a former admin')

  return (
    <>
      <Drawer
        open={!!app}
        onClose={onClose}
        width={560}
        title={app?.full_name || ''}
        subtitle={app ? `Applied ${formatDateTime(app.created_at)} · ${teamName(app.team_id)}` : ''}
        badge={app && <StatusBadge status={open ? app.stage : app.status} />}
        footer={canAct ? (
          <>
            {!mine && <Button icon={Hand} disabled={busy} onClick={() => act(`/api/review/applications/${app.id}/claim`, {}, 'It is yours now.')}>Claim</Button>}
            <Button icon={X} disabled={busy} onClick={() => setDecision({ decision: 'rejected', note: '' })}>Reject</Button>
            <Button variant="primary" icon={Check} disabled={busy} onClick={() => setDecision({ decision: 'approved', note: '' })}>Accept</Button>
          </>
        ) : null}
      >
        {app && (
          <div className="space-y-5">
            {open && !canAct && (
              <p className="text-xs" style={{ color: 'var(--adm-silk-faint)' }}>
                {personName(app.reviewer_id)} has this application. You can read it; a membership manager can reassign it.
              </p>
            )}

            <div className="grid grid-cols-2 gap-4">
              <DetailRow label="Email" mono>{app.email}</DetailRow>
              <DetailRow label="Phone" mono>{app.phone || '—'}</DetailRow>
              <DetailRow label="Student ID" mono>{app.student_id || '—'}</DetailRow>
              <DetailRow label="Study year">{app.study_year || '—'}</DetailRow>
              <DetailRow label="Department">{app.department || '—'}</DetailRow>
              <DetailRow label="Reviewer">{app.reviewer_id ? personName(app.reviewer_id) : 'Unassigned'}</DetailRow>
            </div>
            <DetailRow label="Interests"><TagList items={(app.interests || []).map(k => labels[k] || k)} empty="None chosen" /></DetailRow>
            <DetailRow label="Skills"><TagList items={app.skills} empty="None listed" /></DetailRow>
            <DetailRow label="Why they want to join">
              {app.motivation
                ? <p className="whitespace-pre-wrap leading-relaxed">{app.motivation}</p>
                : <span style={{ color: 'var(--adm-silk-faint)' }}>They left this blank.</span>}
            </DetailRow>

            {canAct && (
              <Panel>
                <PanelHead eyebrow="Review" title="Interview and notes" />
                <div className="p-4 space-y-4">
                  <div className="grid sm:grid-cols-2 gap-3">
                    <TextField label="Interview" type="datetime-local" value={form.interviewAt || ''}
                      onChange={e => set('interviewAt', e.target.value)} hint="Leave empty if not set yet." />
                    <TextField label="Where" value={form.location || ''} onChange={e => set('location', e.target.value)}
                      placeholder="Club room, block B" />
                  </div>
                  {form.interviewAt && toLocalInput(app.interview_at) !== form.interviewAt && (
                    <>
                      <CheckField label="Email the invitation" description="Sends the time, place and your name to the applicant."
                        checked={form.sendInvite} onChange={v => set('sendInvite', v)} />
                      {form.sendInvite && (
                        <TextArea label="Message (optional)" rows={2} value={form.message || ''}
                          onChange={e => set('message', e.target.value)} placeholder="Bring a project you are proud of." />
                      )}
                    </>
                  )}
                  <div>
                    <p className="adm-label">Rating</p>
                    <div className="flex items-center gap-1" role="radiogroup" aria-label="Rating">
                      {[1, 2, 3, 4, 5].map(n => (
                        <button key={n} type="button" role="radio" aria-checked={form.rating === n} aria-label={`${n} of 5`}
                          onClick={() => set('rating', form.rating === n ? null : n)} className="p-1">
                          <Star size={18} style={{ color: n <= (form.rating || 0) ? 'var(--adm-wait)' : 'var(--adm-silk-faint)' }}
                            fill={n <= (form.rating || 0) ? 'currentColor' : 'none'} />
                        </button>
                      ))}
                    </div>
                  </div>
                  <TextArea label="Notes" rows={4} value={form.notes || ''} onChange={e => set('notes', e.target.value)}
                    hint="Visible to other reviewers and managers, so a handover loses nothing." />
                  <div className="flex justify-end">
                    <Button variant="primary" size="sm" busy={busy} busyLabel="Saving…" onClick={save}>Save review</Button>
                  </div>
                </div>
              </Panel>
            )}

            {!canAct && (app.review_notes || app.review_rating) && (
              <DetailRow label={`Review${app.review_rating ? ` · ${app.review_rating}/5` : ''}`}>
                <p className="whitespace-pre-wrap leading-relaxed">{app.review_notes || '—'}</p>
              </DetailRow>
            )}

            {open && (canAct || me.isManager) && (
              <div className="flex flex-wrap gap-2">
                {canAct && <Button size="sm" icon={ArrowRightLeft} onClick={() => setMode(mode === 'transfer' ? null : 'transfer')}>Send to another team</Button>}
                {canAct && mine && (
                  <Button size="sm" icon={Undo2} disabled={busy}
                    onClick={() => act(`/api/review/applications/${app.id}/release`, {},
                      r => (r.reviewerId ? 'Handed to a teammate.' : 'Released. It waits for the next free reviewer.'), { close: true })}>
                    Release
                  </Button>
                )}
                {me.isManager && <Button size="sm" icon={UserPlus} onClick={() => setMode(mode === 'assign' ? null : 'assign')}>Assign reviewer</Button>}
              </div>
            )}

            {mode === 'transfer' && (
              <div className="space-y-3 p-3 rounded-lg" style={{ background: 'var(--adm-board-sunk)' }}>
                <SelectField label="Send to" value={move.teamId} onChange={e => setMove(m => ({ ...m, teamId: e.target.value }))}>
                  <option value="">Choose a team…</option>
                  {data.teams.filter(t => t.id !== app.team_id).map(t => <option key={t.id} value={t.id}>{t.name_en}</option>)}
                  {app.team_id && <option value="pool">General pool</option>}
                </SelectField>
                <TextField label="Why (optional)" value={move.note} onChange={e => setMove(m => ({ ...m, note: e.target.value }))}
                  placeholder="Portfolio is all design work" />
                <div className="flex justify-end gap-2">
                  <Button size="sm" onClick={() => setMode(null)}>Cancel</Button>
                  <Button size="sm" variant="primary" disabled={!move.teamId} busy={busy} onClick={submitMove}>Transfer</Button>
                </div>
              </div>
            )}

            {mode === 'assign' && (
              <div className="space-y-3 p-3 rounded-lg" style={{ background: 'var(--adm-board-sunk)' }}>
                <SelectField label="Reviewer" value={move.reviewerId} onChange={e => setMove(m => ({ ...m, reviewerId: e.target.value }))}
                  hint={app.team_id ? `Reviewers of ${teamName(app.team_id)} are listed first.` : undefined}>
                  <option value="">Choose…</option>
                  <option value="none">Nobody (unassigned)</option>
                  {sortReviewers(data, app.team_id).map(r => (
                    <option key={r.id} value={r.id}>
                      {reviewerName(r)}{r.inTeam ? '' : ' (other team)'}{r.review_available ? '' : ' — away'}
                    </option>
                  ))}
                </SelectField>
                <div className="flex justify-end gap-2">
                  <Button size="sm" onClick={() => setMode(null)}>Cancel</Button>
                  <Button size="sm" variant="primary" disabled={!move.reviewerId} busy={busy} onClick={submitMove}>Assign</Button>
                </div>
              </div>
            )}

            <DetailRow label="History">
              {events.length === 0 ? (
                <span style={{ color: 'var(--adm-silk-faint)' }}>Nothing recorded yet.</span>
              ) : (
                <ol className="space-y-2">
                  {events.map(e => (
                    <li key={e.id} className="text-[13px]">
                      <span className="font-semibold">{EVENT_LABELS[e.kind] || e.kind}</span>
                      <span style={{ color: 'var(--adm-silk-dim)' }}>{describeEvent(e, teamName, personName)}</span>
                      <span className="adm-data block text-[11px]" style={{ color: 'var(--adm-silk-faint)' }}>{formatDateTime(e.created_at)}</span>
                    </li>
                  ))}
                </ol>
              )}
            </DetailRow>
          </div>
        )}
      </Drawer>

      <ConfirmDialog
        open={!!decision}
        onClose={() => setDecision(null)}
        onConfirm={decide}
        danger={decision?.decision === 'rejected'}
        title={decision?.decision === 'approved' ? `Accept ${app?.full_name}?` : `Reject ${app?.full_name}?`}
        confirmLabel={decision?.decision === 'approved' ? 'Accept' : 'Reject'}
        busyLabel={decision?.decision === 'approved' ? 'Accepting…' : 'Rejecting…'}
        message={decision?.decision === 'approved'
          ? 'They become a club member, get a member number and card, and receive a welcome email.'
          : 'The application is closed. No email is sent.'}
      />
    </>
  )
}

function describeEvent(e, teamName, personName) {
  const parts = []
  if (['routed', 'transferred'].includes(e.kind)) parts.push(`to ${teamName(e.to_team_id)}`)
  if (e.to_reviewer_id && ['routed', 'assigned', 'claimed', 'transferred', 'reassigned', 'stale_reassigned', 'released'].includes(e.kind)) {
    parts.push(`${e.kind === 'claimed' ? 'by' : '→'} ${personName(e.to_reviewer_id)}`)
  }
  if (e.kind === 'released' && !e.to_reviewer_id) parts.push('back to the queue')
  if (e.note) parts.push(`· ${e.note}`)
  return parts.length ? ` ${parts.join(' ')}` : ''
}

function sortReviewers(data, teamId) {
  const team = data.teams.find(t => t.id === teamId)
  const inTeam = new Set(team?.reviewer_ids || [])
  return data.reviewers
    .map(r => ({ ...r, inTeam: !teamId || inTeam.has(r.id) }))
    .sort((a, b) => Number(b.inTeam) - Number(a.inTeam) || reviewerName(a).localeCompare(reviewerName(b)))
}

/** Managers' view of who holds what, and the knobs to even it out. */
function LoadBoard({ onChanged }) {
  const addToast = useAdminStore(s => s.addToast)
  const [load, setLoad] = useState(null)
  const [error, setError] = useState(null)
  const [handoff, setHandoff] = useState(null)

  const fetchLoad = useCallback(async () => {
    const { ok, data, message } = await api('/api/review/load')
    if (!ok) { setError(message); return }
    setError(null)
    setLoad(data)
  }, [])

  useEffect(() => { fetchLoad() }, [fetchLoad])

  const update = async (reviewer, patch) => {
    const { ok, message } = await api(`/api/review/reviewers/${reviewer.id}`, { method: 'PATCH', body: patch })
    if (!ok) { addToast(message, 'error'); return }
    await fetchLoad()
  }

  if (error) return <Panel><ErrorState message={error} onRetry={fetchLoad} /></Panel>
  if (!load) return <Panel><p className="p-6 text-sm" style={{ color: 'var(--adm-silk-faint)' }}>Loading…</p></Panel>

  const max = Math.max(1, ...load.reviewers.map(r => r.open))

  return (
    <div className="space-y-5">
      <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))' }}>
        {load.teams.map(t => (
          <Panel key={t.id} className="p-4">
            <p className="flex items-center gap-1.5 text-sm font-semibold">
              <span className="rounded-full" style={{ width: 8, height: 8, background: t.color }} aria-hidden="true" />
              {t.name}
            </p>
            <p className="adm-data text-[22px] mt-2">{t.open}</p>
            <p className="text-xs" style={{ color: t.reviewers ? 'var(--adm-silk-faint)' : 'var(--adm-fault)' }}>
              open · {t.unassigned} unassigned · {t.reviewers ? `${t.reviewers} reviewer${t.reviewers === 1 ? '' : 's'}` : 'no reviewers'}
            </p>
          </Panel>
        ))}
        <Panel className="p-4">
          <p className="text-sm font-semibold">General pool</p>
          <p className="adm-data text-[22px] mt-2">{load.pool}</p>
          <p className="text-xs" style={{ color: 'var(--adm-silk-faint)' }}>match no team</p>
        </Panel>
      </div>

      <Panel>
        <PanelHead eyebrow="Load" title="Reviewers"
          description={`Stale means no progress for ${load.staleDays} days. Capacity caps how many open applications routing gives someone.`}
          action={<Link to="/admin/teams" className="text-xs font-semibold" style={{ color: 'var(--adm-signal)' }}>Manage teams</Link>} />
        {load.reviewers.length === 0 ? (
          <EmptyState compact icon={Inbox} title="No reviewers yet" description="Add admins to review teams to start routing." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs" style={{ color: 'var(--adm-silk-faint)' }}>
                  <th className="px-4 py-2 font-semibold">Reviewer</th>
                  <th className="px-4 py-2 font-semibold">Open</th>
                  <th className="px-4 py-2 font-semibold">Interviews</th>
                  <th className="px-4 py-2 font-semibold">Stale</th>
                  <th className="px-4 py-2 font-semibold">Decided (30d)</th>
                  <th className="px-4 py-2 font-semibold">Avg days</th>
                  <th className="px-4 py-2 font-semibold">Capacity</th>
                  <th className="px-4 py-2 font-semibold">Status</th>
                  <th className="px-4 py-2" />
                </tr>
              </thead>
              <tbody>
                {load.reviewers.map(r => (
                  <tr key={r.id} style={{ borderTop: '1px solid var(--adm-trace)' }}>
                    <td className="px-4 py-2.5">
                      <span className="block font-semibold">{r.name}</span>
                      <span className="block h-1.5 mt-1 rounded-full" style={{ width: `${(r.open / max) * 100}%`, minWidth: 2, background: 'var(--adm-signal)' }} aria-hidden="true" />
                    </td>
                    <td className="px-4 py-2.5 adm-data">{r.open}</td>
                    <td className="px-4 py-2.5 adm-data">{r.interviews}</td>
                    <td className="px-4 py-2.5 adm-data" style={{ color: r.stale ? 'var(--adm-fault)' : undefined }}>{r.stale}</td>
                    <td className="px-4 py-2.5 adm-data">{r.decided_30d}</td>
                    <td className="px-4 py-2.5 adm-data">{r.avg_days ?? '—'}</td>
                    <td className="px-4 py-2.5">
                      <input className="adm-input" style={{ width: 72 }} type="number" min="0" placeholder="∞"
                        aria-label={`Capacity for ${r.name}`} defaultValue={r.capacity ?? ''}
                        onBlur={e => {
                          const next = e.target.value === '' ? null : Number(e.target.value)
                          if (next !== r.capacity) update(r, { capacity: next })
                        }} />
                    </td>
                    <td className="px-4 py-2.5">
                      <button type="button" onClick={() => update(r, { available: !r.available })}
                        aria-label={`${r.name} is ${r.available ? 'available' : 'away'}; toggle`}>
                        <Badge tone={r.available ? 'ok' : 'wait'}>{r.available ? 'Available' : 'Away'}</Badge>
                      </button>
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      {r.open > 0 && <Button size="sm" icon={Undo2} onClick={() => setHandoff(r)}>Hand off</Button>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <ConfirmDialog
        open={!!handoff}
        onClose={() => setHandoff(null)}
        onConfirm={async () => {
          const { ok, data, message } = await api(`/api/review/reviewers/${handoff.id}/handoff`, { method: 'POST', body: {} })
          if (!ok) addToast(message, 'error')
          else addToast(`${data.moved} application${data.moved === 1 ? '' : 's'} moved off ${handoff.name}.`)
          setHandoff(null)
          await fetchLoad()
          onChanged()
        }}
        title={handoff ? `Hand off ${handoff.name}’s applications?` : ''}
        danger={false}
        confirmLabel="Hand off"
        busyLabel="Handing off…"
        message="Each goes to the least-loaded teammate who is available. Ones nobody can take wait unassigned."
      />
    </div>
  )
}
