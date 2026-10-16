import { useEffect, useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { logActivity, run, supabase } from '../../lib/db'
import { MANUAL_CATEGORIES } from '../../lib/points'
import Modal from '../ui/Modal'
import Button, { IconButton } from '../ui/Button'

const blank = { label: '', points: '5', category: 'event' }

/**
 * Add, edit and remove the one-tap reasons offered when giving points. Each
 * row saves when you leave a field. Removing a preset leaves points already
 * given with it as they are.
 */
export default function PresetsModal({ open, presets, onClose, onChanged }) {
  const [rows, setRows] = useState([])
  const [draft, setDraft] = useState(blank)
  const [error, setError] = useState(null)
  const [adding, setAdding] = useState(false)

  useEffect(() => {
    if (!open) return
    setRows(presets.map(p => ({ ...p, edit: { label: p.label, points: String(p.points), category: p.category } })))
    setDraft(blank)
    setError(null)
  }, [open, presets])

  const parse = values => {
    const points = Math.round(Number(values.points))
    if (!values.label.trim()) return { error: 'Name the preset.' }
    if (!points) return { error: 'Points must be a whole number other than zero. Use a minus for a penalty.' }
    return { value: { label: values.label.trim(), points, category: values.category } }
  }

  const save = async row => {
    const { value, error: problem } = parse(row.edit)
    if (problem) { setError(problem); return }
    if (value.label === row.label && value.points === row.points && value.category === row.category) return
    const { ok } = await run(supabase.from('point_presets').update(value).eq('id', row.id), { failure: `${row.label} was not saved.` })
    if (!ok) return
    logActivity('updated', 'point_presets', row.id, value)
    setRows(rs => rs.map(r => (r.id === row.id ? { ...r, ...value } : r)))
    setError(null)
    onChanged()
  }

  const edit = (row, key, value) => setRows(rs => rs.map(r => (r.id === row.id ? { ...r, edit: { ...r.edit, [key]: value } } : r)))

  const add = async () => {
    const { value, error: problem } = parse(draft)
    if (problem) { setError(problem); return }
    setAdding(true)
    const sortOrder = rows.reduce((n, r) => Math.max(n, r.sort_order || 0), 0) + 1
    const { ok, data } = await run(
      supabase.from('point_presets').insert({ ...value, sort_order: sortOrder }).select('*').single(),
      { success: `${value.label} added.`, failure: 'The preset was not added.' }
    )
    setAdding(false)
    if (!ok) return
    logActivity('created', 'point_presets', data.id, value)
    setRows(rs => [...rs, { ...data, edit: { label: data.label, points: String(data.points), category: data.category } }])
    setDraft(blank)
    setError(null)
    onChanged()
  }

  const remove = async row => {
    const { ok } = await run(supabase.from('point_presets').delete().eq('id', row.id), { failure: `${row.label} was not removed.` })
    if (!ok) return
    logActivity('deleted', 'point_presets', row.id, { label: row.label })
    setRows(rs => rs.filter(r => r.id !== row.id))
    onChanged()
  }

  const fields = (values, onEdit, onBlur) => (
    <>
      <input className="adm-input flex-1 min-w-0" aria-label="Reason" placeholder="Attended a workshop" value={values.label}
        onChange={e => onEdit('label', e.target.value)} onBlur={onBlur} />
      <input className="adm-input adm-data" style={{ width: 76 }} aria-label="Points" type="number" step="1" value={values.points}
        onChange={e => onEdit('points', e.target.value)} onBlur={onBlur} />
      <select className="adm-input" style={{ width: 130 }} aria-label="Category" value={values.category}
        onChange={e => onEdit('category', e.target.value)} onBlur={onBlur}>
        {MANUAL_CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
      </select>
    </>
  )

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title="Point presets"
      description="One-tap reasons for giving points. Use a minus for penalties, such as −2 for being late."
      footer={<Button onClick={onClose} data-dialog-dismiss="true">Done</Button>}
    >
      <ul className="space-y-2">
        {rows.map(row => (
          <li key={row.id} className="flex items-center gap-2">
            {fields(row.edit, (key, value) => edit(row, key, value), () => save(row))}
            <IconButton icon={Trash2} danger label={`Remove ${row.label}`} onClick={() => remove(row)} />
          </li>
        ))}
        <li className="flex items-center gap-2 pt-3" style={{ borderTop: '1px solid var(--adm-trace)' }}>
          {fields(draft, (key, value) => { setDraft(d => ({ ...d, [key]: value })); setError(null) })}
          <Button icon={Plus} onClick={add} busy={adding} busyLabel="Adding…">Add</Button>
        </li>
      </ul>
      {error && <p className="text-sm mt-3" style={{ color: 'var(--adm-fault)' }}>{error}</p>}
    </Modal>
  )
}
