import { useEffect, useState } from 'react'
import { logActivity, run, supabase } from '../../lib/db'
import useAdminStore from '../../store/adminStore'
import { AUDIENCES, LANGUAGES, STARTERS, newSlug, prepareQuestions } from '../../lib/polls'
import Modal from '../ui/Modal'
import Button from '../ui/Button'
import { SelectField, TextField } from '../ui/Field'

const EMPTY = { title: '', starter: 'blank', language: 'en', audience: 'public' }

/**
 * A poll starts as a draft: name it, pick who answers and a starting set of
 * questions, then finish it on its own page before publishing.
 */
export default function NewPollModal({ open, onClose, onCreated }) {
  const userId = useAdminStore(s => s.adminProfile?.user_id)
  const [form, setForm] = useState(EMPTY)
  const [error, setError] = useState(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => { if (open) { setForm(EMPTY); setError(null) } }, [open])
  const set = (key, value) => setForm(f => ({ ...f, [key]: value }))

  const submit = async () => {
    const title = form.title.trim()
    if (!title) { setError('Give the poll a name.'); return }
    setSaving(true)
    const { ok, data } = await run(
      supabase.from('polls').insert({
        title, slug: newSlug(), language: form.language, audience: form.audience, created_by: userId,
      }).select('id').single(),
      { failure: 'The poll was not created.' }
    )
    if (!ok) { setSaving(false); return }

    // Starter questions with blank prompts are kept as they are: the editor
    // shows them for the admin to fill in, so only send finished ones now.
    const starter = STARTERS.find(s => s.value === form.starter) || STARTERS[0]
    const ready = starter.questions().filter(q => q.prompt.trim() && q.options.every(o => o.trim()))
    const { payload } = prepareQuestions(ready)
    if (payload?.length) {
      await run(supabase.rpc('poll_replace_questions', { p_poll_id: data.id, p_questions: payload }), { failure: 'The starter questions were not added.' })
    }
    setSaving(false)
    logActivity('created', 'polls', data.id, { name: title })
    onCreated(data.id, form.starter)
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="New poll"
      description="It starts as a draft. Nobody can open the link until you publish it."
      footer={
        <>
          <Button onClick={onClose} data-dialog-dismiss="true">Cancel</Button>
          <Button variant="primary" busy={saving} busyLabel="Creating…" onClick={submit}>Create poll</Button>
        </>
      }
    >
      <form className="space-y-4" onSubmit={e => { e.preventDefault(); submit() }}>
        <TextField
          label="Name"
          required
          autoFocus
          dir="auto"
          placeholder="e.g. Which workshop should we run next?"
          value={form.title}
          error={error}
          onChange={e => { set('title', e.target.value); setError(null) }}
        />
        <SelectField label="Start from" value={form.starter} onChange={e => set('starter', e.target.value)}>
          {STARTERS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
        </SelectField>
        <div className="grid sm:grid-cols-2 gap-4">
          <SelectField label="Who answers" value={form.audience} onChange={e => set('audience', e.target.value)}
            hint={AUDIENCES.find(a => a.value === form.audience)?.hint}>
            {AUDIENCES.map(a => <option key={a.value} value={a.value}>{a.label}</option>)}
          </SelectField>
          <SelectField label="Page language" value={form.language} onChange={e => set('language', e.target.value)}
            hint="Buttons and notices on the public page.">
            {LANGUAGES.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}
          </SelectField>
        </div>
      </form>
    </Modal>
  )
}
