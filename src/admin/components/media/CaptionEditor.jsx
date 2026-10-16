import { useState } from 'react'
import { Copy, Languages, Loader2, Scissors, Sparkles, Wand2 } from 'lucide-react'
import { api } from '../../lib/db'
import useAdminStore from '../../store/adminStore'
import { CAPTION_LANGS, platformOf } from '../../lib/media'
import Button from '../ui/Button'
import { TextArea } from '../ui/Field'

const TONES = [
  { value: 'friendly', label: 'Friendly' },
  { value: 'hype', label: 'Hype' },
  { value: 'informative', label: 'Informative' },
  { value: 'formal', label: 'Formal' },
]

const toast = (message, type) => useAdminStore.getState().addToast(message, type)

/**
 * The caption in three languages with the hashtags under them. Counts are
 * checked against every platform the post goes to, since X cuts at 280 and
 * Instagram hides everything after the first ~125 characters behind "more".
 *
 * @param form      the post form (caption_ar, caption_fr, caption_en, hashtags, …)
 * @param set       (key, value) => void
 * @param context   what the AI needs: title, brief, format, platforms, event
 */
export default function CaptionEditor({ form, set, context, snippets = [] }) {
  const [lang, setLang] = useState('ar')
  const [tone, setTone] = useState('friendly')
  const [notes, setNotes] = useState('')
  const [busy, setBusy] = useState(null) // 'write' | 'improve' | 'translate' | 'shorten'

  const current = CAPTION_LANGS.find(l => l.value === lang)
  const text = form[current.column] || ''
  const tagLength = (form.hashtags || '').trim().length
  const total = text.trim().length + (tagLength ? tagLength + 2 : 0)
  const platforms = (context.platforms || []).map(platformOf).filter(Boolean)

  const writeAll = async () => {
    setBusy('write')
    const { ok, data, message } = await api('/api/media/captions', {
      method: 'POST',
      body: { ...context, tone, notes },
    })
    setBusy(null)
    if (!ok) { toast(message || 'The AI did not answer.', 'error'); return }
    if (data.ar) set('caption_ar', data.ar)
    if (data.fr) set('caption_fr', data.fr)
    if (data.en) set('caption_en', data.en)
    if (data.hashtags && !(form.hashtags || '').trim()) set('hashtags', data.hashtags)
    toast('Captions written in all three languages. Read them before posting.')
  }

  const rewrite = async action => {
    if (!text.trim()) return
    setBusy(action)
    if (action === 'translate') {
      const targets = CAPTION_LANGS.filter(l => l.value !== lang)
      const results = await Promise.all(targets.map(t => api('/api/media/rewrite', {
        method: 'POST', body: { text, action: 'translate', targetLang: t.value },
      })))
      results.forEach((r, i) => r.ok && set(targets[i].column, r.data.text))
      const failed = results.find(r => !r.ok)
      if (failed) toast(failed.message || 'Not every language came back.', 'error')
    } else {
      const { ok, data, message } = await api('/api/media/rewrite', { method: 'POST', body: { text, action } })
      if (ok) set(current.column, data.text)
      else toast(message || 'The AI did not answer.', 'error')
    }
    setBusy(null)
  }

  const insert = body => {
    const filled = body
      .replaceAll('{event}', context.event?.title || '{event}')
      .replaceAll('{date}', context.event?.date || '{date}')
      .replaceAll('{location}', context.event?.location || '{location}')
    set(current.column, text.trim() ? `${text.trimEnd()}\n\n${filled}` : filled)
  }

  const addTags = body => {
    const have = new Set((form.hashtags || '').split(/\s+/).filter(Boolean).map(t => t.toLowerCase()))
    const extra = body.split(/\s+/).filter(t => t && !have.has(t.toLowerCase()))
    set('hashtags', [form.hashtags?.trim(), ...extra].filter(Boolean).join(' '))
  }

  const copy = async () => {
    try {
      await navigator.clipboard.writeText([text.trim(), (form.hashtags || '').trim()].filter(Boolean).join('\n\n'))
      toast('Caption and hashtags copied.')
    } catch {
      toast('Copy is blocked in this browser. Select the text and copy it by hand.', 'error')
    }
  }

  const templates = snippets.filter(s => s.kind === 'template' || s.kind === 'cta')
  const tagSets = snippets.filter(s => s.kind === 'hashtags')

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end gap-2 p-3 rounded-xl" style={{ background: 'var(--adm-board-sunk)', border: '1px solid var(--adm-trace)' }}>
        <label className="flex flex-col gap-1">
          <span className="adm-label" style={{ marginBottom: 0 }}>Tone</span>
          <select className="adm-input" style={{ height: 36, width: 'auto' }} value={tone} onChange={e => setTone(e.target.value)}>
            {TONES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-1 flex-1" style={{ minWidth: 160 }}>
          <span className="adm-label" style={{ marginBottom: 0 }}>Instructions (optional)</span>
          <input className="adm-input" style={{ height: 36 }} value={notes} onChange={e => setNotes(e.target.value)}
            placeholder="Mention the prize, keep it short…" />
        </label>
        <Button size="sm" variant="primary" icon={Sparkles} busy={busy === 'write'} busyLabel="Writing…" onClick={writeAll}
          disabled={!!busy || !(context.title || context.brief)}>
          Write all 3 with AI
        </Button>
      </div>

      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div role="tablist" aria-label="Caption language" className="flex gap-0.5">
          {CAPTION_LANGS.map(l => (
            <button key={l.value} type="button" role="tab" aria-selected={lang === l.value} onClick={() => setLang(l.value)}
              className="px-2.5 h-7 rounded-md text-[12px] font-semibold"
              style={{
                background: lang === l.value ? 'var(--adm-signal-wash)' : 'transparent',
                color: lang === l.value ? 'var(--adm-signal)' : 'var(--adm-silk-faint)',
              }}>
              {l.label}{form[l.column] ? ' ●' : ''}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-0.5">
          {[
            ['improve', Wand2, 'Improve this caption'],
            ['shorten', Scissors, 'Shorten to fit X'],
            ['translate', Languages, 'Rewrite it in the other two languages'],
          ].map(([action, Icon, label]) => (
            <button key={action} type="button" className="adm-icon-btn" style={{ width: 28, height: 28, opacity: text.trim() ? 1 : 0.4 }}
              disabled={!text.trim() || !!busy} onClick={() => rewrite(action)} title={label} aria-label={label}>
              {busy === action ? <Loader2 size={14} className="adm-spin" /> : <Icon size={14} />}
            </button>
          ))}
          <button type="button" className="adm-icon-btn" style={{ width: 28, height: 28 }} onClick={copy}
            title="Copy caption with hashtags" aria-label="Copy caption with hashtags">
            <Copy size={14} />
          </button>
        </div>
      </div>

      <textarea
        className="adm-input"
        rows={8}
        dir={current.dir}
        value={text}
        onChange={e => set(current.column, e.target.value)}
        placeholder={lang === 'ar' ? 'اكتب التعليق هنا…' : lang === 'fr' ? 'Écris la légende ici…' : 'Write the caption here…'}
        aria-label={`Caption in ${current.label}`}
      />

      {platforms.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {platforms.map(p => {
            const over = total > p.limit
            const folded = text.trim().length > p.fold
            return (
              <span key={p.value} className="adm-data text-[11px] px-1.5 py-0.5 rounded"
                title={folded ? `${p.label} shows the first ${p.fold} characters before "more"` : undefined}
                style={{
                  background: over ? 'var(--adm-fault-wash)' : 'var(--adm-board-sunk)',
                  color: over ? 'var(--adm-fault)' : 'var(--adm-silk-dim)',
                }}>
                {p.short} {total}/{p.limit}{folded && !over ? ' · cut at ' + p.fold : ''}
              </span>
            )
          })}
        </div>
      )}

      {templates.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[11px] font-semibold" style={{ color: 'var(--adm-silk-faint)' }}>Insert:</span>
          {templates.map(s => (
            <button key={s.id} type="button" className="adm-badge" style={{ cursor: 'pointer' }} onClick={() => insert(s.body)} title={s.body}>
              {s.label}
            </button>
          ))}
        </div>
      )}

      <TextArea label="Hashtags" rows={2} value={form.hashtags || ''} onChange={e => set('hashtags', e.target.value)}
        hint="Shared by all three captions and added under each one when copied." />
      {tagSets.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 -mt-1">
          <span className="text-[11px] font-semibold" style={{ color: 'var(--adm-silk-faint)' }}>Add set:</span>
          {tagSets.map(s => (
            <button key={s.id} type="button" className="adm-badge" style={{ cursor: 'pointer' }} onClick={() => addTags(s.body)} title={s.body}>
              + {s.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
