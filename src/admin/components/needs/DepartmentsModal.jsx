import { useEffect, useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { logActivity, run, supabase } from '../../lib/db'
import { DEPARTMENT_COLORS } from '../../lib/needs'
import Modal from '../ui/Modal'
import Button, { IconButton } from '../ui/Button'

/**
 * Add, rename, recolor and remove the departments needs are grouped under.
 * Each row saves on its own as soon as it changes. Removing a department
 * keeps its items; they move to "No department".
 */
export default function DepartmentsModal({ open, departments, onClose, onChanged }) {
  const [rows, setRows] = useState([])
  const [draft, setDraft] = useState('')
  const [adding, setAdding] = useState(false)

  useEffect(() => { if (open) { setRows(departments.map(d => ({ ...d, edit: d.name }))); setDraft('') } }, [open, departments])

  const save = async (dept, changes) => {
    const { ok } = await run(supabase.from('departments').update(changes).eq('id', dept.id), { failure: `${dept.name} was not saved.` })
    if (!ok) { setRows(rs => rs.map(r => (r.id === dept.id ? { ...r, edit: r.name } : r))); return }
    logActivity('updated', 'departments', dept.id, { name: changes.name || dept.name, ...changes })
    setRows(rs => rs.map(r => (r.id === dept.id ? { ...r, ...changes, edit: changes.name ?? r.edit } : r)))
    onChanged()
  }

  const rename = dept => {
    const name = dept.edit.trim()
    if (!name || name === dept.name) { setRows(rs => rs.map(r => (r.id === dept.id ? { ...r, edit: r.name } : r))); return }
    save(dept, { name })
  }

  const add = async () => {
    const name = draft.trim()
    if (!name) return
    setAdding(true)
    const color = DEPARTMENT_COLORS[rows.length % DEPARTMENT_COLORS.length]
    const sortOrder = rows.reduce((n, r) => Math.max(n, r.sort_order || 0), 0) + 1
    const { ok, data } = await run(
      supabase.from('departments').insert({ name, color, sort_order: sortOrder }).select('*').single(),
      { success: `${name} added.`, failure: 'The department was not added. Is the name already taken?' }
    )
    setAdding(false)
    if (!ok) return
    logActivity('created', 'departments', data.id, { name })
    setRows(rs => [...rs, { ...data, edit: data.name }])
    setDraft('')
    onChanged()
  }

  const remove = async dept => {
    const { ok } = await run(supabase.from('departments').delete().eq('id', dept.id),
      { success: `${dept.name} removed. Its items now have no department.`, failure: 'The department was not removed.' })
    if (!ok) return
    logActivity('deleted', 'departments', dept.id, { name: dept.name })
    setRows(rs => rs.filter(r => r.id !== dept.id))
    onChanged()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Departments"
      description="Needs are grouped and printed by department. Changes save as you go."
      footer={<Button variant="primary" onClick={onClose} data-dialog-dismiss="true">Done</Button>}
    >
      <ul className="space-y-2">
        {rows.map(dept => (
          <li key={dept.id} className="flex items-center gap-2">
            <select
              className="adm-input adm-cell-select"
              aria-label={`Color of ${dept.name}`}
              value={dept.color || ''}
              onChange={e => save(dept, { color: e.target.value })}
              style={{ width: 52, color: dept.color || 'var(--adm-silk)' }}
            >
              {!DEPARTMENT_COLORS.includes(dept.color) && <option value={dept.color || ''}>●</option>}
              {DEPARTMENT_COLORS.map(c => <option key={c} value={c} style={{ color: c }}>●</option>)}
            </select>
            <input
              className="adm-input flex-1"
              aria-label="Department name"
              value={dept.edit}
              onChange={e => setRows(rs => rs.map(r => (r.id === dept.id ? { ...r, edit: e.target.value } : r)))}
              onBlur={() => rename(dept)}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); e.target.blur() } }}
            />
            <IconButton icon={Trash2} danger label={`Remove ${dept.name}`} onClick={() => remove(dept)} />
          </li>
        ))}
        {!rows.length && <li className="text-sm" style={{ color: 'var(--adm-silk-faint)' }}>No departments yet.</li>}
      </ul>
      <div className="flex items-center gap-2 mt-4 pt-4" style={{ borderTop: '1px solid var(--adm-trace)' }}>
        <input
          className="adm-input flex-1"
          placeholder="New department, e.g. Design"
          aria-label="New department"
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); add() } }}
        />
        <Button icon={Plus} onClick={add} busy={adding} busyLabel="Adding…" disabled={!draft.trim()}>Add</Button>
      </div>
    </Modal>
  )
}
