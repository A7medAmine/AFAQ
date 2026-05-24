import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Plus, Pencil, Trash2, Search, Filter } from 'lucide-react'
import useAdminStore from '../store/adminStore'

export default function AIKnowledgePage() {
  const addToast = useAdminStore(s => s.addToast)
  const [articles, setArticles] = useState([])
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [search, setSearch] = useState('')
  const [filterCat, setFilterCat] = useState('')

  const [form, setForm] = useState({
    title: '', category: '', content: '', keywords: '', published: true,
  })

  async function fetchArticles() {
    setLoading(true)
    try {
      const res = await fetch('/api/ai-knowledge')
      if (res.ok) setArticles(await res.json())
      const catRes = await fetch('/api/ai-knowledge/categories')
      if (catRes.ok) setCategories(await catRes.json())
    } catch { } finally { setLoading(false) }
  }

  useEffect(() => { fetchArticles() }, [])

  function resetForm() {
    setForm({ title: '', category: '', content: '', keywords: '', published: true })
    setEditing(null)
    setShowForm(false)
  }

  function openEdit(article) {
    setForm({
      title: article.title,
      category: article.category || '',
      content: article.content,
      keywords: (article.keywords || []).join(', '),
      published: article.published,
    })
    setEditing(article.id)
    setShowForm(true)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    try {
      const body = {
        ...form,
        keywords: form.keywords.split(',').map(k => k.trim()).filter(Boolean),
      }
      const method = editing ? 'PUT' : 'POST'
      const url = editing ? `/api/ai-knowledge/${editing}` : '/api/ai-knowledge'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (res.ok) {
        addToast(editing ? 'Article updated' : 'Article created')
        resetForm()
        fetchArticles()
      } else {
        const err = await res.json()
        addToast(err.error || 'Failed to save', 'error')
      }
    } catch { addToast('Network error', 'error') }
  }

  async function handleDelete(id) {
    if (!confirm('Delete this article?')) return
    try {
      const res = await fetch(`/api/ai-knowledge/${id}`, { method: 'DELETE' })
      if (res.ok) {
        addToast('Article deleted')
        fetchArticles()
      } else addToast('Failed to delete', 'error')
    } catch { addToast('Network error', 'error') }
  }

  async function togglePublish(article) {
    try {
      const res = await fetch(`/api/ai-knowledge/${article.id}/publish`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ published: !article.published }),
      })
      if (res.ok) {
        addToast(article.published ? 'Unpublished' : 'Published')
        fetchArticles()
      } else addToast('Failed to toggle', 'error')
    } catch { addToast('Network error', 'error') }
  }

  const filtered = articles.filter(a => {
    if (search && !a.title.toLowerCase().includes(search.toLowerCase()) && !a.content.toLowerCase().includes(search.toLowerCase())) return false
    if (filterCat && a.category !== filterCat) return false
    return true
  })

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-lg font-semibold" style={{ color: 'var(--color-text)' }}>AI Knowledge</h1>
          <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>Articles the AI assistant uses to answer questions</p>
        </div>
        <button
          onClick={() => { resetForm(); setShowForm(true) }}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium text-white transition-all hover:opacity-90"
          style={{ background: 'var(--color-accent)' }}
        >
          <Plus size={16} /> New Article
        </button>
      </div>

      {showForm && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl border p-5 mb-6"
          style={{ background: 'var(--color-card)', borderColor: 'var(--color-border-light)' }}
        >
          <h2 className="text-base font-semibold mb-4" style={{ color: 'var(--color-text)' }}>
            {editing ? 'Edit Article' : 'New Article'}
          </h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div className="col-span-2">
                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--color-text-muted)' }}>Title *</label>
                <input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl text-sm border"
                  style={{ background: 'var(--color-bg)', borderColor: 'var(--color-border-light)', color: 'var(--color-text)' }} required />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--color-text-muted)' }}>Category</label>
                <input value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}
                  placeholder="e.g. membership, about"
                  className="w-full px-3 py-2 rounded-xl text-sm border"
                  style={{ background: 'var(--color-bg)', borderColor: 'var(--color-border-light)', color: 'var(--color-text)' }} />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: 'var(--color-text-muted)' }}>Content * (Markdown supported)</label>
              <textarea value={form.content} onChange={e => setForm({ ...form, content: e.target.value })}
                rows={10}
                className="w-full px-3 py-2 rounded-xl text-sm border resize-y font-mono"
                style={{ background: 'var(--color-bg)', borderColor: 'var(--color-border-light)', color: 'var(--color-text)' }} required />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--color-text-muted)' }}>Keywords (comma-separated)</label>
                <input value={form.keywords} onChange={e => setForm({ ...form, keywords: e.target.value })}
                  placeholder="membership, join, register"
                  className="w-full px-3 py-2 rounded-xl text-sm border"
                  style={{ background: 'var(--color-bg)', borderColor: 'var(--color-border-light)', color: 'var(--color-text)' }} />
              </div>
              <div className="flex items-end gap-3">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={form.published}
                    onChange={e => setForm({ ...form, published: e.target.checked })}
                    className="rounded" />
                  <span className="text-sm" style={{ color: 'var(--color-text)' }}>Published</span>
                </label>
              </div>
            </div>
            <div className="flex gap-2 pt-2">
              <button type="submit"
                className="px-4 py-2 rounded-xl text-sm font-medium text-white transition-all hover:opacity-90"
                style={{ background: 'var(--color-accent)' }}>
                {editing ? 'Update' : 'Create'}
              </button>
              <button type="button" onClick={resetForm}
                className="px-4 py-2 rounded-xl text-sm font-medium transition-all"
                style={{ color: 'var(--color-text-muted)' }}>
                Cancel
              </button>
            </div>
          </form>
        </motion.div>
      )}

      <div className="flex items-center gap-3 mb-4">
        <div className="relative flex-1 max-w-xs">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--color-text-muted)' }} />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search articles..."
            className="w-full pl-9 pr-3 py-2 rounded-xl text-sm border"
            style={{ background: 'var(--color-bg)', borderColor: 'var(--color-border-light)', color: 'var(--color-text)' }} />
        </div>
        <div className="relative">
          <Filter size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--color-text-muted)' }} />
          <select value={filterCat} onChange={e => setFilterCat(e.target.value)}
            className="pl-9 pr-8 py-2 rounded-xl text-sm border appearance-none cursor-pointer"
            style={{ background: 'var(--color-bg)', borderColor: 'var(--color-border-light)', color: 'var(--color-text)' }}>
            <option value="">All categories</option>
            {categories.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
          {filtered.length} / {articles.length}
        </span>
      </div>

      {loading ? (
        <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>Loading...</p>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border p-8 text-center" style={{ borderColor: 'var(--color-border-light)' }}>
          <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>No articles found</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(article => (
            <div key={article.id}
              className="rounded-2xl border p-4 flex items-start justify-between gap-4"
              style={{ background: 'var(--color-card)', borderColor: 'var(--color-border-light)' }}>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  {article.category && (
                    <span className="text-xs px-2 py-0.5 rounded" style={{ background: 'var(--color-border-light)', color: 'var(--color-text-muted)' }}>
                      {article.category}
                    </span>
                  )}
                  <button onClick={() => togglePublish(article)}
                    className={`text-xs px-2 py-0.5 rounded cursor-pointer transition-all hover:opacity-80 ${article.published ? 'text-green-700 bg-green-100' : 'text-orange-700 bg-orange-100'}`}>
                    {article.published ? 'Published' : 'Draft'}
                  </button>
                </div>
                <p className="text-sm font-medium truncate" style={{ color: 'var(--color-text)' }}>{article.title}</p>
                <p className="text-xs mt-1 line-clamp-2" style={{ color: 'var(--color-text-muted)' }}>{article.content}</p>
                {article.keywords && article.keywords.length > 0 && (
                  <div className="flex gap-1 mt-2 flex-wrap">
                    {article.keywords.map((kw, i) => (
                      <span key={i} className="text-[10px] px-1.5 py-0.5 rounded"
                        style={{ background: 'var(--color-accent-soft)', color: 'var(--color-accent)' }}>{kw}</span>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex gap-1 shrink-0">
                <button onClick={() => openEdit(article)}
                  className="p-2 rounded-xl transition-all hover:opacity-70"
                  style={{ color: 'var(--color-text-muted)' }}>
                  <Pencil size={16} />
                </button>
                <button onClick={() => handleDelete(article.id)}
                  className="p-2 rounded-xl transition-all hover:opacity-70"
                  style={{ color: 'var(--color-danger)' }}>
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </motion.div>
  )
}
