import { useState } from 'react'
import { Plus } from 'lucide-react'
import { STAGES } from '../../lib/media'
import PostCard from './PostCard'

/**
 * One column per stage. Drag a card to hand it on; the drawer has the same
 * moves as buttons for phones, where dragging is awkward.
 */
export default function MediaBoard({ posts, people, loading, onOpen, onMove, onNew }) {
  const [over, setOver] = useState(null)

  const drop = (e, status) => {
    e.preventDefault()
    setOver(null)
    const id = Number(e.dataTransfer.getData('text/media-post'))
    const post = posts.find(p => p.id === id)
    if (post) onMove(post, status)
  }

  return (
    <div className="adm-scroll flex gap-3 overflow-x-auto pb-3" style={{ minHeight: 420 }}>
      {STAGES.map(stage => {
        const list = posts.filter(p => p.status === stage.value)
        // Posted keeps the latest on top; everything else runs by publish date.
        if (stage.value === 'posted') list.reverse()
        return (
          <section
            key={stage.value}
            aria-label={stage.label}
            onDragOver={e => { e.preventDefault(); setOver(stage.value) }}
            onDragLeave={() => setOver(o => (o === stage.value ? null : o))}
            onDrop={e => drop(e, stage.value)}
            className="flex flex-col shrink-0 rounded-2xl p-2"
            style={{
              width: 264,
              background: over === stage.value ? 'var(--adm-signal-wash)' : 'var(--adm-board-sunk)',
              border: `1px solid ${over === stage.value ? 'var(--adm-signal-edge)' : 'var(--adm-trace)'}`,
            }}
          >
            <header className="flex items-center justify-between px-1.5 py-1 mb-1.5">
              <span className="text-[13px] font-semibold" style={{ color: 'var(--adm-silk)' }}>
                {stage.label}
                <span className="adm-data text-[11px] ml-1.5" style={{ color: 'var(--adm-silk-faint)' }}>{list.length}</span>
              </span>
              {['idea', 'caption'].includes(stage.value) && (
                <button type="button" className="adm-icon-btn" style={{ width: 26, height: 26 }}
                  onClick={() => onNew(stage.value)} aria-label={`New post in ${stage.label}`} title="New post">
                  <Plus size={14} />
                </button>
              )}
            </header>
            <div className="flex flex-col gap-2 flex-1">
              {loading
                ? [0, 1].map(i => <div key={i} className="adm-skeleton rounded-xl" style={{ height: 92 }} />)
                : list.map(post => (
                  <PostCard key={post.id} post={post} people={people} onOpen={onOpen} draggable
                    compact={stage.value === 'idea'} />
                ))}
              {!loading && list.length === 0 && (
                <p className="text-[12px] text-center py-6" style={{ color: 'var(--adm-silk-faint)' }}>Nothing here</p>
              )}
            </div>
          </section>
        )
      })}
    </div>
  )
}
