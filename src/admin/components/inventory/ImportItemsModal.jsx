import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import QRCode from 'qrcode'
import { AlertTriangle, CheckCircle2, Download, FileSpreadsheet, Loader2, Printer, Upload } from 'lucide-react'
import { logActivity, run, supabase } from '../../lib/db'
import { downloadCSV } from '../../lib/format'
import { guessMapping, readSpreadsheet, splitHeader } from '../../lib/memberImport'
import {
  ITEM_FIELDS, MAX_UNITS, TEMPLATE_EXAMPLES, TEMPLATE_HEADERS, buildItemRows, expandUnits,
} from '../../lib/inventoryImport'
import { loadCatalog } from '../../lib/partsCatalog'
import Modal from '../ui/Modal'
import Button from '../ui/Button'
import Badge from '../ui/Badge'

const CHUNK = 200
const LABEL_CONCURRENCY = 8
const PREVIEW_LIMIT = 100

/**
 * Bring a parts list into the inventory from Excel or CSV, in the same three
 * steps as the member import: pick a file, confirm the columns, review. Every
 * unit is inserted as its own row and then gets its asset code and QR label,
 * exactly as an item added by hand does.
 *
 * @param existing  current inventory, so the review can say what is already in stock
 */
export default function ImportItemsModal({ open, existing = [], onClose, onImported }) {
  const navigate = useNavigate()
  const [step, setStep] = useState('pick') // pick → map → review → done
  const [file, setFile] = useState(null)
  const [sheet, setSheet] = useState({ headers: [], body: [] })
  const [mapping, setMapping] = useState({})
  const [catalog, setCatalog] = useState([])
  const [reading, setReading] = useState(false)
  const [readError, setReadError] = useState(null)
  const [templateBusy, setTemplateBusy] = useState(false)
  const [importing, setImporting] = useState(false)
  const [progress, setProgress] = useState(null)
  const [result, setResult] = useState(null)
  // Frozen once the import runs, so the reloaded inventory doesn't change the summary.
  const [frozenRows, setFrozenRows] = useState(null)

  const reset = () => {
    setStep('pick'); setFile(null); setSheet({ headers: [], body: [] }); setMapping({})
    setReadError(null); setResult(null); setFrozenRows(null); setProgress(null)
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
      const [rows, parts] = await Promise.all([readSpreadsheet(f), loadCatalog().catch(() => [])])
      const parsed = splitHeader(rows)
      if (!parsed.body.length) throw new Error('That file has no rows under its header line.')
      setCatalog(parts)
      setFile(f)
      setSheet(parsed)
      setMapping(guessMapping(parsed.headers, ITEM_FIELDS))
      setStep('map')
    } catch (err) {
      setReadError(err.message || 'That file could not be read.')
    } finally {
      setReading(false)
    }
  }

  const liveRows = useMemo(
    () => (step === 'review' ? buildItemRows(sheet.body, mapping, existing, catalog) : []),
    [step, sheet.body, mapping, existing, catalog]
  )
  const rows = frozenRows || liveRows

  const plan = useMemo(() => {
    const valid = rows.filter(r => !r.errors.length)
    return {
      valid,
      invalid: rows.filter(r => r.errors.length),
      units: valid.reduce((n, r) => n + r.quantity, 0),
      warnings: valid.filter(r => r.warnings.length).length,
      matched: valid.filter(r => r.part).length,
    }
  }, [rows])

  const tooMany = plan.units > MAX_UNITS
  const canContinue = mapping.name !== undefined

  /** Same as a hand-added item: the asset code comes from the row's own id. */
  const label = async item => {
    const assetCode = `INV-${String(item.id).padStart(5, '0')}`
    const qrCode = await QRCode.toDataURL(assetCode, { width: 300, margin: 2 })
    const { ok } = await run(supabase.from('inventory_items').update({ asset_code: assetCode, qr_code: qrCode }).eq('id', item.id))
    return ok
  }

  const doImport = async () => {
    setImporting(true)
    setFrozenRows(rows)
    const units = expandUnits(plan.valid)
    const created = []
    let failed = 0

    for (let i = 0; i < units.length; i += CHUNK) {
      const batch = units.slice(i, i + CHUNK)
      setProgress({ phase: 'Adding items', done: i, total: units.length })
      const { ok, data } = await run(
        supabase.from('inventory_items').insert(batch).select('id'),
        { failure: `Units ${i + 1}–${i + batch.length} were not imported.` }
      )
      if (ok) created.push(...(data || []))
      else failed += batch.length
    }

    let labelled = 0
    let next = 0
    setProgress({ phase: 'Making QR labels', done: 0, total: created.length })
    await Promise.all(Array.from({ length: LABEL_CONCURRENCY }, async () => {
      while (next < created.length) {
        const item = created[next++]
        if (await label(item)) labelled++
        setProgress(p => ({ ...p, done: p.done + 1 }))
      }
    }))

    if (created.length) {
      logActivity('created', 'inventory_items', null, {
        name: `Import from ${file?.name}`, created: created.length, rows: plan.valid.length, skipped: plan.invalid.length,
      })
    }
    setResult({ created, labelled, failed })
    setImporting(false)
    setProgress(null)
    setStep('done')
    onImported()
  }

  const downloadExcelTemplate = async () => {
    setTemplateBusy(true)
    try {
      const { downloadInventoryTemplate } = await import('../../lib/inventoryTemplate')
      await downloadInventoryTemplate()
    } finally {
      setTemplateBusy(false)
    }
  }

  const downloadCsvTemplate = () => downloadCSV('inventory-import-template.csv', TEMPLATE_HEADERS, TEMPLATE_EXAMPLES)

  const downloadProblems = () => downloadCSV(
    `inventory-import-problems-${new Date().toISOString().slice(0, 10)}.csv`,
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
        <Button variant="primary" icon={Upload} busy={importing}
          busyLabel={progress ? `${progress.phase} ${progress.done}/${progress.total}…` : 'Importing…'}
          disabled={!plan.units || tooMany} onClick={doImport}>
          Import {plan.units} unit{plan.units === 1 ? '' : 's'}
        </Button>
      </>
    ),
    done: (
      <>
        {result?.created.length > 0 && (
          <Button icon={Printer} onClick={() => {
            const ids = result.created.map(i => i.id).join(',')
            close()
            navigate(`/admin/inventory/labels?ids=${ids}`)
          }}>
            Print their labels
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
      title="Import items"
      description={{
        pick: 'Add a whole parts list from Excel (.xlsx) or CSV. Nothing is saved until you confirm.',
        map: `${file?.name} · ${sheet.body.length} row${sheet.body.length === 1 ? '' : 's'}. Check which column holds what.`,
        review: 'Here is what will be added.',
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
              .xlsx or .csv · first sheet · one part per row with a quantity, headers on the first line
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
              Start from the template: it has dropdowns for category and condition and a sheet explaining each column.
              Headers in English, French or Arabic are recognised. Only the name is required.
            </span>
            <span className="flex gap-2">
              <Button size="sm" variant="primary" icon={Download} busy={templateBusy} busyLabel="Preparing…" onClick={downloadExcelTemplate}>
                Excel template
              </Button>
              <Button size="sm" variant="ghost" icon={Download} onClick={downloadCsvTemplate}>CSV</Button>
            </span>
          </div>
        </div>
      )}

      {step === 'map' && (
        <div className="space-y-4">
          {!canContinue && (
            <p className="flex items-center gap-1.5 text-sm" style={{ color: 'var(--adm-fault)' }}>
              <AlertTriangle size={14} /> Choose the column that holds the item name to continue.
            </p>
          )}
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {ITEM_FIELDS.map(field => (
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
                  {sheet.headers.map((h, i) => (
                    <option key={i} value={i}>{h}{sampleOf(sheet.body, i)}</option>
                  ))}
                </select>
              </label>
            ))}
          </div>
          <p className="text-xs" style={{ color: 'var(--adm-silk-faint)' }}>
            No quantity column means one unit per row. Asset codes and QR labels are assigned automatically.
          </p>
        </div>
      )}

      {(step === 'review' || step === 'done') && (
        <div className="space-y-4">
          {step === 'done' && result ? (
            <div className="rounded-xl p-4 flex items-start gap-3" style={{ background: 'var(--adm-board-sunk)' }}>
              <CheckCircle2 size={20} style={{ color: 'var(--adm-ok)', flexShrink: 0 }} />
              <div className="text-sm space-y-0.5">
                <p><strong>{result.created.length}</strong> units added.</p>
                {result.labelled < result.created.length && (
                  <p style={{ color: 'var(--adm-fault)' }}>
                    {result.created.length - result.labelled} did not get a QR label. Open them and save again to retry.
                  </p>
                )}
                {plan.invalid.length > 0 && <p>{plan.invalid.length} rows skipped because of problems.</p>}
                {result.failed > 0 && <p style={{ color: 'var(--adm-fault)' }}>{result.failed} units failed to save.</p>}
              </div>
            </div>
          ) : (
            <>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap gap-2">
                  <Badge tone="ok">{plan.units} units from {plan.valid.length} rows</Badge>
                  {plan.matched > 0 && <Badge tone="signal">{plan.matched} matched to the parts catalog</Badge>}
                  {plan.invalid.length > 0 && <Badge tone="fault">{plan.invalid.length} with problems</Badge>}
                  {plan.warnings > 0 && <Badge tone="wait">{plan.warnings} with warnings</Badge>}
                </div>
                {plan.invalid.length > 0 && (
                  <Button size="sm" variant="ghost" icon={Download} onClick={downloadProblems}>Download problem rows</Button>
                )}
              </div>
              {tooMany && (
                <p className="flex items-center gap-1.5 text-sm" style={{ color: 'var(--adm-fault)' }}>
                  <AlertTriangle size={14} /> That is {plan.units} units; one import can add at most {MAX_UNITS}. Split the file.
                </p>
              )}
            </>
          )}

          <div className="adm-scroll overflow-auto rounded-xl" style={{ maxHeight: 360, border: '1px solid var(--adm-trace)' }}>
            <table className="adm-table">
              <thead>
                <tr><th>Line</th><th>Item</th><th>Qty</th><th>Category</th><th>Location</th><th>Result</th></tr>
              </thead>
              <tbody>
                {rows.slice(0, PREVIEW_LIMIT).map(r => (
                  <tr key={r.line}>
                    <td className="adm-data text-[12px]">{r.line}</td>
                    <td>
                      <span className="flex items-center gap-2 min-w-0">
                        <span className="rounded overflow-hidden shrink-0" style={{ width: 28, height: 28, background: 'var(--adm-panel-raise)' }}>
                          {r.payload.photo_url && <img src={r.payload.photo_url} alt="" className="w-full h-full object-contain" loading="lazy" />}
                        </span>
                        <span className="text-sm adm-truncate" style={{ maxWidth: 240 }}>{r.payload.name || '—'}</span>
                      </span>
                    </td>
                    <td className="adm-data text-[12px]">{r.quantity || '—'}</td>
                    <td className="text-[13px]">{r.payload.category}</td>
                    <td className="text-[13px]">{r.payload.location || '—'}</td>
                    <td className="text-[12px]"><RowOutcome row={r} /></td>
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

function RowOutcome({ row }) {
  if (row.errors.length) return <span style={{ color: 'var(--adm-fault)' }}>Skipped: {row.errors.join(', ')}</span>
  return (
    <span className="block">
      <span style={{ color: 'var(--adm-ok)' }}>Add {row.quantity}</span>
      {row.inStock > 0 && (
        <span style={{ color: 'var(--adm-silk-faint)' }}> · {row.inStock} already in stock</span>
      )}
      {row.warnings.length > 0 && (
        <span className="block text-[11px]" style={{ color: 'var(--adm-wait)' }}>{row.warnings.join(', ')}</span>
      )}
    </span>
  )
}

/** " — e.g. Arduino Uno" so a column can be recognised by its content, not just its header. */
function sampleOf(body, index) {
  const value = body.find(r => r[index] !== null && r[index] !== undefined && String(r[index]).trim())?.[index]
  if (value === undefined) return ''
  const s = value instanceof Date ? value.toISOString().slice(0, 10) : String(value)
  return ` — e.g. ${s.length > 24 ? `${s.slice(0, 24)}…` : s}`
}
