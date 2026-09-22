import { useCallback, useEffect, useMemo, useState } from 'react'
import { CircuitBoard, Code2, Eye, EyeOff, ImageOff, Link2, Loader2, Pencil, Plus, Trash2, Upload, X } from 'lucide-react'
import { deleteUploadedFile, logActivity, read, run, supabase, uploadFile } from '../lib/db'
import useAdminStore from '../store/adminStore'
import useQueryParam from '../hooks/useQueryParam'
import { formatDate, formatDateTime, toForm } from '../lib/format'
import PageHeader, { FilterTabs } from '../components/ui/PageHeader'
import DataTable from '../components/ui/DataTable'
import Modal from '../components/ui/Modal'
import ConfirmDialog from '../components/ui/ConfirmDialog'
import EmptyState, { ErrorState } from '../components/ui/EmptyState'
import Button, { IconButton } from '../components/ui/Button'
import ExportMenu from '../components/ui/ExportMenu'
import { StatusBadge } from '../components/ui/Badge'
import Panel from '../components/ui/Panel'
import { CheckField, LocalizedField, SelectField, TextField } from '../components/ui/Field'

const CATEGORIES = ['Arduino', 'Robotics', 'IoT', 'Electronics', 'Embedded Systems', 'AI']

const BLANK = {
  title_en: '', title_ar: '', title_fr: '',
  description_en: '', description_ar: '', description_fr: '',
  category: '', technologies: [], github_url: '', demo_url: '', thumbnail_url: '', is_published: false,
}

const FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'published', label: 'Published' },
  { value: 'draft', label: 'Drafts' },
]

export default function ProjectsPage() {
  const addToast = useAdminStore(s => s.addToast)
  const adminProfile = useAdminStore(s => s.adminProfile)

  const [projects, setProjects] = useState([])
  const [state, setState] = useState({ loading: true, error: null })
  const [status, setStatus] = useQueryParam('status', 'all')
  const [search] = useQueryParam('q')
  const [newFlag, setNewFlag] = useQueryParam('new')

  const [editor, setEditor] = useState(null)
  const [pendingDelete, setPendingDelete] = useState(null)
  const [working, setWorking] = useState({})

  const load = useCallback(async () => {
    setState(s => ({ ...s, error: null }))
    const { ok, data, message } = await read(
      supabase.from('projects').select('*').order('created_at', { ascending: false })
    )
    if (!ok) { setState({ loading: false, error: message }); return }
    setProjects(data || [])
    setState({ loading: false, error: null })
  }, [])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    if (newFlag) { setEditor({ project: null }); setNewFlag('') }
  }, [newFlag, setNewFlag])

  const filtered = useMemo(() => {
    if (status === 'published') return projects.filter(p => p.is_published)
    if (status === 'draft') return projects.filter(p => !p.is_published)
    return projects
  }, [projects, status])

  const filterOptions = FILTERS.map(f => ({
    ...f,
    count: f.value === 'all' ? projects.length
      : f.value === 'published' ? projects.filter(p => p.is_published).length
        : projects.filter(p => !p.is_published).length,
  }))

  const togglePublish = async project => {
    setWorking(w => ({ ...w, [project.id]: true }))
    const next = !project.is_published
    const { ok } = await run(
      supabase.from('projects').update({ is_published: next }).eq('id', project.id),
      {
        success: next ? `“${project.title_en}” is live on the site.` : `“${project.title_en}” is hidden from the site.`,
        failure: 'That switch did not change.',
      }
    )
    setWorking(w => ({ ...w, [project.id]: false }))
    if (ok) {
      setProjects(list => list.map(p => (p.id === project.id ? { ...p, is_published: next } : p)))
      logActivity(next ? 'published' : 'unpublished', 'projects', project.id, { name: project.title_en })
    }
  }

  const remove = async () => {
    const project = pendingDelete
    const { ok } = await run(
      supabase.from('projects').delete().eq('id', project.id),
      { success: `“${project.title_en}” deleted.`, failure: 'The project was not deleted.' }
    )
    if (ok) {
      logActivity('deleted', 'projects', project.id, { name: project.title_en })
      if (project.thumbnail_url) deleteUploadedFile(project.thumbnail_url)
      setPendingDelete(null)
      load()
    }
  }

  const columns = useMemo(() => [
    {
      header: 'Project',
      accessorKey: 'title_en',
      cell: ({ row }) => (
        <div className="flex items-center gap-3 min-w-0">
          {row.original.thumbnail_url ? (
            <img
              src={row.original.thumbnail_url}
              alt=""
              className="rounded-md object-cover shrink-0"
              style={{ width: 34, height: 34, border: '1px solid var(--adm-trace)' }}
            />
          ) : (
            <span
              className="flex items-center justify-center rounded-md shrink-0"
              style={{ width: 34, height: 34, background: 'var(--adm-board-sunk)', color: 'var(--adm-silk-faint)' }}
              aria-hidden="true"
            >
              <ImageOff size={14} />
            </span>
          )}
          <span className="min-w-0">
            <span className="block text-sm font-semibold adm-truncate" style={{ maxWidth: 230 }}>{row.original.title_en}</span>
            <span className="block text-[11px] adm-truncate" style={{ color: 'var(--adm-silk-faint)', maxWidth: 230 }}>
              {row.original.category || 'Uncategorised'}
            </span>
          </span>
        </div>
      ),
    },
    {
      header: 'Built with',
      accessorKey: 'technologies',
      enableSorting: false,
      cell: ({ row }) => {
        const tech = row.original.technologies || []
        if (!tech.length) return <span style={{ color: 'var(--adm-silk-faint)' }}>—</span>
        return (
          <span className="flex flex-wrap gap-1">
            {tech.slice(0, 3).map(t => (
              <span
                key={t}
                className="px-1.5 py-0.5 rounded text-[11px]"
                style={{ background: 'var(--adm-board-sunk)', color: 'var(--adm-silk-dim)' }}
              >
                {t}
              </span>
            ))}
            {tech.length > 3 && (
              <span className="adm-data text-[11px] self-center" style={{ color: 'var(--adm-silk-faint)' }}>
                +{tech.length - 3}
              </span>
            )}
          </span>
        )
      },
    },
    {
      header: 'Links',
      id: 'links',
      enableSorting: false,
      cell: ({ row }) => (
        <span className="flex items-center gap-1.5" style={{ color: 'var(--adm-silk-faint)' }}>
          {row.original.github_url && <Code2 size={14} aria-label="Has a repository link" />}
          {row.original.demo_url && <Link2 size={14} aria-label="Has a demo link" />}
          {!row.original.github_url && !row.original.demo_url && '—'}
        </span>
      ),
    },
    { header: 'Visibility', accessorKey: 'is_published', cell: ({ row }) => (
      <StatusBadge status={row.original.is_published ? 'published' : 'draft'} />
    )},
    { header: 'Created', accessorKey: 'created_at', cell: ({ row }) => (
      <span className="adm-data text-[12px]">{formatDate(row.original.created_at)}</span>
    )},
    {
      header: '',
      id: 'actions',
      enableSorting: false,
      cell: ({ row }) => {
        const p = row.original
        return (
          <div className="flex items-center justify-end gap-0.5" onClick={e => e.stopPropagation()}>
            {working[p.id] && <Loader2 size={14} className="adm-spin mr-1" style={{ color: 'var(--adm-silk-faint)' }} />}
            <IconButton
              icon={p.is_published ? EyeOff : Eye}
              label={p.is_published ? 'Unpublish' : 'Publish'}
              disabled={working[p.id]}
              onClick={() => togglePublish(p)}
            />
            <IconButton icon={Pencil} label="Edit" onClick={() => setEditor({ project: p })} />
            <IconButton icon={Trash2} label="Delete" danger onClick={() => setPendingDelete(p)} />
          </div>
        )
      },
    },
  ], [working]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div>
      <PageHeader
        eyebrow="Publish"
        title="Projects"
        description="What the club has built. Published projects appear in the public projects gallery."
        actions={
          <>
            <ExportMenu
              filename={`projects-${status}-${new Date().toISOString().slice(0, 10)}`}
              title="Projects"
              subtitle={`${FILTERS.find(f => f.value === status)?.label || 'All'} · ${formatDateTime(new Date())}`}
              headers={['Title', 'Category', 'Technologies', 'Repository', 'Demo', 'Visibility', 'Created']}
              rows={filtered.map(p => [
                p.title_en, p.category, (p.technologies || []).join(', '), p.github_url, p.demo_url,
                p.is_published ? 'published' : 'draft', formatDate(p.created_at),
              ])}
              statusColumnIndex={5}
              disabled={!filtered.length}
            />
            <Button variant="primary" icon={Plus} onClick={() => setEditor({ project: null })}>New project</Button>
          </>
        }
      />

      {state.error ? (
        <Panel><ErrorState message={state.error} onRetry={load} /></Panel>
      ) : (
        <DataTable
          columns={columns}
          data={filtered}
          loading={state.loading}
          initialSearch={search}
          getRowId={row => String(row.id)}
          onRowClick={project => setEditor({ project })}
          searchPlaceholder="Search projects…"
          toolbar={<FilterTabs options={filterOptions} value={status} onChange={setStatus} label="Project filter" />}
          emptyState={
            projects.length === 0 ? (
              <EmptyState
                icon={CircuitBoard}
                title="No projects yet"
                description="Add what the club has built — boards, robots, tools — and publish it to the site."
                action={<Button variant="primary" icon={Plus} onClick={() => setEditor({ project: null })}>New project</Button>}
              />
            ) : (
              <EmptyState compact icon={CircuitBoard} title="Nothing in this view" description="Try another filter." />
            )
          }
        />
      )}

      <ProjectEditor
        key={editor?.project?.id || 'new'}
        open={!!editor}
        project={editor?.project}
        onClose={() => setEditor(null)}
        onSaved={() => { setEditor(null); load() }}
        addToast={addToast}
        createdBy={adminProfile?.user_id}
      />

      <ConfirmDialog
        open={!!pendingDelete}
        onClose={() => setPendingDelete(null)}
        onConfirm={remove}
        title="Delete this project?"
        message={pendingDelete ? `“${pendingDelete.title_en}” will be removed from the site and the console. This cannot be undone.` : ''}
        confirmLabel="Delete project"
      />
    </div>
  )
}

function ProjectEditor({ open, project, onClose, onSaved, addToast, createdBy }) {
  const [form, setForm] = useState(BLANK)
  const [lang, setLang] = useState('en')
  const [tech, setTech] = useState('')
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(0)

  useEffect(() => {
    if (!open) return
    setForm(project ? { ...toForm(BLANK, project), technologies: project.technologies || [] } : BLANK)
    setErrors({})
    setTech('')
    setLang('en')
  }, [open, project])

  const set = (key, value) => {
    setForm(f => ({ ...f, [key]: value }))
    setErrors(e => ({ ...e, [key]: undefined }))
  }

  const addTech = () => {
    const value = tech.trim()
    if (!value) return
    if (form.technologies.some(t => t.toLowerCase() === value.toLowerCase())) {
      setTech('')
      return
    }
    set('technologies', [...form.technologies, value])
    setTech('')
  }

  const upload = async file => {
    if (!file) return
    setUploading(1)
    try {
      set('thumbnail_url', await uploadFile(file, pct => setUploading(Math.max(1, pct))))
    } catch (err) {
      addToast(err.message, 'error')
    } finally {
      setUploading(0)
    }
  }

  const save = async () => {
    const next = {}
    if (!form.title_en.trim()) next.title_en = 'An English title is required — it is what the site shows.'
    for (const [key, label] of [['github_url', 'repository'], ['demo_url', 'demo']]) {
      const value = form[key]?.trim()
      if (value && !/^https?:\/\//i.test(value)) next[key] = `The ${label} link must start with http:// or https://`
    }
    if (Object.keys(next).length) { setErrors(next); if (next.title_en) setLang('en'); return }

    setSaving(true)
    const payload = {
      title_en: form.title_en.trim(), title_ar: form.title_ar.trim() || null, title_fr: form.title_fr.trim() || null,
      description_en: form.description_en || null, description_ar: form.description_ar || null, description_fr: form.description_fr || null,
      category: form.category || null,
      technologies: form.technologies,
      github_url: form.github_url.trim() || null,
      demo_url: form.demo_url.trim() || null,
      thumbnail_url: form.thumbnail_url || null,
      is_published: form.is_published,
    }

    const { ok } = await run(
      project
        ? supabase.from('projects').update(payload).eq('id', project.id)
        : supabase.from('projects').insert({ ...payload, created_by: createdBy }),
      {
        success: project ? `“${payload.title_en}” updated.` : `“${payload.title_en}” created.`,
        failure: 'The project did not save.',
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
      title={project ? 'Edit project' : 'New project'}
      description="Arabic and French are optional. The site falls back to English where a translation is missing."
      footer={
        <>
          <Button onClick={onClose} data-dialog-dismiss="true">Cancel</Button>
          <Button variant="primary" onClick={save} busy={saving} busyLabel="Saving…">
            {project ? 'Save changes' : 'Create project'}
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
          label="Description" prefix="description" multiline rows={4}
          values={form} onChange={set} lang={lang} onLangChange={setLang}
        />

        <div className="grid sm:grid-cols-2 gap-4">
          <SelectField label="Category" value={form.category} onChange={e => set('category', e.target.value)}>
            <option value="">No category</option>
            {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
          </SelectField>

          <div>
            <span className="adm-label">Built with</span>
            <div className="flex gap-2">
              <input
                className="adm-input"
                value={tech}
                onChange={e => setTech(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addTech() } }}
                placeholder="ESP32, C++, ROS…"
                aria-label="Add a technology"
              />
              <Button onClick={addTech} disabled={!tech.trim()}>Add</Button>
            </div>
            {form.technologies.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {form.technologies.map(t => (
                  <span
                    key={t}
                    className="flex items-center gap-1 pl-2 pr-1 py-0.5 rounded-md text-xs"
                    style={{ background: 'var(--adm-board-sunk)', color: 'var(--adm-silk-dim)' }}
                  >
                    {t}
                    <button
                      type="button"
                      onClick={() => set('technologies', form.technologies.filter(x => x !== t))}
                      className="adm-icon-btn"
                      style={{ width: 18, height: 18 }}
                      aria-label={`Remove ${t}`}
                    >
                      <X size={11} />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <TextField
            label="Repository" type="url" placeholder="https://github.com/…"
            value={form.github_url} error={errors.github_url}
            onChange={e => set('github_url', e.target.value)}
          />
          <TextField
            label="Demo" type="url" placeholder="https://…"
            value={form.demo_url} error={errors.demo_url}
            onChange={e => set('demo_url', e.target.value)}
          />
        </div>

        <div>
          <span className="adm-label">Thumbnail</span>
          <div className="flex items-center gap-3">
            <label className="adm-btn" style={{ cursor: uploading ? 'wait' : 'pointer' }}>
              {uploading ? <Loader2 size={15} className="adm-spin" /> : <Upload size={15} />}
              {uploading ? `Uploading ${uploading}%` : form.thumbnail_url ? 'Replace image' : 'Upload image'}
              <input
                type="file" accept="image/*" className="sr-only" disabled={!!uploading}
                onChange={e => { upload(e.target.files?.[0]); e.target.value = '' }}
              />
            </label>
            {form.thumbnail_url && (
              <div className="flex items-center gap-2">
                <img
                  src={form.thumbnail_url}
                  alt="Project thumbnail preview"
                  className="rounded-lg object-cover"
                  style={{ width: 52, height: 52, border: '1px solid var(--adm-trace)' }}
                />
                <button
                  type="button"
                  onClick={() => set('thumbnail_url', '')}
                  className="text-[13px] font-medium"
                  style={{ color: 'var(--adm-fault)' }}
                >
                  Remove
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="pt-4" style={{ borderTop: '1px solid var(--adm-trace)' }}>
          <CheckField
            label="Published"
            description="Show this project on the public site."
            checked={form.is_published}
            onChange={v => set('is_published', v)}
          />
        </div>
      </div>
    </Modal>
  )
}
