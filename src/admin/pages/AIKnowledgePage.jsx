import { useCallback, useEffect, useMemo, useState } from 'react'
import { Brain, Eye, EyeOff, Loader2, Pencil, Plus, Trash2 } from 'lucide-react'
import { api } from '../lib/db'
import useAdminStore from '../store/adminStore'
import useQueryParam from '../hooks/useQueryParam'
import { formatDate, formatDateTime } from '../lib/format'
import PageHeader, { FilterTabs } from '../components/ui/PageHeader'
import DataTable from '../components/ui/DataTable'
import Modal from '../components/ui/Modal'
import ConfirmDialog from '../components/ui/ConfirmDialog'
import EmptyState, { ErrorState } from '../components/ui/EmptyState'
import Button, { IconButton } from '../components/ui/Button'
import ExportMenu from '../components/ui/ExportMenu'
import Badge, { StatusBadge } from '../components/ui/Badge'
import Panel from '../components/ui/Panel'
import { CheckField, TextArea, TextField } from '../components/ui/Field'

const BLANK = { title: '', category: '', content: '', keywords: '', published: true }

const FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'published', label: 'Published' },
  { value: 'draft', label: 'Drafts' },
]

export default function AIKnowledgePage() {
  const addToast = useAdminStore(s => s.addToast)

  const [articles, setArticles] = useState([])
  const [state, setState] = useState({ loading: true, error: null })
  const [status, setStatus] = useQueryParam('status', 'all')
  const [category, setCategory] = useQueryParam('category', 'all')
  const [search] = useQueryParam('q')

  const [editor, setEditor] = useState(null)
  const [pendingDelete, setPendingDelete] = useState(null)
  const [working, setWorking] = useState({})

  const load = useCallback(async () => {
    setState(s => ({ ...s, error: null }))
    const { ok, data, message } = await api('/api/ai-knowledge')
    if (!ok) { setState({ loading: false, error: message }); return }
    setArticles(Array.isArray(data) ? data : [])
    setState({ loading: false, error: null })
  }, [])

  useEffect(() => { load() }, [load])

  const categories = useMemo(
    () => [...new Set(articles.map(a => a.category).filter(Boolean))].sort(),
    [articles]
  )

  const filtered = useMemo(
    () => articles.filter(a =>
      (status === 'all' || (status === 'published' ? a.published : !a.published)) &&
      (category === 'all' || a.category === category)
    ),
    [articles, status, category]
  )

  const filterOptions = FILTERS.map(f => ({
    ...f,
    count: f.value === 'all' ? articles.length
      : articles.filter(a => (f.value === 'published' ? a.published : !a.published)).length,
  }))

  const togglePublish = async article => {
    setWorking(w => ({ ...w, [article.id]: true }))
    const next = !article.published
    const { ok, message } = await api(`/api/ai-knowledge/${article.id}/publish`, {
      method: 'PATCH',
      body: { published: next },
    })
    setWorking(w => ({ ...w, [article.id]: false }))

    if (!ok) { addToast(message, 'error'); return }
    addToast(next ? 'The assistant can use this article now.' : 'The assistant will no longer use this article.')
    setArticles(list => list.map(a => (a.id === article.id ? { ...a, published: next } : a)))
  }

  const remove = async () => {
    const { ok, message } = await api(`/api/ai-knowledge/${pendingDelete.id}`, { method: 'DELETE' })
    if (!ok) { addToast(message, 'error'); return }
    addToast('Article deleted.')
    setPendingDelete(null)
    load()
  }

  const columns = useMemo(() => [
    {
      header: 'Article',
      accessorKey: 'title',
      cell: ({ row }) => (
        <span className="min-w-0 block">
          <span className="block text-sm font-semibold adm-truncate" style={{ maxWidth: 300 }}>{row.original.title}</span>
          <span className="block text-xs adm-truncate" style={{ color: 'var(--adm-silk-faint)', maxWidth: 300 }}>
            {row.original.content}
          </span>
        </span>
      ),
    },
    {
      header: 'Category',
      accessorKey: 'category',
      cell: ({ row }) => row.original.category
        ? <Badge>{row.original.category}</Badge>
        : <span style={{ color: 'var(--adm-silk-faint)' }}>—</span>,
    },
    {
      header: 'Keywords',
      accessorKey: 'keywords',
      enableSorting: false,
      cell: ({ row }) => {
        const words = row.original.keywords || []
        if (!words.length) return <span style={{ color: 'var(--adm-silk-faint)' }}>—</span>
        return (
          <span className="adm-data text-[11px] adm-truncate block" style={{ maxWidth: 180, color: 'var(--adm-silk-dim)' }}>
            {words.join(', ')}
          </span>
        )
      },
    },
    {
      header: 'In use',
      accessorKey: 'published',
      cell: ({ row }) => <StatusBadge status={row.original.published ? 'published' : 'draft'} />,
    },
    {
      header: 'Updated',
      accessorKey: 'updated_at',
      cell: ({ row }) => (
        <span className="adm-data text-[12px]">{formatDate(row.original.updated_at || row.original.created_at)}</span>
      ),
    },
    {
      header: '',
      id: 'actions',
      enableSorting: false,
      cell: ({ row }) => {
        const a = row.original
        return (
          <div className="flex items-center justify-end gap-0.5" onClick={e => e.stopPropagation()}>
            {working[a.id] && <Loader2 size={14} className="adm-spin mr-1" style={{ color: 'var(--adm-silk-faint)' }} />}
            <IconButton
              icon={a.published ? EyeOff : Eye}
              label={a.published ? 'Stop using this article' : 'Let the assistant use this article'}
              disabled={working[a.id]}
              onClick={() => togglePublish(a)}
            />
            <IconButton icon={Pencil} label="Edit" onClick={() => setEditor({ article: a })} />
            <IconButton icon={Trash2} label="Delete" danger onClick={() => setPendingDelete(a)} />
          </div>
        )
      },
    },
  ], [working]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div>
      <PageHeader
        eyebrow="Console"
        title="AI knowledge"
        description="What the website assistant knows. It answers visitors using the published articles here and nothing else."
        actions={
          <>
            <ExportMenu
              filename={`ai-knowledge-${status}-${new Date().toISOString().slice(0, 10)}`}
              title="AI knowledge"
              subtitle={`${FILTERS.find(f => f.value === status)?.label || 'All'} · ${formatDateTime(new Date())}`}
              headers={['Title', 'Category', 'Keywords', 'Status', 'Updated']}
              rows={filtered.map(a => [
                a.title, a.category, (a.keywords || []).join(', '),
                a.published ? 'published' : 'draft', formatDate(a.updated_at || a.created_at),
              ])}
              statusColumnIndex={3}
              disabled={!filtered.length}
            />
            <Button variant="primary" icon={Plus} onClick={() => setEditor({ article: null })}>New article</Button>
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
          onRowClick={article => setEditor({ article })}
          searchPlaceholder="Search articles…"
          toolbar={
            <>
              <FilterTabs options={filterOptions} value={status} onChange={setStatus} label="Article filter" />
              {categories.length > 0 && (
                <select
                  className="adm-input"
                  style={{ width: 'auto', minWidth: 160 }}
                  value={category}
                  onChange={e => setCategory(e.target.value)}
                  aria-label="Filter by category"
                >
                  <option value="all">Every category</option>
                  {categories.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              )}
            </>
          }
          emptyState={
            articles.length === 0 ? (
              <EmptyState
                icon={Brain}
                title="The assistant knows nothing yet"
                description="Write an article for each question visitors ask — joining the club, meeting times, what you build."
                action={<Button variant="primary" icon={Plus} onClick={() => setEditor({ article: null })}>New article</Button>}
              />
            ) : (
              <EmptyState compact icon={Brain} title="Nothing in this view" description="Try another filter." />
            )
          }
        />
      )}

      <ArticleEditor
        key={editor?.article?.id || 'new'}
        open={!!editor}
        article={editor?.article}
        categories={categories}
        onClose={() => setEditor(null)}
        onSaved={() => { setEditor(null); load() }}
        addToast={addToast}
      />

      <ConfirmDialog
        open={!!pendingDelete}
        onClose={() => setPendingDelete(null)}
        onConfirm={remove}
        title="Delete this article?"
        message={pendingDelete ? `The assistant will stop answering from “${pendingDelete.title}”. This cannot be undone.` : ''}
        confirmLabel="Delete article"
      />
    </div>
  )
}

function ArticleEditor({ open, article, categories, onClose, onSaved, addToast }) {
  const [form, setForm] = useState(BLANK)
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    setForm(article
      ? {
        title: article.title || '',
        category: article.category || '',
        content: article.content || '',
        keywords: (article.keywords || []).join(', '),
        published: article.published !== false,
      }
      : BLANK)
    setErrors({})
  }, [open, article])

  const set = (key, value) => {
    setForm(f => ({ ...f, [key]: value }))
    setErrors(e => ({ ...e, [key]: undefined }))
  }

  const save = async () => {
    const next = {}
    if (!form.title.trim()) next.title = 'Give the article a title.'
    if (!form.content.trim()) next.content = 'Write the answer the assistant should give.'
    if (Object.keys(next).length) { setErrors(next); return }

    setSaving(true)
    const { ok, message } = await api(
      article ? `/api/ai-knowledge/${article.id}` : '/api/ai-knowledge',
      {
        method: article ? 'PUT' : 'POST',
        body: {
          title: form.title.trim(),
          category: form.category.trim() || null,
          content: form.content.trim(),
          keywords: form.keywords.split(',').map(k => k.trim()).filter(Boolean),
          published: form.published,
        },
      }
    )
    setSaving(false)

    if (!ok) { addToast(message, 'error'); return }
    addToast(article ? 'Article updated.' : 'Article added to the assistant.')
    onSaved()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title={article ? 'Edit article' : 'New article'}
      description="Write it as an answer, not a note to yourself — the assistant repeats this to visitors."
      footer={
        <>
          <Button onClick={onClose} data-dialog-dismiss="true">Cancel</Button>
          <Button variant="primary" onClick={save} busy={saving} busyLabel="Saving…">
            {article ? 'Save changes' : 'Add article'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <TextField
          label="Title" required
          value={form.title} error={errors.title}
          onChange={e => set('title', e.target.value)}
          placeholder="How to join the club"
        />

        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="adm-label" htmlFor="ai-category">Category</label>
            <input
              id="ai-category"
              className="adm-input"
              list="ai-categories"
              value={form.category}
              onChange={e => set('category', e.target.value)}
              placeholder="Membership"
            />
            <datalist id="ai-categories">
              {categories.map(c => <option key={c} value={c} />)}
            </datalist>
          </div>
          <TextField
            label="Keywords"
            hint="Comma separated. Words a visitor might use."
            value={form.keywords}
            onChange={e => set('keywords', e.target.value)}
            placeholder="join, membership, sign up"
          />
        </div>

        <TextArea
          label="Answer" required rows={9}
          value={form.content} error={errors.content}
          onChange={e => set('content', e.target.value)}
          placeholder="Anyone enrolled at the University of Bouira can join. Fill in the form on the Join page and…"
        />

        <div className="pt-4" style={{ borderTop: '1px solid var(--adm-trace)' }}>
          <CheckField
            label="In use"
            description="Let the assistant answer visitors from this article."
            checked={form.published}
            onChange={v => set('published', v)}
          />
        </div>
      </div>
    </Modal>
  )
}
