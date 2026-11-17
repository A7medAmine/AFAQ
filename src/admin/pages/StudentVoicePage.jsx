import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowDown, ArrowUp, ExternalLink, Megaphone, Pencil, Plus, Trash2, Vote } from 'lucide-react'
import { logActivity, read, run, supabase } from '../lib/db'
import { STATE_BADGE, pollState } from '../lib/polls'
import { PROBLEM_ICONS, ProblemIcon, STUDENT_VOICE_PATH } from '../../lib/campusVoice'
import PageHeader from '../components/ui/PageHeader'
import Panel, { PanelHead } from '../components/ui/Panel'
import Modal from '../components/ui/Modal'
import ConfirmDialog from '../components/ui/ConfirmDialog'
import EmptyState, { ErrorState } from '../components/ui/EmptyState'
import Button, { IconButton } from '../components/ui/Button'
import Badge from '../components/ui/Badge'
import { SkeletonPanel } from '../components/ui/Skeleton'
import { CheckField, LocalizedField, SelectField, TextField } from '../components/ui/Field'

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/

const pollsQuery = () => supabase.from('polls')
  .select('id, title, slug, status, opens_at, closes_at, max_responses, responses:poll_responses(count)')
  .order('created_at', { ascending: false })

const withState = rows => (rows || []).map(poll => {
  const responseCount = poll.responses?.[0]?.count || 0
  return { ...poll, responseCount, state: pollState(poll, responseCount) }
})

/**
 * The public /student-voice page: the club's table of campus problems at an
 * event. Each problem card links to a poll, so students scan its QR code,
 * answer and suggest a fix. Answers are read on the poll itself.
 */
export default function StudentVoicePage() {
  const [problems, setProblems] = useState([])
  const [polls, setPolls] = useState([])
  const [state, setState] = useState({ loading: true, error: null })
  const [editing, setEditing] = useState(null) // a problem, or {} for a new one
  const [remove, setRemove] = useState(null)
  const [moving, setMoving] = useState(false)

  const load = useCallback(async () => {
    setState(s => ({ ...s, error: null }))
    const [p, pl] = await Promise.all([
      read(supabase.from('campus_problems').select('*').order('sort_order').order('id')),
      read(pollsQuery()),
    ])
    if (!p.ok || !pl.ok) { setState({ loading: false, error: p.message || pl.message }); return }
    setProblems(p.data || [])
    setPolls(withState(pl.data))
    setState({ loading: false, error: null })
  }, [])

  useEffect(() => { load() }, [load])

  // A poll made in another tab shows up in the picker once you come back.
  useEffect(() => {
    const refresh = async () => {
      if (document.visibilityState !== 'visible') return
      const res = await read(pollsQuery())
      if (res.ok) setPolls(withState(res.data))
    }
    document.addEventListener('visibilitychange', refresh)
    return () => document.removeEventListener('visibilitychange', refresh)
  }, [])

  const pollById = useMemo(() => new Map(polls.map(p => [p.id, p])), [polls])

  const move = async (index, delta) => {
    const target = index + delta
    if (moving || target < 0 || target >= problems.length) return
    const next = [...problems]
    ;[next[index], next[target]] = [next[target], next[index]]
    const changed = next.map((row, i) => ({ row, order: i + 1 })).filter(({ row, order }) => row.sort_order !== order)
    setProblems(next.map((row, i) => ({ ...row, sort_order: i + 1 })))
    setMoving(true)
    const results = await Promise.all(changed.map(({ row, order }) =>
      run(supabase.from('campus_problems').update({ sort_order: order }).eq('id', row.id), { failure: 'The new order was not saved.' })
    ))
    setMoving(false)
    if (results.some(r => !r.ok)) load()
  }

  const toggle = async row => {
    const isActive = !row.is_active
    setProblems(rs => rs.map(r => (r.id === row.id ? { ...r, is_active: isActive } : r)))
    const { ok } = await run(
      supabase.from('campus_problems').update({ is_active: isActive, updated_at: new Date().toISOString() }).eq('id', row.id),
      { success: isActive ? `${row.title_en} is on the page.` : `${row.title_en} is hidden.`, failure: 'The problem was not changed.' }
    )
    if (ok) logActivity(isActive ? 'shown' : 'hidden', 'campus_problems', row.id, { title: row.title_en })
    else load()
  }

  const destroy = async row => {
    const { ok } = await run(
      supabase.from('campus_problems').delete().eq('id', row.id),
      { success: `${row.title_en} deleted.`, failure: 'The problem was not deleted.' }
    )
    if (ok) { logActivity('deleted', 'campus_problems', row.id, { title: row.title_en }); setRemove(null); setEditing(null); load() }
  }

  const shown = problems.filter(p => p.is_active)
  const live = shown.filter(p => { const poll = pollById.get(p.poll_id); return poll && poll.state !== 'draft' }).length

  return (
    <div>
      <PageHeader
        eyebrow="Publish"
        title="Student Voice"
        description="Campus problems students answer by scanning a QR code. Each problem opens its own poll; read the answers on that poll."
        actions={
          <>
            <a className="adm-btn" href={STUDENT_VOICE_PATH} target="_blank" rel="noopener noreferrer"><ExternalLink size={15} /> Open page</a>
            <Button variant="primary" icon={Plus} onClick={() => setEditing({})}>Add problem</Button>
          </>
        }
      />

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px] items-start">
        <Panel>
          <PanelHead
            eyebrow="Problems"
            title={state.loading ? 'Loading…' : `${shown.length} shown · ${live} with a live poll`}
            description="Top to bottom, as students see them. A problem without a published poll shows “Opens at the event”."
          />
          {state.error ? (
            <ErrorState message={state.error} onRetry={load} />
          ) : state.loading ? (
            <SkeletonPanel rows={5} />
          ) : problems.length === 0 ? (
            <EmptyState
              icon={Megaphone}
              title="No problems yet"
              description="Add the campus problems you will present, then link each one to a poll."
              action={<Button variant="primary" icon={Plus} onClick={() => setEditing({})}>Add problem</Button>}
            />
          ) : (
            <ul>
              {problems.map((row, i) => {
                const poll = pollById.get(row.poll_id)
                const badge = poll && STATE_BADGE[poll.state]
                return (
                  <li key={row.id} className="flex items-center gap-3 px-4 py-3"
                    style={{ borderTop: i ? '1px solid var(--adm-trace)' : undefined, opacity: row.is_active ? 1 : 0.6 }}>
                    <div className="flex flex-col">
                      <IconButton icon={ArrowUp} size={14} label={`Move ${row.title_en} up`} disabled={i === 0 || moving} onClick={() => move(i, -1)} />
                      <IconButton icon={ArrowDown} size={14} label={`Move ${row.title_en} down`} disabled={i === problems.length - 1 || moving} onClick={() => move(i, 1)} />
                    </div>
                    <span className="grid place-items-center shrink-0"
                      style={{ width: 34, height: 34, borderRadius: 8, background: 'var(--adm-signal-wash)', color: 'var(--adm-signal)' }}>
                      <ProblemIcon name={row.icon} size={17} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-semibold adm-truncate">{row.title_en}</span>
                        {!row.is_active && <Badge>Hidden</Badge>}
                      </span>
                      {poll ? (
                        <Link to={`/admin/polls/${poll.id}`} className="inline-flex items-center gap-1.5 text-[12px] mt-0.5" style={{ color: 'var(--adm-silk-dim)' }}>
                          <Vote size={12} /> <span className="adm-truncate" style={{ maxWidth: 260 }} dir="auto">{poll.title}</span>
                          <Badge tone={badge.tone}>{badge.label}</Badge>
                          <span style={{ color: 'var(--adm-silk-faint)' }}>· {poll.responseCount} {poll.responseCount === 1 ? 'answer' : 'answers'}</span>
                        </Link>
                      ) : (
                        <span className="block text-[12px] mt-0.5" style={{ color: 'var(--adm-silk-faint)' }}>No poll linked yet</span>
                      )}
                    </span>
                    <Button size="sm" variant="ghost" onClick={() => toggle(row)}>{row.is_active ? 'Hide' : 'Show'}</Button>
                    <IconButton icon={Pencil} label={`Edit ${row.title_en}`} onClick={() => setEditing(row)} />
                  </li>
                )
              })}
            </ul>
          )}
        </Panel>

        <EventSettings />
      </div>

      <EditProblem
        problem={editing}
        polls={polls}
        nextOrder={problems.reduce((max, p) => Math.max(max, p.sort_order || 0), 0) + 1}
        onClose={() => setEditing(null)}
        onSaved={() => { setEditing(null); load() }}
        onDelete={() => setRemove(editing)}
      />

      <ConfirmDialog
        open={!!remove}
        onClose={() => setRemove(null)}
        onConfirm={() => destroy(remove)}
        title="Delete this problem?"
        message={remove ? `${remove.title_en} leaves the page. Its poll and answers are kept. To take it off for a while, hide it instead.` : ''}
      />
    </div>
  )
}

const EMPTY_SETTINGS = { event_date: '', start_time: '', end_time: '', place_en: '', place_ar: '', place_fr: '', show_on_home: true }

function EventSettings() {
  const [form, setForm] = useState(EMPTY_SETTINGS)
  const [lang, setLang] = useState('en')
  const [errors, setErrors] = useState({})
  const [status, setStatus] = useState({ loading: true, error: null })
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setStatus({ loading: true, error: null })
    const res = await read(supabase.from('campus_voice_settings').select('*').eq('id', 1).maybeSingle())
    if (!res.ok) { setStatus({ loading: false, error: res.message }); return }
    const row = res.data || {}
    setForm(Object.fromEntries(Object.entries(EMPTY_SETTINGS).map(([k, v]) => [k, row[k] ?? v])))
    setStatus({ loading: false, error: null })
  }, [])

  useEffect(() => { load() }, [load])

  const set = (key, value) => { setForm(f => ({ ...f, [key]: value })); setErrors(e => ({ ...e, [key]: null })) }

  const save = async () => {
    const next = {}
    if (form.start_time && !TIME.test(form.start_time)) next.start_time = 'Use 24-hour time, like 09:00.'
    if (form.end_time && !TIME.test(form.end_time)) next.end_time = 'Use 24-hour time, like 12:00.'
    if (!next.start_time && !next.end_time && form.start_time && form.end_time && form.end_time <= form.start_time) next.end_time = 'It ends before it starts.'
    setErrors(next)
    if (Object.keys(next).length) return
    const blank = v => (typeof v === 'string' && !v.trim() ? null : typeof v === 'string' ? v.trim() : v)
    const row = { id: 1, ...Object.fromEntries(Object.entries(form).map(([k, v]) => [k, blank(v)])), updated_at: new Date().toISOString() }
    setSaving(true)
    const { ok } = await run(
      supabase.from('campus_voice_settings').upsert(row),
      { success: 'Event details saved.', failure: 'The event details were not saved.' }
    )
    setSaving(false)
    if (ok) logActivity('updated', 'campus_voice_settings', 1, { event_date: row.event_date })
  }

  return (
    <Panel>
      <PanelHead eyebrow="Event" title="When and where" description="Shown at the top of the page. After it ends, the page invites students to answer online." />
      {status.error ? (
        <ErrorState message={status.error} onRetry={load} />
      ) : status.loading ? (
        <SkeletonPanel rows={3} />
      ) : (
        <div className="p-4 space-y-4">
          <TextField label="Date" type="date" value={form.event_date || ''} onChange={e => set('event_date', e.target.value)} />
          <div className="grid grid-cols-2 gap-3">
            <TextField label="Starts" type="time" value={form.start_time || ''} error={errors.start_time} onChange={e => set('start_time', e.target.value)} />
            <TextField label="Ends" type="time" value={form.end_time || ''} error={errors.end_time} onChange={e => set('end_time', e.target.value)} />
          </div>
          <LocalizedField label="Place" prefix="place" values={form} onChange={set} lang={lang} onLangChange={setLang} />
          <CheckField
            label="Banner on the home page"
            description="It hides itself a week after the event."
            checked={form.show_on_home}
            onChange={v => set('show_on_home', v)}
          />
          <div className="flex justify-end">
            <Button variant="primary" onClick={save} busy={saving} busyLabel="Saving…">Save</Button>
          </div>
        </div>
      )}
    </Panel>
  )
}

const EMPTY_PROBLEM = {
  title_en: '', title_ar: '', title_fr: '',
  description_en: '', description_ar: '', description_fr: '',
  icon: 'Lightbulb', poll_id: '', is_active: true,
}

function EditProblem({ problem, polls, nextOrder, onClose, onSaved, onDelete }) {
  const isNew = problem && !problem.id
  const [form, setForm] = useState(EMPTY_PROBLEM)
  const [lang, setLang] = useState('en')
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!problem) return
    setForm(problem.id
      ? Object.fromEntries(Object.keys(EMPTY_PROBLEM).map(k => [k, problem[k] ?? EMPTY_PROBLEM[k]]))
      : EMPTY_PROBLEM)
    setLang('en')
    setErrors({})
  }, [problem])

  const set = (key, value) => { setForm(f => ({ ...f, [key]: value })); setErrors(e => ({ ...e, [key]: null })) }
  const chosen = polls.find(p => String(p.id) === String(form.poll_id))

  const save = async () => {
    if (!form.title_en.trim()) { setErrors({ title_en: 'Enter the title in English.' }); setLang('en'); return }
    const text = v => v.trim() || null
    const row = {
      title_en: form.title_en.trim(),
      title_ar: text(form.title_ar), title_fr: text(form.title_fr),
      description_en: text(form.description_en), description_ar: text(form.description_ar), description_fr: text(form.description_fr),
      icon: form.icon,
      poll_id: form.poll_id ? Number(form.poll_id) : null,
      is_active: form.is_active,
      updated_at: new Date().toISOString(),
    }
    setSaving(true)
    const { ok, data } = await run(
      isNew
        ? supabase.from('campus_problems').insert({ ...row, sort_order: nextOrder }).select().single()
        : supabase.from('campus_problems').update(row).eq('id', problem.id).select().single(),
      { success: isNew ? `${row.title_en} added.` : `${row.title_en} saved.`, failure: 'The problem was not saved.' }
    )
    setSaving(false)
    if (!ok) return
    logActivity(isNew ? 'created' : 'updated', 'campus_problems', data?.id ?? problem.id, { title: row.title_en })
    onSaved()
  }

  return (
    <Modal
      open={!!problem}
      onClose={onClose}
      size="md"
      title={isNew ? 'Add problem' : problem?.title_en || ''}
      description="Arabic and French are optional; the page falls back to English."
      footer={
        <>
          {!isNew && <Button className="mr-auto" icon={Trash2} onClick={onDelete}>Delete</Button>}
          <Button onClick={onClose} data-dialog-dismiss="true">Cancel</Button>
          <Button variant="primary" onClick={save} busy={saving} busyLabel="Saving…">{isNew ? 'Add problem' : 'Save'}</Button>
        </>
      }
    >
      <div className="space-y-5">
        <LocalizedField label="Title" prefix="title" required values={form} onChange={set} lang={lang} onLangChange={setLang} error={errors.title_en} />
        <LocalizedField label="Short description" prefix="description" multiline rows={3} values={form} onChange={set} lang={lang} onLangChange={setLang}
          hint="One or two lines. It is printed on the QR frame too." />

        <div>
          <span className="adm-label">Icon</span>
          <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Icon">
            {PROBLEM_ICONS.map(({ value, label, Icon }) => {
              const on = form.icon === value
              return (
                <button key={value} type="button" role="radio" aria-checked={on} title={label} aria-label={label}
                  onClick={() => set('icon', value)}
                  className="grid place-items-center"
                  style={{
                    width: 36, height: 36, borderRadius: 8,
                    border: `1px solid ${on ? 'var(--adm-signal)' : 'var(--adm-trace)'}`,
                    background: on ? 'var(--adm-signal-wash)' : 'transparent',
                    color: on ? 'var(--adm-signal)' : 'var(--adm-silk-dim)',
                  }}>
                  <Icon size={17} />
                </button>
              )
            })}
          </div>
        </div>

        <SelectField
          label="Poll"
          value={form.poll_id ?? ''}
          onChange={e => set('poll_id', e.target.value)}
          hint={chosen?.state === 'draft'
            ? 'This poll is a draft, so the card shows “Opens at the event” until you publish it.'
            : 'Students land on this poll when they scan the QR code.'}
        >
          <option value="">No poll yet</option>
          {polls.map(p => <option key={p.id} value={p.id}>{p.title} — {STATE_BADGE[p.state].label}</option>)}
        </SelectField>
        <p className="text-[12px] -mt-3" style={{ color: 'var(--adm-silk-faint)' }}>
          Need a new one? <Link to="/admin/polls" target="_blank" style={{ color: 'var(--adm-signal)' }}>Create it in Polls</Link>; it appears here when you come back to this tab.
        </p>

        <CheckField
          label="Show on the page"
          description="Hidden problems stay saved here."
          checked={form.is_active}
          onChange={v => set('is_active', v)}
        />
      </div>
    </Modal>
  )
}
