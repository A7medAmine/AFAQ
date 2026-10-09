import { useMemo } from 'react'
import { BarChart3, Star } from 'lucide-react'
import { formatDateTime, plural } from '../../lib/format'
import { questionTypeLabel, tally } from '../../lib/polls'
import Panel, { PanelHead } from '../ui/Panel'
import EmptyState from '../ui/EmptyState'

/** Totals per question, where answers came from, and the written answers. */
export default function PollResults({ questions, responses, answers }) {
  const results = useMemo(() => tally(questions, responses, answers), [questions, responses, answers])
  const sources = useMemo(() => {
    const counts = new Map()
    for (const r of responses) counts.set(r.source || 'direct', (counts.get(r.source || 'direct') || 0) + 1)
    return [...counts.entries()].sort((a, b) => b[1] - a[1])
  }, [responses])
  const last = responses.length ? responses[responses.length - 1].created_at : null

  if (!responses.length) {
    return (
      <Panel>
        <EmptyState icon={BarChart3} title="No answers yet" description="Share the link or QR code. Answers show up here as they come in." />
      </Panel>
    )
  }

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Tile label="Answers" value={responses.length} />
        <Tile label="Last answer" value={formatDateTime(last)} small />
        <Panel className="p-4 col-span-2">
          <p className="adm-eyebrow mb-2">Where they came from</p>
          <div className="flex flex-wrap gap-1.5">
            {sources.map(([source, count]) => (
              <span key={source} className="text-[12px] px-2 py-0.5 rounded-md" style={{ background: 'var(--adm-panel-raise)', color: 'var(--adm-silk-dim)' }}>
                {source === 'direct' ? 'Direct link' : source} · <span className="adm-data">{count}</span>
              </span>
            ))}
          </div>
        </Panel>
      </div>

      {results.map((r, i) => (
        <Panel key={r.question.id}>
          <PanelHead
            eyebrow={`Q${i + 1} · ${questionTypeLabel(r.question.type)}`}
            title={<span dir="auto">{r.question.prompt}</span>}
            description={`${plural(r.answered, 'person', 'people')} answered${r.question.required ? '' : ' (optional)'}`}
            action={r.question.type === 'rating' && r.average !== null && (
              <span className="inline-flex items-center gap-1 text-[15px] font-semibold adm-data">
                <Star size={15} style={{ color: 'var(--adm-wait)' }} /> {r.average.toFixed(1)} / {r.question.scale_max || 5}
              </span>
            )}
          />
          <div className="p-5">
            {r.question.type === 'text' ? (
              r.texts.length ? (
                <ul className="space-y-2 max-h-[420px] overflow-auto">
                  {r.texts.map((t, j) => (
                    <li key={j} className="text-sm p-3 rounded-lg" style={{ background: 'var(--adm-board-sunk)' }}>
                      <p dir="auto" style={{ whiteSpace: 'pre-wrap' }}>{t.text}</p>
                      <p className="text-[11px] mt-1" style={{ color: 'var(--adm-silk-faint)' }}>{formatDateTime(t.at)}</p>
                    </li>
                  ))}
                </ul>
              ) : <p className="text-sm" style={{ color: 'var(--adm-silk-faint)' }}>No written answers yet.</p>
            ) : (
              <Bars rows={r.counts} total={r.question.type === 'multiple' ? r.answered : r.counts.reduce((s, c) => s + c.count, 0)} />
            )}
          </div>
        </Panel>
      ))}
    </div>
  )
}

function Tile({ label, value, small }) {
  return (
    <Panel className="p-4">
      <p className="adm-eyebrow mb-1">{label}</p>
      <p className={`${small ? 'text-[14px]' : 'text-[24px]'} font-semibold adm-data`}>{value}</p>
    </Panel>
  )
}

/** Percentages are of the people who answered, so multiple choice can pass 100% in total. */
function Bars({ rows, total }) {
  const top = Math.max(...rows.map(r => r.count), 0)
  return (
    <ul className="space-y-3">
      {rows.map(row => {
        const pct = total ? Math.round((row.count / total) * 100) : 0
        return (
          <li key={row.id ?? row.label}>
            <div className="flex items-baseline justify-between gap-3 text-[13px] mb-1">
              <span dir="auto" className="min-w-0" style={{ fontWeight: row.count === top && top > 0 ? 600 : 400 }}>{row.label}</span>
              <span className="adm-data shrink-0" style={{ color: 'var(--adm-silk-dim)' }}>{row.count} · {pct}%</span>
            </div>
            <div className="rounded-full overflow-hidden" style={{ height: 8, background: 'var(--adm-board-sunk)' }}>
              <div style={{ width: `${pct}%`, height: '100%', background: row.count === top && top > 0 ? 'var(--adm-signal)' : 'var(--adm-trace-strong)', transition: 'width .3s' }} />
            </div>
          </li>
        )
      })}
    </ul>
  )
}
