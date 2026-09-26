import { useEffect, useMemo, useRef, useState } from 'react'
import { AlertTriangle, CheckCircle2, FlaskConical, Send, Users } from 'lucide-react'
import { api, read, supabase } from '../../lib/db'
import { runCampaign } from '../../lib/email'
import { MEMBER_STATUSES } from '../../lib/hr'
import useAdminStore from '../../store/adminStore'
import {
  EMAIL_LANGUAGES, buildSharedVariables, memberVariables, renderEmail,
} from '../../../lib/emailTemplate'
import Modal from '../ui/Modal'
import Button from '../ui/Button'
import { Field, SelectField, TextArea, TextField } from '../ui/Field'
import { FilterTabs } from '../ui/PageHeader'
import EmailPreview from './EmailPreview'

const SITE_URL = import.meta.env.VITE_APP_URL || (typeof window !== 'undefined' ? window.location.origin : '')

const statusLabel = value => MEMBER_STATUSES.find(s => s.value === value)?.label || value

/** Toggle chip used for statuses, teams and groups. */
function Chip({ active, onClick, children }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className="text-[12px] font-semibold px-2.5 py-1 rounded-lg transition-colors"
      style={{
        border: `1px solid ${active ? 'var(--adm-signal-edge)' : 'var(--adm-trace)'}`,
        background: active ? 'var(--adm-signal-wash)' : 'transparent',
        color: active ? 'var(--adm-signal)' : 'var(--adm-silk-dim)',
      }}
    >
      {children}
    </button>
  )
}

const toggleIn = (list, value) => (list.includes(value) ? list.filter(v => v !== value) : [...list, value])

/**
 * Email members about an announcement, an event, or a free-form message
 * (`source` null). Picks the kind's default template, filters the audience,
 * previews exactly what a member receives, then drives the send in batches.
 *
 * @param source  { type: 'announcement' | 'event', record } or null
 */
export default function ComposeEmailModal({ open, onClose, source, onSent }) {
  const adminProfile = useAdminStore(s => s.adminProfile)
  const addToast = useAdminStore(s => s.addToast)
  const kind = source?.type || 'general'

  const [templates, setTemplates] = useState([])
  const [options, setOptions] = useState(null)
  const [loadError, setLoadError] = useState(null)

  const [templateId, setTemplateId] = useState('')
  const [language, setLanguage] = useState('en')
  const [subject, setSubject] = useState('')
  const [message, setMessage] = useState({ title: '', content: '' })
  const [audience, setAudience] = useState({ statuses: ['active'], teams: [], groupIds: [] })
  const [count, setCount] = useState(null)
  const [errors, setErrors] = useState({})

  const [testing, setTesting] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [progress, setProgress] = useState(null)   // campaign row while/after sending
  const abortRef = useRef(null)

  // Load templates and audience options each time the composer opens.
  useEffect(() => {
    if (!open) return
    setLanguage('en'); setSubject(''); setMessage({ title: '', content: '' })
    setAudience({ statuses: ['active'], teams: [], groupIds: [] })
    setErrors({}); setConfirming(false); setProgress(null); setLoadError(null)

    let cancelled = false
    Promise.all([
      read(supabase.from('email_templates').select('*').order('name')),
      api('/api/email/audience-options'),
    ]).then(([list, opts]) => {
      if (cancelled) return
      if (!list.ok) { setLoadError(list.message); return }
      if (!opts.ok) { setLoadError(opts.message); return }
      const rows = list.data || []
      setTemplates(rows)
      setOptions(opts.data)
      const pick = rows.find(t => t.kind === kind && t.is_default) || rows.find(t => t.kind === kind) || rows[0]
      setTemplateId(pick ? String(pick.id) : '')
    })
    return () => { cancelled = true }
  }, [open, kind])

  // Recount recipients whenever the audience changes (debounced).
  useEffect(() => {
    if (!open) return
    setCount(null)
    const id = setTimeout(async () => {
      const { ok, data } = await api('/api/email/audience/count', { method: 'POST', body: { audience } })
      if (ok) setCount(data)
    }, 300)
    return () => clearTimeout(id)
  }, [open, audience])

  const template = templates.find(t => String(t.id) === templateId)
  // Templates for this kind first, then the rest.
  const sortedTemplates = useMemo(
    () => [...templates].sort((a, b) => (a.kind === kind ? 0 : 1) - (b.kind === kind ? 0 : 1)),
    [templates, kind]
  )

  const preview = useMemo(() => {
    if (!template) return null
    const vars = {
      ...buildSharedVariables({ sourceType: source?.type, record: source?.record, message, language, siteUrl: SITE_URL }),
      ...memberVariables({ full_name: adminProfile?.full_name || 'Member' }),
    }
    return renderEmail(subject.trim() ? { ...template, subject } : template, vars, { language })
  }, [template, subject, source, message, language, adminProfile])

  const missingTranslation = source?.record && language !== 'en' && !source.record[`title_${language}`]

  const payload = () => ({
    templateId: Number(templateId),
    sourceType: source?.type || null,
    sourceId: source?.record?.id || null,
    message: source ? undefined : message,
    language,
    subject: subject.trim() || undefined,
    audience,
  })

  const validate = () => {
    const next = {}
    if (!templateId) next.template = 'Choose a template.'
    if (!source) {
      if (!message.title.trim()) next.title = 'Give the email a title.'
      if (!message.content.trim()) next.content = 'Write the message.'
    }
    setErrors(next)
    return !Object.keys(next).length
  }

  const sendTest = async () => {
    if (!validate()) return
    setTesting(true)
    const { ok, data, message: error } = await api('/api/email/test', { method: 'POST', body: payload() })
    setTesting(false)
    addToast(ok ? `Test sent to ${data.to}.` : error, ok ? 'success' : 'error')
  }

  const send = async () => {
    if (!validate()) return
    setConfirming(false)
    const created = await api('/api/email/campaigns', { method: 'POST', body: payload() })
    if (!created.ok) { addToast(created.message, 'error'); return }
    setProgress({ ...created.data, remaining: created.data.total })

    const controller = new AbortController()
    abortRef.current = controller
    const result = await runCampaign(created.data.id, { onProgress: setProgress, signal: controller.signal })
    abortRef.current = null
    if (result.aborted) return
    if (result.error) {
      addToast(`${result.error} The rest is paused — resume it from the Email page.`, 'error')
      return
    }
    addToast(
      result.failed
        ? `Sent to ${result.sent} of ${result.total}. ${result.failed} failed — retry them from the Email page.`
        : `Sent to ${result.sent} members.`,
      result.failed ? 'error' : 'success'
    )
    onSent?.(result)
  }

  const close = () => {
    if (abortRef.current) {
      abortRef.current.abort()
      addToast('Sending paused. Resume it from the Email page.', 'error')
    }
    onClose()
  }

  const sending = progress && progress.remaining > 0
  const finished = progress && !progress.remaining
  const recipients = count?.count ?? 0

  const title = source
    ? `Email members about “${source.record.title_en}”`
    : 'Email members'

  return (
    <Modal
      open={open}
      onClose={close}
      size="xl"
      title={title}
      description="Everyone in the audience gets their own copy, addressed by name."
      footer={
        finished ? (
          <Button variant="primary" onClick={onClose}>Done</Button>
        ) : sending ? (
          <Button onClick={close}>Pause and close</Button>
        ) : confirming ? (
          <>
            <span className="mr-auto text-sm" style={{ color: 'var(--adm-silk-dim)' }}>
              This emails {recipients} {recipients === 1 ? 'member' : 'members'} now. It cannot be unsent.
            </span>
            <Button onClick={() => setConfirming(false)}>Back</Button>
            <Button variant="primary" icon={Send} onClick={send}>Yes, send it</Button>
          </>
        ) : (
          <>
            <Button icon={FlaskConical} onClick={sendTest} busy={testing} busyLabel="Sending test…"
              disabled={!template || options?.emailConfigured === false}>
              Send me a test
            </Button>
            <Button
              variant="primary"
              icon={Send}
              disabled={!template || !recipients || options?.emailConfigured === false}
              onClick={() => validate() && setConfirming(true)}
            >
              {count === null ? 'Send…' : `Send to ${recipients} ${recipients === 1 ? 'member' : 'members'}`}
            </Button>
          </>
        )
      }
    >
      {loadError ? (
        <p className="text-sm" style={{ color: 'var(--adm-fault)' }}>{loadError}</p>
      ) : progress ? (
        <SendProgress campaign={progress} />
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="space-y-4 min-w-0">
            {options?.emailConfigured === false && (
              <p className="flex items-start gap-2 text-sm rounded-lg p-3"
                style={{ background: 'var(--adm-fault-wash)', color: 'var(--adm-fault)' }}>
                <AlertTriangle size={15} className="shrink-0 mt-0.5" />
                Email is not configured on the server. Set SMTP_USER and SMTP_PASS, then restart it.
              </p>
            )}

            <div className="grid gap-4 sm:grid-cols-[1fr_auto]">
              <SelectField label="Template" required value={templateId} error={errors.template}
                onChange={e => setTemplateId(e.target.value)}>
                {!templates.length && <option value="">No templates yet</option>}
                {sortedTemplates.map(t => (
                  <option key={t.id} value={t.id}>
                    {t.name}{t.kind !== kind ? ` (${t.kind})` : ''}{t.is_default && t.kind === kind ? ' — default' : ''}
                  </option>
                ))}
              </SelectField>
              <Field label="Language">
                {() => (
                  <FilterTabs
                    options={EMAIL_LANGUAGES.map(l => ({ value: l.value, label: l.value.toUpperCase() }))}
                    value={language}
                    onChange={setLanguage}
                    label="Email language"
                  />
                )}
              </Field>
            </div>
            {missingTranslation && (
              <p className="text-xs -mt-2" style={{ color: 'var(--adm-wait)' }}>
                This {source.type} has no {language.toUpperCase()} translation; the English text is used.
              </p>
            )}

            {!source && (
              <>
                <TextField label="Title" required value={message.title} error={errors.title}
                  dir={language === 'ar' ? 'rtl' : 'ltr'}
                  onChange={e => { setMessage(m => ({ ...m, title: e.target.value })); setErrors(x => ({ ...x, title: undefined })) }} />
                <TextArea label="Message" required rows={6} value={message.content} error={errors.content}
                  dir={language === 'ar' ? 'rtl' : 'ltr'}
                  onChange={e => { setMessage(m => ({ ...m, content: e.target.value })); setErrors(x => ({ ...x, content: undefined })) }} />
              </>
            )}

            <TextField
              label="Subject"
              value={subject}
              placeholder={template ? preview?.subject : ''}
              hint="Leave empty to use the template's subject."
              dir={language === 'ar' ? 'rtl' : 'ltr'}
              onChange={e => setSubject(e.target.value)}
            />

            <div className="space-y-3 pt-4" style={{ borderTop: '1px solid var(--adm-trace)' }}>
              <p className="adm-label flex items-center gap-1.5" style={{ marginBottom: 0 }}>
                <Users size={13} /> Audience
              </p>
              <AudienceRow label="Status">
                {(options?.statuses?.length ? options.statuses : MEMBER_STATUSES.map(s => ({ value: s.value }))).map(s => (
                  <Chip key={s.value} active={audience.statuses.includes(s.value)}
                    onClick={() => setAudience(a => ({ ...a, statuses: toggleIn(a.statuses, s.value) }))}>
                    {statusLabel(s.value)}{s.count !== undefined ? ` · ${s.count}` : ''}
                  </Chip>
                ))}
              </AudienceRow>
              {!!options?.teams?.length && (
                <AudienceRow label="Team" hint="None selected = every team">
                  {options.teams.map(t => (
                    <Chip key={t.value} active={audience.teams.includes(t.value)}
                      onClick={() => setAudience(a => ({ ...a, teams: toggleIn(a.teams, t.value) }))}>
                      {t.value} · {t.count}
                    </Chip>
                  ))}
                </AudienceRow>
              )}
              {!!options?.groups?.length && (
                <AudienceRow label="Group" hint="None selected = no group filter">
                  {options.groups.map(g => (
                    <Chip key={g.id} active={audience.groupIds.includes(g.id)}
                      onClick={() => setAudience(a => ({ ...a, groupIds: toggleIn(a.groupIds, g.id) }))}>
                      {g.name} · {g.count}
                    </Chip>
                  ))}
                </AudienceRow>
              )}
              <p className="adm-data text-[12px]" style={{ color: 'var(--adm-silk-dim)' }}>
                {count === null
                  ? 'Counting…'
                  : `${count.count} ${count.count === 1 ? 'recipient' : 'recipients'}`
                    + (count.optedOut ? ` · ${count.optedOut} opted out` : '')}
              </p>
            </div>
          </div>

          <div className="min-w-0 space-y-3">
            <p className="adm-eyebrow">Preview — as {adminProfile?.full_name?.split(/\s+/)[0] || 'a member'} would see it</p>
            {preview
              ? <EmailPreview subject={preview.subject} html={preview.html} height={560} />
              : <p className="text-sm" style={{ color: 'var(--adm-silk-faint)' }}>Choose a template to preview the email.</p>}
          </div>
        </div>
      )}
    </Modal>
  )
}

function AudienceRow({ label, hint, children }) {
  return (
    <div>
      <p className="text-xs mb-1.5" style={{ color: 'var(--adm-silk-faint)' }}>
        {label}{hint && <span> — {hint}</span>}
      </p>
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </div>
  )
}

export function SendProgress({ campaign }) {
  const done = campaign.sent + campaign.failed
  const pct = campaign.total ? Math.round((done / campaign.total) * 100) : 0
  const finished = !campaign.remaining
  return (
    <div className="py-6 max-w-md mx-auto text-center">
      {finished ? (
        <CheckCircle2 size={34} className="mx-auto mb-3" style={{ color: campaign.failed ? 'var(--adm-wait)' : 'var(--adm-ok)' }} />
      ) : (
        <Send size={30} className="mx-auto mb-3" style={{ color: 'var(--adm-signal)' }} />
      )}
      <p className="text-base font-semibold" style={{ color: 'var(--adm-silk)' }}>
        {finished ? 'Finished' : 'Sending…'}
      </p>
      <p className="adm-data text-sm mt-1" style={{ color: 'var(--adm-silk-dim)' }}>
        {campaign.sent} sent · {campaign.failed} failed · {campaign.total} total
      </p>
      <div className="mt-4 h-2 rounded-full overflow-hidden" style={{ background: 'var(--adm-board-sunk)' }}
        role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
        <div className="h-full transition-all" style={{ width: `${pct}%`, background: 'var(--adm-signal)' }} />
      </div>
      {!finished && (
        <p className="text-xs mt-3" style={{ color: 'var(--adm-silk-faint)' }}>
          Keep this window open. If you close it, sending pauses and can be resumed from the Email page.
        </p>
      )}
    </div>
  )
}
