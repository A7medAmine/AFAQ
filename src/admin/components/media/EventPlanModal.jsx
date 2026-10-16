import { useEffect, useState } from 'react'
import { CalendarPlus } from 'lucide-react'
import { run, supabase } from '../../lib/db'
import useAdminStore from '../../store/adminStore'
import { formatDateTime } from '../../lib/format'
import { EVENT_PLAN, ROLES, formatLabel } from '../../lib/media'
import Modal from '../ui/Modal'
import Button from '../ui/Button'
import { CheckField, SelectField } from '../ui/Field'

/** The event's date at `hour`, moved by `days`. Falls back to noon when the event has no time. */
function planDate(event, days, hour) {
  const d = new Date(`${event.date}T${event.time || '12:00'}`)
  d.setDate(d.getDate() + days)
  if (days !== 0 || !event.time) d.setHours(hour, 0, 0, 0)
  return d
}

/**
 * The same five posts get made for every event. This lays them out in one go,
 * dated around the event and already assigned, so nobody plans them by hand.
 */
export default function EventPlanModal({ open, events, people, onClose, onAdded }) {
  const userId = useAdminStore(s => s.adminProfile?.user_id)
  const [eventId, setEventId] = useState('')
  const [chosen, setChosen] = useState(() => new Set(EVENT_PLAN.map((_, i) => i)))
  const [team, setTeam] = useState({})
  const [saving, setSaving] = useState(false)

  const upcoming = events.filter(e => e.date >= new Date().toISOString().slice(0, 10))

  useEffect(() => {
    if (!open) return
    setEventId(upcoming[0] ? String(upcoming[0].id) : '')
    setChosen(new Set(EVENT_PLAN.map((_, i) => i)))
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  const event = events.find(e => String(e.id) === eventId)

  const create = async () => {
    if (!event) return
    const rows = EVENT_PLAN.filter((_, i) => chosen.has(i)).map(item => ({
      title: `${event.title_en} — ${item.title}`,
      format: item.format,
      platforms: item.format === 'story' ? ['instagram', 'facebook'] : ['instagram', 'facebook', 'linkedin'],
      publish_at: planDate(event, item.days, item.hour).toISOString(),
      needs_shoot: item.needs_shoot,
      event_id: event.id,
      status: 'idea',
      created_by: userId || null,
      ...Object.fromEntries(ROLES.map(r => [r.key, team[r.key] ? Number(team[r.key]) : null])),
    }))
    setSaving(true)
    const { ok } = await run(supabase.from('media_posts').insert(rows), {
      success: `${rows.length} posts planned for ${event.title_en}.`,
      failure: 'The plan was not saved.',
    })
    setSaving(false)
    if (!ok) return
    onAdded()
    onClose()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title="Plan an event"
      description="Creates the usual posts around one event, dated and assigned. Change anything afterwards on the board."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="primary" icon={CalendarPlus} busy={saving} busyLabel="Planning…" disabled={!event || !chosen.size} onClick={create}>
            Create {chosen.size} posts
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <SelectField label="Event" value={eventId} onChange={e => setEventId(e.target.value)}>
          <option value="">Pick an event</option>
          {events.map(ev => <option key={ev.id} value={ev.id}>{ev.title_en} · {ev.date}</option>)}
        </SelectField>

        {event && (
          <div className="flex flex-col gap-2.5">
            <span className="adm-label" style={{ marginBottom: 0 }}>Posts</span>
            {EVENT_PLAN.map((item, i) => (
              <CheckField
                key={item.title}
                label={`${item.title} · ${formatLabel(item.format)}`}
                description={`${formatDateTime(planDate(event, item.days, item.hour))}${item.needs_shoot ? ' · needs a shoot' : ''}`}
                checked={chosen.has(i)}
                onChange={on => setChosen(s => {
                  const next = new Set(s)
                  on ? next.add(i) : next.delete(i)
                  return next
                })}
              />
            ))}
          </div>
        )}

        <div className="grid gap-3 sm:grid-cols-2">
          {ROLES.map(r => (
            <SelectField key={r.key} label={r.label} value={team[r.key] || ''} onChange={e => setTeam(t => ({ ...t, [r.key]: e.target.value }))}>
              <option value="">Nobody yet</option>
              {people.map(p => <option key={p.id} value={p.id}>{p.full_name || p.email}</option>)}
            </SelectField>
          ))}
        </div>
      </div>
    </Modal>
  )
}
