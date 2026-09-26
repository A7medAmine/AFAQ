import { useEffect, useState } from 'react'
import { Download, FileText, RectangleHorizontal, RectangleVertical, Sheet } from 'lucide-react'
import { downloadCSV, exportPDF } from '../../lib/format'
import {
  EXPORT_LANGUAGES, localizeLabel, relocalizeDate, rememberExportLanguage, savedExportLanguage, term,
} from '../../lib/exportI18n'
import Button from './Button'
import Modal from './Modal'
import { CheckField } from './Field'

/** English / Français / العربية picker, shared with the finance report dialog. */
export function LanguageChoice({ value, onChange }) {
  const choose = next => {
    rememberExportLanguage(next)
    onChange(next)
  }
  return (
    <div>
      <span className="adm-label">Document language</span>
      <div className="flex gap-2">
        {EXPORT_LANGUAGES.map(l => (
          <button
            key={l.value}
            type="button"
            className="adm-export-choice"
            data-active={value === l.value || undefined}
            onClick={() => choose(l.value)}
            lang={l.value}
            dir={l.value === 'ar' ? 'rtl' : undefined}
          >
            {l.label}
          </button>
        ))}
      </div>
    </div>
  )
}

/**
 * One export control shared by every admin table, so every page offers the
 * same choices — which columns, which format, which orientation, which
 * language — instead of each one wiring its own buttons. `headers`/`rows` are
 * the exact arrays a page would hand `downloadCSV`; this only ever exports a
 * subset of them.
 *
 * Headers, title, subtitle and dates are translated for French and Arabic.
 * Cell values are translated only in `enumColumns` (defaults to the status
 * column) — columns holding fixed vocabulary such as a status or category —
 * so a person or project that happens to be called "Grant" stays "Grant".
 */
export default function ExportMenu({ filename, title, subtitle, headers, rows, statusColumnIndex, enumColumns, disabled }) {
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [format, setFormat] = useState('csv')
  const [orientation, setOrientation] = useState('landscape')
  const [lang, setLang] = useState(savedExportLanguage)
  const [selected, setSelected] = useState(() => headers.map((_, i) => i))

  useEffect(() => {
    if (open) setSelected(headers.map((_, i) => i))
  }, [open, headers])

  const toggle = i => setSelected(s => (s.includes(i) ? s.filter(x => x !== i) : [...s, i].sort((a, b) => a - b)))
  const allChecked = selected.length === headers.length
  const toggleAll = () => setSelected(allChecked ? [] : headers.map((_, i) => i))

  const run = async () => {
    const order = [...selected].sort((a, b) => a - b)
    const translated = new Set(enumColumns ?? (statusColumnIndex != null ? [statusColumnIndex] : []))
    const subHeaders = order.map(i => term(lang, headers[i]))
    const subRows = rows.map(r => order.map(i => {
      const value = translated.has(i) ? term(lang, r[i]) : r[i]
      return relocalizeDate(lang, value)
    }))
    const subStatusIndex = statusColumnIndex != null && order.includes(statusColumnIndex)
      ? order.indexOf(statusColumnIndex)
      : undefined

    if (format === 'csv') {
      downloadCSV(`${filename}.csv`, subHeaders, subRows)
      setOpen(false)
      return
    }

    setBusy(true)
    try {
      await exportPDF({
        filename: `${filename}.pdf`, title: term(lang, title), subtitle: localizeLabel(lang, subtitle),
        headers: subHeaders, rows: subRows, statusColumnIndex: subStatusIndex, orientation, lang,
      })
    } finally {
      setBusy(false)
      setOpen(false)
    }
  }

  return (
    <>
      <Button icon={Download} disabled={disabled} onClick={() => setOpen(true)}>
        Export {rows.length ? `${rows.length} rows` : ''}
      </Button>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Export options"
        description={`${rows.length} ${rows.length === 1 ? 'row' : 'rows'} in the current view.`}
        footer={
          <>
            <Button onClick={() => setOpen(false)} data-dialog-dismiss="true">Cancel</Button>
            <Button variant="primary" onClick={run} busy={busy} busyLabel="Exporting…" disabled={!selected.length}>
              Export {selected.length ? `${selected.length} column${selected.length === 1 ? '' : 's'}` : ''}
            </Button>
          </>
        }
      >
        <div className="space-y-5">
          <div>
            <span className="adm-label">Format</span>
            <div className="flex gap-2">
              <button
                type="button"
                className="adm-export-choice"
                data-active={format === 'csv' || undefined}
                onClick={() => setFormat('csv')}
              >
                <Sheet size={16} /> CSV
              </button>
              <button
                type="button"
                className="adm-export-choice"
                data-active={format === 'pdf' || undefined}
                onClick={() => setFormat('pdf')}
              >
                <FileText size={16} /> PDF
              </button>
            </div>
          </div>

          <LanguageChoice value={lang} onChange={setLang} />

          {format === 'pdf' && (
            <div>
              <span className="adm-label">Page orientation</span>
              <div className="flex gap-2">
                <button
                  type="button"
                  className="adm-export-choice"
                  data-active={orientation === 'landscape' || undefined}
                  onClick={() => setOrientation('landscape')}
                >
                  <RectangleHorizontal size={16} /> Landscape
                </button>
                <button
                  type="button"
                  className="adm-export-choice"
                  data-active={orientation === 'portrait' || undefined}
                  onClick={() => setOrientation('portrait')}
                >
                  <RectangleVertical size={16} /> Portrait
                </button>
              </div>
            </div>
          )}

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="adm-label" style={{ marginBottom: 0 }}>Columns</span>
              <button type="button" onClick={toggleAll} className="text-xs font-medium" style={{ color: 'var(--adm-signal)' }}>
                {allChecked ? 'Clear all' : 'Select all'}
              </button>
            </div>
            <div className="space-y-2.5">
              {headers.map((header, i) => (
                <CheckField
                  key={header + i}
                  label={header}
                  checked={selected.includes(i)}
                  onChange={() => toggle(i)}
                />
              ))}
            </div>
          </div>
        </div>
      </Modal>
    </>
  )
}
