import { useCallback, useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { CalendarClock, Eye, EyeOff, Loader2, Megaphone, Pencil, Pin, PinOff, Plus, Send, Trash2 } from 'lucide-react'
import { logActivity, read, run, supabase } from '../lib/db'
import useAdminStore from '../store/adminStore'
import useQueryParam from '../hooks/useQueryParam'
import { hasPermission } from '../lib/permissions'
import ComposeEmailModal from '../components/email/ComposeEmailModal'
import { formatDateTime, relativeTime, toForm } from '../lib/format'
import PageHeader, { FilterTabs } from '../components/ui/PageHeader'
import Panel from '../components/ui/Panel'
import Modal from '../components/ui/Modal'
import ConfirmDialog from '../components/ui/ConfirmDialog'
import EmptyState, { ErrorState } from '../components/ui/EmptyState'
import Button, { IconButton } from '../components/ui/Button'
import Badge, { StatusBadge } from '../components/ui/Badge'
import { SkeletonPanel } from '../components/ui/Skeleton'
import { CheckField, LocalizedField, TextField } from '../components/ui/Field'

const BLANK = {
  title_en: '', title_ar: '', title_fr: '',
  content_en: '', content_ar: '', content_fr: '',
  is_pinned: false, is_published: true, scheduled_at: '',
}

const FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'live', label: 'Live' },
  { value: 'scheduled', label: 'Scheduled' },
  { value: 'draft', label: 'Drafts' },
]

/** Published, but dated in the future — live on the site only once that passes. */
const isScheduled = a => a.is_published && a.scheduled_at && new Date(a.scheduled_at) > new Date()

const stateOf = a => (!a.is_published ? 'draft' : isScheduled(a) ? 'scheduled' : 'live')

export default function AnnouncementsPage() {
  const adminProfile = useAdminStore(s => s.adminProfile)
  const canEmail = hasPermission(useAdminStore(s => s.role()), 'email.send')
  const [emailing, setEmailing] = useState(null)

  const [items, setItems] = useState([])
  const [state, setState] = useState({ loading: true, error: null })
  const [status, setStatus] = useQueryParam('status', 'all')
  const [newFlag, setNewFlag] = useQueryParam('new')

  const [editor, setEditor] = useState(null)
  const [pendingDelete, setPendingDelete] = useState(null)
  const [working, setWorking] = useState({})

  const load = useCallback(async () => {
    setState(s => ({ ...s, error: null }))
    const { ok, data, message } = await read(
      supabase.from('announcements').select('*')
        .order('is_pinned', { ascending: false })
        .order('created_at', { ascending: false })
    )
    if (!ok) { setState({ loading: false, error: message }); return }
    setItems(data || [])
    setState({ loading: false, error: null })
  }, [])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    if (newFlag) { setEditor({ item: null }); setNewFlag('') }
  }, [newFlag, setNewFlag])

  const filtered = useMemo(
    () => (status === 'all' ? items : items.filter(a => stateOf(a) === status)),
    [items, status]
  )

  const filterOptions = FILTERS.map(f => ({
    ...f,
    count: f.value === 'all' ? items.length : items.filter(a => stateOf(a) === f.value).length,
  }))

  const toggle = async (item, field, labels) => {
    setWorking(w => ({ ...w, [item.id]: true }))
    const next = !item[field]
    const { ok } = await run(
      supabase.from('announcements').update({ [field]: next }).eq('id', item.id),
      { success: next ? labels.on : labels.off, failure: 'That switch did not change.' }
    )
    setWorking(w => ({ ...w, [item.id]: false }))
    if (ok) load()
  }

  const remove = async () => {
    const { ok } = await run(
      supabase.from('announcements').delete().eq('id', pendingDelete.id),
      { success: 'Announcement deleted.', failure: 'The announcement was not deleted.' }
    )
    if (ok) {
      logActivity('deleted', 'announcements', pendingDelete.id, { name: pendingDelete.title_en })
      setPendingDelete(null)
      load()
    }
  }

  return (
    <div>
      <PageHeader
        eyebrow="Publish"
        title="Announcements"
        description="Short notices shown on the site. Pinned ones sit at the top of the list."
        actions={<Button variant="primary" icon={Plus} onClick={() => setEditor({ item: null })}>New announcement</Button>}
      />

      <div className="mb-4">
        <FilterTabs options={filterOptions} value={status} onChange={setStatus} label="Announcement filter" />
      </div>

      {state.error ? (
        <Panel><ErrorState message={state.error} onRetry={load} /></Panel>
      ) : state.loading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => <SkeletonPanel key={i} rows={2} />)}
        </div>
      ) : filtered.length === 0 ? (
        <Panel>
          {items.length === 0 ? (
            <EmptyState
              icon={Megaphone}
              title="No announcements yet"
              description="Post a notice when something changes — a new workshop, a deadline, a room move."
              action={<Button variant="primary" icon={Plus} onClick={() => setEditor({ item: null })}>New announcement</Button>}
            />
          ) : (
            <EmptyState compact icon={Megaphone} title={`Nothing ${status}`} description="Try another filter." />
          )}
        </Panel>
      ) : (
        <div className="space-y-3">
          {filtered.map((item, index) => (
            <motion.article
              key={item.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(index * 0.03, 0.2) }}
              className="adm-panel p-4 sm:p-5"
              style={item.is_pinned ? { borderColor: 'var(--adm-signal-edge)' } : undefined}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2 mb-1.5">
                    {item.is_pinned && (
                      <Badge tone="signal"><Pin size={11} /> Pinned</Badge>
                    )}
                    <h3 className="text-[15px] leading-tight">{item.title_en}</h3>
                    <StatusBadge status={stateOf(item)} />
                  </div>
                  <p className="text-sm adm-clamp-2" style={{ color: 'var(--adm-silk-dim)' }}>
                    {item.content_en || 'No English body text.'}
                  </p>
                  <p className="adm-data text-[11px] mt-2.5" style={{ color: 'var(--adm-silk-faint)' }}>
                    {isScheduled(item)
                      ? `Goes live ${formatDateTime(item.scheduled_at)}`
                      : `Posted ${relativeTime(item.created_at)}`}
                  </p>
                </div>

                <div className="flex items-center gap-0.5 shrink-0">
                  {working[item.id] && <Loader2 size={14} className="adm-spin mr-1" style={{ color: 'var(--adm-silk-faint)' }} />}
                  <IconButton
                    icon={item.is_pinned ? PinOff : Pin}
                    label={item.is_pinned ? 'Unpin' : 'Pin to the top'}
                    disabled={working[item.id]}
                    onClick={() => toggle(item, 'is_pinned', { on: 'Pinned to the top.', off: 'Unpinned.' })}
                  />
                  <IconButton
                    icon={item.is_published ? EyeOff : Eye}
                    label={item.is_published ? 'Unpublish' : 'Publish'}
                    disabled={working[item.id]}
                    onClick={() => toggle(item, 'is_published', {
                      on: 'Published to the site.',
                      off: 'Hidden from the site.',
                    })}
                  />
                  {canEmail && (
                    <IconButton icon={Send} label="Email members" onClick={() => setEmailing(item)} />
                  )}
                  <IconButton icon={Pencil} label="Edit" onClick={() => setEditor({ item })} />
                  <IconButton icon={Trash2} label="Delete" danger onClick={() => setPendingDelete(item)} />
                </div>
              </div>
            </motion.article>
          ))}
        </div>
      )}

      <AnnouncementEditor
        key={editor?.item?.id || 'new'}
        open={!!editor}
        item={editor?.item}
        onClose={() => setEditor(null)}
        onSaved={() => { setEditor(null); load() }}
        createdBy={adminProfile?.user_id}
      />

      <ComposeEmailModal
        open={!!emailing}
        source={emailing ? { type: 'announcement', record: emailing } : null}
        onClose={() => setEmailing(null)}
      />

      <ConfirmDialog
        open={!!pendingDelete}
        onClose={() => setPendingDelete(null)}
        onConfirm={remove}
        title="Delete this announcement?"
        message={pendingDelete ? `“${pendingDelete.title_en}” will be removed from the site. This cannot be undone.` : ''}
        confirmLabel="Delete announcement"
      />
    </div>
  )
}

function AnnouncementEditor({ open, item, onClose, onSaved, createdBy }) {
  const [form, setForm] = useState(BLANK)
  const [lang, setLang] = useState('en')
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    setForm(item
      ? {
        ...toForm(BLANK, item),
        // datetime-local wants `YYYY-MM-DDTHH:mm` with no zone.
        scheduled_at: item.scheduled_at ? new Date(item.scheduled_at).toISOString().slice(0, 16) : '',
      }
      : BLANK)
    setErrors({})
    setLang('en')
  }, [open, item])

  const set = (key, value) => {
    setForm(f => ({ ...f, [key]: value }))
    setErrors(e => ({ ...e, [key]: undefined }))
  }

  const save = async () => {
    const next = {}
    if (!form.title_en.trim()) next.title_en = 'An English title is required — it is what the site shows.'
    if (!form.content_en.trim()) next.content_en = 'Write the notice itself.'
    if (Object.keys(next).length) { setErrors(next); setLang('en'); return }

    setSaving(true)
    const payload = {
      title_en: form.title_en.trim(), title_ar: form.title_ar.trim() || null, title_fr: form.title_fr.trim() || null,
      content_en: form.content_en, content_ar: form.content_ar || null, content_fr: form.content_fr || null,
      is_pinned: form.is_pinned,
      is_published: form.is_published,
      scheduled_at: form.scheduled_at ? new Date(form.scheduled_at).toISOString() : null,
    }

    const { ok } = await run(
      item
        ? supabase.from('announcements').update(payload).eq('id', item.id)
        : supabase.from('announcements').insert({ ...payload, created_by: createdBy }),
      {
        success: item ? 'Announcement updated.' : 'Announcement posted.',
        failure: 'The announcement did not save.',
      }
    )
    setSaving(false)
    if (ok) onSaved()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title={item ? 'Edit announcement' : 'New announcement'}
      description="Keep it to a sentence or two. Arabic and French are optional."
      footer={
        <>
          <Button onClick={onClose} data-dialog-dismiss="true">Cancel</Button>
          <Button variant="primary" onClick={save} busy={saving} busyLabel="Saving…">
            {item ? 'Save changes' : 'Post announcement'}
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        <LocalizedField
          label="Title" prefix="title" required
          values={form} onChange={set} lang={lang} onLangChange={setLang} error={errors.title_en}
        />
        <LocalizedField
          label="Notice" prefix="content" required multiline rows={5}
          values={form} onChange={set} lang={lang} onLangChange={setLang} error={errors.content_en}
        />

        <TextField
          label="Go live at"
          type="datetime-local"
          hint="Leave empty to publish immediately."
          value={form.scheduled_at}
          onChange={e => set('scheduled_at', e.target.value)}
        />

        <div className="flex flex-col gap-3 pt-4" style={{ borderTop: '1px solid var(--adm-trace)' }}>
          <CheckField
            label="Published"
            description="Show this notice on the public site."
            checked={form.is_published}
            onChange={v => set('is_published', v)}
          />
          <CheckField
            label="Pinned"
            description="Keep it at the top of the announcements list."
            checked={form.is_pinned}
            onChange={v => set('is_pinned', v)}
          />
          {form.scheduled_at && form.is_published && new Date(form.scheduled_at) > new Date() && (
            <p className="flex items-center gap-2 text-xs" style={{ color: 'var(--adm-signal)' }}>
              <CalendarClock size={13} />
              Hidden until {formatDateTime(form.scheduled_at)}.
            </p>
          )}
        </div>
      </div>
    </Modal>
  )
}
