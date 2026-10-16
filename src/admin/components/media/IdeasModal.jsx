import { useEffect, useState } from 'react'
import { Check, Plus, Sparkles } from 'lucide-react'
import { api, run, supabase } from '../../lib/db'
import useAdminStore from '../../store/adminStore'
import { formatLabel, platformOf } from '../../lib/media'
import Modal from '../ui/Modal'
import Button from '../ui/Button'
import Badge from '../ui/Badge'
import { SelectField, TextArea } from '../ui/Field'

/**
 * Ask the AI for post ideas on a topic or around an event, then keep the good
 * ones. Kept ideas land in the Ideas column with you as the writer.
 */
export default function IdeasModal({ open, events, onClose, onAdded }) {
  const adminId = useAdminStore(s => s.adminProfile?.id)
  const userId = useAdminStore(s => s.adminProfile?.user_id)
  const addToast = useAdminStore(s => s.addToast)
  const [topic, setTopic] = useState('')
  const [eventId, setEventId] = useState('')
  const [ideas, setIdeas] = useState([])
  const [picked, setPicked] = useState(new Set())
  const [busy, setBusy] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    setIdeas([])
    setPicked(new Set())
  }, [open])

  const event = events.find(e => String(e.id) === eventId)

  const generate = async () => {
    setBusy(true)
    const { ok, data, message } = await api('/api/media/ideas', {
      method: 'POST',
      body: {
        topic,
        count: 6,
        event: event ? { title: event.title_en, date: event.date, location: event.location_en, description: event.description_en } : null,
      },
    })
    setBusy(false)
    if (!ok) { addToast(message || 'The AI did not answer.', 'error'); return }
    setIdeas(data.ideas || [])
    setPicked(new Set((data.ideas || []).map((_, i) => i)))
  }

  const toggle = i => setPicked(s => {
    const next = new Set(s)
    next.has(i) ? next.delete(i) : next.add(i)
    return next
  })

  const keep = async () => {
    const rows = ideas.filter((_, i) => picked.has(i)).map(idea => ({
      title: idea.title,
      brief: idea.brief || null,
      format: idea.format,
      platforms: idea.platforms.length ? idea.platforms : ['instagram', 'facebook'],
      shot_list: idea.shot_list || null,
      needs_shoot: !!idea.shot_list,
      event_id: event?.id || null,
      status: 'idea',
      writer_id: adminId || null,
      created_by: userId || null,
    }))
    if (!rows.length) return
    setSaving(true)
    const { ok } = await run(supabase.from('media_posts').insert(rows), {
      success: `${rows.length} idea${rows.length === 1 ? '' : 's'} added to the board.`,
      failure: 'The ideas were not saved.',
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
      title="Post ideas"
      description="Describe a topic or pick an event. Keep the ideas you like; they go to the Ideas column."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Close</Button>
          {ideas.length > 0 && (
            <Button variant="primary" icon={Plus} busy={saving} busyLabel="Adding…" disabled={!picked.size} onClick={keep}>
              Add {picked.size} to the board
            </Button>
          )}
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <div className="grid gap-3 sm:grid-cols-[1fr_220px]">
          <TextArea label="Topic" rows={2} value={topic} onChange={e => setTopic(e.target.value)}
            placeholder="Arduino tips for beginners, our robot at the national competition, Ramadan schedule…" />
          <SelectField label="Event (optional)" value={eventId} onChange={e => setEventId(e.target.value)}>
            <option value="">None</option>
            {events.map(ev => <option key={ev.id} value={ev.id}>{ev.title_en} · {ev.date}</option>)}
          </SelectField>
        </div>
        <div>
          <Button icon={Sparkles} busy={busy} busyLabel="Thinking…" disabled={!topic.trim() && !eventId} onClick={generate}>
            {ideas.length ? 'Suggest again' : 'Suggest ideas'}
          </Button>
        </div>

        {ideas.length > 0 && (
          <div className="grid gap-2 sm:grid-cols-2">
            {ideas.map((idea, i) => {
              const on = picked.has(i)
              return (
                <button key={i} type="button" onClick={() => toggle(i)} aria-pressed={on}
                  className="text-left flex flex-col gap-1.5 p-3 rounded-xl"
                  style={{
                    background: on ? 'var(--adm-signal-wash)' : 'var(--adm-board-sunk)',
                    border: `1px solid ${on ? 'var(--adm-signal-edge)' : 'var(--adm-trace)'}`,
                  }}>
                  <span className="flex items-start justify-between gap-2">
                    <span className="text-[13px] font-semibold" style={{ color: 'var(--adm-silk)' }}>{idea.title}</span>
                    {on && <Check size={15} style={{ color: 'var(--adm-signal)', flexShrink: 0 }} />}
                  </span>
                  <span className="text-[12px]" style={{ color: 'var(--adm-silk-dim)' }}>{idea.brief}</span>
                  <span className="flex flex-wrap gap-1">
                    <Badge>{formatLabel(idea.format)}</Badge>
                    {idea.platforms.map(p => <Badge key={p}>{platformOf(p)?.label || p}</Badge>)}
                  </span>
                </button>
              )
            })}
          </div>
        )}
      </div>
    </Modal>
  )
}
