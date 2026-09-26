import { useEffect, useMemo, useRef, useState } from 'react'
import { Braces } from 'lucide-react'
import { run, supabase } from '../../lib/db'
import { toForm } from '../../lib/format'
import {
  EMAIL_LANGUAGES, SAMPLE_VARIABLES, TEMPLATE_KINDS, TEMPLATE_VARIABLES, renderEmail,
} from '../../../lib/emailTemplate'
import Modal from '../ui/Modal'
import Button from '../ui/Button'
import { CheckField, SelectField, TextArea, TextField } from '../ui/Field'
import { FilterTabs } from '../ui/PageHeader'
import EmailPreview from './EmailPreview'

const BLANK = {
  name: '', kind: 'announcement', subject: '{{title}}',
  header_text: '{{club_name}}', heading: '{{title}}',
  body: 'Hello {{first_name}},\n\n{{content}}',
  button_label: '', button_url: '{{link}}',
  footer: 'You receive this email because you are a member of {{club_name}}.',
  accent_color: '#0F172A', custom_html: '', is_default: false,
}

const MODES = [
  { value: 'layout', label: 'Built-in layout' },
  { value: 'html', label: 'Custom HTML' },
]

/** Fields that accept {{variables}}; the chip bar inserts into whichever was focused last. */
const INSERTABLE = ['subject', 'header_text', 'heading', 'body', 'button_label', 'button_url', 'footer', 'custom_html']

export default function TemplateEditorModal({ open, template, onClose, onSaved, createdBy }) {
  const [form, setForm] = useState(BLANK)
  const [mode, setMode] = useState('layout')
  const [previewLang, setPreviewLang] = useState('en')
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)
  const focused = useRef({ key: 'body', el: null })

  useEffect(() => {
    if (!open) return
    const next = template ? toForm(BLANK, template) : BLANK
    setForm(next)
    setMode(next.custom_html ? 'html' : 'layout')
    setErrors({})
  }, [open, template])

  const set = (key, value) => {
    setForm(f => ({ ...f, [key]: value }))
    setErrors(e => ({ ...e, [key]: undefined }))
  }

  const track = key => ({
    onFocus: e => { focused.current = { key, el: e.target } },
  })

  const insert = variable => {
    const token = `{{${variable}}}`
    const { key, el } = focused.current
    const target = INSERTABLE.includes(key) ? key : 'body'
    const current = form[target] || ''
    const start = el?.selectionStart ?? current.length
    const end = el?.selectionEnd ?? current.length
    set(target, current.slice(0, start) + token + current.slice(end))
    requestAnimationFrame(() => {
      if (!el) return
      el.focus()
      el.setSelectionRange(start + token.length, start + token.length)
    })
  }

  const effective = mode === 'html' ? form : { ...form, custom_html: '' }
  const preview = useMemo(
    () => renderEmail(effective, SAMPLE_VARIABLES, { language: previewLang }),
    [effective.subject, effective.header_text, effective.heading, effective.body, effective.button_label, // eslint-disable-line react-hooks/exhaustive-deps
      effective.button_url, effective.footer, effective.accent_color, effective.custom_html, previewLang]
  )

  const save = async () => {
    const next = {}
    if (!form.name.trim()) next.name = 'Name the template so you can find it in the composer.'
    if (!form.subject.trim()) next.subject = 'A subject line is required.'
    if (mode === 'html' && !form.custom_html.trim()) next.custom_html = 'Paste the HTML, or switch back to the built-in layout.'
    if (mode === 'layout' && !form.body.trim()) next.body = 'Write the message body.'
    if (!/^#[0-9a-f]{6}$/i.test(form.accent_color)) next.accent_color = 'Use a colour like #2563EB.'
    if (Object.keys(next).length) { setErrors(next); return }

    setSaving(true)
    const payload = {
      name: form.name.trim(),
      kind: form.kind,
      subject: form.subject.trim(),
      header_text: form.header_text || null,
      heading: form.heading || null,
      body: form.body || null,
      button_label: form.button_label.trim() || null,
      button_url: form.button_url.trim() || null,
      footer: form.footer || null,
      accent_color: form.accent_color,
      custom_html: mode === 'html' ? form.custom_html : null,
      is_default: form.is_default,
      updated_at: new Date().toISOString(),
    }

    // One default per kind: clear the flag elsewhere before setting it here.
    if (form.is_default) {
      let clear = supabase.from('email_templates').update({ is_default: false }).eq('kind', form.kind)
      if (template) clear = clear.neq('id', template.id)
      await run(clear, { failure: 'The previous default was not cleared.' })
    }

    const { ok } = await run(
      template
        ? supabase.from('email_templates').update(payload).eq('id', template.id)
        : supabase.from('email_templates').insert({ ...payload, created_by: createdBy }),
      { success: template ? 'Template saved.' : 'Template created.', failure: 'The template did not save.' }
    )
    setSaving(false)
    if (ok) onSaved()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="xl"
      title={template ? `Edit “${template.name}”` : 'New email template'}
      description="Type {{variables}} anywhere — they are filled in for each member when the email goes out."
      footer={
        <>
          <Button onClick={onClose} data-dialog-dismiss="true">Cancel</Button>
          <Button variant="primary" onClick={save} busy={saving} busyLabel="Saving…">
            {template ? 'Save template' : 'Create template'}
          </Button>
        </>
      }
    >
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-4 min-w-0">
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField label="Name" required value={form.name} error={errors.name}
              onChange={e => set('name', e.target.value)} placeholder="Workshop invitation" />
            <SelectField label="Used for" value={form.kind} onChange={e => set('kind', e.target.value)}>
              {TEMPLATE_KINDS.map(k => <option key={k.value} value={k.value}>{k.label}</option>)}
            </SelectField>
          </div>

          <TextField label="Subject" required value={form.subject} error={errors.subject}
            onChange={e => set('subject', e.target.value)} {...track('subject')} />

          <FilterTabs options={MODES} value={mode} onChange={setMode} label="Template mode" />

          {mode === 'layout' ? (
            <>
              <div className="grid gap-4 sm:grid-cols-[1fr_auto]">
                <TextField label="Header bar" value={form.header_text} hint="Leave empty to hide the coloured bar."
                  onChange={e => set('header_text', e.target.value)} {...track('header_text')} />
                <TextField label="Colour" type="color" className="w-24" value={form.accent_color}
                  error={errors.accent_color} onChange={e => set('accent_color', e.target.value)} style={{ height: 38, padding: 4 }} />
              </div>
              <TextField label="Heading" value={form.heading}
                onChange={e => set('heading', e.target.value)} {...track('heading')} />
              <TextArea label="Body" rows={7} required value={form.body} error={errors.body}
                hint="A blank line starts a new paragraph. **text** makes it bold."
                onChange={e => set('body', e.target.value)} {...track('body')} />
              <div className="grid gap-4 sm:grid-cols-2">
                <TextField label="Button text" value={form.button_label} hint="Leave empty for no button."
                  onChange={e => set('button_label', e.target.value)} {...track('button_label')} />
                <TextField label="Button link" value={form.button_url}
                  onChange={e => set('button_url', e.target.value)} {...track('button_url')} />
              </div>
              <TextArea label="Footer" rows={2} value={form.footer}
                onChange={e => set('footer', e.target.value)} {...track('footer')} />
            </>
          ) : (
            <TextArea
              label="HTML" rows={16} required value={form.custom_html} error={errors.custom_html}
              hint="Full email HTML with inline styles. Variable values are escaped automatically."
              onChange={e => set('custom_html', e.target.value)} {...track('custom_html')}
              style={{ fontFamily: 'ui-monospace, monospace', fontSize: 12 }} dir="ltr"
            />
          )}

          <div>
            <p className="adm-label flex items-center gap-1.5"><Braces size={13} /> Insert a variable</p>
            <div className="flex flex-wrap gap-1.5">
              {TEMPLATE_VARIABLES.map(v => (
                <button
                  key={v.key}
                  type="button"
                  title={v.label}
                  onMouseDown={e => e.preventDefault()}
                  onClick={() => insert(v.key)}
                  className="adm-data text-[11px] px-2 py-1 rounded-md"
                  style={{ background: 'var(--adm-board-sunk)', border: '1px solid var(--adm-trace)', color: 'var(--adm-silk-dim)' }}
                >
                  {`{{${v.key}}}`}
                </button>
              ))}
            </div>
          </div>

          <div className="pt-4" style={{ borderTop: '1px solid var(--adm-trace)' }}>
            <CheckField
              label="Default for this kind"
              description="Picked automatically when you email members about an announcement or event."
              checked={form.is_default}
              onChange={v => set('is_default', v)}
            />
          </div>
        </div>

        <div className="min-w-0 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <p className="adm-eyebrow">Preview with sample data</p>
            <FilterTabs
              options={EMAIL_LANGUAGES.map(l => ({ value: l.value, label: l.value.toUpperCase() }))}
              value={previewLang}
              onChange={setPreviewLang}
              label="Preview direction"
            />
          </div>
          <EmailPreview subject={preview.subject} html={preview.html} height={600} />
        </div>
      </div>
    </Modal>
  )
}
