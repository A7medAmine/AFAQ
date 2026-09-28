import { useState } from 'react'
import { CalendarClock, CheckCircle2, Link2, Upload } from 'lucide-react'
import { api } from '../../lib/db'
import useAdminStore from '../../store/adminStore'
import Modal from '../ui/Modal'
import Button from '../ui/Button'
import { CheckField, TextField } from '../ui/Field'

const PREVIEW_LIMIT = 100

/**
 * Bring events in from any .ics calendar — a Google Calendar "secret address",
 * or a file exported from Google/Outlook/Apple. Nothing is saved until the
 * admin picks which rows to keep; every import lands as an unpublished draft.
 */
export default function ImportEventsModal({ open, onClose, onImported }) {
  const token = useAdminStore(s => s.session?.access_token)
  const [step, setStep] = useState('pick') // pick → review → done
  const [source, setSource] = useState('url') // url | file
  const [icsUrl, setIcsUrl] = useState('')
  const [file, setFile] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [rows, setRows] = useState([])
  const [result, setResult] = useState(null)

  const reset = () => {
    setStep('pick'); setSource('url'); setIcsUrl(''); setFile(null)
    setError(''); setRows([]); setResult(null)
  }

  const close = () => {
    if (loading) return
    reset()
    onClose()
  }

  const preview = async () => {
    setLoading(true)
    setError('')
    try {
      let res
      if (source === 'file') {
        if (!file) { setError('Choose a .ics file.'); setLoading(false); return }
        const fd = new FormData()
        fd.append('file', file)
        const headers = {}
        if (token) headers.Authorization = `Bearer ${token}`
        const raw = await fetch('/api/events/import/preview', { method: 'POST', headers, body: fd })
        const payload = await raw.json().catch(() => ({}))
        res = { ok: raw.ok, data: payload, message: payload?.error }
      } else {
        if (!icsUrl.trim()) { setError('Paste a calendar URL.'); setLoading(false); return }
        res = await api('/api/events/import/preview', { method: 'POST', body: { icsUrl: icsUrl.trim() } })
      }

      if (!res.ok) { setError(res.message || 'That calendar could not be read.'); setLoading(false); return }
      setRows(res.data.events.map(e => ({ ...e, selected: true })))
      setStep('review')
    } catch {
      setError('That calendar could not be read.')
    } finally {
      setLoading(false)
    }
  }

  const toggle = i => setRows(r => r.map((row, idx) => (idx === i ? { ...row, selected: !row.selected } : row)))
  const toggleAll = v => setRows(r => r.map(row => ({ ...row, selected: v })))
  const selectedCount = rows.filter(r => r.selected).length

  const doImport = async () => {
    setLoading(true)
    const events = rows.filter(r => r.selected).map(({ title, description, location, date, time }) => ({
      title, description, location, date, time,
    }))
    const res = await api('/api/events/import/confirm', { method: 'POST', body: { events } })
    setLoading(false)
    if (!res.ok) { setError(res.message || 'The import did not complete.'); return }
    setResult(res.data)
    setStep('done')
    onImported()
  }

  const footer = {
    pick: (
      <>
        <Button onClick={close} data-dialog-dismiss="true">Cancel</Button>
        <Button variant="primary" busy={loading} busyLabel="Reading…" onClick={preview}>Preview</Button>
      </>
    ),
    review: (
      <>
        <Button onClick={() => setStep('pick')} disabled={loading}>Back</Button>
        <Button variant="primary" icon={Upload} busy={loading} busyLabel="Importing…"
          disabled={!selectedCount} onClick={doImport}>
          Import {selectedCount} event{selectedCount === 1 ? '' : 's'} as drafts
        </Button>
      </>
    ),
    done: <Button variant="primary" onClick={close}>Done</Button>,
  }[step]

  return (
    <Modal
      open={open}
      onClose={close}
      size="lg"
      title="Import events"
      description={{
        pick: 'From a Google Calendar secret iCal address, or a .ics file exported from Google, Outlook or Apple Calendar.',
        review: `${rows.length} event${rows.length === 1 ? '' : 's'} found. Pick which ones to bring in — each lands as an unpublished draft you can edit before publishing.`,
        done: 'Import finished.',
      }[step]}
      footer={footer}
    >
      {step === 'pick' && (
        <div className="space-y-4">
          <div className="flex gap-2">
            <Button size="sm" variant={source === 'url' ? 'primary' : 'ghost'} icon={Link2} onClick={() => setSource('url')}>
              Calendar URL
            </Button>
            <Button size="sm" variant={source === 'file' ? 'primary' : 'ghost'} icon={Upload} onClick={() => setSource('file')}>
              Upload .ics file
            </Button>
          </div>

          {source === 'url' ? (
            <TextField
              label="iCal address"
              hint="In Google Calendar: Settings → your calendar → Integrate calendar → Secret address in iCal format."
              placeholder="https://calendar.google.com/calendar/ical/…/basic.ics"
              value={icsUrl}
              onChange={e => setIcsUrl(e.target.value)}
            />
          ) : (
            <label className="flex flex-col items-center justify-center gap-2 rounded-xl py-10 px-4 text-center"
              style={{ border: '1.5px dashed var(--adm-trace)', background: 'var(--adm-board-sunk)', cursor: 'pointer' }}>
              <CalendarClock size={26} style={{ color: 'var(--adm-signal)' }} />
              <span className="text-sm font-semibold">{file ? file.name : 'Choose a .ics file'}</span>
              <span className="text-xs" style={{ color: 'var(--adm-silk-faint)' }}>Exported from Google, Outlook or Apple Calendar</span>
              <input type="file" accept=".ics" className="sr-only" onChange={e => setFile(e.target.files?.[0] || null)} />
            </label>
          )}

          {error && <p className="text-sm" style={{ color: 'var(--adm-fault)' }}>{error}</p>}
        </div>
      )}

      {(step === 'review' || step === 'done') && (
        <div className="space-y-4">
          {step === 'done' && result ? (
            <div className="rounded-xl p-4 flex items-start gap-3" style={{ background: 'var(--adm-board-sunk)' }}>
              <CheckCircle2 size={20} style={{ color: 'var(--adm-ok)', flexShrink: 0 }} />
              <p className="text-sm"><strong>{result.created}</strong> event{result.created === 1 ? '' : 's'} imported as unpublished drafts. Open each one to fill in translations, a poster and registration settings before publishing.</p>
            </div>
          ) : (
            <>
              <CheckField
                label="Select all"
                checked={selectedCount === rows.length}
                onChange={toggleAll}
              />
              {error && <p className="text-sm" style={{ color: 'var(--adm-fault)' }}>{error}</p>}
            </>
          )}

          {step === 'review' && (
            <div className="adm-scroll overflow-auto rounded-xl" style={{ maxHeight: 360, border: '1px solid var(--adm-trace)' }}>
              <table className="adm-table">
                <thead>
                  <tr><th></th><th>Title</th><th>Date</th><th>Location</th></tr>
                </thead>
                <tbody>
                  {rows.slice(0, PREVIEW_LIMIT).map((r, i) => (
                    <tr key={i}>
                      <td><input type="checkbox" className="adm-check" checked={r.selected} onChange={() => toggle(i)} /></td>
                      <td className="text-sm">{r.title}</td>
                      <td className="adm-data text-[12px]">{r.date}{r.time ? ` · ${r.time}` : ''}</td>
                      <td className="text-[13px]">{r.location || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {rows.length > PREVIEW_LIMIT && (
            <p className="text-xs" style={{ color: 'var(--adm-silk-faint)' }}>
              Showing the first {PREVIEW_LIMIT} of {rows.length}. Only the selected ones import.
            </p>
          )}
        </div>
      )}
    </Modal>
  )
}
