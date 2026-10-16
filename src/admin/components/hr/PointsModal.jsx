import { useEffect, useState } from 'react'
import { logActivity, run, supabase } from '../../lib/db'
import useAdminStore from '../../store/adminStore'
import { MANUAL_CATEGORIES } from '../../lib/points'
import Modal from '../ui/Modal'
import Button from '../ui/Button'
import { SelectField, TextField } from '../ui/Field'

/**
 * Gives (or takes away) the same number of points to every member passed in.
 * One ledger row per member, signed by the admin giving them.
 */
export default function PointsModal({ open, members = [], take = false, onClose, onSaved }) {
  const userId = useAdminStore(s => s.adminProfile?.user_id)
  const [form, setForm] = useState({ direction: 'give', amount: '10', category: 'contribution', reason: '' })
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    setForm({ direction: take ? 'take' : 'give', amount: take ? '5' : '10', category: take ? 'penalty' : 'contribution', reason: '' })
    setErrors({})
  }, [open, take])

  const set = (key, value) => {
    setForm(f => {
      const next = { ...f, [key]: value }
      // Taking points away is a penalty unless said otherwise.
      if (key === 'direction') next.category = value === 'take' ? 'penalty' : 'contribution'
      return next
    })
    setErrors(e => ({ ...e, [key]: null }))
  }

  const save = async e => {
    e?.preventDefault()
    const amount = Math.round(Number(form.amount))
    const next = {}
    if (!amount || amount < 1) next.amount = 'Enter a whole number above zero.'
    if (!form.reason.trim()) next.reason = 'Say why, so the history makes sense later.'
    setErrors(next)
    if (Object.keys(next).length) return

    const points = form.direction === 'take' ? -amount : amount
    const count = members.length
    setSaving(true)
    const { ok } = await run(
      supabase.from('point_entries').insert(members.map(m => ({
        member_id: m.id, points, category: form.category, reason: form.reason.trim(), awarded_by: userId,
      }))),
      {
        success: `${points > 0 ? `${points} points given to` : `${-points} points taken from`} ${count === 1 ? members[0].full_name : `${count} members`}.`,
        failure: 'The points were not saved.',
      }
    )
    setSaving(false)
    if (!ok) return
    logActivity('created', 'point_entries', null, { points, reason: form.reason.trim(), members: members.map(m => m.full_name) })
    onSaved?.()
    onClose()
  }

  const count = members.length

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={form.direction === 'take' ? 'Take points away' : 'Give points'}
      description={count === 1 ? members[0].full_name : `${count} selected members, the same amount each.`}
      footer={
        <>
          <Button onClick={onClose} data-dialog-dismiss="true">Cancel</Button>
          <Button variant={form.direction === 'take' ? 'danger' : 'primary'} busy={saving} busyLabel="Saving…" onClick={save}>
            {form.direction === 'take' ? 'Take away' : 'Give points'}
          </Button>
        </>
      }
    >
      <form onSubmit={save} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <SelectField label="Action" value={form.direction} onChange={e => set('direction', e.target.value)}>
            <option value="give">Give points</option>
            <option value="take">Take points away</option>
          </SelectField>
          <TextField label="Points" type="number" min="1" step="1" required value={form.amount} error={errors.amount}
            onChange={e => set('amount', e.target.value)} />
        </div>
        <SelectField label="Category" value={form.category} onChange={e => set('category', e.target.value)}>
          {MANUAL_CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
        </SelectField>
        <TextField label="Reason" required value={form.reason} error={errors.reason} autoFocus
          placeholder={form.direction === 'take' ? 'Missed the workshop without notice' : 'Helped set up the open day'}
          onChange={e => set('reason', e.target.value)} />
      </form>
    </Modal>
  )
}
