import { useEffect, useState } from 'react'
import { logActivity, run, supabase } from '../../lib/db'
import { toDateInput } from '../../lib/format'
import { positionLabel } from '../../lib/hr'
import Modal from '../ui/Modal'
import Button from '../ui/Button'
import { SelectField, TextArea, TextField } from '../ui/Field'
import RoleField, { NEW_ROLE, saveRole } from './RoleField'

/**
 * Assign or edit an office term. Pass `memberId` to fix the holder (from a
 * member's detail view); otherwise the form asks who holds it.
 *
 * @param position  the term to edit, or null to assign a new one
 * @param members      [{ id, full_name, member_code }] for the holder picker
 * @param customRoles  rows of member_roles, offered alongside the built-in offices
 * @param defaultTitle role preselected when assigning a new term
 */
export default function PositionModal({
  open, position, memberId, members = [], teams = [], customRoles = [], defaultTitle, onClose, onSaved,
}) {
  const editing = !!position
  const [form, setForm] = useState({})
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    setForm({
      member_id: String(position?.member_id || memberId || ''),
      title: position?.title || defaultTitle || 'team_lead',
      custom_title: '',
      team: position?.team || '',
      term_start: position?.term_start || toDateInput(),
      term_end: position?.term_end || '',
      notes: position?.notes || '',
    })
    setErrors({})
  }, [open, position, memberId, defaultTitle])

  const set = (key, value) => {
    setForm(f => ({ ...f, [key]: value }))
    setErrors(e => ({ ...e, [key]: undefined }))
  }

  const submit = async () => {
    const next = {}
    if (!form.member_id) next.member_id = 'Choose who holds this position.'
    if (form.title === NEW_ROLE && !form.custom_title.trim()) next.custom_title = 'Name the role.'
    if (!form.term_start) next.term_start = 'Enter when the term starts.'
    if (form.term_end && form.term_end < form.term_start) next.term_end = 'The term ends before it starts.'
    if (Object.keys(next).length) { setErrors(next); return }

    setSaving(true)
    const title = await saveRole(form.title, form.custom_title, customRoles)
    if (!title) { setSaving(false); return }
    const payload = {
      member_id: Number(form.member_id),
      title,
      team: form.team.trim() || null,
      term_start: form.term_start,
      term_end: form.term_end || null,
      notes: form.notes.trim() || null,
    }

    const query = editing
      ? supabase.from('member_positions').update(payload).eq('id', position.id)
      : supabase.from('member_positions').insert(payload)
    const { ok, data } = await run(query.select('*').single(), {
      success: editing ? 'Role updated.' : `${positionLabel(title)} assigned.`,
      failure: 'The role did not save.',
    })
    setSaving(false)
    if (!ok) return
    logActivity(editing ? 'updated' : 'created', 'member_positions', data.id, { name: positionLabel(title) })
    onSaved(data)
    onClose()
  }

  const fixedMember = !!memberId && !editing
  // A past holder may no longer be on the active roster; keep them selectable.
  const options = position?.member && !members.some(m => m.id === position.member_id)
    ? [position.member, ...members]
    : members

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editing ? 'Edit role' : 'Assign a role'}
      description="Leave the end date empty for a term that runs until someone replaces them."
      footer={
        <>
          <Button onClick={onClose} data-dialog-dismiss="true">Cancel</Button>
          <Button variant="primary" onClick={submit} busy={saving} busyLabel="Saving…">
            {editing ? 'Save changes' : 'Assign'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {!fixedMember && (
          <SelectField label="Held by" required value={form.member_id || ''} error={errors.member_id}
            onChange={e => set('member_id', e.target.value)}>
            <option value="">Choose a member…</option>
            {options.map(m => (
              <option key={m.id} value={m.id}>{m.full_name}{m.member_code ? ` · ${m.member_code}` : ''}</option>
            ))}
          </SelectField>
        )}
        <div className="grid sm:grid-cols-2 gap-4">
          <RoleField required value={form.title} newName={form.custom_title} error={errors.custom_title}
            customRoles={customRoles} onChange={v => set('title', v)} onNewNameChange={v => set('custom_title', v)} />
          <TextField label="Team" value={form.team || ''} onChange={e => set('team', e.target.value)}
            list="position-teams" placeholder="Robotics" hint="For team leads and heads of department."
            className={form.title === NEW_ROLE ? 'sm:col-span-2' : undefined} />
          <datalist id="position-teams">{teams.map(t => <option key={t} value={t} />)}</datalist>
          <TextField label="Term starts" type="date" required value={form.term_start || ''} error={errors.term_start}
            onChange={e => set('term_start', e.target.value)} />
          <TextField label="Term ends" type="date" value={form.term_end || ''} error={errors.term_end}
            onChange={e => set('term_end', e.target.value)} hint="The day they leave office." />
        </div>
        <TextArea label="Notes" value={form.notes || ''} onChange={e => set('notes', e.target.value)}
          placeholder="Elected at the general assembly of…" />
      </div>
    </Modal>
  )
}
