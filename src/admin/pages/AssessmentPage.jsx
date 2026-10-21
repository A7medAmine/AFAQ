import { useCallback, useEffect, useMemo, useState } from 'react'
import { ArrowRight, Building2, ClipboardCheck, Eraser, Search, UserX } from 'lucide-react'
import { read, run, supabase, logActivity } from '../lib/db'
import useAdminStore from '../store/adminStore'
import useQueryParam from '../hooks/useQueryParam'
import { formatDateTime } from '../lib/format'
import { hasPermission } from '../lib/permissions'
import {
  INTERVIEW_STATUSES, LEVELS, MAX_SCORE, OPTION_LETTERS, PRACTICAL_STATUSES, PRO_THRESHOLD, QUESTIONS,
  answersOf, blankAnswers, isComplete, levelOf, practicalLabel, scoreOf, statusLabel,
} from '../lib/assessment'
import PageHeader, { FilterTabs } from '../components/ui/PageHeader'
import EmptyState, { ErrorState } from '../components/ui/EmptyState'
import ExportMenu from '../components/ui/ExportMenu'
import Badge from '../components/ui/Badge'
import Button from '../components/ui/Button'
import Panel, { PanelHead } from '../components/ui/Panel'
import { SelectField, TextArea } from '../components/ui/Field'

const STATUS_TONE = { pending: 'wait', completed: 'ok', absent: 'fault' }
const STATUS_FILTERS = [{ value: 'all', label: 'All' }, ...INTERVIEW_STATUSES]

/**
 * Interview tool for a department's members: pick a member, read their
 * motivation letter, score the six questions, and the level follows. Every
 * change saves straight away, so interviewers can share the work.
 */
export default function AssessmentPage() {
  const me = useAdminStore(s => s.adminProfile)
  const seesAll = hasPermission(me?.role?.name, 'hr.manage')

  const [departments, setDepartments] = useState([])
  const [members, setMembers] = useState([])
  const [assessments, setAssessments] = useState({}) // member_id → row
  const [state, setState] = useState({ loading: true, error: null })
  const [membersLoading, setMembersLoading] = useState(false)
  const [selected, setSelected] = useQueryParam('d', '')
  const [currentId, setCurrentId] = useQueryParam('m', '')
  const [filter, setFilter] = useQueryParam('status', 'all')
  const [search, setSearch] = useState('')

  const loadDepartments = useCallback(async () => {
    setState(s => ({ ...s, error: null }))
    const res = seesAll
      ? await read(supabase.from('departments').select('id, name, sort_order').order('sort_order'))
      : await read(supabase.from('department_managers')
        .select('department:departments(id, name, sort_order)').eq('admin_user_id', me?.id))
    if (!res.ok) { setState({ loading: false, error: res.message }); return }
    const list = seesAll ? res.data : (res.data || []).map(r => r.department).filter(Boolean).sort((a, b) => a.sort_order - b.sort_order)
    setDepartments(list || [])
    setState({ loading: false, error: null })
  }, [seesAll, me?.id])

  useEffect(() => { loadDepartments() }, [loadDepartments])

  // The questions are the Tech department's, so it opens first.
  const current = departments.find(d => String(d.id) === selected)
    || departments.find(d => /tech/i.test(d.name)) || departments[0] || null

  const loadMembers = useCallback(async () => {
    if (!current) { setMembers([]); setAssessments({}); return }
    setMembersLoading(true)
    const links = await read(supabase.from('member_departments').select('member_id').eq('department_id', current.id))
    const ids = (links.data || []).map(l => l.member_id)
    if (!ids.length) { setMembers([]); setAssessments({}); setMembersLoading(false); return }
    const [memberRes, assessmentRes] = await Promise.all([
      read(supabase.from('members')
        .select('id, full_name, email, phone, member_code, study_year, department, application:membership_applications(motivation, created_at)')
        .in('id', ids).order('full_name')),
      read(supabase.from('member_assessments').select('*').eq('department_id', current.id)),
    ])
    if (!memberRes.ok) setState({ loading: false, error: memberRes.message })
    setMembers(memberRes.data || [])
    setAssessments(Object.fromEntries((assessmentRes.data || []).map(a => [a.member_id, a])))
    setMembersLoading(false)
  }, [current?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { loadMembers() }, [loadMembers])

  const rows = useMemo(() => members.map(m => {
    const a = assessments[m.id]
    const answers = answersOf(a)
    return {
      ...m,
      assessment: a,
      answers,
      status: a?.status || 'pending',
      practical: a?.practical || 'not_required',
      score: scoreOf(answers),
      complete: isComplete(answers),
      level: levelOf(answers),
    }
  }), [members, assessments])

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase()
    return rows.filter(r => (filter === 'all' || r.status === filter)
      && (!q || r.full_name.toLowerCase().includes(q) || (r.member_code || '').toLowerCase().includes(q) || (r.email || '').toLowerCase().includes(q)))
  }, [rows, filter, search])

  const member = rows.find(r => String(r.id) === currentId) || null

  const save = useCallback(async (target, changes) => {
    const prev = assessments[target.id]
    const next = {
      member_id: target.id,
      department_id: current.id,
      answers: prev ? answersOf(prev) : blankAnswers(),
      status: prev?.status || 'pending',
      practical: prev?.practical || 'not_required',
      notes: prev?.notes ?? null,
      ...changes,
      interviewed_by: me?.user_id,
      updated_at: new Date().toISOString(),
    }
    setAssessments(s => ({ ...s, [target.id]: { ...prev, ...next } })) // optimistic
    const res = await run(
      supabase.from('member_assessments').upsert(next, { onConflict: 'member_id,department_id' }).select().single(),
      { failure: 'The assessment did not save.' },
    )
    if (!res.ok) { setAssessments(s => ({ ...s, [target.id]: prev })); return false }
    setAssessments(s => ({ ...s, [target.id]: res.data }))
    if (changes.status && changes.status !== prev?.status) {
      logActivity('assessment.status', 'member', target.id, { department: current.name, status: changes.status })
    }
    return true
  }, [assessments, current?.id, current?.name, me?.user_id])

  const answer = (target, index, value) => {
    const answers = [...target.answers]
    answers[index] = value
    const changes = { answers }
    if (isComplete(answers)) {
      changes.status = 'completed'
      if (scoreOf(answers) >= PRO_THRESHOLD && target.practical === 'not_required') changes.practical = 'pending'
    }
    save(target, changes)
  }

  const nextPending = () => {
    const i = visible.findIndex(r => r.id === member?.id)
    const order = [...visible.slice(i + 1), ...visible.slice(0, i + 1)]
    const next = order.find(r => r.status === 'pending' && r.id !== member?.id)
    if (next) setCurrentId(String(next.id))
    else useAdminStore.getState().addToast('No pending members left in this list.', 'success')
  }

  const completed = rows.filter(r => r.status === 'completed')
  const levelCount = level => completed.filter(r => r.level === level).length
  const share = n => (completed.length ? `${Math.round((n / completed.length) * 100)}% of completed` : '')

  if (state.error) return <Panel><ErrorState message={state.error} onRetry={loadDepartments} /></Panel>

  return (
    <div>
      <PageHeader
        eyebrow="People"
        title={current ? `${current.name} assessment` : 'Member assessment'}
        description="Interview each member: read their motivation letter, score the six questions, and the level follows. Changes save as you go."
        actions={
          <ExportMenu
            filename={`${(current?.name || 'department').toLowerCase()}-assessment-${new Date().toISOString().slice(0, 10)}`}
            title={current ? `${current.name} member assessment` : 'Member assessment'}
            subtitle={formatDateTime(new Date())}
            headers={['Member no.', 'Name', 'Email', 'Phone', ...QUESTIONS.map((_, i) => `Q${i + 1}`), 'Total', 'Level', 'Status', 'Practical', 'Notes']}
            rows={rows.map(r => [r.member_code, r.full_name, r.email, r.phone, ...r.answers.map(v => v ?? ''),
              r.complete ? r.score : '', r.level || '', statusLabel(r.status), practicalLabel(r.practical), r.assessment?.notes || ''])}
            disabled={!rows.length}
          />
        }
      >
        {departments.length > 1 && (
          <div className="mt-4">
            <FilterTabs
              options={departments.map(d => ({ value: String(d.id), label: d.name }))}
              value={current ? String(current.id) : ''}
              onChange={v => { setSelected(v); setCurrentId('') }}
              label="Department"
            />
          </div>
        )}
      </PageHeader>

      {!state.loading && departments.length === 0 ? (
        <Panel>
          <EmptyState
            icon={Building2}
            title="You do not head a department yet"
            description="HR or a super admin assigns department heads from the HR screen."
          />
        </Panel>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3 mb-5">
            <Stat label="Members" value={rows.length} />
            <Stat label="Completed" value={completed.length} />
            <Stat label="Pending" value={rows.filter(r => r.status === 'pending').length} />
            <Stat label="Absent" value={rows.filter(r => r.status === 'absent').length} />
            {LEVELS.map(level => <Stat key={level} label={level} value={levelCount(level)} hint={share(levelCount(level))} />)}
          </div>

          <div className="grid gap-4 lg:grid-cols-[320px_minmax(0,1fr)] items-start">
            <Panel className="p-3">
              <div className="relative">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--adm-silk-faint)' }} />
                <input
                  className="adm-input"
                  style={{ paddingLeft: 34 }}
                  placeholder="Search members…"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  aria-label="Search members"
                />
              </div>
              <div className="mt-2 flex gap-2">
                <select className="adm-input" value={filter} onChange={e => setFilter(e.target.value)} aria-label="Interview status">
                  {STATUS_FILTERS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
                <Button variant="primary" icon={ArrowRight} onClick={nextPending} className="shrink-0">Next pending</Button>
              </div>
              <div className="adm-scroll mt-3 overflow-y-auto space-y-1" style={{ maxHeight: '62vh' }}>
                {membersLoading && !rows.length && <p className="text-sm p-2" style={{ color: 'var(--adm-silk-faint)' }}>Loading members…</p>}
                {!membersLoading && !visible.length && (
                  <p className="text-sm p-2" style={{ color: 'var(--adm-silk-faint)' }}>
                    {rows.length ? 'Nobody matches this search.' : 'No members in this department.'}
                  </p>
                )}
                {visible.map(r => {
                  const on = r.id === member?.id
                  return (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => setCurrentId(String(r.id))}
                      className="w-full text-left flex items-center justify-between gap-2 px-3 py-2 rounded-lg transition-colors"
                      style={{
                        border: `1px solid ${on ? 'var(--adm-signal-edge)' : 'transparent'}`,
                        background: on ? 'var(--adm-signal-wash)' : undefined,
                      }}
                      aria-current={on || undefined}
                    >
                      <span className="min-w-0">
                        <span className="block text-sm font-semibold adm-truncate">{r.full_name}</span>
                        <span className="adm-data block text-[11px]" style={{ color: 'var(--adm-silk-faint)' }}>
                          {r.member_code || '—'}{r.complete ? ` · ${r.score}/${MAX_SCORE}` : ''}
                        </span>
                      </span>
                      <Badge tone={STATUS_TONE[r.status]}>{statusLabel(r.status)}</Badge>
                    </button>
                  )
                })}
              </div>
            </Panel>

            {member ? (
              <Interview
                key={member.id}
                member={member}
                onAnswer={(i, v) => answer(member, i, v)}
                onSave={changes => save(member, changes)}
                onNext={nextPending}
              />
            ) : (
              <Panel>
                <EmptyState
                  icon={ClipboardCheck}
                  title="Pick a member to interview"
                  description="Choose someone from the list, or press Next pending to start with the first member not yet interviewed."
                />
              </Panel>
            )}
          </div>
        </>
      )}
    </div>
  )
}

function Interview({ member, onAnswer, onSave, onNext }) {
  const [notes, setNotes] = useState(member.assessment?.notes || '')
  const saved = member.assessment?.notes || ''
  const saveNotes = () => (notes !== saved ? onSave({ notes: notes || null }) : Promise.resolve(true))

  return (
    <div className="space-y-4 min-w-0">
      <Panel>
        <PanelHead
          eyebrow={member.member_code || 'Member'}
          title={member.full_name}
          description={[member.email, member.phone, [member.department, member.study_year].filter(Boolean).join(' · ')].filter(Boolean).join(' · ')}
          action={
            <>
              <Badge tone={STATUS_TONE[member.status]}>{statusLabel(member.status)}</Badge>
              <Badge tone={member.complete ? 'signal' : undefined}>
                {member.complete ? `${member.score}/${MAX_SCORE} · ${member.level}` : `${member.score}/${MAX_SCORE} (incomplete)`}
              </Badge>
            </>
          }
        />
        <div className="px-4 sm:px-5 py-4">
          <p className="adm-label">Motivation letter</p>
          {member.application?.motivation
            ? <p className="whitespace-pre-wrap leading-relaxed text-sm">{member.application.motivation}</p>
            : <p className="text-sm" style={{ color: 'var(--adm-silk-faint)' }}>No motivation letter on file.</p>}
        </div>
      </Panel>

      <Panel>
        <PanelHead eyebrow="Interview" title="Questions" description="Each answer scores 0 (A) to 3 (D)." />
        <div className="px-4 sm:px-5 py-4 space-y-4">
          {QUESTIONS.map((q, i) => (
            <fieldset key={q.title} className="rounded-xl p-3.5" style={{ border: '1px solid var(--adm-trace)' }}>
              <legend className="px-1 text-sm font-semibold">Q{i + 1} — {q.title}</legend>
              <p className="text-[13px] mb-2" style={{ color: 'var(--adm-silk-dim)' }}>{q.prompt}</p>
              <div className="space-y-1.5">
                {q.options.map((option, k) => {
                  const on = member.answers[i] === k
                  return (
                    <label
                      key={k}
                      className="flex items-start gap-2.5 px-3 py-2 rounded-lg cursor-pointer text-[13px]"
                      style={{
                        border: `1px solid ${on ? 'var(--adm-signal-edge)' : 'var(--adm-trace)'}`,
                        background: on ? 'var(--adm-signal-wash)' : undefined,
                      }}
                    >
                      <input
                        type="radio"
                        name={`q${i}`}
                        className="mt-0.5"
                        checked={on}
                        onChange={() => onAnswer(i, k)}
                      />
                      <span><b>{OPTION_LETTERS[k]}</b> ({k}) — {option}</span>
                    </label>
                  )
                })}
              </div>
            </fieldset>
          ))}
        </div>
      </Panel>

      <Panel>
        <PanelHead eyebrow="Outcome" title="Result" />
        <div className="px-4 sm:px-5 py-4 space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <SelectField label="Practical verification" value={member.practical} onChange={e => onSave({ practical: e.target.value })}>
              {PRACTICAL_STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
            </SelectField>
            <SelectField label="Interview status" value={member.status} onChange={e => onSave({ status: e.target.value })}>
              {INTERVIEW_STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
            </SelectField>
          </div>
          <TextArea label="Notes" rows={3} value={notes} onChange={e => setNotes(e.target.value)} onBlur={saveNotes} />
          {member.complete && member.score >= PRO_THRESHOLD && (
            <p className="text-[13px]" style={{ color: 'var(--adm-wait)' }}>
              Pro candidate: give a short practical task before assigning advanced responsibilities.
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            <Button variant="primary" icon={ArrowRight} onClick={async () => { if (await saveNotes()) onNext() }}>Save &amp; next pending</Button>
            <Button icon={UserX} onClick={async () => { if (await onSave({ status: 'absent', notes: notes || null })) onNext() }}>Mark absent</Button>
            <Button icon={Eraser} onClick={() => onSave({ answers: blankAnswers(), status: 'pending', practical: 'not_required' })}>Clear answers</Button>
          </div>
        </div>
      </Panel>
    </div>
  )
}

function Stat({ label, value, hint }) {
  return (
    <Panel className="p-4">
      <p className="adm-eyebrow">{label}</p>
      <p className="mt-2 adm-data text-[22px] font-semibold">{value}</p>
      {hint && <p className="text-[11px] mt-0.5" style={{ color: 'var(--adm-silk-faint)' }}>{hint}</p>}
    </Panel>
  )
}
