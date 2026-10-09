import { AUDIENCES, IDENTITY, LANGUAGES, RESULTS_VISIBILITY } from '../../lib/polls'
import Panel, { PanelHead } from '../ui/Panel'
import { SelectField, TextArea, TextField } from '../ui/Field'

/** datetime-local wants local time without a zone; the database keeps UTC. */
export const toLocalInput = value => {
  if (!value) return ''
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return ''
  const pad = n => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}
export const fromLocalInput = value => (value ? new Date(value).toISOString() : null)

export function settingsForm(poll) {
  return {
    title: poll.title || '',
    description: poll.description || '',
    language: poll.language,
    audience: poll.audience,
    collect_identity: poll.collect_identity,
    results_visibility: poll.results_visibility,
    opens_at: toLocalInput(poll.opens_at),
    closes_at: toLocalInput(poll.closes_at),
    max_responses: poll.max_responses ?? '',
    thank_you_message: poll.thank_you_message || '',
    event_id: poll.event_id ?? '',
  }
}

/** Check the form; returns `{ errors }` or `{ values }` ready to save. */
export function settingsValues(form) {
  const errors = {}
  if (!form.title.trim()) errors.title = 'Give the poll a name.'
  const max = form.max_responses === '' ? null : Number(form.max_responses)
  if (max !== null && (!Number.isInteger(max) || max < 1)) errors.max_responses = 'A whole number above 0, or leave it empty.'
  if (form.opens_at && form.closes_at && new Date(form.opens_at) >= new Date(form.closes_at)) errors.closes_at = 'It has to close after it opens.'
  if (Object.keys(errors).length) return { errors }
  return {
    values: {
      title: form.title.trim(),
      description: form.description.trim() || null,
      language: form.language,
      audience: form.audience,
      collect_identity: form.collect_identity,
      results_visibility: form.results_visibility,
      opens_at: fromLocalInput(form.opens_at),
      closes_at: fromLocalInput(form.closes_at),
      max_responses: max,
      thank_you_message: form.thank_you_message.trim() || null,
      event_id: form.event_id ? Number(form.event_id) : null,
    },
  }
}

export default function PollSettings({ form, onChange, errors = {}, events = [] }) {
  const set = key => e => onChange({ ...form, [key]: e.target.value })
  const audience = AUDIENCES.find(a => a.value === form.audience)
  const identity = IDENTITY.find(i => i.value === form.collect_identity)

  return (
    <div className="space-y-5">
      <Panel>
        <PanelHead eyebrow="Poll" title="What people see" />
        <div className="p-5 space-y-4">
          <TextField label="Name" required dir="auto" value={form.title} error={errors.title} onChange={set('title')} />
          <TextArea label="Introduction" dir="auto" rows={3} value={form.description} onChange={set('description')}
            hint="Shown above the questions, and in the preview when the link is posted." />
          <TextArea label="Thank-you message" dir="auto" rows={2} value={form.thank_you_message} onChange={set('thank_you_message')}
            hint="Shown after someone answers. Leave empty for the standard one." />
          <div className="grid sm:grid-cols-2 gap-4">
            <SelectField label="Page language" value={form.language} onChange={set('language')} hint="Buttons and notices; Arabic reads right to left.">
              {LANGUAGES.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}
            </SelectField>
            <SelectField label="Linked event" value={form.event_id} onChange={set('event_id')} hint="Optional, for your own records.">
              <option value="">None</option>
              {events.map(ev => <option key={ev.id} value={ev.id}>{ev.title_en}</option>)}
            </SelectField>
          </div>
        </div>
      </Panel>

      <Panel>
        <PanelHead eyebrow="Access" title="Who answers and what they see" />
        <div className="p-5 grid sm:grid-cols-2 gap-4">
          <SelectField label="Who can answer" value={form.audience} onChange={set('audience')} hint={audience?.hint}>
            {AUDIENCES.map(a => <option key={a.value} value={a.value}>{a.label}</option>)}
          </SelectField>
          <SelectField label="Name and email" value={form.collect_identity} onChange={set('collect_identity')}
            disabled={form.audience === 'members'}
            hint={form.audience === 'members' ? 'Members-only polls always know who answered.' : identity?.hint}>
            {IDENTITY.map(i => <option key={i.value} value={i.value}>{i.label}</option>)}
          </SelectField>
          <SelectField label="Show results to people answering" value={form.results_visibility} onChange={set('results_visibility')}
            hint="Totals only. Written answers stay private.">
            {RESULTS_VISIBILITY.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
          </SelectField>
          <TextField label="Stop after this many answers" type="number" min={1} placeholder="No limit"
            value={form.max_responses} error={errors.max_responses} onChange={set('max_responses')} />
        </div>
      </Panel>

      <Panel>
        <PanelHead eyebrow="Schedule" title="When it takes answers" description="Both optional. A published poll opens and closes on its own at these times." />
        <div className="p-5 grid sm:grid-cols-2 gap-4">
          <TextField label="Opens" type="datetime-local" value={form.opens_at} onChange={set('opens_at')} hint="Empty: as soon as it is published." />
          <TextField label="Closes" type="datetime-local" value={form.closes_at} error={errors.closes_at} onChange={set('closes_at')} hint="Empty: stays open until you close it." />
        </div>
      </Panel>
    </div>
  )
}
