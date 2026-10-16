import { useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { isLate, platformOf, stageOf } from '../../lib/media'
import Panel from '../ui/Panel'
import Button, { IconButton } from '../ui/Button'

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const MONTH = new Intl.DateTimeFormat('en-GB', { month: 'long', year: 'numeric' })
const TIME = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false })

const dayKey = d => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`

/** Six weeks starting on the Monday on or before the 1st. */
function monthGrid(month) {
  const first = new Date(month.getFullYear(), month.getMonth(), 1)
  const start = new Date(first)
  start.setDate(first.getDate() - ((first.getDay() + 6) % 7))
  return Array.from({ length: 42 }, (_, i) => {
    const d = new Date(start)
    d.setDate(start.getDate() + i)
    return d
  })
}

/**
 * What goes out when. Undated posts sit under the grid so they don't get
 * forgotten; clicking an empty day starts a post on that day at 18:00.
 */
export default function MediaCalendar({ posts, onOpen, onNew }) {
  const [month, setMonth] = useState(() => {
    const now = new Date()
    return new Date(now.getFullYear(), now.getMonth(), 1)
  })

  const byDay = useMemo(() => {
    const map = new Map()
    posts.forEach(p => {
      if (!p.publish_at) return
      const key = dayKey(new Date(p.publish_at))
      map.set(key, [...(map.get(key) || []), p])
    })
    return map
  }, [posts])

  const undated = posts.filter(p => !p.publish_at && p.status !== 'posted')
  const days = monthGrid(month)
  const today = dayKey(new Date())
  const shift = n => setMonth(m => new Date(m.getFullYear(), m.getMonth() + n, 1))

  return (
    <div className="flex flex-col gap-4">
      <Panel className="p-3 sm:p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-[15px]">{MONTH.format(month)}</h2>
          <div className="flex items-center gap-1">
            <IconButton icon={ChevronLeft} label="Previous month" onClick={() => shift(-1)} />
            <Button size="sm" onClick={() => { const n = new Date(); setMonth(new Date(n.getFullYear(), n.getMonth(), 1)) }}>Today</Button>
            <IconButton icon={ChevronRight} label="Next month" onClick={() => shift(1)} />
          </div>
        </div>
        <div className="adm-scroll overflow-x-auto">
          <div className="grid grid-cols-7 gap-1" style={{ minWidth: 720 }}>
            {WEEKDAYS.map(d => (
              <div key={d} className="text-[11px] font-semibold px-1.5 pb-1" style={{ color: 'var(--adm-silk-faint)' }}>{d}</div>
            ))}
            {days.map(d => {
              const list = (byDay.get(dayKey(d)) || []).sort((a, b) => a.publish_at.localeCompare(b.publish_at))
              const inMonth = d.getMonth() === month.getMonth()
              return (
                <div
                  key={d.toISOString()}
                  className="flex flex-col gap-1 p-1 rounded-lg"
                  style={{
                    minHeight: 104,
                    background: inMonth ? 'var(--adm-panel-hover)' : 'transparent',
                    border: `1px solid ${dayKey(d) === today ? 'var(--adm-signal)' : 'var(--adm-trace)'}`,
                    opacity: inMonth ? 1 : 0.5,
                  }}
                >
                  <button
                    type="button"
                    className="text-left text-[11px] adm-data px-1 rounded"
                    style={{ color: 'var(--adm-silk-dim)' }}
                    title="New post on this day"
                    onClick={() => {
                      const at = new Date(d)
                      at.setHours(18, 0, 0, 0)
                      onNew(at.toISOString())
                    }}
                  >
                    {d.getDate()}
                  </button>
                  {list.map(p => {
                    const stage = stageOf(p.status)
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => onOpen(p)}
                        className="text-left text-[11px] leading-tight px-1.5 py-1 rounded-md"
                        title={`${p.title} — ${stage.label}`}
                        style={{
                          background: 'var(--adm-panel)',
                          borderLeft: `3px solid var(--adm-${isLate(p) ? 'fault' : stage.tone === 'neutral' ? 'trace-strong' : stage.tone})`,
                          color: 'var(--adm-silk)',
                        }}
                      >
                        <span className="adm-data" style={{ color: 'var(--adm-silk-faint)' }}>{TIME.format(new Date(p.publish_at))} </span>
                        <span className="font-semibold">{p.title}</span>
                        <span className="block" style={{ color: 'var(--adm-silk-faint)' }}>
                          {(p.platforms || []).map(x => platformOf(x)?.short || x).join(' · ')}
                        </span>
                      </button>
                    )
                  })}
                </div>
              )
            })}
          </div>
        </div>
      </Panel>

      {undated.length > 0 && (
        <Panel className="p-3 sm:p-4">
          <h2 className="text-[14px] mb-2">No publish date yet <span className="adm-data text-[12px]" style={{ color: 'var(--adm-silk-faint)' }}>{undated.length}</span></h2>
          <div className="flex flex-wrap gap-1.5">
            {undated.map(p => (
              <button key={p.id} type="button" onClick={() => onOpen(p)} className="adm-badge" style={{ cursor: 'pointer' }}>
                {p.title} · {stageOf(p.status).label}
              </button>
            ))}
          </div>
        </Panel>
      )}
    </div>
  )
}
