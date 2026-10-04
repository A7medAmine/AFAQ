import { useEffect, useState } from 'react'
import { Check, Pencil, Plus, RotateCcw, Trash2, X } from 'lucide-react'
import { logActivity, run, supabase } from '../../lib/db'
import { roleOptions } from '../../lib/hr'
import Modal from '../ui/Modal'
import Button, { IconButton } from '../ui/Button'
import Badge from '../ui/Badge'
import { TextField } from '../ui/Field'

/**
 * Lists every role with how many members hold it now, and lets the admin add,
 * rename or remove custom roles. Built-in offices cannot be removed, but can be
 * renamed: the new name is a member_roles row with builtin_key set, and
 * resetting deletes it. Deleting a custom role only takes it out of the
 * pickers; members who held it keep their terms.
 *
 * @param holders  { [roleValue]: count } of current holders
 */
export default function RolesModal({ open, customRoles = [], holders = {}, onClose, onChanged, onPick }) {
  const [name, setName] = useState('')
  const [error, setError] = useState(null)
  const [saving, setSaving] = useState(false)

  const [editing, setEditing] = useState(null) // { value, name, error }

  useEffect(() => { if (open) { setName(''); setError(null); setEditing(null) } }, [open])

  const options = roleOptions(customRoles)

  // Names are unique across member_roles, so check every row, not just the listed ones.
  const nameTaken = (candidate, role) => {
    const lower = candidate.toLowerCase()
    return options.some(o => o.value !== role?.value && o.label.toLowerCase() === lower) ||
      customRoles.some(r => r.id !== (role?.id ?? role?.renameId) && r.name.toLowerCase() === lower)
  }

  const create = async e => {
    e?.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) { setError('Name the role.'); return }
    if (nameTaken(trimmed)) { setError('That role already exists.'); return }
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

  const rename = async (e, role) => {
    e?.preventDefault()
    const trimmed = editing.name.trim()
    const fail = msg => setEditing(ed => ({ ...ed, error: msg }))
    if (!trimmed) { fail('Name the role.'); return }
    if (trimmed === role.label) { setEditing(null); return }
    // Typing a built-in office's original name back is the same as resetting it.
    if (role.renameId && trimmed === role.defaultLabel) {
      await reset(role)
      return
    }
    if (nameTaken(trimmed, role)) { fail('That role already exists.'); return }

    setSaving(true)
    const messages = { success: `Renamed to ${trimmed}.`, failure: 'The role was not renamed.' }
    let result
    if (role.defaultLabel) {
      result = role.renameId
        ? await run(supabase.from('member_roles').update({ name: trimmed }).eq('id', role.renameId).select('*').single(), messages)
        : await run(supabase.from('member_roles').insert({ name: trimmed, builtin_key: role.value }).select('*').single(), messages)
    } else {
      // Terms store a custom role by name, so carry them over to the new one.
      result = await run(supabase.from('member_roles').update({ name: trimmed }).eq('id', role.id).select('*').single(), messages)
      if (result.ok) {
        await run(supabase.from('member_positions').update({ title: trimmed }).eq('title', role.value),
          { failure: 'The role was renamed, but members holding it still show the old name.' })
      }
    }
    setSaving(false)
    if (!result.ok) return
    logActivity('updated', 'member_roles', result.data.id, { name: trimmed, from: role.label })
    setEditing(null)
    onChanged()
  }

  const reset = async role => {
    setSaving(true)
    const { ok } = await run(
      supabase.from('member_roles').delete().eq('id', role.renameId),
      { success: `${role.defaultLabel} name restored.`, failure: 'The name was not restored.' }
    )
    setSaving(false)
    if (!ok) return
    logActivity('updated', 'member_roles', role.renameId, { name: role.defaultLabel, from: role.label })
    setEditing(null)
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
      description="Offices and custom roles members can hold. Click a role to see who holds it, or the pencil to rename it."
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
            {editing?.value === r.value ? (
              <form onSubmit={e => rename(e, r)} className="flex flex-1 min-w-0 items-start gap-2">
                <TextField label={`Rename ${r.label}`} value={editing.name} error={editing.error} className="flex-1" autoFocus
                  hint={r.defaultLabel ? `Built-in name: ${r.defaultLabel}` : undefined}
                  onChange={e => setEditing({ ...editing, name: e.target.value, error: null })} />
                <IconButton icon={Check} label="Save name" size={14} type="submit" disabled={saving} className="mt-6" />
                <IconButton icon={X} label="Cancel" size={14} onClick={() => setEditing(null)} className="mt-6" />
              </form>
            ) : (
              <>
                <button type="button" className="flex-1 min-w-0 text-left text-sm font-semibold adm-truncate"
                  onClick={() => onPick(r.value)}>
                  {r.label}
                  {r.renameId && (
                    <span className="ml-1.5 font-normal text-[12px]" style={{ color: 'var(--adm-silk-faint)' }}>({r.defaultLabel})</span>
                  )}
                </button>
                <span className="adm-data text-[12px]" style={{ color: 'var(--adm-silk-faint)' }}>
                  {holders[r.value] || 0} holding
                </span>
                <IconButton icon={Pencil} label={`Rename ${r.label}`} size={14}
                  onClick={() => setEditing({ value: r.value, name: r.label, error: null })} />
                {r.id ? (
                  <IconButton icon={Trash2} label={`Delete ${r.label}`} size={14} danger onClick={() => remove(r)} />
                ) : r.renameId ? (
                  <IconButton icon={RotateCcw} label={`Restore the name ${r.defaultLabel}`} size={14} disabled={saving} onClick={() => reset(r)} />
                ) : (
                  <Badge tone="neutral">Built-in</Badge>
                )}
              </>
            )}
          </li>
        ))}
      </ul>
    </Modal>
  )
}
