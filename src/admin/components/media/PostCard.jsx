import { CalendarClock, Image as ImageIcon } from 'lucide-react'
import { formatDateTime, initials } from '../../lib/format'
import { formatLabel, isLate, platformOf, stageOf } from '../../lib/media'
import Badge from '../ui/Badge'

/** The picture that best shows where a post is: the final cut, else a raw shot. */
export function coverOf(post) {
  const assets = post.assets || []
  return (assets.find(a => a.kind === 'final') || assets.find(a => a.kind === 'raw'))?.url || null
}

export function PersonChip({ person, label }) {
  if (!person) return null
  const name = person.full_name || person.email
  return (
    <span
      title={label ? `${label}: ${name}` : name}
      className="inline-flex items-center justify-center shrink-0 text-[10px] font-bold"
      style={{
        width: 22, height: 22, borderRadius: 999,
        background: 'var(--adm-signal-wash)', color: 'var(--adm-signal)',
        border: '1px solid var(--adm-signal-edge)',
      }}
    >
      {initials(name)}
    </span>
  )
}

/** One post on the board, the calendar or the "my work" list. */
export default function PostCard({ post, people = [], onOpen, draggable, showStage = false, compact = false }) {
  const owner = stageOf(post.status).owner
  const ownerPerson = owner ? people.find(p => p.id === post[owner]) : null
  const cover = coverOf(post)
  const late = isLate(post)

  return (
    <button
      type="button"
      draggable={draggable}
      onDragStart={e => {
        e.dataTransfer.setData('text/media-post', String(post.id))
        e.dataTransfer.effectAllowed = 'move'
      }}
      onClick={() => onOpen(post)}
      className="adm-hover w-full text-left flex flex-col gap-2 p-2.5 rounded-xl"
      style={{
        background: 'var(--adm-panel)',
        border: `1px solid ${late ? 'var(--adm-fault)' : 'var(--adm-trace)'}`,
        boxShadow: 'var(--adm-shadow)',
        cursor: draggable ? 'grab' : 'pointer',
      }}
    >
      {!compact && cover && (
        <img src={cover} alt="" loading="lazy" className="w-full object-cover rounded-lg"
          style={{ aspectRatio: '4 / 3', background: 'var(--adm-board-sunk)' }} />
      )}
      <span className="text-[13px] font-semibold leading-snug" style={{ color: 'var(--adm-silk)' }}>{post.title}</span>
      {post.event && (
        <span className="text-[11px] adm-truncate" style={{ color: 'var(--adm-silk-faint)' }}>{post.event.title_en}</span>
      )}
      <span className="flex flex-wrap items-center gap-1">
        {showStage && <Badge tone={stageOf(post.status).tone}>{stageOf(post.status).label}</Badge>}
        <Badge>{formatLabel(post.format)}</Badge>
        {(post.platforms || []).map(p => (
          <span key={p} className="adm-data text-[10px] px-1 rounded" title={platformOf(p)?.label}
            style={{ background: 'var(--adm-board-sunk)', color: 'var(--adm-silk-dim)' }}>
            {platformOf(p)?.short || p}
          </span>
        ))}
      </span>
      <span className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-1 text-[11px] adm-data"
          style={{ color: late ? 'var(--adm-fault)' : 'var(--adm-silk-faint)' }}>
          <CalendarClock size={12} />
          {post.publish_at ? formatDateTime(post.publish_at) : 'No date'}
        </span>
        <span className="flex items-center gap-1">
          {!cover && (post.assets || []).length === 0 && post.needs_shoot && ['shooting', 'editing'].includes(post.status) && (
            <ImageIcon size={13} style={{ color: 'var(--adm-wait)' }} aria-label="No photos yet" />
          )}
          <PersonChip person={ownerPerson} label={stageOf(post.status).label} />
        </span>
      </span>
    </button>
  )
}
