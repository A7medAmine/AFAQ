import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  ArrowDown, ArrowLeft, ArrowUp, ExternalLink, Loader2, Plus, Sparkles, Trash2, Upload, X,
} from 'lucide-react'
import { logActivity, read, run, supabase, uploadFile } from '../lib/db'
import useAdminStore from '../store/adminStore'
import { formatDate } from '../lib/format'
import { LEVELS, RESOURCE_KINDS, buildAiPrompt, guessKind, isHttpUrl, parseAiAnswer, slugify } from '../lib/tutorials'
import MarkdownEditor from '../components/markdown/MarkdownEditor'
import Panel from '../components/ui/Panel'
import Modal from '../components/ui/Modal'
import ConfirmDialog from '../components/ui/ConfirmDialog'
import Button, { IconButton } from '../components/ui/Button'
import { StatusBadge } from '../components/ui/Badge'
import { ErrorState } from '../components/ui/EmptyState'
import { SelectField, TextArea, TextField } from '../components/ui/Field'
import CopyButton from '../components/ui/CopyButton'

const BLANK = {
  title: '', slug: '', summary: '', content: '', cover_url: '', level: 'beginner',
  tags: [], resources: [], requirements: '', event_id: '', is_published: false,
}

const fromRow = row => ({
  title: row.title || '',
  slug: row.slug || '',
  summary: row.summary || '',
  content: row.content || '',
  cover_url: row.cover_url || '',
  level: row.level || 'beginner',
  tags: row.tags || [],
  resources: Array.isArray(row.resources) ? row.resources : [],
  requirements: row.requirements || '',
  event_id: row.event_id ? String(row.event_id) : '',
  is_published: !!row.is_published,
})

const CONTENT_PLACEHOLDER = `## What we will build

A short intro: what the reader makes and why it is useful.

## What you need

- [ ] Arduino Uno and USB cable
- [ ] Arduino IDE installed

### Step 1: Wire the LED

\`\`\`cpp title="blink.ino"
void setup() { pinMode(13, OUTPUT); }
void loop() { digitalWrite(13, HIGH); delay(500); digitalWrite(13, LOW); delay(500); }
\`\`\`

> [!TIP]
> Tip: paste an answer from the AI prompt here and the fields fill in by themselves.`

export default function TutorialEditorPage() {
  const { id } = useParams()
  const isNew = id === 'new'
  const navigate = useNavigate()
  const addToast = useAdminStore(s => s.addToast)
  const adminProfile = useAdminStore(s => s.adminProfile)

  const [form, setForm] = useState(BLANK)
  const [saved, setSaved] = useState(BLANK)
  const [row, setRow] = useState(null)
  const [state, setState] = useState({ loading: !isNew, error: null })
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)
  const [slugTouched, setSlugTouched] = useState(!isNew)
  const [events, setEvents] = useState([])
  const [tagInput, setTagInput] = useState('')
  const [coverUploading, setCoverUploading] = useState(0)
  const [aiOpen, setAiOpen] = useState(false)
  const [leaving, setLeaving] = useState(false)

  const dirty = useMemo(() => JSON.stringify(form) !== JSON.stringify(saved), [form, saved])

  const load = useCallback(async () => {
    if (isNew) return
    setState({ loading: true, error: null })
    const { ok, data, message } = await read(supabase.from('tutorials').select('*').eq('id', id).maybeSingle())
    if (!ok) { setState({ loading: false, error: message }); return }
    if (!data) { setState({ loading: false, error: 'This tutorial does not exist any more.' }); return }
    const next = fromRow(data)
    setRow(data)
    setForm(next)
    setSaved(next)
    setState({ loading: false, error: null })
  }, [id, isNew])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    read(supabase.from('events').select('id, title_en, date, time, location_en').order('date', { ascending: false }).limit(150))
      .then(({ data }) => setEvents(data || []))
  }, [])

  // Closing the tab with unsaved work asks first.
  useEffect(() => {
    if (!dirty) return
    const warn = e => { e.preventDefault(); e.returnValue = '' }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty])

  const set = (key, value) => {
    setForm(f => {
      const next = { ...f, [key]: value }
      if (key === 'title' && !slugTouched) next.slug = slugify(value).slice(0, 80)
      return next
    })
    setErrors(e => ({ ...e, [key]: undefined }))
  }

  const event = events.find(e => String(e.id) === form.event_id) || null

  // ---- tags -----------------------------------------------------------

  const addTags = raw => {
    const incoming = raw.split(',').map(t => t.trim().toLowerCase()).filter(Boolean)
    if (!incoming.length) return
    set('tags', [...new Set([...form.tags, ...incoming])].slice(0, 12))
    setTagInput('')
  }

  // ---- resources ------------------------------------------------------

  const setResource = (i, patch) => set('resources', form.resources.map((r, j) => {
    if (j !== i) return r
    const next = { ...r, ...patch }
    // Guess the kind from the URL until someone picks one by hand.
    if (patch.url !== undefined && !r.kindPicked) next.kind = guessKind(patch.url)
    return next
  }))
  const moveResource = (i, dir) => {
    const list = [...form.resources]
    const j = i + dir
    if (j < 0 || j >= list.length) return
    ;[list[i], list[j]] = [list[j], list[i]]
    set('resources', list)
  }

  // ---- uploads --------------------------------------------------------

  const uploadImage = useCallback(async file => {
    try {
      return await uploadFile(file)
    } catch (err) {
      addToast(err.message, 'error')
      throw err
    }
  }, [addToast])

  const uploadCover = async file => {
    if (!file) return
    setCoverUploading(1)
    try {
      set('cover_url', await uploadFile(file, pct => setCoverUploading(Math.max(1, pct))))
    } catch (err) {
      addToast(err.message, 'error')
    } finally {
      setCoverUploading(0)
    }
  }

  // ---- pasting an AI answer -------------------------------------------

  const onPasteText = (text, insert) => {
    const parsed = parseAiAnswer(text)
    if (!parsed) return false
    const filled = [
      parsed.title && 'title', parsed.summary && 'summary', parsed.level && 'level',
      parsed.tags.length && 'tags', parsed.requirements.length && 'what to bring', parsed.resources.length && 'links',
    ].filter(Boolean)
    setForm(f => {
      const next = { ...f }
      if (parsed.title) { next.title = parsed.title; if (!slugTouched) next.slug = slugify(parsed.title).slice(0, 80) }
      if (parsed.summary) next.summary = parsed.summary
      if (parsed.level) next.level = parsed.level
      if (parsed.tags.length) next.tags = [...new Set([...f.tags, ...parsed.tags])].slice(0, 12)
      if (parsed.requirements.length) {
        const have = f.requirements.split('\n').map(s => s.trim()).filter(Boolean)
        next.requirements = [...new Set([...have, ...parsed.requirements])].join('\n')
      }
      if (parsed.resources.length) {
        const urls = new Set(f.resources.map(r => r.url))
        next.resources = [...f.resources, ...parsed.resources.filter(r => !urls.has(r.url))]
      }
      return next
    })
    insert(parsed.body)
    setErrors({})
    addToast(filled.length ? `Filled ${filled.join(', ')} from the AI answer.` : 'Pasted the AI answer.', 'success')
    return true
  }

  // ---- save -----------------------------------------------------------

  const validate = async () => {
    const next = {}
    if (!form.title.trim()) next.title = 'A title is required.'
    const slug = form.slug.trim()
    if (!slug) next.slug = 'The page address is required.'
    else if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug)) next.slug = 'Use lowercase letters, numbers and single dashes only.'
    else {
      let q = supabase.from('tutorials').select('id').eq('slug', slug).limit(1)
      if (!isNew) q = q.neq('id', id)
      const { data } = await read(q)
      if (data?.length) next.slug = 'Another tutorial already uses this address.'
    }
    if (form.resources.some(r => r.url && !isHttpUrl(r.url))) next.resources = 'Every link must start with http:// or https://'
    return next
  }

  const save = async (publish = form.is_published) => {
    if (saving) return
    const next = await validate()
    if (Object.keys(next).length) {
      setErrors(next)
      addToast(Object.values(next)[0], 'error')
      return
    }
    setSaving(true)
    const payload = {
      title: form.title.trim(),
      slug: form.slug.trim(),
      summary: form.summary.trim() || null,
      content: form.content || null,
      cover_url: form.cover_url || null,
      level: form.level,
      tags: form.tags,
      resources: form.resources
        .filter(r => r.url?.trim())
        .map(r => ({ label: r.label?.trim() || r.url.trim(), url: r.url.trim(), kind: r.kind || guessKind(r.url) })),
      requirements: form.requirements.trim() || null,
      event_id: form.event_id ? Number(form.event_id) : null,
      is_published: publish,
    }
    const { ok, data } = await run(
      isNew
        ? supabase.from('tutorials').insert({ ...payload, created_by: adminProfile?.user_id }).select('*').single()
        : supabase.from('tutorials').update(payload).eq('id', id).select('*').single(),
      {
        success: publish && !saved.is_published ? `“${payload.title}” is live on the Learn page.`
          : !publish && saved.is_published ? `“${payload.title}” is hidden from the site.`
            : 'Saved.',
        failure: 'The tutorial did not save.',
      }
    )
    setSaving(false)
    if (!ok) return
    const fresh = fromRow(data)
    setRow(data)
    setForm(fresh)
    setSaved(fresh)
    setSlugTouched(true)
    const action = isNew ? 'created' : publish !== saved.is_published ? (publish ? 'published' : 'unpublished') : 'updated'
    logActivity(action, 'tutorials', data.id, { name: data.title })
    if (isNew) navigate(`/admin/tutorials/${data.id}`, { replace: true })
  }

  // Ctrl+S saves without leaving the page.
  const saveRef = useRef(save)
  saveRef.current = save
  useEffect(() => {
    const onKey = e => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') { e.preventDefault(); saveRef.current() }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const back = () => (dirty ? setLeaving(true) : navigate('/admin/tutorials'))

  if (state.loading) {
    return <div className="flex items-center gap-2 py-20 justify-center" style={{ color: 'var(--adm-silk-faint)' }}><Loader2 size={16} className="adm-spin" /> Loading tutorial…</div>
  }
  if (state.error) {
    return (
      <Panel>
        <ErrorState message={state.error} onRetry={load} />
        <div className="flex justify-center pb-4"><Link to="/admin/tutorials" className="text-sm font-semibold" style={{ color: 'var(--adm-signal)' }}>Back to tutorials</Link></div>
      </Panel>
    )
  }

  return (
    <div>
      {/* Header */}
      <div className="flex flex-wrap items-center gap-3 mb-5">
        <button type="button" onClick={back} className="adm-btn adm-btn-ghost" aria-label="Back to tutorials">
          <ArrowLeft size={15} /> Tutorials
        </button>
        <div className="min-w-0 flex-1">
          <h1 className="text-xl font-bold adm-truncate">{form.title.trim() || (isNew ? 'New tutorial' : 'Untitled')}</h1>
          <div className="flex items-center gap-2 text-[12px]" style={{ color: 'var(--adm-silk-faint)' }}>
            <StatusBadge status={saved.is_published ? 'published' : 'draft'} />
            {dirty ? <span>Unsaved changes</span> : row?.updated_at ? <span>Saved {formatDate(row.updated_at)}</span> : null}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button icon={Sparkles} onClick={() => setAiOpen(true)}>Copy AI prompt</Button>
          {saved.is_published && row?.slug && (
            <a href={`/learn/${row.slug}`} target="_blank" rel="noopener noreferrer" className="adm-btn">
              <ExternalLink size={15} /> View on site
            </a>
          )}
          {saved.is_published ? (
            <>
              <Button onClick={() => save(false)} disabled={saving}>Unpublish</Button>
              <Button variant="primary" onClick={() => save(true)} busy={saving} busyLabel="Saving…" disabled={!dirty}>Save changes</Button>
            </>
          ) : (
            <>
              <Button onClick={() => save(false)} busy={saving} busyLabel="Saving…">Save draft</Button>
              <Button variant="primary" onClick={() => save(true)} disabled={saving}>Publish</Button>
            </>
          )}
        </div>
      </div>

      <div className="grid xl:grid-cols-[minmax(0,1fr)_340px] gap-5 items-start">
        {/* Main column */}
        <div className="space-y-4 min-w-0">
          <Panel>
            <div className="p-4 space-y-4">
              <TextField
                label="Title" required value={form.title} error={errors.title}
                placeholder="Build a line-following robot"
                onChange={e => set('title', e.target.value)}
              />
              <TextArea
                label="Summary" rows={2} value={form.summary}
                hint="One or two sentences for the card on the Learn page and for link previews."
                placeholder="Wire two IR sensors to an Arduino and write the code that keeps the robot on the line."
                onChange={e => set('summary', e.target.value)}
                maxLength={300}
              />
            </div>
          </Panel>

          <div>
            <div className="flex items-baseline justify-between gap-3 mb-1.5">
              <span className="adm-label" style={{ marginBottom: 0 }}>Content</span>
              <span className="text-[11px]" style={{ color: 'var(--adm-silk-faint)' }}>
                Pasting an answer from the AI prompt fills the fields too.
              </span>
            </div>
            <MarkdownEditor
              value={form.content}
              onChange={v => set('content', v)}
              onUploadImage={uploadImage}
              onPasteText={onPasteText}
              placeholder={CONTENT_PLACEHOLDER}
            />
          </div>
        </div>

        {/* Side column */}
        <div className="space-y-4 xl:sticky xl:top-4">
          <Panel>
            <div className="p-4 space-y-4">
              <h2 className="text-sm font-bold">Settings</h2>
              <TextField
                label="Page address" required value={form.slug} error={errors.slug}
                hint={`afaq.club/learn/${form.slug || '…'}`}
                onChange={e => { setSlugTouched(true); set('slug', e.target.value.toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/-{2,}/g, '-')) }}
                onBlur={() => set('slug', slugify(form.slug))}
              />
              <SelectField label="Level" value={form.level} onChange={e => set('level', e.target.value)}>
                {LEVELS.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}
              </SelectField>
              <SelectField
                label="Workshop" value={form.event_id} onChange={e => set('event_id', e.target.value)}
                hint="The event page links to this tutorial once it is published."
              >
                <option value="">Not part of a workshop</option>
                {events.map(e => <option key={e.id} value={String(e.id)}>{e.title_en} · {formatDate(e.date)}</option>)}
              </SelectField>

              <div>
                <span className="adm-label">Tags</span>
                <input
                  className="adm-input"
                  value={tagInput}
                  onChange={e => { if (e.target.value.endsWith(',')) addTags(e.target.value); else setTagInput(e.target.value) }}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addTags(tagInput) } }}
                  onBlur={() => addTags(tagInput)}
                  placeholder="arduino, sensors…"
                  aria-label="Add tags"
                />
                {form.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {form.tags.map(t => (
                      <span key={t} className="flex items-center gap-1 pl-2 pr-1 py-0.5 rounded-md text-xs" style={{ background: 'var(--adm-board-sunk)', color: 'var(--adm-silk-dim)' }}>
                        {t}
                        <button type="button" onClick={() => set('tags', form.tags.filter(x => x !== t))} className="adm-icon-btn" style={{ width: 18, height: 18 }} aria-label={`Remove ${t}`}>
                          <X size={11} />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <span className="adm-label">Cover image</span>
                <div className="flex items-center gap-3">
                  <label className="adm-btn" style={{ cursor: coverUploading ? 'wait' : 'pointer' }}>
                    {coverUploading ? <Loader2 size={15} className="adm-spin" /> : <Upload size={15} />}
                    {coverUploading ? `Uploading ${coverUploading}%` : form.cover_url ? 'Replace' : 'Upload'}
                    <input type="file" accept="image/*" className="sr-only" disabled={!!coverUploading}
                      onChange={e => { uploadCover(e.target.files?.[0]); e.target.value = '' }} />
                  </label>
                  {form.cover_url && (
                    <>
                      <img src={form.cover_url} alt="Cover preview" className="rounded-md object-cover" style={{ width: 64, height: 40, border: '1px solid var(--adm-trace)' }} />
                      <button type="button" onClick={() => set('cover_url', '')} className="text-[13px] font-medium" style={{ color: 'var(--adm-fault)' }}>Remove</button>
                    </>
                  )}
                </div>
              </div>
            </div>
          </Panel>

          <Panel>
            <div className="p-4">
              <TextArea
                label="What to bring or install" rows={4} value={form.requirements}
                hint="One item per line. Shown as a checklist beside the tutorial."
                placeholder={'Laptop with Arduino IDE 2\nUSB-B cable'}
                onChange={e => set('requirements', e.target.value)}
              />
            </div>
          </Panel>

          <Panel>
            <div className="p-4">
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-sm font-bold">Resources</h2>
                <Button size="sm" icon={Plus} onClick={() => set('resources', [...form.resources, { label: '', url: '', kind: 'link' }])}>Add link</Button>
              </div>
              <p className="text-[12px] mb-3" style={{ color: 'var(--adm-silk-faint)' }}>
                Slides, starter code, datasheets, downloads. Shown as buttons at the top of the tutorial.
              </p>
              {errors.resources && <p className="text-xs mb-2" style={{ color: 'var(--adm-fault)' }}>{errors.resources}</p>}
              {form.resources.length === 0 ? (
                <p className="text-[12px] py-3 text-center rounded-md" style={{ color: 'var(--adm-silk-faint)', background: 'var(--adm-board-sunk)' }}>No links yet.</p>
              ) : (
                <ul className="space-y-2.5">
                  {form.resources.map((r, i) => (
                    <li key={i} className="rounded-md p-2.5 space-y-2" style={{ background: 'var(--adm-board-sunk)' }}>
                      <div className="flex items-center gap-1.5">
                        <select
                          className="adm-input" style={{ width: 'auto', paddingBlock: 4 }}
                          value={r.kind || 'link'} aria-label="Kind of resource"
                          onChange={e => setResource(i, { kind: e.target.value, kindPicked: true })}
                        >
                          {RESOURCE_KINDS.map(k => <option key={k.value} value={k.value}>{k.label}</option>)}
                        </select>
                        <span className="flex-1" />
                        <IconButton icon={ArrowUp} label="Move up" size={14} disabled={i === 0} onClick={() => moveResource(i, -1)} />
                        <IconButton icon={ArrowDown} label="Move down" size={14} disabled={i === form.resources.length - 1} onClick={() => moveResource(i, 1)} />
                        <IconButton icon={Trash2} label="Remove link" size={14} danger onClick={() => set('resources', form.resources.filter((_, j) => j !== i))} />
                      </div>
                      <input className="adm-input" placeholder="Label, e.g. Workshop slides" value={r.label || ''} aria-label="Link label"
                        onChange={e => setResource(i, { label: e.target.value })} />
                      <input className="adm-input" placeholder="https://…" value={r.url || ''} aria-label="Link address" type="url"
                        aria-invalid={r.url && !isHttpUrl(r.url) ? 'true' : undefined}
                        onChange={e => setResource(i, { url: e.target.value.trim() })} />
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </Panel>
        </div>
      </div>

      <AiPromptModal open={aiOpen} onClose={() => setAiOpen(false)} form={form} event={event} />

      <ConfirmDialog
        open={leaving}
        onClose={() => setLeaving(false)}
        onConfirm={() => { setSaved(form); navigate('/admin/tutorials') }}
        title="Leave without saving?"
        message="Your changes to this tutorial have not been saved."
        confirmLabel="Leave"
      />
    </div>
  )
}

function AiPromptModal({ open, onClose, form, event }) {
  const [projects, setProjects] = useState(null)
  const [projectId, setProjectId] = useState('')
  const [project, setProject] = useState(null)
  const [notes, setNotes] = useState('')

  useEffect(() => {
    if (!open || projects) return
    read(supabase.from('projects').select('id, title_en').order('created_at', { ascending: false }))
      .then(({ data }) => setProjects(data || []))
  }, [open, projects])

  useEffect(() => {
    if (!projectId) { setProject(null); return }
    let cancelled = false
    read(supabase.from('projects')
      .select('id, title_en, description_en, content_en, category, technologies, github_url, demo_url')
      .eq('id', projectId).maybeSingle())
      .then(({ data }) => { if (!cancelled) setProject(data || null) })
    return () => { cancelled = true }
  }, [projectId])

  const prompt = useMemo(() => buildAiPrompt({ form, event, project, notes }), [form, event, project, notes])

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="xl"
      title="Copy a prompt for an AI"
      description="Paste it into ChatGPT, Claude or Gemini. Then copy the whole answer and paste it into the content box: the title, summary, tags, what to bring and links fill in by themselves."
      footer={
        <>
          <Button onClick={onClose} data-dialog-dismiss="true">Close</Button>
          <CopyPromptButton value={prompt} />
        </>
      }
    >
      <div className="grid lg:grid-cols-[300px_minmax(0,1fr)] gap-5">
        <div className="space-y-4">
          <SelectField
            label="Based on a club project" value={projectId} onChange={e => setProjectId(e.target.value)}
            hint="Its description, write-up, parts and links go into the prompt."
          >
            <option value="">No project</option>
            {(projects || []).map(p => <option key={p.id} value={String(p.id)}>{p.title_en}</option>)}
          </SelectField>
          <TextArea
            label="Details for the AI" rows={10} value={notes} onChange={e => setNotes(e.target.value)}
            hint="Workshop plan, code you will use, wiring, links. The more you give, the less it guesses."
            placeholder={'90-minute workshop, 20 students.\nWe use the Arduino Uno + HC-SR04.\nCode: …'}
          />
          <p className="text-[12px]" style={{ color: 'var(--adm-silk-faint)' }}>
            The title, level, tags, workshop, links and any draft you already wrote are included automatically.
          </p>
        </div>
        <div className="min-w-0">
          <div className="flex items-center justify-between mb-1.5">
            <span className="adm-label" style={{ marginBottom: 0 }}>Prompt</span>
            <CopyButton value={prompt} label="Copy prompt" />
          </div>
          <textarea
            readOnly
            value={prompt}
            className="adm-input"
            rows={22}
            style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace', fontSize: 12, lineHeight: 1.55 }}
            aria-label="Prompt to copy"
            onFocus={e => e.target.select()}
          />
        </div>
      </div>
    </Modal>
  )
}

function CopyPromptButton({ value }) {
  const [copied, setCopied] = useState(false)
  useEffect(() => {
    if (!copied) return
    const t = setTimeout(() => setCopied(false), 1800)
    return () => clearTimeout(t)
  }, [copied])
  return (
    <Button
      variant="primary"
      icon={Sparkles}
      onClick={async () => {
        try { await navigator.clipboard.writeText(value); setCopied(true) } catch { /* selectable in the box */ }
      }}
    >
      {copied ? 'Copied' : 'Copy prompt'}
    </Button>
  )
}
