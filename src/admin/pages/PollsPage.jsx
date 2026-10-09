import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CalendarClock, Plus, Users, Vote } from 'lucide-react'
import { read, supabase } from '../lib/db'
import useQueryParam from '../hooks/useQueryParam'
import { formatDateTime, plural } from '../lib/format'
import { AUDIENCES, POLL_STATUSES, STATE_BADGE, pollState } from '../lib/polls'
import PageHeader, { FilterTabs } from '../components/ui/PageHeader'
import EmptyState, { ErrorState } from '../components/ui/EmptyState'
import Button from '../components/ui/Button'
import Badge from '../components/ui/Badge'
import Panel from '../components/ui/Panel'
import Skeleton from '../components/ui/Skeleton'
import NewPollModal from '../components/polls/NewPollModal'

/**
 * Polls and short surveys. Each one gets a link that works without an
 * account, so it can go on social media, a poster QR code or a slide.
 */
export default function PollsPage() {
  const navigate = useNavigate()
  const [polls, setPolls] = useState([])
  const [state, setState] = useState({ loading: true, error: null })
  const [status, setStatus] = useQueryParam('status', 'all')
  const [creating, setCreating] = useState(false)

  const load = useCallback(async () => {
    setState(s => ({ ...s, error: null }))
    const res = await read(
      supabase.from('polls')
        .select('*, questions:poll_questions(count), responses:poll_responses(count)')
        .order('created_at', { ascending: false })
    )
    if (!res.ok) { setState({ loading: false, error: res.message }); return }
    setPolls((res.data || []).map(p => {
      const responseCount = p.responses?.[0]?.count || 0
      return { ...p, responseCount, questionCount: p.questions?.[0]?.count || 0, state: pollState(p, responseCount) }
    }))
    setState({ loading: false, error: null })
  }, [])

  useEffect(() => { load() }, [load])

  // Scheduled and full polls sit with the open ones; they are still live links.
  const group = p => (p.state === 'draft' ? 'draft' : p.state === 'closed' ? 'closed' : 'open')
  const shown = useMemo(() => (status === 'all' ? polls : polls.filter(p => group(p) === status)), [polls, status])
  const filterOptions = [
    { value: 'all', label: 'All', count: polls.length },
    ...POLL_STATUSES.map(s => ({ ...s, count: polls.filter(p => group(p) === s.value).length })),
  ]

  return (
    <div>
      <PageHeader
        eyebrow="Publish"
        title="Polls"
        description="Ask members or the public a question and share the link anywhere. Results update as answers come in."
        actions={<Button variant="primary" icon={Plus} onClick={() => setCreating(true)}>New poll</Button>}
      />

      <div className="mb-5">
        <FilterTabs options={filterOptions} value={status} onChange={setStatus} label="Poll status" />
      </div>

      {state.error ? (
        <Panel><ErrorState message={state.error} onRetry={load} /></Panel>
      ) : state.loading ? (
        <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {[0, 1, 2].map(i => <Panel key={i} className="p-5"><Skeleton style={{ height: 18, width: '60%' }} /><Skeleton style={{ height: 12, width: '40%', marginTop: 12 }} /></Panel>)}
        </div>
      ) : shown.length === 0 ? (
        <Panel>
          <EmptyState
            icon={Vote}
            title={polls.length ? 'No polls here' : 'No polls yet'}
            description={polls.length ? 'Try another filter.' : 'Create one, add questions, then share its link or QR code.'}
            action={!polls.length && <Button variant="primary" icon={Plus} onClick={() => setCreating(true)}>New poll</Button>}
          />
        </Panel>
      ) : (
        <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {shown.map(poll => <PollCard key={poll.id} poll={poll} onOpen={() => navigate(`/admin/polls/${poll.id}`)} />)}
        </div>
      )}

      <NewPollModal open={creating} onClose={() => setCreating(false)} onCreated={(id, starter) => { setCreating(false); navigate(`/admin/polls/${id}`, { state: { starter } }) }} />
    </div>
  )
}

function PollCard({ poll, onOpen }) {
  const badge = STATE_BADGE[poll.state]
  const audience = AUDIENCES.find(a => a.value === poll.audience)
  const cap = poll.max_responses
  return (
    <Panel as="button" type="button" onClick={onOpen} className="p-5 text-left w-full transition-colors hover:brightness-[1.02]" style={{ cursor: 'pointer' }}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="adm-eyebrow mb-1">{poll.audience === 'members' ? 'Members' : 'Public'} · {plural(poll.questionCount, 'question')}</p>
          <p className="text-[15px] font-semibold adm-truncate" dir="auto">{poll.title}</p>
          {poll.description && <p className="text-xs mt-0.5 adm-truncate" dir="auto" style={{ color: 'var(--adm-silk-dim)' }}>{poll.description}</p>}
        </div>
        <Badge tone={badge.tone}>{badge.label}</Badge>
      </div>

      <div className="mt-4">
        <div className="flex items-center justify-between text-xs mb-1.5" style={{ color: 'var(--adm-silk-faint)' }}>
          <span className="inline-flex items-center gap-1"><Users size={12} /> {plural(poll.responseCount, 'answer')}{cap ? ` of ${cap}` : ''}</span>
          <span title={audience?.label}>{poll.language.toUpperCase()}</span>
        </div>
        {cap ? (
          <div className="rounded-full overflow-hidden" style={{ height: 6, background: 'var(--adm-board-sunk)' }}>
            <div style={{ width: `${Math.min(100, Math.round((poll.responseCount / cap) * 100))}%`, height: '100%', background: 'var(--adm-signal)' }} />
          </div>
        ) : null}
      </div>

      {(poll.closes_at || poll.opens_at) && (
        <p className="inline-flex items-center gap-1 text-[11.5px] mt-4" style={{ color: 'var(--adm-silk-faint)' }}>
          <CalendarClock size={12} />
          {poll.state === 'scheduled' ? `Opens ${formatDateTime(poll.opens_at)}` : poll.closes_at ? `${poll.state === 'closed' ? 'Closed' : 'Closes'} ${formatDateTime(poll.closes_at)}` : ''}
        </p>
      )}
    </Panel>
  )
}
