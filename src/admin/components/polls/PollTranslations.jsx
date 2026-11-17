import { useState } from 'react'
import { Languages } from 'lucide-react'
import Panel from '../ui/Panel'
import { LANGUAGES } from '../../lib/polls'

const blankPack = () => ({ title: '', description: '', thank_you_message: '', questions: [] })

export default function PollTranslations({ baseLang, poll, questions, value, onChange, locked = false }) {
  const [lang, setLang] = useState(() => LANGUAGES.find(l => l.value !== baseLang)?.value || 'en')
  const isBase = lang === baseLang
  const pack = value[lang] || blankPack()

  const setPack = changes => onChange({ ...value, [lang]: { ...blankPack(), ...pack, ...changes } })

  const setField = (field, text) => setPack({ [field]: text })

  const setQuestion = (index, changes) => {
    const list = [...(pack.questions || [])]
    while (list.length < questions.length) list.push({ prompt: '', help: '', options: [] })
    list[index] = { ...list[index], ...changes }
    setPack({ questions: list.slice(0, questions.length) })
  }

  const readOnly = isBase || locked
  const shown = questions.map((q, i) => ({
    prompt: isBase ? q.prompt : pack.questions?.[i]?.prompt || '',
    help: isBase ? q.help || '' : pack.questions?.[i]?.help || '',
    options: (q.options || []).map((o, j) => (isBase ? o.label : pack.questions?.[i]?.options?.[j] || '')),
  }))

  return (
    <div className="space-y-4">
      <Panel className="p-4 sm:p-5">
        <div className="flex flex-wrap items-center gap-2">
          <Languages size={16} style={{ color: 'var(--adm-silk-dim)' }} />
          <p className="text-sm flex-1 min-w-[240px]" style={{ color: 'var(--adm-silk-dim)' }}>
            Fill in the wording voters see when they switch language. The {LANGUAGES.find(l => l.value === baseLang)?.label || baseLang} text is the original from the Questions tab; anything left blank falls back to it.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 mt-4">
          {LANGUAGES.map(l => (
            <button key={l.value} type="button" className="adm-btn" data-active={lang === l.value || undefined}
              style={lang === l.value ? { borderColor: 'var(--adm-accent, #2460e7)', color: 'var(--adm-accent, #2460e7)' } : undefined}
              onClick={() => setLang(l.value)}>
              {l.label}{l.value === baseLang ? ' · original' : ''}
            </button>
          ))}
        </div>
      </Panel>

      <Panel className="p-4 sm:p-5 space-y-3">
        <span className="adm-eyebrow">Poll details</span>
        <input className="adm-input" dir="auto" readOnly={readOnly} placeholder={`Title in ${lang.toUpperCase()}`}
          aria-label={`Title in ${lang.toUpperCase()}`} value={isBase ? poll.title : pack.title || ''}
          onChange={e => setField('title', e.target.value)} />
        <input className="adm-input" dir="auto" readOnly={readOnly} placeholder={`Description in ${lang.toUpperCase()}`}
          aria-label={`Description in ${lang.toUpperCase()}`} value={isBase ? poll.description || '' : pack.description || ''}
          onChange={e => setField('description', e.target.value)} />
        <input className="adm-input" dir="auto" readOnly={readOnly} placeholder={`Thank-you note in ${lang.toUpperCase()}`}
          aria-label={`Thank-you note in ${lang.toUpperCase()}`} value={isBase ? poll.thank_you_message || '' : pack.thank_you_message || ''}
          onChange={e => setField('thank_you_message', e.target.value)} />
      </Panel>

      {shown.map((q, i) => (
        <Panel key={questions[i]?.id || i} className="p-4 sm:p-5 space-y-3">
          <span className="adm-eyebrow">Question {i + 1}</span>
          <input className="adm-input" dir="auto" readOnly={readOnly} placeholder={`Question ${i + 1} in ${lang.toUpperCase()}`}
            aria-label={`Question ${i + 1} in ${lang.toUpperCase()}`} value={q.prompt}
            onChange={e => setQuestion(i, { prompt: e.target.value })} />
          <input className="adm-input" dir="auto" readOnly={readOnly} placeholder={`Help text in ${lang.toUpperCase()} (optional)`}
            aria-label={`Help text ${i + 1} in ${lang.toUpperCase()}`} value={q.help}
            onChange={e => setQuestion(i, { help: e.target.value })} />
          {q.options.length > 0 && (
            <div className="space-y-2">
              {q.options.map((label, j) => (
                <input key={j} className="adm-input" dir="auto" readOnly={readOnly} placeholder={`Option ${j + 1} in ${lang.toUpperCase()}`}
                  aria-label={`Option ${j + 1} of question ${i + 1} in ${lang.toUpperCase()}`} value={label}
                  onChange={e => setQuestion(i, { options: q.options.map((o, k) => (k === j ? e.target.value : o)) })} />
              ))}
            </div>
          )}
        </Panel>
      ))}
    </div>
  )
}
