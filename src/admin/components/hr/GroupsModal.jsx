import { useEffect, useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { logActivity, run, supabase } from '../../lib/db'
import Modal from '../ui/Modal'
import Button, { IconButton } from '../ui/Button'
import { TextField } from '../ui/Field'

/**
 * Lists member groups with their size and lets the admin create or delete
 * them. Deleting a group only removes the grouping; members stay on the roster.
 *
 * @param counts  { [groupId]: memberCount }
 */
export default function GroupsModal({ open, groups = [], counts = {}, onClose, onChanged, onPick }) {
  const [name, setName] = useState('')
  const [error, setError] = useState(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => { if (open) { setName(''); setError(null) } }, [open])

  const create = async e => {
    e?.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) { setError('Name the group.'); return }
    if (groups.some(g => g.name.toLowerCase() === trimmed.toLowerCase())) { setError('That group already exists.'); return }
    setSaving(true)
    const { ok, data } = await run(
      supabase.from('member_groups').insert({ name: trimmed }).select('*').single(),
      { success: `${trimmed} group created.`, failure: 'The group did not save.' }
    )
    setSaving(false)
    if (!ok) return
    logActivity('created', 'member_groups', data.id, { name: trimmed })
    setName('')
    onChanged()
  }

  const remove = async group => {
    const { ok } = await run(
      supabase.from('member_groups').delete().eq('id', group.id),
      { success: `${group.name} group deleted.`, failure: 'The group was not deleted.' }
    )
    if (!ok) return
    logActivity('deleted', 'member_groups', group.id, { name: group.name })
    onChanged()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Groups"
      description="Named sets of members. Select members in the table to add them to a group. Click a group to see who is in it."
      footer={<Button onClick={onClose} data-dialog-dismiss="true">Done</Button>}
    >
      <form onSubmit={create} className="flex items-end gap-2 mb-4">
        <TextField label="New group" value={name} error={error} className="flex-1"
          onChange={e => { setName(e.target.value); setError(null) }} placeholder="Robotics workshop 2026" />
        <Button type="submit" variant="primary" icon={Plus} busy={saving} busyLabel="Adding…">Add</Button>
      </form>
      {groups.length === 0 ? (
        <p className="text-sm" style={{ color: 'var(--adm-silk-faint)' }}>No groups yet.</p>
      ) : (
        <ul className="space-y-1.5">
          {groups.map(g => (
            <li key={g.id} className="flex items-center gap-2 px-3 py-2 rounded-lg" style={{ background: 'var(--adm-board-sunk)' }}>
              <button type="button" className="flex-1 min-w-0 text-left text-sm font-semibold adm-truncate"
                onClick={() => onPick(String(g.id))}>
                {g.name}
              </button>
              <span className="adm-data text-[12px]" style={{ color: 'var(--adm-silk-faint)' }}>
                {counts[g.id] || 0} member{counts[g.id] === 1 ? '' : 's'}
              </span>
              <IconButton icon={Trash2} label={`Delete ${g.name}`} size={14} danger onClick={() => remove(g)} />
            </li>
          ))}
        </ul>
      )}
    </Modal>
  )
}
