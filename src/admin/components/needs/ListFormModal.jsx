import { useEffect, useState } from 'react'
import { logActivity, read, run, supabase } from '../../lib/db'
import useAdminStore from '../../store/adminStore'
import { LIST_SCOPES, copyItems } from '../../lib/needs'
import Modal from '../ui/Modal'
import Button from '../ui/Button'
import { SelectField, TextArea, TextField } from '../ui/Field'

const EMPTY = { title: '', scope: 'event', event_id: '', department_id: '', due_date: '', notes: '', template_id: '' }

/** Create a needs list, or edit one's title, purpose, due date and notes. */
export default function ListFormModal({ open, list, events, departments, templates = [], onClose, onSaved }) {
  const userId = useAdminStore(s => s.adminProfile?.user_id)
  const [form, setForm] = useState(EMPTY)
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)
  const isNew = !list?.id

  useEffect(() => {
    if (!open) return
    setErrors({})
    setForm(list?.id ? {
      title: list.title, scope: list.scope, event_id: list.event_id || '', department_id: list.department_id || '',
      due_date: list.due_date || '', notes: list.notes || '',
    } : { ...EMPTY, scope: events.length ? 'event' : 'custom' })
  }, [open, list, events.length])

  const set = (key, value) => {
    setForm(f => {
      const next = { ...f, [key]: value }
      // Picking the event or department fills an empty title with its name.
      if (!f.title.trim() || f.title === autoTitle(f)) {
        if (key === 'event_id' || key === 'department_id' || key === 'scope') next.title = autoTitle(next)
      }
      return next
    })
    setErrors(e => ({ ...e, [key]: undefined }))
  }

  const autoTitle = f => {
    if (f.scope === 'event') {
      const event = events.find(e => String(e.id) === String(f.event_id))
      return event ? `${event.title_en} needs` : ''
    }
    if (f.scope === 'department') {
      const dept = departments.find(d => String(d.id) === String(f.department_id))
      return dept ? `${dept.name} needs` : ''
    }
    return ''
  }

  const submit = async () => {
    const next = {}
    if (!form.title.trim()) next.title = 'Give the list a name.'
    if (form.scope === 'event' && !form.event_id) next.event_id = 'Pick the event.'
    if (form.scope === 'department' && !form.department_id) next.department_id = 'Pick the department.'
    if (Object.keys(next).length) { setErrors(next); return }

    const values = {
      title: form.title.trim(),
      scope: form.scope,
      event_id: form.scope === 'event' ? Number(form.event_id) : null,
      department_id: form.scope === 'department' ? Number(form.department_id) : null,
      due_date: form.due_date || null,
      notes: form.notes.trim() || null,
    }
    setSaving(true)
    const { ok, data } = await run(
      isNew
        ? supabase.from('need_lists').insert({ ...values, created_by: userId }).select('id').single()
        : supabase.from('need_lists').update({ ...values, updated_at: new Date().toISOString() }).eq('id', list.id),
      { success: isNew ? `${values.title} created.` : 'List saved.', failure: 'The list was not saved.' }
    )
    setSaving(false)
    if (!ok) return
    const id = isNew ? data.id : list.id
    logActivity(isNew ? 'created' : 'updated', 'need_lists', id, { name: values.title, ...(form.template_id ? { from_template: Number(form.template_id) } : {}) })
    if (isNew && form.template_id) {
      const tpl = await read(supabase.from('need_items').select('*').eq('list_id', form.template_id))
      const rows = tpl.ok ? copyItems(tpl.data || [], id) : []
      if (rows.length) await run(supabase.from('need_items').insert(rows), { failure: 'The list was made, but the template items were not copied.' })
    }
    onSaved(id)
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isNew ? 'New needs list' : 'Edit list'}
      description="A list of what has to be gathered, grouped by department when you add items."
      footer={
        <>
          <Button onClick={onClose} data-dialog-dismiss="true">Cancel</Button>
          <Button variant="primary" onClick={submit} busy={saving} busyLabel="Saving…">{isNew ? 'Create list' : 'Save'}</Button>
        </>
      }
    >
      <div className="space-y-4">
        <div>
          <span className="adm-label">What is it for?</span>
          <div className="flex flex-wrap gap-2">
            {LIST_SCOPES.map(s => (
              <button key={s.value} type="button" className="adm-export-choice" data-active={form.scope === s.value || undefined}
                onClick={() => set('scope', s.value)}>
                {s.label}
              </button>
            ))}
          </div>
        </div>
        {form.scope === 'event' && (
          <SelectField label="Event" required value={form.event_id} error={errors.event_id} onChange={e => set('event_id', e.target.value)}>
            <option value="">Pick an event…</option>
            {events.map(e => <option key={e.id} value={e.id}>{e.title_en}{e.date ? ` · ${e.date.slice(0, 10)}` : ''}</option>)}
          </SelectField>
        )}
        {form.scope === 'department' && (
          <SelectField label="Department" required value={form.department_id} error={errors.department_id} onChange={e => set('department_id', e.target.value)}>
            <option value="">Pick a department…</option>
            {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
          </SelectField>
        )}
        {isNew && templates.length > 0 && (
          <SelectField label="Start from a template" value={form.template_id} hint="Copies its items into the new list, all set to Needed."
            onChange={e => setForm(f => ({ ...f, template_id: e.target.value }))}>
            <option value="">Empty list</option>
            {templates.map(t => <option key={t.id} value={t.id}>{t.title}</option>)}
          </SelectField>
        )}
        <TextField label="Name" required value={form.title} error={errors.title} placeholder="Open week 2026 needs"
          onChange={e => set('title', e.target.value)} />
        <TextField label="Needed by" type="date" value={form.due_date} hint="Optional. The list is flagged late after this day."
          onChange={e => set('due_date', e.target.value)} />
        <TextArea label="Notes" value={form.notes} rows={2} placeholder="Budget, contacts, where to drop things off…"
          onChange={e => set('notes', e.target.value)} />
      </div>
    </Modal>
  )
}
