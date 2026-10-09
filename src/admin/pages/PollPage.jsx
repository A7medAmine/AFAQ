import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Copy, Eraser, ExternalLink, Lock, Play, RefreshCw, Save, Share2, Square, Trash2 } from 'lucide-react'
import { logActivity, read, run, supabase } from '../lib/db'
import useAdminStore from '../store/adminStore'
import useQueryParam from '../hooks/useQueryParam'
import { formatDateTime, plural } from '../lib/format'
import {
  STARTERS, STATE_BADGE, duplicatePoll, exportTable, loadResponses, pollState, pollUrl, prepareQuestions, toEditable,
} from '../lib/polls'
import PageHeader, { FilterTabs } from '../components/ui/PageHeader'
import { ErrorState } from '../components/ui/EmptyState'
import Button from '../components/ui/Button'
import Badge from '../components/ui/Badge'
import Panel from '../components/ui/Panel'
import Skeleton from '../components/ui/Skeleton'
import ConfirmDialog from '../components/ui/ConfirmDialog'
import ExportMenu from '../components/ui/ExportMenu'
import QuestionEditor from '../components/polls/QuestionEditor'
import PollSettings, { settingsForm, settingsValues } from '../components/polls/PollSettings'
import PollResults from '../components/polls/PollResults'
import SharePollModal from '../components/polls/SharePollModal'

const REFRESH_MS = 15000

export default function PollPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const userId = useAdminStore(s => s.adminProfile?.user_id)
  const [poll, setPoll] = useState(null)
  const [questions, setQuestions] = useState([]) // saved rows
  const [draft, setDraft] = useState([]) // editor copy
  const [form, setForm] = useState(null)
  const [events, setEvents] = useState([])
  const [data, setData] = useState({ responses: [], answers: [] })
  const [state, setState] = useState({ loading: true, error: null })
  const [errors, setErrors] = useState({})
  const [settingsErrors, setSettingsErrors] = useState({})
  const [saving, setSaving] = useState(false)
  const [busy, setBusy] = useState(null)
  const [confirm, setConfirm] = useState(null) // 'delete' | 'clear'
  const [sharing, setSharing] = useState(false)
  const [tab, setTab] = useQueryParam('tab', 'questions')
  const starterUsed = useRef(false)

  const loadQuestions = useCallback(async () => {
    const res = await read(supabase.from('poll_questions').select('*, options:poll_options(*)').eq('poll_id', id).order('position'))
    if (res.ok) setQuestions(res.data || [])
    return res
  }, [id])

  const loadAnswers = useCallback(async () => {
    const res = await loadResponses(id)
    if (res.ok) setData({ responses: res.responses, answers: res.answers })
    return res
  }, [id])

  const load = useCallback(async () => {
    setState(s => ({ ...s, error: null }))
    const [pollRes, qRes, aRes, evRes] = await Promise.all([
      read(supabase.from('polls').select('*').eq('id', id).maybeSingle()),
      read(supabase.from('poll_questions').select('*, options:poll_options(*)').eq('poll_id', id).order('position')),
      loadResponses(id),
      read(supabase.from('events').select('id, title_en, date').order('date', { ascending: false })),
    ])
    const failed = [pollRes, qRes, aRes].find(r => !r.ok)
    if (failed) { setState({ loading: false, error: failed.message }); return }
    if (!pollRes.data) { setState({ loading: false, error: 'This poll does not exist any more.' }); return }
    setPoll(pollRes.data)
    setForm(settingsForm(pollRes.data))
    setQuestions(qRes.data || [])
    let editable = toEditable(qRes.data || [])
    // A poll just made from a starter opens with its questions ready to fill in.
    const starter = location.state?.starter
    if (!editable.length && starter && !starterUsed.current) {
      starterUsed.current = true
      editable = (STARTERS.find(s => s.value === starter) || STARTERS[0]).questions()
    }
    setDraft(editable)
    setData({ responses: aRes.responses, answers: aRes.answers })
    setEvents(evRes.data || [])
    setState({ loading: false, error: null })
  }, [id, location.state])

  useEffect(() => { load() }, [load])

  const responseCount = data.responses.length
  const current = poll ? pollState(poll, responseCount) : 'draft'
  const locked = responseCount > 0

  // Results keep themselves current while the poll takes answers.
  useEffect(() => {
    if (tab !== 'results' || !poll || !['open', 'scheduled'].includes(current)) return
    const timer = setInterval(() => { if (!document.hidden) loadAnswers() }, REFRESH_MS)
    return () => clearInterval(timer)
  }, [tab, poll, current, loadAnswers])

  const questionsDirty = useMemo(
    () => JSON.stringify(prepareQuestions(draft).payload ?? draft) !== JSON.stringify(prepareQuestions(toEditable(questions)).payload ?? []),
    [draft, questions]
  )
  const settingsDirty = useMemo(() => poll && form && JSON.stringify(form) !== JSON.stringify(settingsForm(poll)), [poll, form])

  // Unsaved edits survive a slip of the back button.
  useEffect(() => {
    if (!questionsDirty && !settingsDirty) return
    const warn = e => { e.preventDefault(); e.returnValue = '' }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [questionsDirty, settingsDirty])

  const saveQuestions = async () => {
    const { errors: errs, payload } = prepareQuestions(draft)
    if (errs) { setErrors(errs); return false }
    setErrors({})
    setSaving(true)
    const { ok } = await run(supabase.rpc('poll_replace_questions', { p_poll_id: Number(id), p_questions: payload }), {
      success: 'Questions saved.', failure: 'The questions were not saved.',
    })
    setSaving(false)
    if (!ok) return false
    logActivity('updated', 'polls', Number(id), { name: poll.title, questions: payload.length })
    const res = await loadQuestions()
    if (res.ok) setDraft(toEditable(res.data || []))
    return true
  }

  const saveSettings = async () => {
    const { errors: errs, values } = settingsValues(form)
    if (errs) { setSettingsErrors(errs); return false }
    setSettingsErrors({})
    setSaving(true)
    const { ok, data: row } = await run(
      supabase.from('polls').update({ ...values, updated_at: new Date().toISOString() }).eq('id', id).select('*').single(),
      { success: 'Settings saved.', failure: 'The settings were not saved.' }
    )
    setSaving(false)
    if (!ok) return false
    logActivity('updated', 'polls', Number(id), { name: values.title })
    setPoll(row)
    setForm(settingsForm(row))
    return true
  }

  const setStatus = async status => {
    if (status === 'open') {
      if (questionsDirty || settingsDirty) {
        const saved = (!questionsDirty || await saveQuestions()) && (!settingsDirty || await saveSettings())
        if (!saved) return
      }
      if (!draft.length) { setTab('questions'); setErrors({ _poll: 'Add at least one question before publishing.' }); return }
    }
    setBusy(status)
    const message = { open: poll.status === 'closed' ? 'Poll reopened.' : 'Poll published. The link works now.', closed: 'Poll closed. No more answers.', draft: 'Back to draft. The link stops working.' }[status]
    // Reopening a poll whose closing time has passed would close it again at
    // once, so the old time is cleared.
    const reopenPast = status === 'open' && poll.closes_at && new Date(poll.closes_at) <= new Date()
    const { ok, data: row } = await run(
      supabase.from('polls').update({ status, ...(reopenPast ? { closes_at: null } : {}), updated_at: new Date().toISOString() }).eq('id', id).select('*').single(),
      { success: message, failure: 'The poll status did not change.' }
    )
    setBusy(null)
    if (!ok) return
    logActivity('updated', 'polls', Number(id), { name: poll.title, status })
    setPoll(row)
    setForm(settingsForm(row))
    if (status === 'open' && poll.status === 'draft') setSharing(true)
  }

  const remove = async () => {
    const { ok } = await run(supabase.from('polls').delete().eq('id', id), { success: `${poll.title} deleted.`, failure: 'The poll was not deleted.' })
    if (!ok) return
    logActivity('deleted', 'polls', Number(id), { name: poll.title })
    navigate('/admin/polls')
  }

  const clearAnswers = async () => {
    const { ok } = await run(supabase.from('poll_responses').delete().eq('poll_id', id), {
      success: 'All answers cleared.', failure: 'The answers were not cleared.',
    })
    setConfirm(null)
    if (!ok) return
    logActivity('deleted', 'poll_responses', Number(id), { name: poll.title, count: responseCount })
    loadAnswers()
  }

  const duplicate = async () => {
    setBusy('duplicate')
    const res = await duplicatePoll(poll, questions, userId)
    setBusy(null)
    if (!res.ok) { useAdminStore.getState().addToast(res.message || 'The poll was not copied.', 'error'); return }
    logActivity('created', 'polls', res.id, { name: `${poll.title} (copy)`, from: Number(id) })
    navigate(`/admin/polls/${res.id}`)
  }

  const exportData = useMemo(() => exportTable(questions, data.responses, data.answers), [questions, data])

  if (state.loading) {
    return <div className="space-y-4"><Skeleton style={{ height: 28, width: 280 }} /><Panel className="p-5"><Skeleton style={{ height: 160 }} /></Panel></div>
  }
  if (state.error) {
    return (
      <div>
        <Link to="/admin/polls" className="adm-btn mb-5 inline-flex"><ArrowLeft size={15} /> Polls</Link>
        <Panel><ErrorState message={state.error} onRetry={load} /></Panel>
      </div>
    )
  }

  const badge = STATE_BADGE[current]
  const tabs = [
    { value: 'questions', label: 'Questions', count: draft.length },
    { value: 'settings', label: 'Settings' },
    { value: 'results', label: 'Results', count: responseCount },
  ]
  const dirty = tab === 'questions' ? questionsDirty : tab === 'settings' ? settingsDirty : false

  return (
    <div>
      <PageHeader
        eyebrow={poll.audience === 'members' ? 'Members poll' : 'Public poll'}
        title={<span dir="auto">{poll.title}</span>}
        actions={
          <>
            <Link to="/admin/polls" className="adm-btn"><ArrowLeft size={15} /> Polls</Link>
            <Button icon={Copy} busy={busy === 'duplicate'} busyLabel="Copying…" onClick={duplicate}>Duplicate</Button>
            <Button icon={Trash2} variant="danger" onClick={() => setConfirm('delete')}>Delete</Button>
          </>
        }
      >
        <div className="flex flex-wrap items-center gap-2 mt-3">
          <Badge tone={badge.tone}>{badge.label}</Badge>
          <span className="text-xs" style={{ color: 'var(--adm-silk-faint)' }}>
            {plural(responseCount, 'answer')}{poll.max_responses ? ` of ${poll.max_responses}` : ''}
            {poll.opens_at && current === 'scheduled' ? ` · opens ${formatDateTime(poll.opens_at)}` : ''}
            {poll.closes_at && current !== 'scheduled' ? ` · ${current === 'closed' ? 'closed' : 'closes'} ${formatDateTime(poll.closes_at)}` : ''}
          </span>
        </div>
      </PageHeader>

      <Panel className="p-4 mb-5 flex flex-wrap items-center gap-2">
        {poll.status === 'draft' ? (
          <Button variant="primary" icon={Play} busy={busy === 'open'} busyLabel="Publishing…" onClick={() => setStatus('open')}>Publish</Button>
        ) : current === 'closed' ? (
          <Button variant="primary" icon={Play} busy={busy === 'open'} busyLabel="Reopening…" onClick={() => setStatus('open')}>Reopen</Button>
        ) : (
          <Button icon={Square} busy={busy === 'closed'} busyLabel="Closing…" onClick={() => setStatus('closed')}>Close now</Button>
        )}
        {poll.status !== 'draft' && !locked && (
          <Button variant="ghost" busy={busy === 'draft'} busyLabel="Moving…" onClick={() => setStatus('draft')}>Back to draft</Button>
        )}
        <Button icon={Share2} onClick={() => setSharing(true)}>Share</Button>
        <a className="adm-btn" href={pollUrl(poll.slug)} target="_blank" rel="noreferrer"><ExternalLink size={15} /> {poll.status === 'draft' ? 'Link' : 'Open page'}</a>
        <span className="adm-data text-[12px] ml-auto adm-truncate" style={{ color: 'var(--adm-silk-faint)' }}>/p/{poll.slug}</span>
      </Panel>

      <div className="flex flex-wrap items-center gap-3 mb-5">
        <FilterTabs options={tabs} value={tab} onChange={setTab} label="Poll sections" />
        {tab === 'results' && (
          <div className="flex items-center gap-2 ml-auto">
            <Button size="sm" icon={RefreshCw} onClick={loadAnswers}>Refresh</Button>
            <ExportMenu
              filename={`poll-${poll.slug}-${new Date().toISOString().slice(0, 10)}`}
              title="Poll answers"
              subtitle={`${poll.title} · ${formatDateTime(new Date())}`}
              headers={exportData.headers}
              rows={exportData.rows}
              disabled={!responseCount}
            />
            {locked && <Button size="sm" icon={Eraser} variant="danger" onClick={() => setConfirm('clear')}>Clear answers</Button>}
          </div>
        )}
        {dirty && (
          <div className="flex items-center gap-2 ml-auto">
            <span className="text-xs" style={{ color: 'var(--adm-wait)' }}>Unsaved changes</span>
            <Button size="sm" onClick={() => (tab === 'questions' ? (setDraft(toEditable(questions)), setErrors({})) : (setForm(settingsForm(poll)), setSettingsErrors({})))}>Discard</Button>
            <Button size="sm" variant="primary" icon={Save} busy={saving} busyLabel="Saving…" onClick={tab === 'questions' ? saveQuestions : saveSettings}>Save</Button>
          </div>
        )}
      </div>

      {tab === 'questions' && (
        <>
          {locked && (
            <Panel className="p-4 mb-4 flex flex-wrap items-center gap-3">
              <Lock size={16} style={{ color: 'var(--adm-silk-faint)' }} />
              <p className="text-sm flex-1 min-w-[220px]" style={{ color: 'var(--adm-silk-dim)' }}>
                {plural(responseCount, 'person has', 'people have')} answered, so the questions are locked. Duplicate the poll to change them, or clear the answers first.
              </p>
            </Panel>
          )}
          <QuestionEditor questions={draft} onChange={setDraft} errors={errors} locked={locked} />
        </>
      )}

      {tab === 'settings' && form && (
        <PollSettings form={form} onChange={setForm} errors={settingsErrors} events={events} />
      )}

      {tab === 'results' && <PollResults questions={questions} responses={data.responses} answers={data.answers} />}

      <SharePollModal open={sharing} poll={poll} state={current} onClose={() => setSharing(false)} />
      <ConfirmDialog
        open={confirm === 'delete'}
        onClose={() => setConfirm(null)}
        onConfirm={remove}
        title={`Delete ${poll.title}?`}
        message={`The poll, its questions and ${plural(responseCount, 'answer')} are deleted for good, and the link stops working.`}
      />
      <ConfirmDialog
        open={confirm === 'clear'}
        onClose={() => setConfirm(null)}
        onConfirm={clearAnswers}
        title="Clear every answer?"
        message={`${plural(responseCount, 'answer')} will be deleted for good. Export them first if you need them. People who answered can answer again.`}
        confirmLabel="Clear answers"
        busyLabel="Clearing…"
      />
    </div>
  )
}
