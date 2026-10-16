import { useEffect, useState } from 'react'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import { run, supabase } from '../../lib/db'
import { SNIPPET_KINDS } from '../../lib/media'
import Modal from '../ui/Modal'
import Button, { IconButton } from '../ui/Button'
import { SelectField, TextArea, TextField } from '../ui/Field'

const BLANK = { id: null, kind: 'hashtags', label: '', body: '' }

/**
 * Copy the team types again and again: hashtag sets, caption templates and
 * calls to action. They show up as one-click buttons in the caption editor.
 * Templates can use {event}, {date} and {location}.
 */
export default function SnippetsModal({ open, snippets, onClose, onChanged }) {
  const [form, setForm] = useState(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => { if (!open) setForm(null) }, [open])

  const save = async () => {
    if (!form.label.trim() || !form.body.trim()) return
    setSaving(true)
    const payload = { kind: form.kind, label: form.label.trim(), body: form.body.trim() }
    const query = form.id
      ? supabase.from('media_snippets').update(payload).eq('id', form.id)
      : supabase.from('media_snippets').insert({ ...payload, sort_order: snippets.length + 1 })
    const { ok } = await run(query, { success: 'Saved to the library.', failure: 'The snippet did not save.' })
    setSaving(false)
    if (!ok) return
    setForm(null)
    onChanged()
  }

  const remove = async id => {
    const { ok } = await run(supabase.from('media_snippets').delete().eq('id', id), { failure: 'The snippet was not removed.' })
    if (ok) onChanged()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title="Caption library"
      description="Hashtag sets, templates and calls to action — one click away in every caption."
      footer={form ? (
        <>
          <Button variant="ghost" onClick={() => setForm(null)}>Cancel</Button>
          <Button variant="primary" busy={saving} busyLabel="Saving…" disabled={!form.label.trim() || !form.body.trim()} onClick={save}>Save</Button>
        </>
      ) : (
        <>
          <Button variant="ghost" onClick={onClose}>Close</Button>
          <Button variant="primary" icon={Plus} onClick={() => setForm({ ...BLANK })}>New snippet</Button>
        </>
      )}
    >
      {form ? (
        <div className="flex flex-col gap-3">
          <div className="grid gap-3 sm:grid-cols-[180px_1fr]">
            <SelectField label="Kind" value={form.kind} onChange={e => setForm(f => ({ ...f, kind: e.target.value }))}>
              {SNIPPET_KINDS.map(k => <option key={k.value} value={k.value}>{k.label}</option>)}
            </SelectField>
            <TextField label="Name" value={form.label} onChange={e => setForm(f => ({ ...f, label: e.target.value }))} placeholder="Robotics" />
          </div>
          <TextArea label="Text" rows={6} value={form.body} onChange={e => setForm(f => ({ ...f, body: e.target.value }))}
            hint={form.kind === 'template' ? '{event}, {date} and {location} are filled from the post’s event.' : undefined} />
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {SNIPPET_KINDS.map(kind => {
            const list = snippets.filter(s => s.kind === kind.value)
            return (
              <div key={kind.value}>
                <h3 className="adm-eyebrow mb-2">{kind.label}</h3>
                {list.length === 0 && <p className="text-[12px]" style={{ color: 'var(--adm-silk-faint)' }}>None yet.</p>}
                <div className="flex flex-col gap-1.5">
                  {list.map(s => (
                    <div key={s.id} className="flex items-start gap-2 p-2.5 rounded-lg" style={{ background: 'var(--adm-board-sunk)' }}>
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-semibold">{s.label}</p>
                        <p className="text-[12px] whitespace-pre-wrap" style={{ color: 'var(--adm-silk-dim)' }}>{s.body}</p>
                      </div>
                      <IconButton icon={Pencil} label="Edit" onClick={() => setForm({ ...s })} />
                      <IconButton icon={Trash2} label="Delete" danger onClick={() => remove(s.id)} />
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </Modal>
  )
}
