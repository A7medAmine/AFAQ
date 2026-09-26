import { useEffect, useState } from 'react'
import { logActivity, run, supabase } from '../../lib/db'
import Modal from '../ui/Modal'
import Button from '../ui/Button'
import { SelectField, TextArea, TextField } from '../ui/Field'

/**
 * Plan what an event or project should cost and bring in. The scope select
 * holds `event:<id>`, `project:<id>` or '' (club-wide), since a budget belongs
 * to at most one of them.
 */
export default function BudgetModal({ open, budget, events = [], projects = [], onClose, onSaved }) {
  const editing = !!budget
  const [form, setForm] = useState({})
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    const b = budget || {}
    setForm({
      name: b.name || '',
      scope: b.event_id ? `event:${b.event_id}` : b.project_id ? `project:${b.project_id}` : '',
      planned_expense: b.planned_expense != null ? String(Number(b.planned_expense)) : '',
      planned_income: b.planned_income != null ? String(Number(b.planned_income)) : '',
      notes: b.notes || '',
    })
    setErrors({})
  }, [open, budget])

  const set = (key, value) => {
    setForm(f => ({ ...f, [key]: value }))
    setErrors(e => ({ ...e, [key]: undefined }))
  }

  // Picking an event or project names the budget after it, unless already named.
  const setScope = value => {
    const [type, id] = value.split(':')
    const source = type === 'event' ? events : type === 'project' ? projects : []
    const title = source.find(x => String(x.id) === id)?.title_en
    setForm(f => ({ ...f, scope: value, name: f.name.trim() ? f.name : title || '' }))
  }

  const submit = async () => {
    const next = {}
    const expense = Number(form.planned_expense || 0)
    const income = Number(form.planned_income || 0)
    if (!form.name.trim()) next.name = 'Give the budget a name.'
    if (!Number.isFinite(expense) || expense < 0) next.planned_expense = 'Enter zero or more.'
    if (!Number.isFinite(income) || income < 0) next.planned_income = 'Enter zero or more.'
    if (Object.keys(next).length) { setErrors(next); return }

    const [type, id] = form.scope.split(':')
    const payload = {
      name: form.name.trim(),
      event_id: type === 'event' ? Number(id) : null,
      project_id: type === 'project' ? Number(id) : null,
      planned_expense: Math.round(expense * 100) / 100,
      planned_income: Math.round(income * 100) / 100,
      notes: form.notes.trim() || null,
      updated_at: new Date().toISOString(),
    }

    setSaving(true)
    const query = editing
      ? supabase.from('finance_budgets').update(payload).eq('id', budget.id)
      : supabase.from('finance_budgets').insert(payload)
    const { ok, data } = await run(query.select('*').single(), {
      success: editing ? 'Budget updated.' : 'Budget created.',
      failure: 'The budget did not save.',
    })
    setSaving(false)
    if (!ok) return
    logActivity(editing ? 'updated' : 'created', 'finance_budgets', data.id, { name: data.name })
    onSaved(data)
    onClose()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editing ? 'Edit budget' : 'New budget'}
      size="sm"
      footer={
        <>
          <Button onClick={onClose} data-dialog-dismiss="true">Cancel</Button>
          <Button variant="primary" onClick={submit} busy={saving} busyLabel="Saving…">
            {editing ? 'Save changes' : 'Create budget'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <SelectField label="For" value={form.scope || ''} onChange={e => setScope(e.target.value)}
          hint="Actuals are every transaction tagged with this event or project.">
          <option value="">The whole club</option>
          {events.length > 0 && (
            <optgroup label="Events">
              {events.map(ev => <option key={ev.id} value={`event:${ev.id}`}>{ev.title_en}</option>)}
            </optgroup>
          )}
          {projects.length > 0 && (
            <optgroup label="Projects">
              {projects.map(p => <option key={p.id} value={`project:${p.id}`}>{p.title_en}</option>)}
            </optgroup>
          )}
        </SelectField>
        <TextField label="Name" required value={form.name || ''} error={errors.name}
          onChange={e => set('name', e.target.value)} placeholder="Robotics day 2026" />
        <div className="grid grid-cols-2 gap-4">
          <TextField label="Planned spend (DA)" type="number" min="0" step="0.01" inputMode="decimal"
            value={form.planned_expense || ''} error={errors.planned_expense}
            onChange={e => set('planned_expense', e.target.value)} />
          <TextField label="Expected income (DA)" type="number" min="0" step="0.01" inputMode="decimal"
            value={form.planned_income || ''} error={errors.planned_income}
            onChange={e => set('planned_income', e.target.value)} />
        </div>
        <TextArea label="Notes" rows={2} value={form.notes || ''} onChange={e => set('notes', e.target.value)} />
      </div>
    </Modal>
  )
}
