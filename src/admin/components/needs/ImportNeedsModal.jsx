import { useMemo, useState } from 'react'
import { AlertTriangle, CheckCircle2, Download, FileSpreadsheet, Loader2, Upload } from 'lucide-react'
import { logActivity, run, supabase } from '../../lib/db'
import { downloadCSV } from '../../lib/format'
import { guessMapping, readSpreadsheet, splitHeader } from '../../lib/memberImport'
import { MAX_NEED_ROWS, NEED_FIELDS, NEED_TEMPLATE_EXAMPLES, NEED_TEMPLATE_HEADERS, buildNeedRows } from '../../lib/needsImport'
import { DEPARTMENT_COLORS, itemStatusLabel, kindLabel, sourceLabel } from '../../lib/needs'
import Modal from '../ui/Modal'
import Button from '../ui/Button'
import Badge from '../ui/Badge'
import { CheckField } from '../ui/Field'

const CHUNK = 200
const PREVIEW_LIMIT = 100

/**
 * Bring a needs list in from Excel or CSV, in the same three steps as the
 * other imports: pick a file, confirm the columns, review. Rows are added to
 * the open list; departments the sheet names that don't exist yet can be
 * created on the way.
 */
export default function ImportNeedsModal({ open, list, departments, inventory, onClose, onImported }) {
  const [step, setStep] = useState('pick') // pick → map → review → done
  const [file, setFile] = useState(null)
  const [sheet, setSheet] = useState({ headers: [], body: [] })
  const [mapping, setMapping] = useState({})
  const [fallbackDept, setFallbackDept] = useState('')
  const [createDepts, setCreateDepts] = useState(true)
  const [reading, setReading] = useState(false)
  const [readError, setReadError] = useState(null)
  const [importing, setImporting] = useState(false)
  const [result, setResult] = useState(null)

  const reset = () => {
    setStep('pick'); setFile(null); setSheet({ headers: [], body: [] }); setMapping({})
    setReadError(null); setResult(null); setCreateDepts(true)
    setFallbackDept(list?.scope === 'department' && list.department_id ? String(list.department_id) : '')
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
      const parsed = splitHeader(await readSpreadsheet(f))
      if (!parsed.body.length) throw new Error('That file has no rows under its header line.')
      setFile(f)
      setSheet(parsed)
      setMapping(guessMapping(parsed.headers, NEED_FIELDS))
      if (list?.scope === 'department' && list.department_id) setFallbackDept(String(list.department_id))
      setStep('map')
    } catch (err) {
      setReadError(err.message || 'That file could not be read.')
    } finally {
      setReading(false)
    }
  }

  const built = useMemo(
    () => (step === 'review' || step === 'done'
      ? buildNeedRows(sheet.body, mapping, { departments, inventory, fallbackDept: fallbackDept ? Number(fallbackDept) : null })
      : { rows: [], newDepartments: [] }),
    [step, sheet.body, mapping, departments, inventory, fallbackDept]
  )
  const valid = built.rows.filter(r => !r.errors.length)
  const invalid = built.rows.filter(r => r.errors.length)
  const warned = valid.filter(r => r.warnings.length).length
  const tooMany = valid.length > MAX_NEED_ROWS

  const doImport = async () => {
    setImporting(true)
    let failed = 0
    let added = 0

    // Departments the sheet names that don't exist yet.
    const created = new Map()
    if (createDepts && built.newDepartments.length) {
      const start = departments.reduce((n, d) => Math.max(n, d.sort_order || 0), 0)
      const { ok, data } = await run(
        supabase.from('departments').insert(built.newDepartments.map((name, i) => ({
          name, color: DEPARTMENT_COLORS[(departments.length + i) % DEPARTMENT_COLORS.length], sort_order: start + i + 1,
        }))).select('id, name'),
        { failure: 'The new departments were not created; their items have no department.' }
      )
      if (ok) {
        data.forEach(d => created.set(d.name, d.id))
        logActivity('created', 'departments', null, { name: 'Import', departments: data.map(d => d.name) })
      }
    }

    const payloads = valid.map(r => ({
      ...r.payload,
      list_id: list.id,
      department_id: r.newDept ? created.get(r.newDept) ?? (fallbackDept ? Number(fallbackDept) : null) : r.payload.department_id,
    }))
    for (let i = 0; i < payloads.length; i += CHUNK) {
      const batch = payloads.slice(i, i + CHUNK)
      const { ok } = await run(supabase.from('need_items').insert(batch), { failure: `Rows ${i + 1}–${i + batch.length} were not imported.` })
      if (ok) added += batch.length
      else failed += batch.length
    }

    if (added) {
      logActivity('created', 'need_items', null, { name: `Import from ${file?.name}`, list: list.title, added, skipped: invalid.length })
    }
    setResult({ added, failed, departments: created.size })
    setImporting(false)
    setStep('done')
    onImported()
  }

  const downloadTemplate = () => downloadCSV('needs-import-template.csv', NEED_TEMPLATE_HEADERS, NEED_TEMPLATE_EXAMPLES)

  const downloadProblems = () => downloadCSV(
    `needs-import-problems-${new Date().toISOString().slice(0, 10)}.csv`,
    ['Line', 'Problem', ...sheet.headers],
    invalid.map(r => [r.line, r.errors.join('; '), ...sheet.body[r.line - 1].map(c => (c instanceof Date ? c.toISOString().slice(0, 10) : c))])
  )

  const footer = {
    pick: <Button onClick={close} data-dialog-dismiss="true">Cancel</Button>,
    map: (
      <>
        <Button onClick={reset}>Choose another file</Button>
        <Button variant="primary" disabled={mapping.name === undefined} onClick={() => setStep('review')}>Review rows</Button>
      </>
    ),
    review: (
      <>
        <Button onClick={() => setStep('map')} disabled={importing}>Back</Button>
        <Button variant="primary" icon={Upload} busy={importing} busyLabel="Importing…" disabled={!valid.length || tooMany} onClick={doImport}>
          Add {valid.length} item{valid.length === 1 ? '' : 's'}
        </Button>
      </>
    ),
    done: <Button variant="primary" onClick={close}>Done</Button>,
  }[step]

  return (
    <Modal
      open={open}
      onClose={close}
      size="xl"
      title="Import needs"
      description={{
        pick: `Add items to ${list?.title || 'this list'} from Excel (.xlsx) or CSV. Nothing is saved until you confirm.`,
        map: `${file?.name} · ${sheet.body.length} row${sheet.body.length === 1 ? '' : 's'}. Check which column holds what.`,
        review: 'Here is what will be added to the list.',
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
              .xlsx or .csv · first sheet · one item per row, headers on the first line
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
          <div className="rounded-xl p-3 flex flex-wrap items-center justify-between gap-3" style={{ background: 'var(--adm-panel-raise)' }}>
            <span className="text-xs max-w-md" style={{ color: 'var(--adm-silk-faint)' }}>
              Only the item name is required. Headers and values in English, French or Arabic are recognised,
              e.g. “Consommable”, “À acheter”, “جاهز”.
            </span>
            <Button size="sm" variant="primary" icon={Download} onClick={downloadTemplate}>CSV template</Button>
          </div>
        </div>
      )}

      {step === 'map' && (
        <div className="space-y-4">
          {mapping.name === undefined && (
            <p className="flex items-center gap-1.5 text-sm" style={{ color: 'var(--adm-fault)' }}>
              <AlertTriangle size={14} /> Choose the column that holds the item name to continue.
            </p>
          )}
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {NEED_FIELDS.map(field => (
              <label key={field.key} className="block">
                <span className="adm-label">
                  {field.label}
                  {field.key === 'name' && <span style={{ color: 'var(--adm-fault)' }} aria-hidden="true"> *</span>}
                </span>
                <select className="adm-input" value={mapping[field.key] ?? ''}
                  onChange={e => setMapping(m => {
                    const next = { ...m }
                    if (e.target.value === '') delete next[field.key]
                    else next[field.key] = Number(e.target.value)
                    return next
                  })}>
                  <option value="">— not in file —</option>
                  {sheet.headers.map((h, i) => <option key={i} value={i}>{h}{sampleOf(sheet.body, i)}</option>)}
                </select>
              </label>
            ))}
          </div>
          <label className="block" style={{ maxWidth: 320 }}>
            <span className="adm-label">Department for rows without one</span>
            <select className="adm-input" value={fallbackDept} onChange={e => setFallbackDept(e.target.value)}>
              <option value="">None</option>
              {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </label>
          <p className="text-xs" style={{ color: 'var(--adm-silk-faint)' }}>
            No quantity means 1. Missing type, source, status or priority fall back to Equipment, Buy, Needed and Must have;
            an item already in inventory with enough on the shelf is marked “From stock”.
          </p>
        </div>
      )}

      {(step === 'review' || step === 'done') && (
        <div className="space-y-4">
          {step === 'done' && result ? (
            <div className="rounded-xl p-4 flex items-start gap-3" style={{ background: 'var(--adm-board-sunk)' }}>
              <CheckCircle2 size={20} style={{ color: 'var(--adm-ok)', flexShrink: 0 }} />
              <div className="text-sm space-y-0.5">
                <p><strong>{result.added}</strong> item{result.added === 1 ? '' : 's'} added to the list.</p>
                {result.departments > 0 && <p>{result.departments} new department{result.departments === 1 ? '' : 's'} created.</p>}
                {invalid.length > 0 && <p>{invalid.length} rows skipped because of problems.</p>}
                {result.failed > 0 && <p style={{ color: 'var(--adm-fault)' }}>{result.failed} items failed to save.</p>}
              </div>
            </div>
          ) : (
            <>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap gap-2">
                  <Badge tone="ok">{valid.length} to add</Badge>
                  {valid.filter(r => r.linked).length > 0 && <Badge tone="signal">{valid.filter(r => r.linked).length} found in inventory</Badge>}
                  {invalid.length > 0 && <Badge tone="fault">{invalid.length} with problems</Badge>}
                  {warned > 0 && <Badge tone="wait">{warned} with warnings</Badge>}
                </div>
                {invalid.length > 0 && <Button size="sm" variant="ghost" icon={Download} onClick={downloadProblems}>Download problem rows</Button>}
              </div>
              {built.newDepartments.length > 0 && (
                <div className="rounded-xl p-3" style={{ background: 'var(--adm-panel-raise)' }}>
                  <CheckField
                    label={`Create ${built.newDepartments.length} new department${built.newDepartments.length === 1 ? '' : 's'}: ${built.newDepartments.join(', ')}`}
                    description="Untick to put those rows under the fallback department instead."
                    checked={createDepts}
                    onChange={setCreateDepts}
                  />
                </div>
              )}
              {tooMany && (
                <p className="flex items-center gap-1.5 text-sm" style={{ color: 'var(--adm-fault)' }}>
                  <AlertTriangle size={14} /> That is {valid.length} rows; one import can take at most {MAX_NEED_ROWS}. Split the file.
                </p>
              )}
            </>
          )}

          <div className="adm-scroll overflow-auto rounded-xl" style={{ maxHeight: 360, border: '1px solid var(--adm-trace)' }}>
            <table className="adm-table">
              <thead>
                <tr><th>Line</th><th>Item</th><th>Qty</th><th>Department</th><th>Type</th><th>Source</th><th>Status</th><th>Result</th></tr>
              </thead>
              <tbody>
                {built.rows.slice(0, PREVIEW_LIMIT).map(r => (
                  <tr key={r.line}>
                    <td className="adm-data text-[12px]">{r.line}</td>
                    <td className="text-sm"><span className="adm-truncate block" style={{ maxWidth: 220 }}>{r.payload.name || '—'}</span></td>
                    <td className="adm-data text-[12px]">{r.payload.quantity}{r.payload.unit ? ` ${r.payload.unit}` : ''}</td>
                    <td className="text-[13px]">
                      {r.deptName || departments.find(d => d.id === r.payload.department_id)?.name || '—'}
                      {r.newDept && <span className="block text-[11px]" style={{ color: 'var(--adm-signal)' }}>new</span>}
                    </td>
                    <td className="text-[13px]">{kindLabel(r.payload.kind)}</td>
                    <td className="text-[13px]">{sourceLabel(r.payload.source)}</td>
                    <td className="text-[13px]">{itemStatusLabel(r.payload.status)}</td>
                    <td className="text-[12px]">
                      {r.errors.length
                        ? <span style={{ color: 'var(--adm-fault)' }}>Skipped: {r.errors.join(', ')}</span>
                        : <span style={{ color: 'var(--adm-ok)' }}>Add{r.linked ? ' · in inventory' : ''}</span>}
                      {r.warnings.length > 0 && <span className="block text-[11px]" style={{ color: 'var(--adm-wait)' }}>{r.warnings.join(', ')}</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {built.rows.length > PREVIEW_LIMIT && (
            <p className="text-xs" style={{ color: 'var(--adm-silk-faint)' }}>
              Showing the first {PREVIEW_LIMIT} of {built.rows.length} rows. All of them are imported.
            </p>
          )}
        </div>
      )}
    </Modal>
  )
}

/** " — e.g. Projector" so a column can be recognised by its content, not just its header. */
function sampleOf(body, index) {
  const value = body.find(r => r[index] !== null && r[index] !== undefined && String(r[index]).trim())?.[index]
  if (value === undefined) return ''
  const s = value instanceof Date ? value.toISOString().slice(0, 10) : String(value)
  return ` — e.g. ${s.length > 24 ? `${s.slice(0, 24)}…` : s}`
}
