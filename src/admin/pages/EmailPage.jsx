import { useCallback, useEffect, useState } from 'react'
import {
  Copy, FileText, Loader2, Mail, Pencil, Play, Plus, RotateCcw, Send, Star, Trash2, Users,
} from 'lucide-react'
import { api, logActivity, read, run, supabase } from '../lib/db'
import { CAMPAIGN_STATUS, runCampaign } from '../lib/email'
import { formatDateTime, relativeTime } from '../lib/format'
import useAdminStore from '../store/adminStore'
import useQueryParam from '../hooks/useQueryParam'
import { TEMPLATE_KINDS } from '../../lib/emailTemplate'
import PageHeader, { FilterTabs } from '../components/ui/PageHeader'
import Panel from '../components/ui/Panel'
import Drawer from '../components/ui/Drawer'
import ConfirmDialog from '../components/ui/ConfirmDialog'
import EmptyState, { ErrorState } from '../components/ui/EmptyState'
import Button, { IconButton } from '../components/ui/Button'
import Badge from '../components/ui/Badge'
import { SkeletonPanel } from '../components/ui/Skeleton'
import ComposeEmailModal from '../components/email/ComposeEmailModal'
import TemplateEditorModal from '../components/email/TemplateEditorModal'

const TABS = [
  { value: 'sent', label: 'Sent' },
  { value: 'templates', label: 'Templates' },
]

const SOURCE_LABEL = { announcement: 'Announcement', event: 'Event' }
const kindLabel = kind => TEMPLATE_KINDS.find(k => k.value === kind)?.label || kind

export default function EmailPage() {
  const adminProfile = useAdminStore(s => s.adminProfile)
  const addToast = useAdminStore(s => s.addToast)
  const [tab, setTab] = useQueryParam('tab', 'sent')

  const [campaigns, setCampaigns] = useState([])
  const [templates, setTemplates] = useState([])
  const [state, setState] = useState({ loading: true, error: null })

  const [composing, setComposing] = useState(false)
  const [editor, setEditor] = useState(null)          // { template | null }
  const [pendingDelete, setPendingDelete] = useState(null)
  const [recipientsOf, setRecipientsOf] = useState(null)
  const [running, setRunning] = useState({})          // campaign id → true while this tab drives it

  const load = useCallback(async () => {
    setState(s => ({ ...s, error: null }))
    const [c, t] = await Promise.all([
      read(supabase.from('email_campaigns').select('*').order('created_at', { ascending: false }).limit(100)),
      read(supabase.from('email_templates').select('*').order('kind').order('name')),
    ])
    if (!c.ok || !t.ok) { setState({ loading: false, error: c.message || t.message }); return }
    setCampaigns(c.data || [])
    setTemplates(t.data || [])
    setState({ loading: false, error: null })
  }, [])

  useEffect(() => { load() }, [load])

  const patchCampaign = row => setCampaigns(list => list.map(c => (c.id === row.id ? { ...c, ...row } : c)))

  const drive = async campaign => {
    setRunning(r => ({ ...r, [campaign.id]: true }))
    const result = await runCampaign(campaign.id, { onProgress: patchCampaign })
    setRunning(r => ({ ...r, [campaign.id]: false }))
    if (result.error) addToast(result.error, 'error')
    else addToast(result.failed ? `${result.failed} still failed.` : 'All emails sent.', result.failed ? 'error' : 'success')
  }

  const retry = async campaign => {
    const { ok, data, message } = await api(`/api/email/campaigns/${campaign.id}/retry`, { method: 'POST' })
    if (!ok) { addToast(message, 'error'); return }
    patchCampaign(data)
    drive(data)
  }

  const duplicate = async template => {
    const { id, created_at, updated_at, ...rest } = template
    const { ok } = await run(
      supabase.from('email_templates').insert({ ...rest, name: `${template.name} (copy)`, is_default: false, created_by: adminProfile?.user_id }),
      { success: 'Template copied.', failure: 'The copy was not created.' }
    )
    if (ok) load()
  }

  const removeTemplate = async () => {
    const { ok } = await run(
      supabase.from('email_templates').delete().eq('id', pendingDelete.id),
      { success: 'Template deleted.', failure: 'The template was not deleted.' }
    )
    if (ok) {
      logActivity('deleted', 'email_templates', pendingDelete.id, { name: pendingDelete.name })
      setPendingDelete(null)
      load()
    }
  }

  const tabOptions = TABS.map(t => ({ ...t, count: t.value === 'sent' ? campaigns.length : templates.length }))

  return (
    <div>
      <PageHeader
        eyebrow="Publish"
        title="Email"
        description="Notify members by email. Announcements and events also have an email button of their own."
        actions={
          <>
            <Button icon={FileText} onClick={() => setEditor({ template: null })}>New template</Button>
            <Button variant="primary" icon={Send} onClick={() => setComposing(true)}>Email members</Button>
          </>
        }
      />

      <div className="mb-4">
        <FilterTabs options={tabOptions} value={tab} onChange={setTab} label="Email section" />
      </div>

      {state.error ? (
        <Panel><ErrorState message={state.error} onRetry={load} /></Panel>
      ) : state.loading ? (
        <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <SkeletonPanel key={i} rows={2} />)}</div>
      ) : tab === 'templates' ? (
        templates.length === 0 ? (
          <Panel>
            <EmptyState icon={FileText} title="No templates yet"
              description="A template sets the look of an email: colours, heading, body and button."
              action={<Button variant="primary" icon={Plus} onClick={() => setEditor({ template: null })}>New template</Button>} />
          </Panel>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {templates.map(t => (
              <article key={t.id} className="adm-panel p-4 flex items-start gap-3">
                <span className="shrink-0 rounded-md mt-0.5" style={{ width: 10, height: 34, background: t.accent_color }} aria-hidden="true" />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <h3 className="text-[15px] leading-tight">{t.name}</h3>
                    <Badge>{kindLabel(t.kind)}</Badge>
                    {t.is_default && <Badge tone="signal"><Star size={11} /> Default</Badge>}
                    {t.custom_html && <Badge tone="wait">HTML</Badge>}
                  </div>
                  <p className="adm-data text-[12px] adm-truncate" style={{ color: 'var(--adm-silk-dim)' }}>{t.subject}</p>
                </div>
                <div className="flex items-center gap-0.5 shrink-0">
                  <IconButton icon={Copy} label="Duplicate" onClick={() => duplicate(t)} />
                  <IconButton icon={Pencil} label="Edit" onClick={() => setEditor({ template: t })} />
                  <IconButton icon={Trash2} label="Delete" danger onClick={() => setPendingDelete(t)} />
                </div>
              </article>
            ))}
          </div>
        )
      ) : campaigns.length === 0 ? (
        <Panel>
          <EmptyState icon={Mail} title="Nothing sent yet"
            description="Emails you send to members show up here with their delivery results."
            action={<Button variant="primary" icon={Send} onClick={() => setComposing(true)}>Email members</Button>} />
        </Panel>
      ) : (
        <div className="space-y-3">
          {campaigns.map(c => {
            const status = CAMPAIGN_STATUS[c.status] || { tone: 'neutral', label: c.status }
            const busy = running[c.id]
            const unfinished = c.status === 'queued' || c.status === 'sending'
            const pct = c.total ? Math.round(((c.sent + c.failed) / c.total) * 100) : 0
            return (
              <article key={c.id} className="adm-panel p-4 sm:p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2 mb-1.5">
                      <h3 className="text-[15px] leading-tight">{c.subject}</h3>
                      <Badge tone={status.tone}>{busy ? 'Sending' : status.label}</Badge>
                      {c.source_type && <Badge>{SOURCE_LABEL[c.source_type] || c.source_type}</Badge>}
                      <Badge>{c.language.toUpperCase()}</Badge>
                    </div>
                    <p className="adm-data text-[12px]" style={{ color: 'var(--adm-silk-dim)' }}>
                      {c.sent} sent · {c.failed} failed · {c.total} total
                    </p>
                    {(unfinished || busy) && (
                      <div className="mt-2 h-1.5 rounded-full overflow-hidden max-w-sm" style={{ background: 'var(--adm-board-sunk)' }}>
                        <div className="h-full transition-all" style={{ width: `${pct}%`, background: 'var(--adm-signal)' }} />
                      </div>
                    )}
                    <p className="adm-data text-[11px] mt-2" style={{ color: 'var(--adm-silk-faint)' }} title={formatDateTime(c.created_at)}>
                      Started {relativeTime(c.created_at)}
                      {c.completed_at ? ` · finished ${relativeTime(c.completed_at)}` : ''}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {busy && <Loader2 size={14} className="adm-spin mr-1" style={{ color: 'var(--adm-silk-faint)' }} />}
                    {unfinished && !busy && (
                      <Button size="sm" icon={Play} onClick={() => retry(c)}>Resume</Button>
                    )}
                    {!unfinished && c.failed > 0 && !busy && (
                      <Button size="sm" icon={RotateCcw} onClick={() => retry(c)}>Retry {c.failed} failed</Button>
                    )}
                    <IconButton icon={Users} label="Recipients" onClick={() => setRecipientsOf(c)} />
                  </div>
                </div>
              </article>
            )
          })}
        </div>
      )}

      <ComposeEmailModal
        open={composing}
        source={null}
        onClose={() => { setComposing(false); load() }}
        onSent={load}
      />

      <TemplateEditorModal
        key={editor?.template?.id || 'new'}
        open={!!editor}
        template={editor?.template}
        onClose={() => setEditor(null)}
        onSaved={() => { setEditor(null); load() }}
        createdBy={adminProfile?.user_id}
      />

      <ConfirmDialog
        open={!!pendingDelete}
        onClose={() => setPendingDelete(null)}
        onConfirm={removeTemplate}
        title="Delete this template?"
        message={pendingDelete ? `“${pendingDelete.name}” will no longer be offered in the composer. Emails already sent are not affected.` : ''}
        confirmLabel="Delete template"
      />

      <RecipientsDrawer campaign={recipientsOf} onClose={() => setRecipientsOf(null)} />
    </div>
  )
}

const DELIVERY_TONE = { sent: 'ok', failed: 'fault', queued: 'wait', sending: 'signal' }

function RecipientsDrawer({ campaign, onClose }) {
  const [rows, setRows] = useState(null)
  const [filter, setFilter] = useState('all')

  useEffect(() => {
    if (!campaign) return
    setRows(null); setFilter(campaign.failed ? 'failed' : 'all')
    read(
      supabase.from('email_deliveries').select('id, email, name, status, error, sent_at')
        .eq('campaign_id', campaign.id).order('status').order('name')
    ).then(({ data }) => setRows(data || []))
  }, [campaign])

  const shown = (rows || []).filter(r => filter === 'all' || r.status === filter)
  const options = ['all', 'sent', 'failed', 'queued'].map(value => ({
    value,
    label: value === 'all' ? 'All' : value[0].toUpperCase() + value.slice(1),
    count: value === 'all' ? rows?.length ?? 0 : (rows || []).filter(r => r.status === value).length,
  }))

  return (
    <Drawer open={!!campaign} onClose={onClose} title="Recipients" subtitle={campaign?.subject} width={520}>
      {!rows ? (
        <SkeletonPanel rows={4} />
      ) : (
        <div className="space-y-3">
          <FilterTabs options={options} value={filter} onChange={setFilter} label="Delivery filter" />
          <ul className="space-y-1.5">
            {shown.map(r => (
              <li key={r.id} className="rounded-lg px-3 py-2" style={{ border: '1px solid var(--adm-trace)' }}>
                <div className="flex items-center justify-between gap-3">
                  <span className="min-w-0">
                    <span className="block text-sm adm-truncate" style={{ color: 'var(--adm-silk)' }}>{r.name || r.email}</span>
                    <span className="adm-data block text-[11px] adm-truncate" style={{ color: 'var(--adm-silk-faint)' }}>{r.email}</span>
                  </span>
                  <Badge tone={DELIVERY_TONE[r.status]}>{r.status}</Badge>
                </div>
                {r.error && <p className="text-xs mt-1.5" style={{ color: 'var(--adm-fault)' }}>{r.error}</p>}
              </li>
            ))}
            {!shown.length && <p className="text-sm" style={{ color: 'var(--adm-silk-faint)' }}>No one here.</p>}
          </ul>
        </div>
      )}
    </Drawer>
  )
}
