import { useEffect, useState } from 'react'
import { logActivity, run, supabase } from '../../lib/db'
import Modal from '../ui/Modal'
import Button from '../ui/Button'
import { SelectField, TextField } from '../ui/Field'

const NEW = '__new'

/**
 * Puts the given members into an existing group, or into a new one created on
 * the spot. Members already in the group are left as they are.
 */
export default function AddToGroupModal({ open, members = [], groups = [], onClose, onSaved }) {
  const [groupId, setGroupId] = useState(NEW)
  const [name, setName] = useState('')
  const [error, setError] = useState(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    setGroupId(groups.length ? String(groups[0].id) : NEW)
    setName('')
    setError(null)
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  const save = async e => {
    e?.preventDefault()
    let group = groups.find(g => String(g.id) === groupId)
    if (groupId === NEW) {
      const trimmed = name.trim()
      if (!trimmed) { setError('Name the group.'); return }
      if (groups.some(g => g.name.toLowerCase() === trimmed.toLowerCase())) { setError('That group already exists. Pick it from the list.'); return }
      setSaving(true)
      const { ok, data } = await run(
        supabase.from('member_groups').insert({ name: trimmed }).select('*').single(),
        { failure: 'The group did not save.' }
      )
      if (!ok) { setSaving(false); return }
      logActivity('created', 'member_groups', data.id, { name: trimmed })
      group = data
    }
    setSaving(true)
    const count = members.length
    const { ok } = await run(
      supabase.from('member_group_members')
        .upsert(members.map(m => ({ group_id: group.id, member_id: m.id })), { onConflict: 'group_id,member_id', ignoreDuplicates: true }),
      { success: `${count} member${count === 1 ? '' : 's'} added to ${group.name}.`, failure: 'The members were not added.' }
    )
    setSaving(false)
    if (!ok) return
    logActivity('updated', 'member_groups', group.id, { name: group.name, added: count })
    onSaved()
    onClose()
  }

  const count = members.length

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Add to group"
      description={count === 1 ? `Add ${members[0].full_name} to a group.` : `Add ${count} selected members to a group.`}
      footer={
        <>
          <Button onClick={onClose} data-dialog-dismiss="true">Cancel</Button>
          <Button variant="primary" busy={saving} busyLabel="Adding…" onClick={save}>
            {groupId === NEW ? 'Create group and add' : 'Add to group'}
          </Button>
        </>
      }
    >
      <form onSubmit={save} className="space-y-4">
        <SelectField label="Group" value={groupId} onChange={e => { setGroupId(e.target.value); setError(null) }}>
          {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
          <option value={NEW}>+ New group…</option>
        </SelectField>
        {groupId === NEW && (
          <TextField label="New group name" value={name} error={error} autoFocus
            onChange={e => { setName(e.target.value); setError(null) }} placeholder="Robotics workshop 2026" />
        )}
      </form>
    </Modal>
  )
}
