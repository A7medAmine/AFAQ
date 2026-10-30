import { useCallback, useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { BellRing, Eye, Loader2, Pencil, Pin, PinOff, Plus, Send, Trash2, X } from 'lucide-react'
import { api, logActivity, read, run, supabase } from '../lib/db'
import useAdminStore from '../store/adminStore'
import { formatDateTime, relativeTime } from '../lib/format'
import PageHeader from '../components/ui/PageHeader'
import Panel from '../components/ui/Panel'
import Modal from '../components/ui/Modal'
import ConfirmDialog from '../components/ui/ConfirmDialog'
import EmptyState, { ErrorState } from '../components/ui/EmptyState'
import Button, { IconButton } from '../components/ui/Button'
import Badge from '../components/ui/Badge'
import { SkeletonPanel } from '../components/ui/Skeleton'
import { CheckField, Field, SelectField, TextArea, TextField } from '../components/ui/Field'

const BLANK = { title: '', body: '', priority: 'normal', is_pinned: false, expires_at: '', email: false }

/**
 * Notices for members only, shown in the member portal (/portal) and never on
 * the public site. Each one goes to everyone, or to the departments, groups
 * and members picked as its audience.
 */
export default function MemberNoticesPage() {
  const adminProfile = useAdminStore(s => s.adminProfile)
  const addToast = useAdminStore(s => s.addToast)
  const [items, setItems] = useState([])
  const [lookups, setLookups] = useState({ departments: [], groups: [], members: [] })
  const [state, setState] = useState({ loading: true, error: null })
  const [editor, setEditor] = useState(null)
  const [pendingDelete, setPendingDelete] = useState(null)
  const [emailing, setEmailing] = useState(null) // { id, sent, total }

  const load = useCallback(async () => {
    setState(s => ({ ...s, error: null }))
    const [noticeRes, deptRes, groupRes, memberRes] = await Promise.all([
      read(supabase.from('member_notices')
        .select('*, targets:member_notice_targets(department_id, group_id, member_id), reads:member_notice_reads(count)')
        .order('is_pinned', { ascending: false })
        .order('created_at', { ascending: false })),
      read(supabase.from('departments').select('id, name').order('sort_order')),
      read(supabase.from('member_groups').select('id, name').order('name')),
      read(supabase.from('members').select('id, full_name, member_code').eq('status', 'active').order('full_name')),
    ])
    if (!noticeRes.ok) { setState({ loading: false, error: noticeRes.message }); return }
    setItems(noticeRes.data || [])
    setLookups({ departments: deptRes.data || [], groups: groupRes.data || [], members: memberRes.data || [] })
    setState({ loading: false, error: null })
  }, [])

  useEffect(() => { load() }, [load])

  const names = useMemo(() => ({
    department: Object.fromEntries(lookups.departments.map(d => [d.id, d.name])),
    group: Object.fromEntries(lookups.groups.map(g => [g.id, g.name])),
    member: Object.fromEntries(lookups.members.map(m => [m.id, m.full_name])),
  }), [lookups])

  const audienceLabel = targets => {
    if (!targets?.length) return ['Everyone']
    return targets.map(t => t.department_id ? names.department[t.department_id] || 'A department'
      : t.group_id ? names.group[t.group_id] || 'A group'
      : names.member[t.member_id] || 'A member')
  }

  /** Emails a notice one batch at a time, so a big send fits in serverless limits. */
  const sendEmail = useCallback(async notice => {
    let after = 0
    let sent = 0
    setEmailing({ id: notice.id, sent: 0, total: null })
    for (;;) {
      const { ok, data, message } = await api(`/api/portal/notices/${notice.id}/email`, { method: 'POST', body: { after } })
      if (!ok) { addToast(message || 'The notice was not emailed.', 'error'); break }
      sent += data.sent
      setEmailing({ id: notice.id, sent, total: data.total })
      if (data.next === null) {
        addToast(data.total ? `Emailed to ${sent} of ${data.total} member${data.total === 1 ? '' : 's'}.` : 'Nobody to email: the audience is empty or opted out.', 'success')
        logActivity('updated', 'member_notices', notice.id, { name: notice.title, emailed: sent })
        break
      }
      after = data.next
    }
    setEmailing(null)
    load()
  }, [addToast, load])

  const togglePin = async item => {
    const { ok } = await run(
      supabase.from('member_notices').update({ is_pinned: !item.is_pinned }).eq('id', item.id),
      { success: item.is_pinned ? 'Unpinned.' : 'Pinned to the top.', failure: 'That switch did not change.' }
    )
    if (ok) load()
  }

  const remove = async () => {
    const { ok } = await run(
      supabase.from('member_notices').delete().eq('id', pendingDelete.id),
      { success: 'Notice deleted.', failure: 'The notice was not deleted.' }
    )
    if (ok) {
      logActivity('deleted', 'member_notices', pendingDelete.id, { name: pendingDelete.title })
      setPendingDelete(null)
      load()
    }
  }

  const expired = n => n.expires_at && new Date(n.expires_at) <= new Date()

  return (
    <div>
      <PageHeader
        eyebrow="People"
        title="Member notices"
        description="Messages for members, shown in their member area. Not published on the site."
        actions={<Button variant="primary" icon={Plus} onClick={() => setEditor({ item: null })}>New notice</Button>}
      />

      {state.error ? (
        <Panel><ErrorState message={state.error} onRetry={load} /></Panel>
      ) : state.loading ? (
        <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <SkeletonPanel key={i} rows={2} />)}</div>
      ) : items.length === 0 ? (
        <Panel>
          <EmptyState
            icon={BellRing}
            title="No notices yet"
            description="Tell members about a meeting, a deadline or a change, by department or for everyone."
            action={<Button variant="primary" icon={Plus} onClick={() => setEditor({ item: null })}>New notice</Button>}
          />
        </Panel>
      ) : (
        <div className="space-y-3">
          {items.map((item, index) => (
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
                    {item.is_pinned && <Badge tone="signal"><Pin size={11} /> Pinned</Badge>}
                    <h3 className="text-[15px] leading-tight">{item.title}</h3>
                    {item.priority === 'important' && <Badge tone="wait">Important</Badge>}
                    {expired(item) && <Badge>Expired</Badge>}
                  </div>
                  <p className="text-sm adm-clamp-2" style={{ color: 'var(--adm-silk-dim)' }}>{item.body}</p>
                  <div className="flex flex-wrap gap-1 mt-2.5">
                    {audienceLabel(item.targets).map((label, i) => <Badge key={i}>{label}</Badge>)}
                  </div>
                  <p className="adm-data text-[11px] mt-2.5 flex flex-wrap gap-x-3" style={{ color: 'var(--adm-silk-faint)' }}>
                    <span>Posted {relativeTime(item.created_at)}</span>
                    <span className="inline-flex items-center gap-1"><Eye size={11} /> Read by {item.reads?.[0]?.count || 0}</span>
                    {item.emailed_at && <span>Emailed {formatDateTime(item.emailed_at)}</span>}
                    {item.expires_at && !expired(item) && <span>Until {formatDateTime(item.expires_at)}</span>}
                  </p>
                </div>

                <div className="flex items-center gap-0.5 shrink-0">
                  {emailing?.id === item.id ? (
                    <span className="adm-data text-[11px] inline-flex items-center gap-1 mr-1" style={{ color: 'var(--adm-silk-faint)' }}>
                      <Loader2 size={13} className="adm-spin" /> {emailing.sent}{emailing.total != null && `/${emailing.total}`}
                    </span>
                  ) : (
                    <IconButton icon={Send} label={item.emailed_at ? 'Email again' : 'Email to members'} disabled={!!emailing} onClick={() => sendEmail(item)} />
                  )}
                  <IconButton icon={item.is_pinned ? PinOff : Pin} label={item.is_pinned ? 'Unpin' : 'Pin to the top'} onClick={() => togglePin(item)} />
                  <IconButton icon={Pencil} label="Edit" onClick={() => setEditor({ item })} />
                  <IconButton icon={Trash2} label="Delete" danger onClick={() => setPendingDelete(item)} />
                </div>
              </div>
            </motion.article>
          ))}
        </div>
      )}

      <NoticeEditor
        key={editor?.item?.id || 'new'}
        open={!!editor}
        item={editor?.item}
        lookups={lookups}
        createdBy={adminProfile?.user_id}
        onClose={() => setEditor(null)}
        onSaved={saved => {
          setEditor(null)
          load()
          if (saved.email) sendEmail(saved.notice)
        }}
      />

      <ConfirmDialog
        open={!!pendingDelete}
        onClose={() => setPendingDelete(null)}
        onConfirm={remove}
        title="Delete this notice?"
        message={pendingDelete ? `“${pendingDelete.title}” disappears from every member's portal. This cannot be undone.` : ''}
        confirmLabel="Delete notice"
      />
    </div>
  )
}

/** Target rows ↔ the picker's { departments, groups, members } id lists. */
const toAudience = (targets = []) => ({
  departments: targets.filter(t => t.department_id).map(t => t.department_id),
  groups: targets.filter(t => t.group_id).map(t => t.group_id),
  members: targets.filter(t => t.member_id).map(t => t.member_id),
})

function NoticeEditor({ open, item, lookups, createdBy, onClose, onSaved }) {
  const [form, setForm] = useState(BLANK)
  const [audience, setAudience] = useState({ departments: [], groups: [], members: [] })
  const [everyone, setEveryone] = useState(true)
  const [memberQuery, setMemberQuery] = useState('')
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    setForm(item ? {
      title: item.title, body: item.body, priority: item.priority, is_pinned: item.is_pinned,
      expires_at: item.expires_at ? new Date(item.expires_at).toISOString().slice(0, 16) : '', email: false,
    } : BLANK)
    setAudience(toAudience(item?.targets))
    setEveryone(!item?.targets?.length)
    setMemberQuery('')
    setErrors({})
  }, [open, item])

  const set = (key, value) => {
    setForm(f => ({ ...f, [key]: value }))
    setErrors(e => ({ ...e, [key]: undefined }))
  }

  const toggleIn = (kind, id) => setAudience(a => ({
    ...a, [kind]: a[kind].includes(id) ? a[kind].filter(x => x !== id) : [...a[kind], id],
  }))

  const memberMatches = useMemo(() => {
    const q = memberQuery.trim().toLowerCase()
    if (q.length < 2) return []
    return lookups.members
      .filter(m => !audience.members.includes(m.id) && (m.full_name.toLowerCase().includes(q) || (m.member_code || '').toLowerCase().includes(q)))
      .slice(0, 6)
  }, [memberQuery, lookups.members, audience.members])

  const picked = audience.departments.length + audience.groups.length + audience.members.length

  const save = async () => {
    const next = {}
    if (!form.title.trim()) next.title = 'Give the notice a title.'
    if (!form.body.trim()) next.body = 'Write the notice itself.'
    if (!everyone && !picked) next.audience = 'Pick at least one department, group or member, or send it to everyone.'
    if (Object.keys(next).length) { setErrors(next); return }

    setSaving(true)
    const payload = {
      title: form.title.trim(),
      body: form.body.trim(),
      priority: form.priority,
      is_pinned: form.is_pinned,
      expires_at: form.expires_at ? new Date(form.expires_at).toISOString() : null,
      updated_at: new Date().toISOString(),
    }
    const { ok, data } = await run(
      item
        ? supabase.from('member_notices').update(payload).eq('id', item.id).select().single()
        : supabase.from('member_notices').insert({ ...payload, created_by: createdBy }).select().single(),
      { failure: 'The notice did not save.' }
    )
    if (!ok) { setSaving(false); return }

    // Replace the audience wholesale; it is a handful of rows.
    const targets = everyone ? [] : [
      ...audience.departments.map(id => ({ notice_id: data.id, department_id: id })),
      ...audience.groups.map(id => ({ notice_id: data.id, group_id: id })),
      ...audience.members.map(id => ({ notice_id: data.id, member_id: id })),
    ]
    const cleared = await run(supabase.from('member_notice_targets').delete().eq('notice_id', data.id), { failure: 'The audience did not save.' })
    const written = cleared.ok && targets.length
      ? await run(supabase.from('member_notice_targets').insert(targets), { failure: 'The audience did not save.' })
      : cleared
    setSaving(false)
    if (!written.ok) return

    useAdminStore.getState().addToast(item ? 'Notice updated.' : 'Notice posted to the member area.', 'success')
    logActivity(item ? 'updated' : 'created', 'member_notices', data.id, { name: data.title })
    onSaved({ notice: data, email: form.email })
  }

  const chip = (kind, row) => {
    const on = audience[kind].includes(row.id)
    return (
      <button key={row.id} type="button" aria-pressed={on} onClick={() => toggleIn(kind, row.id)}
        className={`adm-btn adm-btn-sm ${on ? 'adm-btn-primary' : ''}`}>
        {row.name}
      </button>
    )
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title={item ? 'Edit notice' : 'New notice'}
      description="Members see it in their member area. Only those in the audience can read it."
      footer={
        <>
          <Button onClick={onClose} data-dialog-dismiss="true">Cancel</Button>
          <Button variant="primary" onClick={save} busy={saving} busyLabel="Saving…">
            {item ? 'Save changes' : form.email ? 'Post and email' : 'Post notice'}
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        <TextField label="Title" required maxLength={160} value={form.title} error={errors.title}
          onChange={e => set('title', e.target.value)} />
        <TextArea label="Notice" required rows={6} value={form.body} error={errors.body}
          hint="Plain text. Blank lines start a new paragraph."
          onChange={e => set('body', e.target.value)} />

        <Field label="Audience" error={errors.audience}>
          {() => (
          <div className="space-y-3">
            <CheckField label="Everyone" description="Every member who can sign in to the member area."
              checked={everyone} onChange={v => { setEveryone(v); setErrors(e => ({ ...e, audience: undefined })) }} />
            {!everyone && (
              <>
                {lookups.departments.length > 0 && (
                  <div>
                    <p className="text-[12px] mb-1.5" style={{ color: 'var(--adm-silk-faint)' }}>Departments</p>
                    <div className="flex flex-wrap gap-1.5">{lookups.departments.map(d => chip('departments', d))}</div>
                  </div>
                )}
                {lookups.groups.length > 0 && (
                  <div>
                    <p className="text-[12px] mb-1.5" style={{ color: 'var(--adm-silk-faint)' }}>Member groups</p>
                    <div className="flex flex-wrap gap-1.5">{lookups.groups.map(g => chip('groups', g))}</div>
                  </div>
                )}
                <div>
                  <p className="text-[12px] mb-1.5" style={{ color: 'var(--adm-silk-faint)' }}>Specific members</p>
                  {audience.members.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mb-2">
                      {audience.members.map(id => (
                        <button key={id} type="button" className="adm-btn adm-btn-sm adm-btn-primary" onClick={() => toggleIn('members', id)}>
                          {lookups.members.find(m => m.id === id)?.full_name || `Member ${id}`} <X size={12} />
                        </button>
                      ))}
                    </div>
                  )}
                  <input className="adm-input" placeholder="Search by name or member number…" value={memberQuery}
                    onChange={e => setMemberQuery(e.target.value)} aria-label="Search members" />
                  {memberMatches.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {memberMatches.map(m => (
                        <button key={m.id} type="button" className="adm-btn adm-btn-sm"
                          onClick={() => { toggleIn('members', m.id); setMemberQuery('') }}>
                          <Plus size={12} /> {m.full_name}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
          )}
        </Field>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <SelectField label="Priority" value={form.priority} onChange={e => set('priority', e.target.value)}>
            <option value="normal">Normal</option>
            <option value="important">Important (highlighted)</option>
          </SelectField>
          <TextField label="Hide after" type="datetime-local" hint="Leave empty to keep it up."
            value={form.expires_at} onChange={e => set('expires_at', e.target.value)} />
        </div>

        <div className="flex flex-col gap-3 pt-4" style={{ borderTop: '1px solid var(--adm-trace)' }}>
          <CheckField label="Pinned" description="Keep it at the top of members' notices."
            checked={form.is_pinned} onChange={v => set('is_pinned', v)} />
          {!item && (
            <CheckField label="Also email it" description="Send it to the audience's inbox too. Members who opted out of emails are skipped."
              checked={form.email} onChange={v => set('email', v)} />
          )}
        </div>
      </div>
    </Modal>
  )
}
