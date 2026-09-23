import { useEffect, useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { logActivity, run, supabase } from '../../lib/db'
import { roleOptions } from '../../lib/hr'
import Modal from '../ui/Modal'
import Button, { IconButton } from '../ui/Button'
import Badge from '../ui/Badge'
import { TextField } from '../ui/Field'

/**
 * Lists every role with how many members hold it now, and lets the admin add
 * or remove custom roles. Built-in offices cannot be removed. Deleting a custom
 * role only takes it out of the pickers; members who held it keep their terms.
 *
 * @param holders  { [roleValue]: count } of current holders
 */
export default function RolesModal({ open, customRoles = [], holders = {}, onClose, onChanged, onPick }) {
  const [name, setName] = useState('')
  const [error, setError] = useState(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => { if (open) { setName(''); setError(null) } }, [open])

  const options = roleOptions(customRoles)

  const create = async e => {
    e?.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) { setError('Name the role.'); return }
    if (options.some(o => o.label.toLowerCase() === trimmed.toLowerCase())) { setError('That role already exists.'); return }
    setSaving(true)
    const { ok, data } = await run(
      supabase.from('member_roles').insert({ name: trimmed }).select('*').single(),
      { success: `${trimmed} role created.`, failure: 'The role did not save.' }
    )
    setSaving(false)
    if (!ok) return
    logActivity('created', 'member_roles', data.id, { name: trimmed })
    setName('')
    onChanged()
  }

  const remove = async role => {
    const { ok } = await run(
      supabase.from('member_roles').delete().eq('id', role.id),
      { success: `${role.label} role deleted.`, failure: 'The role was not deleted.' }
    )
    if (!ok) return
    logActivity('deleted', 'member_roles', role.id, { name: role.label })
    onChanged()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Roles"
      description="Offices and custom roles members can hold. Click a role to see who holds it."
      footer={<Button onClick={onClose} data-dialog-dismiss="true">Done</Button>}
    >
      <form onSubmit={create} className="flex items-end gap-2 mb-4">
        <TextField label="New custom role" value={name} error={error} className="flex-1"
          onChange={e => { setName(e.target.value); setError(null) }} placeholder="Media officer" />
        <Button type="submit" variant="primary" icon={Plus} busy={saving} busyLabel="Adding…">Add</Button>
      </form>
      <ul className="space-y-1.5">
        {options.map(r => (
          <li key={r.value} className="flex items-center gap-2 px-3 py-2 rounded-lg" style={{ background: 'var(--adm-board-sunk)' }}>
            <button type="button" className="flex-1 min-w-0 text-left text-sm font-semibold adm-truncate"
              onClick={() => onPick(r.value)}>
              {r.label}
            </button>
            <span className="adm-data text-[12px]" style={{ color: 'var(--adm-silk-faint)' }}>
              {holders[r.value] || 0} holding
            </span>
            {r.id ? (
              <IconButton icon={Trash2} label={`Delete ${r.label}`} size={14} danger onClick={() => remove(r)} />
            ) : (
              <Badge tone="neutral">Built-in</Badge>
            )}
          </li>
        ))}
      </ul>
    </Modal>
  )
}
