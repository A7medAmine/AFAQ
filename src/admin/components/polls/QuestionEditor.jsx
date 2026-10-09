import { AlertCircle, ArrowDown, ArrowUp, Copy, Plus, Trash2, X } from 'lucide-react'
import { QUESTION_TYPES, blankQuestion } from '../../lib/polls'
import Button, { IconButton } from '../ui/Button'
import Panel from '../ui/Panel'
import { CheckField } from '../ui/Field'

/**
 * The questions of one poll, edited in place. Nothing saves until the page's
 * Save button; `locked` shows them read-only once answers exist.
 */
export default function QuestionEditor({ questions, onChange, errors = {}, locked = false }) {
  const update = (key, changes) => onChange(questions.map(q => (q.key === key ? { ...q, ...changes } : q)))
  const remove = key => onChange(questions.filter(q => q.key !== key))
  const move = (index, delta) => {
    const next = [...questions]
    const [q] = next.splice(index, 1)
    next.splice(index + delta, 0, q)
    onChange(next)
  }
  const duplicate = index => {
    const next = [...questions]
    next.splice(index + 1, 0, { ...questions[index], key: crypto.randomUUID(), options: [...questions[index].options] })
    onChange(next)
  }
  const add = type => onChange([...questions, blankQuestion(type)])

  return (
    <div className="space-y-4">
      {errors._poll && (
        <p className="flex items-center gap-1.5 text-sm" style={{ color: 'var(--adm-fault)' }}><AlertCircle size={14} /> {errors._poll}</p>
      )}

      {questions.map((q, index) => (
        <Panel key={q.key} className="p-4 sm:p-5">
          <fieldset disabled={locked} className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="adm-eyebrow">Question {index + 1}</span>
              <select
                className="adm-input"
                style={{ width: 'auto', height: 32, paddingTop: 0, paddingBottom: 0 }}
                aria-label="Question type"
                value={q.type}
                onChange={e => {
                  const type = e.target.value
                  const choice = type === 'single' || type === 'multiple'
                  update(q.key, {
                    type,
                    options: choice ? (q.options.length ? q.options : ['', '']) : [],
                    scale_max: type === 'rating' ? q.scale_max || 5 : null,
                  })
                }}
              >
                {QUESTION_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
              {!locked && (
                <div className="flex items-center gap-1 ml-auto">
                  <IconButton icon={ArrowUp} label="Move up" disabled={index === 0} onClick={() => move(index, -1)} />
                  <IconButton icon={ArrowDown} label="Move down" disabled={index === questions.length - 1} onClick={() => move(index, 1)} />
                  <IconButton icon={Copy} label="Duplicate question" onClick={() => duplicate(index)} />
                  <IconButton icon={Trash2} label="Delete question" danger onClick={() => remove(q.key)} />
                </div>
              )}
            </div>

            <input
              className="adm-input text-[15px] font-medium"
              dir="auto"
              placeholder="Write the question"
              aria-label={`Question ${index + 1}`}
              aria-invalid={errors[q.key] ? 'true' : undefined}
              value={q.prompt}
              onChange={e => update(q.key, { prompt: e.target.value })}
            />
            <input
              className="adm-input text-[13px]"
              dir="auto"
              placeholder="Help text (optional)"
              aria-label={`Help text for question ${index + 1}`}
              value={q.help}
              onChange={e => update(q.key, { help: e.target.value })}
            />

            {(q.type === 'single' || q.type === 'multiple') && (
              <div className="space-y-2">
                {q.options.map((option, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <span aria-hidden="true" style={{
                      width: 14, height: 14, flexShrink: 0, border: '2px solid var(--adm-trace-strong)',
                      borderRadius: q.type === 'single' ? 999 : 4,
                    }} />
                    <input
                      className="adm-input"
                      dir="auto"
                      placeholder={`Option ${i + 1}`}
                      aria-label={`Option ${i + 1}`}
                      value={option}
                      onChange={e => update(q.key, { options: q.options.map((o, j) => (j === i ? e.target.value : o)) })}
                      onKeyDown={e => {
                        // Enter on the last option starts the next one.
                        if (e.key === 'Enter' && i === q.options.length - 1 && option.trim()) {
                          e.preventDefault()
                          update(q.key, { options: [...q.options, ''] })
                        }
                      }}
                    />
                    {!locked && (
                      <IconButton icon={X} label={`Remove option ${i + 1}`} disabled={q.options.length <= 2}
                        onClick={() => update(q.key, { options: q.options.filter((_, j) => j !== i) })} />
                    )}
                  </div>
                ))}
                {!locked && (
                  <Button size="sm" variant="ghost" icon={Plus} onClick={() => update(q.key, { options: [...q.options, ''] })}>Add option</Button>
                )}
              </div>
            )}

            {q.type === 'multiple' && (
              <div className="flex flex-wrap items-center gap-3 text-[13px]" style={{ color: 'var(--adm-silk-dim)' }}>
                <label className="flex items-center gap-2">
                  At least
                  <input type="number" min={1} max={q.options.length} className="adm-input" style={{ width: 72 }}
                    value={q.min_choices ?? ''} placeholder="—"
                    onChange={e => update(q.key, { min_choices: e.target.value ? Number(e.target.value) : null })} />
                </label>
                <label className="flex items-center gap-2">
                  At most
                  <input type="number" min={1} max={q.options.length} className="adm-input" style={{ width: 72 }}
                    value={q.max_choices ?? ''} placeholder="—"
                    onChange={e => update(q.key, { max_choices: e.target.value ? Number(e.target.value) : null })} />
                </label>
              </div>
            )}

            {q.type === 'rating' && (
              <label className="flex items-center gap-2 text-[13px]" style={{ color: 'var(--adm-silk-dim)' }}>
                Scale from 1 to
                <select className="adm-input" style={{ width: 'auto' }} value={q.scale_max || 5}
                  onChange={e => update(q.key, { scale_max: Number(e.target.value) })}>
                  <option value={5}>5 (stars)</option>
                  <option value={10}>10</option>
                </select>
              </label>
            )}

            {q.type === 'text' && (
              <p className="text-xs" style={{ color: 'var(--adm-silk-faint)' }}>
                Written answers are only shown to admins, never on the public results.
              </p>
            )}

            <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
              <CheckField label="Required" checked={q.required} disabled={locked} onChange={v => update(q.key, { required: v })} />
              {errors[q.key] && (
                <p className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--adm-fault)' }}><AlertCircle size={13} /> {errors[q.key]}</p>
              )}
            </div>
          </fieldset>
        </Panel>
      ))}

      {!locked && (
        <div className="flex flex-wrap gap-2">
          {QUESTION_TYPES.map(t => (
            <Button key={t.value} size="sm" icon={Plus} onClick={() => add(t.value)} title={t.hint}>{t.label}</Button>
          ))}
        </div>
      )}
    </div>
  )
}
