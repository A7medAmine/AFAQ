import { useId, useState } from 'react'
import { AlertCircle, Sparkles, Languages, Loader2 } from 'lucide-react'
import { api } from '../../lib/db'
import useAdminStore from '../../store/adminStore'

/**
 * Label, control, hint and error wired together with real ids — the old forms
 * had bare <label> tags next to inputs with nothing connecting them, so screen
 * readers and click-to-focus both missed.
 */
export function Field({ label, hint, error, required, children, className = '' }) {
  const id = useId()
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined

  return (
    <div className={className}>
      {label && (
        <label className="adm-label" htmlFor={id}>
          {label}
          {required && <span style={{ color: 'var(--adm-fault)' }} aria-hidden="true"> *</span>}
        </label>
      )}
      {children({ id, 'aria-describedby': describedBy, 'aria-invalid': error ? 'true' : undefined, required })}
      {error ? (
        <p id={`${id}-error`} className="flex items-center gap-1.5 mt-1.5 text-xs" style={{ color: 'var(--adm-fault)' }}>
          <AlertCircle size={13} /> {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="mt-1.5 text-xs" style={{ color: 'var(--adm-silk-faint)' }}>{hint}</p>
      ) : null}
    </div>
  )
}

export function TextField({ label, hint, error, required, className, ...input }) {
  return (
    <Field label={label} hint={hint} error={error} required={required} className={className}>
      {a11y => <input className="adm-input" {...a11y} {...input} />}
    </Field>
  )
}

export function TextArea({ label, hint, error, required, className, rows = 3, ...input }) {
  return (
    <Field label={label} hint={hint} error={error} required={required} className={className}>
      {a11y => <textarea className="adm-input" rows={rows} {...a11y} {...input} />}
    </Field>
  )
}

export function SelectField({ label, hint, error, required, className, children, ...select }) {
  return (
    <Field label={label} hint={hint} error={error} required={required} className={className}>
      {a11y => <select className="adm-input" {...a11y} {...select}>{children}</select>}
    </Field>
  )
}

export function CheckField({ label, description, checked, onChange, disabled }) {
  return (
    <label
      className="flex items-start gap-2.5 cursor-pointer select-none"
      style={{ opacity: disabled ? 0.55 : 1 }}
    >
      <input
        type="checkbox"
        className="adm-check mt-0.5"
        checked={!!checked}
        onChange={e => onChange(e.target.checked)}
        disabled={disabled}
      />
      <span>
        <span className="text-sm font-medium" style={{ color: 'var(--adm-silk)' }}>{label}</span>
        {description && (
          <span className="block text-xs mt-0.5" style={{ color: 'var(--adm-silk-faint)' }}>{description}</span>
        )}
      </span>
    </label>
  )
}

/**
 * Three-language fields collapse into one control with language tabs. The old
 * forms rendered EN/AR/FR side by side, which made every modal three times as
 * wide as it needed to be and buried the field you actually wanted.
 */
export function LocalizedField({
  label, prefix, values, onChange, lang, onLangChange,
  multiline = false, rows = 4, error, required, dir, ai = true,
}) {
  const langs = ['en', 'ar', 'fr']
  const key = `${prefix}_${lang}`
  const text = values[key] || ''
  const [busy, setBusy] = useState(null) // null | 'improve' | 'translate'
  const shared = {
    className: 'adm-input',
    value: text,
    onChange: e => onChange(key, e.target.value),
    dir: dir ?? (lang === 'ar' ? 'rtl' : 'ltr'),
    'aria-invalid': error ? 'true' : undefined,
  }

  const assist = async (action) => {
    if (!text.trim() || busy) return
    setBusy(action)
    try {
      if (action === 'improve') {
        const { ok, data, message } = await api('/api/ai/content-assist', {
          method: 'POST', body: { text, action: 'improve' },
        })
        if (ok) onChange(key, data.text)
        else useAdminStore.getState().addToast(message || 'The AI assistant did not respond.', 'error')
      } else {
        const targets = langs.filter(l => l !== lang)
        const results = await Promise.all(
          targets.map(targetLang => api('/api/ai/content-assist', {
            method: 'POST', body: { text, action: 'translate', targetLang },
          }))
        )
        results.forEach((res, i) => {
          if (res.ok) onChange(`${prefix}_${targets[i]}`, res.data.text)
        })
        const failed = results.find(r => !r.ok)
        if (failed) useAdminStore.getState().addToast(failed.message || 'Translation did not complete for all languages.', 'error')
      }
    } finally {
      setBusy(null)
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-1.5 gap-3">
        <span className="adm-label" style={{ marginBottom: 0 }}>
          {label}
          {required && <span style={{ color: 'var(--adm-fault)' }} aria-hidden="true"> *</span>}
        </span>
        <div className="flex items-center gap-2">
          {ai && (
            <div className="flex items-center gap-0.5">
              <button
                type="button"
                onClick={() => assist('improve')}
                disabled={!text.trim() || !!busy}
                title="Improve this text with AI"
                aria-label="Improve this text with AI"
                className="adm-icon-btn"
                style={{ width: 22, height: 22, opacity: !text.trim() ? 0.4 : 1 }}
              >
                {busy === 'improve' ? <Loader2 size={13} className="adm-spin" /> : <Sparkles size={13} />}
              </button>
              <button
                type="button"
                onClick={() => assist('translate')}
                disabled={!text.trim() || !!busy}
                title={`Translate this text into the other languages`}
                aria-label="Translate this text into the other languages"
                className="adm-icon-btn"
                style={{ width: 22, height: 22, opacity: !text.trim() ? 0.4 : 1 }}
              >
                {busy === 'translate' ? <Loader2 size={13} className="adm-spin" /> : <Languages size={13} />}
              </button>
            </div>
          )}
          <div role="tablist" aria-label={`${label} language`} className="flex gap-0.5">
            {langs.map(code => {
              const filled = !!values[`${prefix}_${code}`]
              const active = lang === code
              return (
                <button
                  key={code}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => onLangChange(code)}
                  className="adm-pixel px-2 py-1 rounded-md text-[10px] uppercase tracking-widest transition-colors"
                  style={{
                    background: active ? 'var(--adm-signal-wash)' : 'transparent',
                    color: active ? 'var(--adm-signal)' : filled ? 'var(--adm-silk-dim)' : 'var(--adm-silk-faint)',
                  }}
                >
                  {code}
                  {/* A filled translation is marked, so you can see at a glance
                      which languages are still missing. */}
                  {filled && <span aria-hidden="true"> ·</span>}
                </button>
              )
            })}
          </div>
        </div>
      </div>
      {multiline ? <textarea rows={rows} {...shared} /> : <input {...shared} />}
      {error && (
        <p className="flex items-center gap-1.5 mt-1.5 text-xs" style={{ color: 'var(--adm-fault)' }}>
          <AlertCircle size={13} /> {error}
        </p>
      )}
    </div>
  )
}
