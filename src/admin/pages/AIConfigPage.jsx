import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Info, Plus, Pencil, Trash2, RotateCcw } from 'lucide-react'
import useAdminStore from '../store/adminStore'

export default function AIConfigPage() {
  const addToast = useAdminStore(s => s.addToast)
  const [entries, setEntries] = useState([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ key: '', labelEn: '', labelAr: '', labelFr: '', valueEn: '', valueAr: '', valueFr: '', category: '', sortOrder: 0 })

  async function fetchEntries() {
    try {
      const res = await fetch('/api/club-info')
      if (res.ok) setEntries(await res.json())
    } catch { } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchEntries() }, [])

  function resetForm() {
    setForm({ key: '', labelEn: '', labelAr: '', labelFr: '', valueEn: '', valueAr: '', valueFr: '', category: '', sortOrder: 0 })
    setEditing(null)
    setShowForm(false)
  }

  function openEdit(entry) {
    setForm({ key: entry.key, labelEn: entry.labelEn, labelAr: entry.labelAr || '', labelFr: entry.labelFr || '', valueEn: entry.valueEn, valueAr: entry.valueAr || '', valueFr: entry.valueFr || '', category: entry.category || '', sortOrder: entry.sortOrder || 0 })
    setEditing(entry.id)
    setShowForm(true)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    try {
      const method = editing ? 'PUT' : 'POST'
      const url = editing ? `/api/club-info/${editing}` : '/api/club-info'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (res.ok) {
        addToast(editing ? 'Entry updated' : 'Entry created')
        resetForm()
        fetchEntries()
      } else {
        const err = await res.json()
        addToast(err.error || 'Failed to save', 'error')
      }
    } catch {
      addToast('Network error', 'error')
    }
  }

  async function handleDelete(id) {
    if (!confirm('Delete this entry?')) return
    try {
      const res = await fetch(`/api/club-info/${id}`, { method: 'DELETE' })
      if (res.ok) {
        addToast('Entry deleted')
        fetchEntries()
      } else {
        addToast('Failed to delete', 'error')
      }
    } catch {
      addToast('Network error', 'error')
    }
  }

  async function handleSeed() {
    if (!confirm('Add default entries (skips existing)?')) return
    try {
      const res = await fetch('/api/club-info/seed', { method: 'POST' })
      if (res.ok) {
        const data = await res.json()
        addToast(data.message)
        fetchEntries()
      } else {
        addToast('Failed to seed', 'error')
      }
    } catch {
      addToast('Network error', 'error')
    }
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-lg font-semibold" style={{ color: 'var(--color-text)' }}>AI Club Info</h1>
          <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>Manage the knowledge the AI assistant uses to answer questions</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleSeed}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium transition-all hover:opacity-80"
            style={{ background: 'var(--color-border-light)', color: 'var(--color-text)' }}
          >
            <RotateCcw size={16} /> Seed Defaults
          </button>
          <button
            onClick={() => { resetForm(); setShowForm(true) }}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium text-white transition-all hover:opacity-90"
            style={{ background: 'var(--color-accent)' }}
          >
            <Plus size={16} /> Add Entry
          </button>
        </div>
      </div>

      {showForm && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl border p-5 mb-6"
          style={{ background: 'var(--color-card)', borderColor: 'var(--color-border-light)' }}
        >
          <h2 className="text-base font-semibold mb-4" style={{ color: 'var(--color-text)' }}>
            {editing ? 'Edit Entry' : 'New Entry'}
          </h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--color-text-muted)' }}>Key *</label>
                <input
                  value={form.key}
                  onChange={e => setForm({ ...form, key: e.target.value })}
                  placeholder="e.g. how_to_join"
                  className="w-full px-3 py-2 rounded-xl text-sm border"
                  style={{ background: 'var(--color-bg)', borderColor: 'var(--color-border-light)', color: 'var(--color-text)' }}
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--color-text-muted)' }}>Category</label>
                <input
                  value={form.category}
                  onChange={e => setForm({ ...form, category: e.target.value })}
                  placeholder="e.g. membership, events, about"
                  className="w-full px-3 py-2 rounded-xl text-sm border"
                  style={{ background: 'var(--color-bg)', borderColor: 'var(--color-border-light)', color: 'var(--color-text)' }}
                />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--color-text-muted)' }}>Label (EN) *</label>
                <input
                  value={form.labelEn}
                  onChange={e => setForm({ ...form, labelEn: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl text-sm border"
                  style={{ background: 'var(--color-bg)', borderColor: 'var(--color-border-light)', color: 'var(--color-text)' }}
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--color-text-muted)' }}>Label (AR)</label>
                <input
                  value={form.labelAr}
                  onChange={e => setForm({ ...form, labelAr: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl text-sm border"
                  style={{ background: 'var(--color-bg)', borderColor: 'var(--color-border-light)', color: 'var(--color-text)' }}
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--color-text-muted)' }}>Label (FR)</label>
                <input
                  value={form.labelFr}
                  onChange={e => setForm({ ...form, labelFr: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl text-sm border"
                  style={{ background: 'var(--color-bg)', borderColor: 'var(--color-border-light)', color: 'var(--color-text)' }}
                />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--color-text-muted)' }}>Value (EN) *</label>
                <textarea
                  value={form.valueEn}
                  onChange={e => setForm({ ...form, valueEn: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 rounded-xl text-sm border resize-none"
                  style={{ background: 'var(--color-bg)', borderColor: 'var(--color-border-light)', color: 'var(--color-text)' }}
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--color-text-muted)' }}>Value (AR)</label>
                <textarea
                  value={form.valueAr}
                  onChange={e => setForm({ ...form, valueAr: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 rounded-xl text-sm border resize-none"
                  style={{ background: 'var(--color-bg)', borderColor: 'var(--color-border-light)', color: 'var(--color-text)' }}
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--color-text-muted)' }}>Value (FR)</label>
                <textarea
                  value={form.valueFr}
                  onChange={e => setForm({ ...form, valueFr: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 rounded-xl text-sm border resize-none"
                  style={{ background: 'var(--color-bg)', borderColor: 'var(--color-border-light)', color: 'var(--color-text)' }}
                />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-32">
                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--color-text-muted)' }}>Sort Order</label>
                <input
                  type="number"
                  value={form.sortOrder}
                  onChange={e => setForm({ ...form, sortOrder: Number(e.target.value) })}
                  className="w-full px-3 py-2 rounded-xl text-sm border"
                  style={{ background: 'var(--color-bg)', borderColor: 'var(--color-border-light)', color: 'var(--color-text)' }}
                />
              </div>
            </div>
            <div className="flex gap-2 pt-2">
              <button
                type="submit"
                className="px-4 py-2 rounded-xl text-sm font-medium text-white transition-all hover:opacity-90"
                style={{ background: 'var(--color-accent)' }}
              >
                {editing ? 'Update' : 'Create'}
              </button>
              <button
                type="button"
                onClick={resetForm}
                className="px-4 py-2 rounded-xl text-sm font-medium transition-all"
                style={{ color: 'var(--color-text-muted)' }}
              >
                Cancel
              </button>
            </div>
          </form>
        </motion.div>
      )}

      {loading ? (
        <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>Loading...</p>
      ) : entries.length === 0 ? (
        <div className="rounded-2xl border p-8 text-center" style={{ borderColor: 'var(--color-border-light)' }}>
          <Info size={32} className="mx-auto mb-2" style={{ color: 'var(--color-text-muted)' }} />
          <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>No club info entries yet. Add one or seed defaults.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {entries.map(entry => (
            <div
              key={entry.id}
              className="rounded-2xl border p-4 flex items-start justify-between gap-4"
              style={{ background: 'var(--color-card)', borderColor: 'var(--color-border-light)' }}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <code className="text-xs px-2 py-0.5 rounded" style={{ background: 'var(--color-border-light)', color: 'var(--color-accent)' }}>{entry.key}</code>
                  {entry.category && (
                    <span className="text-xs px-2 py-0.5 rounded" style={{ background: 'var(--color-border-light)', color: 'var(--color-text-muted)' }}>{entry.category}</span>
                  )}
                  <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>#{entry.sortOrder}</span>
                </div>
                <p className="text-sm font-medium truncate" style={{ color: 'var(--color-text)' }}>{entry.labelEn}</p>
                <p className="text-xs mt-1 line-clamp-2" style={{ color: 'var(--color-text-muted)' }}>{entry.valueEn}</p>
              </div>
              <div className="flex gap-1 shrink-0">
                <button
                  onClick={() => openEdit(entry)}
                  className="p-2 rounded-xl transition-all hover:opacity-70"
                  style={{ color: 'var(--color-text-muted)' }}
                >
                  <Pencil size={16} />
                </button>
                <button
                  onClick={() => handleDelete(entry.id)}
                  className="p-2 rounded-xl transition-all hover:opacity-70"
                  style={{ color: 'var(--color-danger)' }}
                >
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
