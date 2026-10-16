import { useEffect, useState } from 'react'
import { logActivity, run, supabase } from '../../lib/db'
import Modal from '../ui/Modal'
import Button from '../ui/Button'
import { SelectField } from '../ui/Field'

/**
 * Puts the given members into a department by hand. Hand-added rows are
 * 'manual', so a later change to their interests never takes them out.
 * Members already in the department become 'manual' too.
 */
export default function AddToDepartmentModal({ open, members = [], departments = [], onClose, onSaved }) {
  const [departmentId, setDepartmentId] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open) setDepartmentId(departments.length ? String(departments[0].id) : '')
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  const save = async e => {
    e?.preventDefault()
    const department = departments.find(d => String(d.id) === departmentId)
    if (!department) return
    const count = members.length
    setSaving(true)
    const { ok } = await run(
      supabase.from('member_departments')
        .upsert(members.map(m => ({ member_id: m.id, department_id: department.id, source: 'manual' })), { onConflict: 'member_id,department_id' }),
      { success: `${count} member${count === 1 ? '' : 's'} added to ${department.name}.`, failure: 'The members were not added.' }
    )
    setSaving(false)
    if (!ok) return
    logActivity('updated', 'departments', department.id, { name: department.name, added: count })
    onSaved?.()
    onClose()
  }

  const count = members.length

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Add to department"
      description={count === 1 ? `Add ${members[0].full_name} to a department.` : `Add ${count} selected members to a department.`}
      footer={
        <>
          <Button onClick={onClose} data-dialog-dismiss="true">Cancel</Button>
          <Button variant="primary" busy={saving} busyLabel="Adding…" onClick={save} disabled={!departmentId}>Add to department</Button>
        </>
      }
    >
      <form onSubmit={save}>
        <SelectField label="Department" value={departmentId} onChange={e => setDepartmentId(e.target.value)}>
          {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
        </SelectField>
      </form>
    </Modal>
  )
}
