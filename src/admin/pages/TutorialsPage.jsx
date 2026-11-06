import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ExternalLink, Eye, EyeOff, GraduationCap, ImageOff, Loader2, Pencil, Plus, Trash2 } from 'lucide-react'
import { logActivity, read, run, supabase } from '../lib/db'
import useQueryParam from '../hooks/useQueryParam'
import { formatDate } from '../lib/format'
import { LEVELS } from '../lib/tutorials'
import PageHeader, { FilterTabs } from '../components/ui/PageHeader'
import DataTable from '../components/ui/DataTable'
import ConfirmDialog from '../components/ui/ConfirmDialog'
import EmptyState, { ErrorState } from '../components/ui/EmptyState'
import Button, { IconButton } from '../components/ui/Button'
import { StatusBadge } from '../components/ui/Badge'
import Panel from '../components/ui/Panel'

const FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'published', label: 'Published' },
  { value: 'draft', label: 'Drafts' },
]

const levelLabel = value => LEVELS.find(l => l.value === value)?.label || value

export default function TutorialsPage() {
  const navigate = useNavigate()
  const [tutorials, setTutorials] = useState([])
  const [state, setState] = useState({ loading: true, error: null })
  const [status, setStatus] = useQueryParam('status', 'all')
  const [search] = useQueryParam('q')
  const [pendingDelete, setPendingDelete] = useState(null)
  const [working, setWorking] = useState({})

  const load = useCallback(async () => {
    setState(s => ({ ...s, error: null }))
    const { ok, data, message } = await read(
      supabase.from('tutorials')
        .select('id, slug, title, summary, cover_url, level, tags, is_published, published_at, updated_at, event:events(id, title_en, date)')
        .order('updated_at', { ascending: false })
    )
    if (!ok) { setState({ loading: false, error: message }); return }
    setTutorials(data || [])
    setState({ loading: false, error: null })
  }, [])

  useEffect(() => { load() }, [load])

  const filtered = useMemo(() => {
    if (status === 'published') return tutorials.filter(t => t.is_published)
    if (status === 'draft') return tutorials.filter(t => !t.is_published)
    return tutorials
  }, [tutorials, status])

  const filterOptions = FILTERS.map(f => ({
    ...f,
    count: f.value === 'all' ? tutorials.length
      : tutorials.filter(t => (f.value === 'published' ? t.is_published : !t.is_published)).length,
  }))

  const togglePublish = async tutorial => {
    setWorking(w => ({ ...w, [tutorial.id]: true }))
    const next = !tutorial.is_published
    const { ok } = await run(
      supabase.from('tutorials').update({ is_published: next }).eq('id', tutorial.id),
      {
        success: next ? `“${tutorial.title}” is live on the Learn page.` : `“${tutorial.title}” is hidden from the site.`,
        failure: 'That switch did not change.',
      }
    )
    setWorking(w => ({ ...w, [tutorial.id]: false }))
    if (ok) {
      logActivity(next ? 'published' : 'unpublished', 'tutorials', tutorial.id, { name: tutorial.title })
      load()
    }
  }

  const remove = async () => {
    const tutorial = pendingDelete
    const { ok } = await run(
      supabase.from('tutorials').delete().eq('id', tutorial.id),
      { success: `“${tutorial.title}” deleted.`, failure: 'The tutorial was not deleted.' }
    )
    if (ok) {
      logActivity('deleted', 'tutorials', tutorial.id, { name: tutorial.title })
      setPendingDelete(null)
      load()
    }
  }

  const columns = useMemo(() => [
    {
      header: 'Tutorial',
      accessorKey: 'title',
      cell: ({ row }) => {
        const t = row.original
        return (
          <div className="flex items-center gap-3 min-w-0">
            {t.cover_url ? (
              <img src={t.cover_url} alt="" className="rounded-md object-cover shrink-0" style={{ width: 34, height: 34, border: '1px solid var(--adm-trace)' }} />
            ) : (
              <span className="flex items-center justify-center rounded-md shrink-0" style={{ width: 34, height: 34, background: 'var(--adm-board-sunk)', color: 'var(--adm-silk-faint)' }} aria-hidden="true">
                <ImageOff size={14} />
              </span>
            )}
            <span className="min-w-0">
              <span className="block text-sm font-semibold adm-truncate" style={{ maxWidth: 280 }}>{t.title}</span>
              <span className="block text-[11px] adm-data adm-truncate" style={{ color: 'var(--adm-silk-faint)', maxWidth: 280 }}>/learn/{t.slug}</span>
            </span>
          </div>
        )
      },
    },
    { header: 'Level', accessorKey: 'level', cell: ({ row }) => <span className="text-[12px]">{levelLabel(row.original.level)}</span> },
    {
      header: 'Workshop',
      id: 'event',
      accessorFn: t => t.event?.title_en || '',
      cell: ({ row }) => {
        const e = row.original.event
        if (!e) return <span style={{ color: 'var(--adm-silk-faint)' }}>—</span>
        return (
          <span className="min-w-0">
            <span className="block text-[12px] font-semibold adm-truncate" style={{ maxWidth: 200 }}>{e.title_en}</span>
            <span className="block text-[11px] adm-data" style={{ color: 'var(--adm-silk-faint)' }}>{formatDate(e.date)}</span>
          </span>
        )
      },
    },
    {
      header: 'Tags',
      accessorKey: 'tags',
      enableSorting: false,
      cell: ({ row }) => {
        const tags = row.original.tags || []
        if (!tags.length) return <span style={{ color: 'var(--adm-silk-faint)' }}>—</span>
        return (
          <span className="flex flex-wrap gap-1">
            {tags.slice(0, 3).map(t => (
              <span key={t} className="px-1.5 py-0.5 rounded text-[11px]" style={{ background: 'var(--adm-board-sunk)', color: 'var(--adm-silk-dim)' }}>{t}</span>
            ))}
            {tags.length > 3 && <span className="adm-data text-[11px] self-center" style={{ color: 'var(--adm-silk-faint)' }}>+{tags.length - 3}</span>}
          </span>
        )
      },
    },
    { header: 'Visibility', accessorKey: 'is_published', cell: ({ row }) => <StatusBadge status={row.original.is_published ? 'published' : 'draft'} /> },
    { header: 'Updated', accessorKey: 'updated_at', cell: ({ row }) => <span className="adm-data text-[12px]">{formatDate(row.original.updated_at)}</span> },
    {
      header: '',
      id: 'actions',
      enableSorting: false,
      cell: ({ row }) => {
        const t = row.original
        return (
          <div className="flex items-center justify-end gap-0.5" onClick={e => e.stopPropagation()}>
            {working[t.id] && <Loader2 size={14} className="adm-spin mr-1" style={{ color: 'var(--adm-silk-faint)' }} />}
            {t.is_published && (
              <IconButton icon={ExternalLink} label="Open on the site" onClick={() => window.open(`/learn/${t.slug}`, '_blank', 'noopener')} />
            )}
            <IconButton icon={t.is_published ? EyeOff : Eye} label={t.is_published ? 'Unpublish' : 'Publish'} disabled={working[t.id]} onClick={() => togglePublish(t)} />
            <IconButton icon={Pencil} label="Edit" onClick={() => navigate(`/admin/tutorials/${t.id}`)} />
            <IconButton icon={Trash2} label="Delete" danger onClick={() => setPendingDelete(t)} />
          </div>
        )
      },
    },
  ], [working]) // eslint-disable-line react-hooks/exhaustive-deps

  const newButton = <Button variant="primary" icon={Plus} onClick={() => navigate('/admin/tutorials/new')}>New tutorial</Button>

  return (
    <div>
      <PageHeader
        eyebrow="Publish"
        title="Tutorials"
        description="Guides and workshop materials. Published tutorials appear on the public Learn page."
        actions={newButton}
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
          onRowClick={t => navigate(`/admin/tutorials/${t.id}`)}
          searchPlaceholder="Search tutorials…"
          toolbar={<FilterTabs options={filterOptions} value={status} onChange={setStatus} label="Tutorial filter" />}
          emptyState={
            tutorials.length === 0 ? (
              <EmptyState
                icon={GraduationCap}
                title="No tutorials yet"
                description="Prepare the guide for your next workshop: steps, code people can copy, links and what to bring."
                action={newButton}
              />
            ) : (
              <EmptyState compact icon={GraduationCap} title="Nothing in this view" description="Try another filter." />
            )
          }
        />
      )}

      <ConfirmDialog
        open={!!pendingDelete}
        onClose={() => setPendingDelete(null)}
        onConfirm={remove}
        title="Delete this tutorial?"
        message={pendingDelete ? `“${pendingDelete.title}” will be removed from the site and the console. This cannot be undone.` : ''}
        confirmLabel="Delete tutorial"
      />
    </div>
  )
}
