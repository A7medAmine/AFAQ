import { useCallback, useEffect, useState } from 'react'
import { ArrowLeft, ArrowRight, Ban, Copy, Trash2 } from 'lucide-react'
import { logActivity, read, run, supabase } from '../../lib/db'
import useAdminStore from '../../store/adminStore'
import {
  CAPTION_LANGS, FORMATS, PLATFORMS, ROLES, STAGES, fullCaption, nextStage, previousStage, stageOf, toLocalInput,
} from '../../lib/media'
import Drawer from '../ui/Drawer'
import Badge from '../ui/Badge'
import Button from '../ui/Button'
import ConfirmDialog from '../ui/ConfirmDialog'
import { CheckField, SelectField, TextArea, TextField } from '../ui/Field'
import CaptionEditor from './CaptionEditor'
import PostFiles from './PostFiles'
import PostComments from './PostComments'

const BLANK = {
  title: '', brief: '', format: 'post', platforms: ['instagram', 'facebook'], event_id: '', publish_at: '',
  caption_ar: '', caption_fr: '', caption_en: '', hashtags: '', shot_list: '', needs_shoot: true,
  writer_id: '', photographer_id: '', editor_id: '', publisher_id: '', posted_links: '',
}

const toForm = src => {
  const form = { ...BLANK }
  Object.keys(BLANK).forEach(k => { if (src?.[k] !== undefined && src[k] !== null) form[k] = src[k] })
  ;['event_id', ...ROLES.map(r => r.key)].forEach(k => { form[k] = form[k] ? String(form[k]) : '' })
  form.publish_at = toLocalInput(src?.publish_at)
  return form
}

const toPayload = form => ({
  title: form.title.trim(),
  brief: form.brief.trim() || null,
  format: form.format,
  platforms: form.platforms,
  event_id: form.event_id ? Number(form.event_id) : null,
  publish_at: form.publish_at ? new Date(form.publish_at).toISOString() : null,
  caption_ar: form.caption_ar.trim() || null,
  caption_fr: form.caption_fr.trim() || null,
  caption_en: form.caption_en.trim() || null,
  hashtags: form.hashtags.trim() || null,
  shot_list: form.shot_list.trim() || null,
  needs_shoot: !!form.needs_shoot,
  writer_id: form.writer_id ? Number(form.writer_id) : null,
  photographer_id: form.photographer_id ? Number(form.photographer_id) : null,
  editor_id: form.editor_id ? Number(form.editor_id) : null,
  publisher_id: form.publisher_id ? Number(form.publisher_id) : null,
  posted_links: form.posted_links.trim() || null,
  updated_at: new Date().toISOString(),
})

function Section({ title, children, action }) {
  return (
    <section className="flex flex-col gap-3 pb-5 mb-5" style={{ borderBottom: '1px solid var(--adm-trace)' }}>
      <div className="flex items-center justify-between gap-2">
        <h3 className="adm-eyebrow">{title}</h3>
        {action}
      </div>
      {children}
    </section>
  )
}

/**
 * Everything about one post: the idea, who does each stage, the caption in
 * three languages, the shoot brief, the files and the thread. The buttons in
 * the footer hand it to the next stage (saving first) or send it back with a note.
 */
export default function PostDrawer({ open, post, defaults, people, events, snippets, onClose, onSaved, onMove, onDeleted }) {
  const adminId = useAdminStore(s => s.adminProfile?.id)
  const userId = useAdminStore(s => s.adminProfile?.user_id)
  const addToast = useAdminStore(s => s.addToast)
  const editing = !!post

  const [form, setForm] = useState(BLANK)
  const [dirty, setDirty] = useState(false)
  const [error, setError] = useState(null)
  const [saving, setSaving] = useState(false)
  const [assets, setAssets] = useState([])
  const [comments, setComments] = useState([])
  const [sendBack, setSendBack] = useState(null) // note text while open
  const [confirm, setConfirm] = useState(null) // 'delete' | 'drop'

  useEffect(() => {
    if (!open) return
    setForm(toForm(post || defaults))
    setDirty(false)
    setError(null)
    setSendBack(null)
  }, [open, post?.id, defaults]) // eslint-disable-line react-hooks/exhaustive-deps

  const loadExtras = useCallback(async () => {
    if (!post?.id) { setAssets([]); setComments([]); return }
    const [a, c] = await Promise.all([
      read(supabase.from('media_assets').select('*').eq('post_id', post.id).order('created_at')),
      read(supabase.from('media_comments').select('*').eq('post_id', post.id).order('created_at')),
    ])
    setAssets(a.data || [])
    setComments(c.data || [])
  }, [post?.id])

  useEffect(() => { if (open) loadExtras() }, [open, loadExtras])

  const set = (key, value) => {
    setForm(f => ({ ...f, [key]: value }))
    setDirty(true)
    if (key === 'title') setError(null)
  }

  const togglePlatform = value => set('platforms', form.platforms.includes(value)
    ? form.platforms.filter(p => p !== value)
    : [...form.platforms, value])

  const event = events.find(e => String(e.id) === form.event_id)
  const aiContext = {
    title: form.title,
    brief: form.brief,
    format: form.format,
    platforms: form.platforms,
    event: event ? { title: event.title_en, date: event.date, location: event.location_en, description: event.description_en } : null,
  }

  /** Save the form. Returns the saved row, or null when it did not save. */
  const save = async ({ quiet = false } = {}) => {
    if (!form.title.trim()) { setError('Give the post a working title.'); return null }
    setSaving(true)
    const payload = toPayload(form)
    const query = editing
      ? supabase.from('media_posts').update(payload).eq('id', post.id)
      : supabase.from('media_posts').insert({ ...payload, status: defaults?.status || 'idea', created_by: userId || null })
    const { ok, data } = await run(query.select('*').single(), {
      success: quiet ? undefined : editing ? 'Post saved.' : 'Post created.',
      failure: 'The post did not save.',
    })
    setSaving(false)
    if (!ok) return null
    logActivity(editing ? 'updated' : 'created', 'media_posts', data.id, { name: data.title })
    setDirty(false)
    onSaved(data)
    return data
  }

  const advance = async () => {
    const saved = dirty || !editing ? await save({ quiet: true }) : post
    if (!saved) return
    const next = nextStage({ ...saved, needs_shoot: form.needs_shoot })
    if (!next) return
    if (next.value === 'scheduled' && !form.caption_ar.trim() && !form.caption_fr.trim() && !form.caption_en.trim()) {
      addToast('It has no caption yet. Write one before it goes to the publisher.', 'error')
      return
    }
    await onMove(saved, next.value)
    addToast(`Moved to ${next.label}.`)
  }

  const goBack = async () => {
    const prev = previousStage(post)
    if (!prev) return
    if (sendBack?.trim()) {
      await run(supabase.from('media_comments').insert({
        post_id: post.id, author_id: adminId, body: `Sent back to ${prev.label}: ${sendBack.trim()}`,
      }))
    }
    if (dirty) await save({ quiet: true })
    await onMove(post, prev.value)
    setSendBack(null)
    loadExtras()
    addToast(`Sent back to ${prev.label}.`)
  }

  const remove = async () => {
    const { ok } = await run(supabase.from('media_posts').delete().eq('id', post.id), {
      success: 'Post deleted.', failure: 'The post was not deleted.',
    })
    if (!ok) return
    logActivity('deleted', 'media_posts', post.id, { name: post.title })
    setConfirm(null)
    onDeleted()
  }

  const drop = async () => {
    await onMove(post, 'dropped')
    setConfirm(null)
    onDeleted()
  }

  const copyCaption = async lang => {
    try {
      await navigator.clipboard.writeText(fullCaption(form, lang))
      addToast('Copied. Paste it into the app.')
    } catch {
      addToast('Copy is blocked in this browser.', 'error')
    }
  }

  const stage = post ? stageOf(post.status) : stageOf(defaults?.status || 'idea')
  const next = post ? nextStage({ ...post, needs_shoot: form.needs_shoot }) : null
  const prev = post ? previousStage(post) : null
  const personOptions = people.map(p => <option key={p.id} value={p.id}>{p.full_name || p.email}</option>)

  return (
    <>
      <Drawer
        open={open}
        onClose={onClose}
        width={680}
        title={editing ? post.title : 'New post'}
        subtitle={editing ? `${event ? event.title_en + ' · ' : ''}${STAGES.findIndex(s => s.value === post.status) + 1} of ${STAGES.length}` : 'Starts in ' + stage.label}
        badge={<Badge tone={stage.tone}>{stage.label}</Badge>}
        footer={
          <>
            {editing && (
              <div className="flex items-center gap-1.5 mr-auto">
                <Button size="sm" variant="ghost" icon={Trash2} onClick={() => setConfirm('delete')}>Delete</Button>
                {post.status !== 'posted' && <Button size="sm" variant="ghost" icon={Ban} onClick={() => setConfirm('drop')}>Drop</Button>}
              </div>
            )}
            {editing && prev && (
              <Button icon={ArrowLeft} onClick={() => setSendBack(s => (s === null ? '' : null))}>Send back</Button>
            )}
            <Button onClick={() => save()} busy={saving} busyLabel="Saving…" disabled={saving || (editing && !dirty)}>
              {editing ? 'Save' : 'Create post'}
            </Button>
            {editing && next && (
              <Button variant="primary" icon={ArrowRight} onClick={advance} disabled={saving}>{stage.next}</Button>
            )}
          </>
        }
      >
        {sendBack !== null && (
          <div className="flex flex-col gap-2 p-3 mb-5 rounded-xl" style={{ background: 'var(--adm-wait-wash)', border: '1px solid var(--adm-wait)' }}>
            <TextArea label={`Send back to ${prev?.label} — what needs fixing?`} rows={2} value={sendBack}
              onChange={e => setSendBack(e.target.value)} placeholder="The second photo is blurry; the French caption needs the date." />
            <div className="flex justify-end gap-2">
              <Button size="sm" variant="ghost" onClick={() => setSendBack(null)}>Cancel</Button>
              <Button size="sm" variant="primary" icon={ArrowLeft} onClick={goBack}>Send back</Button>
            </div>
          </div>
        )}

        <Section title="Idea">
          <TextField label="Working title" required value={form.title} error={error}
            onChange={e => set('title', e.target.value)} placeholder="Hackathon countdown — 3 days left" />
          <TextArea label="Brief" rows={3} value={form.brief} onChange={e => set('brief', e.target.value)}
            placeholder="What the post shows and what it should make people do." />
          <div className="grid gap-3 sm:grid-cols-3">
            <SelectField label="Format" value={form.format} onChange={e => set('format', e.target.value)}>
              {FORMATS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
            </SelectField>
            <TextField label="Publish at" type="datetime-local" value={form.publish_at} onChange={e => set('publish_at', e.target.value)} />
            <SelectField label="Event" value={form.event_id} onChange={e => set('event_id', e.target.value)}>
              <option value="">None</option>
              {events.map(ev => <option key={ev.id} value={ev.id}>{ev.title_en} · {ev.date}</option>)}
            </SelectField>
          </div>
          <div>
            <span className="adm-label">Platforms</span>
            <div className="flex flex-wrap gap-1.5">
              {PLATFORMS.map(p => {
                const on = form.platforms.includes(p.value)
                return (
                  <button key={p.value} type="button" aria-pressed={on} onClick={() => togglePlatform(p.value)}
                    className="px-2.5 h-8 rounded-lg text-[12px] font-semibold"
                    style={{
                      background: on ? 'var(--adm-signal-wash)' : 'var(--adm-board-sunk)',
                      color: on ? 'var(--adm-signal)' : 'var(--adm-silk-faint)',
                      border: `1px solid ${on ? 'var(--adm-signal-edge)' : 'var(--adm-trace)'}`,
                    }}>
                    {p.label}
                  </button>
                )
              })}
            </div>
          </div>
        </Section>

        <Section title="Team">
          <div className="grid gap-3 sm:grid-cols-2">
            {ROLES.map(r => (
              <SelectField key={r.key} label={r.label} value={form[r.key]} onChange={e => set(r.key, e.target.value)}>
                <option value="">Nobody yet</option>
                {personOptions}
              </SelectField>
            ))}
          </div>
        </Section>

        <Section title="Caption">
          <CaptionEditor form={form} set={set} context={aiContext} snippets={snippets} />
        </Section>

        <Section title="Shoot">
          <CheckField label="Needs a photo shoot" description="Off for posts made from existing photos or graphics only; the board then skips Shooting."
            checked={form.needs_shoot} onChange={v => set('needs_shoot', v)} />
          {form.needs_shoot && (
            <TextArea label="Shot list" rows={3} value={form.shot_list} onChange={e => set('shot_list', e.target.value)}
              placeholder="Wide shot of the room, close-ups of the robots, team photo at the end." />
          )}
        </Section>

        <Section title="Files">
          {editing
            ? <PostFiles postId={post.id} assets={assets} onChanged={() => { loadExtras(); onSaved() }} />
            : <p className="text-[12px]" style={{ color: 'var(--adm-silk-faint)' }}>Create the post first, then add photos.</p>}
        </Section>

        {editing && ['scheduled', 'posted'].includes(post.status) && (
          <Section title="Posting">
            <div className="flex flex-wrap gap-1.5">
              {CAPTION_LANGS.filter(l => form[l.column]).map(l => (
                <Button key={l.value} size="sm" icon={Copy} onClick={() => copyCaption(l.value)}>Copy {l.label}</Button>
              ))}
            </div>
            <TextArea label="Live links" rows={2} value={form.posted_links} onChange={e => set('posted_links', e.target.value)}
              hint="One link per line, so the team can find the post later." />
          </Section>
        )}

        {editing && (
          <section className="flex flex-col gap-3">
            <h3 className="adm-eyebrow">Comments</h3>
            <PostComments postId={post.id} comments={comments} people={people} onChanged={loadExtras} />
          </section>
        )}
      </Drawer>

      <ConfirmDialog
        open={confirm === 'delete'}
        onClose={() => setConfirm(null)}
        onConfirm={remove}
        title={`Delete “${post?.title}”?`}
        message="The post, its files list and its comments are removed for good. To keep a record, drop it instead."
        confirmLabel="Delete"
      />
      <ConfirmDialog
        open={confirm === 'drop'}
        onClose={() => setConfirm(null)}
        onConfirm={drop}
        title={`Drop “${post?.title}”?`}
        message="It leaves the board but stays in the database with its files and comments."
        confirmLabel="Drop"
        busyLabel="Dropping…"
        danger={false}
      />
    </>
  )
}
