import { useEffect, useState } from 'react'
import { api } from '../lib/db'
import Modal from './ui/Modal'
import Button from './ui/Button'
import { SelectField, TextField } from './ui/Field'

/**
 * Create a console account. Pass `member` to make an existing club member an
 * admin: their name and email come from the member record, and the account is
 * linked to it (admin_users.member_id).
 *
 * @param roles   rows of admin_roles to pick from
 * @param member  { id, full_name, email } or null for a standalone admin
 */
export default function AddAdminModal({ open, roles, member = null, onClose, onAdded, addToast }) {
  const [form, setForm] = useState({ full_name: '', email: '', password: '', role_id: '' })
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open) {
      setForm({
        full_name: member?.full_name || '',
        email: member?.email || '',
        password: '',
        role_id: roles[0]?.id || '',
      })
      setErrors({})
    }
  }, [open, roles, member])

  const set = (key, value) => {
    setForm(f => ({ ...f, [key]: value }))
    setErrors(e => ({ ...e, [key]: undefined }))
  }

  const submit = async () => {
    const next = {}
    if (!form.full_name.trim()) next.full_name = 'Enter their name.'
    if (!form.email.trim()) next.email = member ? 'Add an email to this member first.' : 'Enter an email address.'
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) next.email = 'That is not a valid email address.'
    if (form.password.length < 8) next.password = 'Use at least 8 characters.'
    if (!form.role_id) next.role_id = 'Pick a role.'
    if (Object.keys(next).length) { setErrors(next); return }

    setSaving(true)
    const { ok, message } = await api('/api/admin/users', {
      method: 'POST',
      body: {
        full_name: form.full_name.trim(),
        email: form.email.trim(),
        password: form.password,
        role_id: form.role_id,
        member_id: member?.id,
      },
    })
    setSaving(false)
    if (!ok) { addToast(message, 'error'); return }
    addToast(`${form.full_name.trim()} can now sign in.`)
    onClose()
    onAdded()
  }

  const selectedRole = roles.find(r => String(r.id) === String(form.role_id))

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={member ? `Make ${member.full_name} an admin` : 'Add an admin'}
      description="They sign in with this email and password, and can change it afterwards in Settings."
      footer={
        <>
          <Button onClick={onClose} data-dialog-dismiss="true">Cancel</Button>
          <Button variant="primary" onClick={submit} busy={saving} busyLabel="Creating…">Create account</Button>
        </>
      }
    >
      <div className="space-y-4">
        <TextField label="Full name" required value={form.full_name} error={errors.full_name}
          onChange={e => set('full_name', e.target.value)} placeholder="Sara Belkacem" />
        <TextField label="Email" type="email" required value={form.email} error={errors.email}
          readOnly={!!member} hint={member ? 'From their member record. Edit the member to change it.' : undefined}
          onChange={e => set('email', e.target.value)} placeholder="sara@afaq.dz" />
        <TextField
          label="Temporary password" type="password" required
          hint="At least 8 characters. Share it with them directly."
          value={form.password} error={errors.password}
          onChange={e => set('password', e.target.value)}
        />
        <SelectField label="Role" required value={form.role_id} error={errors.role_id}
          onChange={e => set('role_id', e.target.value)}>
          {roles.map(r => <option key={r.id} value={r.id}>{r.label}</option>)}
        </SelectField>
        {selectedRole?.description && (
          <p className="text-xs -mt-2" style={{ color: 'var(--adm-silk-faint)' }}>{selectedRole.description}</p>
        )}
      </div>
    </Modal>
  )
}
