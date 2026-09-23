import { useEffect, useState } from 'react'
import { logActivity, run, supabase } from '../../lib/db'
import useAdminStore from '../../store/adminStore'
import { TASK_PRIORITIES, TASK_STATUSES } from '../../lib/hr'
import Modal from '../ui/Modal'
import Button from '../ui/Button'
import { SelectField, TextArea, TextField } from '../ui/Field'

/**
 * Create or edit a task. `defaults` pre-fills a new task — the project page and
 * a member's detail view open this with their own id already chosen.
 *
 * @param members   [{ id, full_name }] assignee options
 * @param projects  [{ id, title_en }] project options
 */
export default function TaskModal({ open, task, defaults = {}, members = [], projects = [], onClose, onSaved }) {
  const editing = !!task
  const userId = useAdminStore(s => s.adminProfile?.user_id)
  const [form, setForm] = useState({})
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    const src = task || defaults
    setForm({
      title: src.title || '',
      description: src.description || '',
      assignee_id: src.assignee_id ? String(src.assignee_id) : '',
      project_id: src.project_id ? String(src.project_id) : '',
      status: src.status || 'todo',
      priority: src.priority || 'normal',
      due_date: src.due_date || '',
    })
    setErrors({})
  }, [open, task]) // eslint-disable-line react-hooks/exhaustive-deps

  const set = (key, value) => {
    setForm(f => ({ ...f, [key]: value }))
    setErrors(e => ({ ...e, [key]: undefined }))
  }

  const submit = async () => {
    if (!form.title.trim()) { setErrors({ title: 'Say what needs doing.' }); return }

    const payload = {
      title: form.title.trim(),
      description: form.description.trim() || null,
      assignee_id: form.assignee_id ? Number(form.assignee_id) : null,
      project_id: form.project_id ? Number(form.project_id) : null,
      status: form.status,
      priority: form.priority,
      due_date: form.due_date || null,
      updated_at: new Date().toISOString(),
    }
    // Stamp completion when a task first reaches done, clear it if reopened.
    if (form.status === 'done') payload.completed_at = task?.completed_at || new Date().toISOString()
    else payload.completed_at = null

    setSaving(true)
    const query = editing
      ? supabase.from('member_tasks').update(payload).eq('id', task.id)
      : supabase.from('member_tasks').insert({ ...payload, created_by: userId || null })
    const { ok, data } = await run(query.select('*').single(), {
      success: editing ? 'Task updated.' : 'Task created.',
      failure: 'The task did not save.',
    })
    setSaving(false)
    if (!ok) return
    logActivity(editing ? 'updated' : 'created', 'member_tasks', data.id, { name: data.title })
    onSaved(data)
    onClose()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editing ? 'Edit task' : 'New task'}
      footer={
        <>
          <Button onClick={onClose} data-dialog-dismiss="true">Cancel</Button>
          <Button variant="primary" onClick={submit} busy={saving} busyLabel="Saving…">
            {editing ? 'Save changes' : 'Create task'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <TextField label="Task" required value={form.title || ''} error={errors.title}
          onChange={e => set('title', e.target.value)} placeholder="Prepare the robotics workshop kit" />
        <TextArea label="Details" value={form.description || ''} onChange={e => set('description', e.target.value)} />
        <div className="grid sm:grid-cols-2 gap-4">
          <SelectField label="Assigned to" value={form.assignee_id || ''} onChange={e => set('assignee_id', e.target.value)}>
            <option value="">Nobody yet</option>
            {members.map(m => <option key={m.id} value={m.id}>{m.full_name}</option>)}
          </SelectField>
          <SelectField label="Project" value={form.project_id || ''} onChange={e => set('project_id', e.target.value)}>
            <option value="">No project</option>
            {projects.map(p => <option key={p.id} value={p.id}>{p.title_en}</option>)}
          </SelectField>
          <SelectField label="Status" value={form.status || 'todo'} onChange={e => set('status', e.target.value)}>
            {TASK_STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
          </SelectField>
          <SelectField label="Priority" value={form.priority || 'normal'} onChange={e => set('priority', e.target.value)}>
            {TASK_PRIORITIES.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
          </SelectField>
          <TextField label="Due" type="date" value={form.due_date || ''} onChange={e => set('due_date', e.target.value)} />
        </div>
      </div>
    </Modal>
  )
}
