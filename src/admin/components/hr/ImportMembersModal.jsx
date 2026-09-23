import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AlertTriangle, CheckCircle2, Download, FileSpreadsheet, Loader2, Printer, Upload } from 'lucide-react'
import { logActivity, run, supabase } from '../../lib/db'
import { downloadCSV } from '../../lib/format'
import {
  IMPORT_FIELDS, TEMPLATE_HEADERS, buildImportRows, guessMapping, readSpreadsheet, splitHeader, updatePatch,
} from '../../lib/memberImport'
import Modal from '../ui/Modal'
import Button from '../ui/Button'
import Badge from '../ui/Badge'
import { CheckField } from '../ui/Field'

const CHUNK = 200
const PREVIEW_LIMIT = 100

/**
 * Bring an existing roster into the console from Excel or CSV. Three steps:
 * pick a file, confirm which column is which, review what will happen to each
 * row. Nothing is written until the last step, and new members get their
 * number and card from the database the same way a hand-added member does.
 *
 * @param existing  the current roster, to match people already on it
 */
export default function ImportMembersModal({ open, existing = [], onClose, onImported }) {
  const navigate = useNavigate()
  const [step, setStep] = useState('pick') // pick → map → review → done
  const [file, setFile] = useState(null)
  const [sheet, setSheet] = useState({ headers: [], body: [] })
  const [mapping, setMapping] = useState({})
  const [updateExisting, setUpdateExisting] = useState(false)
  const [reading, setReading] = useState(false)
  const [readError, setReadError] = useState(null)
  const [importing, setImporting] = useState(false)
  const [result, setResult] = useState(null)

  const reset = () => {
    setStep('pick'); setFile(null); setSheet({ headers: [], body: [] }); setMapping({})
    setUpdateExisting(false); setReadError(null); setResult(null); setFrozenRows(null)
  }

  const close = () => {
    if (importing) return
    reset()
    onClose()
  }

  const pick = async e => {
    const f = e.target.files?.[0]
    e.target.value = ''
    if (!f) return
    setReading(true)
    setReadError(null)
    try {
      const rows = await readSpreadsheet(f)
      const parsed = splitHeader(rows)
      if (!parsed.body.length) throw new Error('That file has no rows under its header line.')
      setFile(f)
      setSheet(parsed)
      setMapping(guessMapping(parsed.headers))
      setStep('map')
    } catch (err) {
      setReadError(err.message || 'That file could not be read.')
    } finally {
      setReading(false)
    }
  }

  // Frozen once the import runs: the roster reloads afterwards, and the new
  // members would otherwise show up as "already a member" in the summary.
  const [frozenRows, setFrozenRows] = useState(null)
  const liveRows = useMemo(
    () => (step === 'review' ? buildImportRows(sheet.body, mapping, existing) : []),
    [step, sheet.body, mapping, existing]
  )
  const rows = frozenRows || liveRows

  const plan = useMemo(() => {
    const invalid = rows.filter(r => r.errors.length)
    const valid = rows.filter(r => !r.errors.length)
    const toInsert = valid.filter(r => !r.match)
    const matched = valid.filter(r => r.match)
    return {
      invalid,
      toInsert,
      toUpdate: updateExisting ? matched : [],
      skipped: updateExisting ? [] : matched,
      warnings: valid.filter(r => r.warnings.length).length,
    }
  }, [rows, updateExisting])

  const hasName = mapping.full_name !== undefined || mapping.first_name !== undefined || mapping.last_name !== undefined
  const canContinue = hasName && mapping.email !== undefined

  const doImport = async () => {
    setImporting(true)
    setFrozenRows(rows)
    const created = []
    let updated = 0
    let failed = 0

    for (let i = 0; i < plan.toInsert.length; i += CHUNK) {
      const batch = plan.toInsert.slice(i, i + CHUNK).map(r => ({ ...r.payload, status: r.payload.status || 'active' }))
      const { ok, data } = await run(
        supabase.from('members').insert(batch).select('id, full_name'),
        { failure: `Rows ${i + 1}–${i + batch.length} were not imported.` }
      )
      if (ok) created.push(...(data || []))
      else failed += batch.length
    }

    for (const r of plan.toUpdate) {
      const patch = updatePatch(r.payload, mapping)
      if (!Object.keys(patch).length) continue
      const { ok } = await run(
        supabase.from('members').update({ ...patch, updated_at: new Date().toISOString() }).eq('id', r.match.id)
      )
      if (ok) updated += 1
      else failed += 1
    }

    if (created.length || updated) {
      logActivity('created', 'members', null, {
        name: `Import from ${file?.name}`, created: created.length, updated, skipped: plan.skipped.length + plan.invalid.length,
      })
    }
    setResult({ created, updated, failed })
    setImporting(false)
    setStep('done')
    onImported()
  }

  const downloadTemplate = () => downloadCSV('members-import-template.csv', TEMPLATE_HEADERS, [[
    'Ahmed Mansouri', 'ahmed@univ-bouira.dz', '0555123456', '202212345678', 'Computer Science', 'L2', 'Robotics',
    'active', '15/10/2025', '03/04/2004', 'male', 'Arduino, Python', 'Robotics, AI', '',
  ]])

  const downloadProblems = () => downloadCSV(
    `import-problems-${new Date().toISOString().slice(0, 10)}.csv`,
    ['Line', 'Problem', ...sheet.headers],
    plan.invalid.map(r => [r.line, r.errors.join('; '), ...sheet.body[r.line - 1].map(c => (c instanceof Date ? c.toISOString().slice(0, 10) : c))])
  )

  const footer = {
    pick: <Button onClick={close} data-dialog-dismiss="true">Cancel</Button>,
    map: (
      <>
        <Button onClick={reset}>Choose another file</Button>
        <Button variant="primary" disabled={!canContinue} onClick={() => setStep('review')}>Review rows</Button>
      </>
    ),
    review: (
      <>
        <Button onClick={() => setStep('map')} disabled={importing}>Back</Button>
        <Button variant="primary" icon={Upload} busy={importing} busyLabel="Importing…"
          disabled={!plan.toInsert.length && !plan.toUpdate.length} onClick={doImport}>
          Import {plan.toInsert.length + plan.toUpdate.length} member{plan.toInsert.length + plan.toUpdate.length === 1 ? '' : 's'}
        </Button>
      </>
    ),
    done: (
      <>
        {result?.created.length > 0 && (
          <Button icon={Printer} onClick={() => { const ids = result.created.map(m => m.id).join(','); close(); navigate(`/admin/members/cards?ids=${ids}`) }}>
            Print their cards
          </Button>
        )}
        <Button variant="primary" onClick={close}>Done</Button>
      </>
    ),
  }[step]

  return (
    <Modal
      open={open}
      onClose={close}
      size="xl"
      title="Import members"
      description={{
        pick: 'Bring in a roster from Excel (.xlsx) or CSV. Nothing is saved until you confirm.',
        map: `${file?.name} · ${sheet.body.length} row${sheet.body.length === 1 ? '' : 's'}. Check which column holds what.`,
        review: 'Here is what will happen to each row.',
        done: 'Import finished.',
      }[step]}
      footer={footer}
    >
      {step === 'pick' && (
        <div className="space-y-4">
          <label className="flex flex-col items-center justify-center gap-2 rounded-xl py-10 px-4 text-center"
            style={{ border: '1.5px dashed var(--adm-trace)', background: 'var(--adm-board-sunk)', cursor: reading ? 'default' : 'pointer' }}>
            {reading
              ? <Loader2 size={26} className="adm-spin" style={{ color: 'var(--adm-silk-faint)' }} />
              : <FileSpreadsheet size={26} style={{ color: 'var(--adm-signal)' }} />}
            <span className="text-sm font-semibold">{reading ? 'Reading the file…' : 'Choose a spreadsheet'}</span>
            <span className="text-xs" style={{ color: 'var(--adm-silk-faint)' }}>
              .xlsx or .csv · first sheet · one member per row, headers on the first line
            </span>
            <input type="file" className="sr-only" disabled={reading}
              accept=".xlsx,.csv,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              onChange={pick} />
          </label>
          {readError && (
            <p className="flex items-center gap-1.5 text-sm" style={{ color: 'var(--adm-fault)' }}>
              <AlertTriangle size={14} /> {readError}
            </p>
          )}
          <div className="flex items-center justify-between gap-3 text-xs" style={{ color: 'var(--adm-silk-faint)' }}>
            <span>Headers in English, French or Arabic are recognised. Only name and email are required.</span>
            <Button size="sm" variant="ghost" icon={Download} onClick={downloadTemplate}>Template</Button>
          </div>
        </div>
      )}

      {step === 'map' && (
        <div className="space-y-4">
          {!canContinue && (
            <p className="flex items-center gap-1.5 text-sm" style={{ color: 'var(--adm-fault)' }}>
              <AlertTriangle size={14} /> Choose the columns for the name and the email to continue.
            </p>
          )}
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {IMPORT_FIELDS.map(field => (
              <label key={field.key} className="block">
                <span className="adm-label">
                  {field.label}
                  {(field.key === 'email' || (field.key === 'full_name' && !hasName)) && (
                    <span style={{ color: 'var(--adm-fault)' }} aria-hidden="true"> *</span>
                  )}
                </span>
                <select className="adm-input" value={mapping[field.key] ?? ''}
                  onChange={e => setMapping(m => {
                    const next = { ...m }
                    if (e.target.value === '') delete next[field.key]
                    else next[field.key] = Number(e.target.value)
                    return next
                  })}>
                  <option value="">— not in file —</option>
                  {sheet.headers.map((h, i) => (
                    <option key={i} value={i}>{h}{sampleOf(sheet.body, i)}</option>
                  ))}
                </select>
              </label>
            ))}
          </div>
          <p className="text-xs" style={{ color: 'var(--adm-silk-faint)' }}>
            Use either “Full name” or “First name” + “Last name”. Member numbers are assigned automatically.
          </p>
        </div>
      )}

      {(step === 'review' || step === 'done') && (
        <div className="space-y-4">
          {step === 'done' && result ? (
            <div className="rounded-xl p-4 flex items-start gap-3" style={{ background: 'var(--adm-board-sunk)' }}>
              <CheckCircle2 size={20} style={{ color: 'var(--adm-ok)', flexShrink: 0 }} />
              <div className="text-sm space-y-0.5">
                <p><strong>{result.created.length}</strong> added, each with a member number and card.</p>
                {result.updated > 0 && <p><strong>{result.updated}</strong> existing members updated.</p>}
                {plan.skipped.length > 0 && <p>{plan.skipped.length} already on the roster, left unchanged.</p>}
                {plan.invalid.length > 0 && <p>{plan.invalid.length} rows skipped because of problems.</p>}
                {result.failed > 0 && <p style={{ color: 'var(--adm-fault)' }}>{result.failed} rows failed to save.</p>}
              </div>
            </div>
          ) : (
            <>
              <div className="flex flex-wrap gap-2">
                <Badge tone="ok">{plan.toInsert.length} new</Badge>
                {plan.toUpdate.length > 0 && <Badge tone="signal">{plan.toUpdate.length} to update</Badge>}
                {plan.skipped.length > 0 && <Badge>{plan.skipped.length} already members</Badge>}
                {plan.invalid.length > 0 && <Badge tone="fault">{plan.invalid.length} with problems</Badge>}
                {plan.warnings > 0 && <Badge tone="wait">{plan.warnings} with warnings</Badge>}
              </div>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <CheckField
                  label="Update members who are already on the roster"
                  description="Matched by email or student ID. Only filled cells overwrite; empty cells keep what is there."
                  checked={updateExisting}
                  onChange={setUpdateExisting}
                />
                {plan.invalid.length > 0 && (
                  <Button size="sm" variant="ghost" icon={Download} onClick={downloadProblems}>Download problem rows</Button>
                )}
              </div>
            </>
          )}

          <div className="adm-scroll overflow-auto rounded-xl" style={{ maxHeight: 360, border: '1px solid var(--adm-trace)' }}>
            <table className="adm-table">
              <thead>
                <tr><th>Line</th><th>Name</th><th>Email</th><th>Student ID</th><th>Team</th><th>Result</th></tr>
              </thead>
              <tbody>
                {rows.slice(0, PREVIEW_LIMIT).map(r => (
                  <tr key={r.line}>
                    <td className="adm-data text-[12px]">{r.line}</td>
                    <td className="text-sm">{r.payload.full_name || '—'}</td>
                    <td className="adm-data text-[12px]">{r.payload.email || '—'}</td>
                    <td className="adm-data text-[12px]">{r.payload.student_id || '—'}</td>
                    <td className="text-[13px]">{r.payload.team || '—'}</td>
                    <td className="text-[12px]">
                      <RowOutcome row={r} updateExisting={updateExisting} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {rows.length > PREVIEW_LIMIT && (
            <p className="text-xs" style={{ color: 'var(--adm-silk-faint)' }}>
              Showing the first {PREVIEW_LIMIT} of {rows.length} rows. All of them are imported.
            </p>
          )}
        </div>
      )}
    </Modal>
  )
}

function RowOutcome({ row, updateExisting }) {
  if (row.errors.length) return <span style={{ color: 'var(--adm-fault)' }}>Skipped: {row.errors.join(', ')}</span>
  const main = row.match
    ? (updateExisting
      ? <span style={{ color: 'var(--adm-signal)' }}>Update {row.match.member_code || row.match.full_name}</span>
      : <span style={{ color: 'var(--adm-silk-faint)' }}>Already a member ({row.match.member_code || row.match.full_name})</span>)
    : <span style={{ color: 'var(--adm-ok)' }}>New member</span>
  return (
    <span className="block">
      {main}
      {row.warnings.length > 0 && (
        <span className="block text-[11px]" style={{ color: 'var(--adm-wait)' }}>{row.warnings.join(', ')}</span>
      )}
    </span>
  )
}

/** " — e.g. Ahmed" so a column can be recognised by its content, not just its header. */
function sampleOf(body, index) {
  const value = body.find(r => r[index] !== null && r[index] !== undefined && String(r[index]).trim())?.[index]
  if (value === undefined) return ''
  const s = value instanceof Date ? value.toISOString().slice(0, 10) : String(value)
  return ` — e.g. ${s.length > 24 ? `${s.slice(0, 24)}…` : s}`
}
