import { ClipboardCheck } from 'lucide-react'
import { ROLES, involves, waitsOn } from '../../lib/media'
import Panel, { PanelHead } from '../ui/Panel'
import EmptyState from '../ui/EmptyState'
import PostCard from './PostCard'

const byDate = (a, b) => (a.publish_at || '9999').localeCompare(b.publish_at || '9999')

/**
 * What each person has to do now. A photographer opening the planner sees the
 * shoots waiting on them, not the whole board.
 */
export default function MyMediaWork({ posts, adminId, canReview, onOpen }) {
  const waiting = posts.filter(p => waitsOn(p, adminId)).sort(byDate)
  const review = canReview ? posts.filter(p => p.status === 'review').sort(byDate) : []
  const later = posts
    .filter(p => involves(p, adminId) && !waitsOn(p, adminId) && p.status !== 'posted')
    .sort(byDate)

  if (!waiting.length && !review.length && !later.length) {
    return (
      <Panel>
        <EmptyState
          icon={ClipboardCheck}
          title="Nothing waiting on you"
          description="Posts show up here when you're named as the writer, photographer, editor or publisher of the stage they're in."
        />
      </Panel>
    )
  }

  const roleOf = post => ROLES.filter(r => post[r.key] === adminId).map(r => r.label).join(', ')

  const section = (title, description, list, showRole) => list.length > 0 && (
    <Panel>
      <PanelHead title={`${title} · ${list.length}`} description={description} />
      <div className="grid gap-2.5 p-3 sm:p-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))' }}>
        {list.map(p => (
          <div key={p.id} className="flex flex-col gap-1">
            <PostCard post={p} onOpen={onOpen} showStage />
            {showRole && <span className="text-[11px] px-1" style={{ color: 'var(--adm-silk-faint)' }}>You: {roleOf(p)}</span>}
          </div>
        ))}
      </div>
    </Panel>
  )

  return (
    <div className="flex flex-col gap-4">
      {section('Waiting on you', 'Your stage is now — finish it and hand the post on.', waiting, true)}
      {section('To review', 'Edited and captioned. Approve it or send it back with a note.', review, false)}
      {section('Coming your way', "You're named on these for a later stage.", later, true)}
    </div>
  )
}
