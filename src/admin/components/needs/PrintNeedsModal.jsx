import { useEffect, useMemo, useState } from 'react'
import { ListChecks, ShoppingCart } from 'lucide-react'
import { savedExportLanguage } from '../../lib/exportI18n'
import { printNeedsList } from '../../lib/needsReport'
import useAdminStore from '../../store/adminStore'
import Modal from '../ui/Modal'
import Button from '../ui/Button'
import { CheckField } from '../ui/Field'
import { LanguageChoice } from '../ui/ExportMenu'

const NONE = 'none'

/**
 * Print options for a needs list: the whole checklist or only what must be
 * bought, which departments, the language, and whether each department gets
 * its own page — handy for giving Tech and Media their own sheet.
 */
export default function PrintNeedsModal({ open, list, items, departments, onClose }) {
  const addToast = useAdminStore(s => s.addToast)
  const [layout, setLayout] = useState('checklist')
  const [lang, setLang] = useState(savedExportLanguage)
  const [includeReady, setIncludeReady] = useState(true)
  const [pagePerDept, setPagePerDept] = useState(false)
  const [picked, setPicked] = useState([])
  const [busy, setBusy] = useState(false)

  // Departments that have something on this list, plus "No department".
  const groups = useMemo(() => {
    const known = new Set(departments.map(d => d.id))
    const used = new Set(items.filter(i => i.status !== 'cancelled').map(i => (known.has(i.department_id) ? i.department_id : NONE)))
    const list = departments.filter(d => used.has(d.id)).map(d => ({ key: String(d.id), id: d.id, name: d.name }))
    if (used.has(NONE)) list.push({ key: NONE, id: null, name: 'No department' })
    return list
  }, [items, departments])

  useEffect(() => { if (open) setPicked(groups.map(g => g.key)) }, [open, groups])

  const toggle = (key, on) => setPicked(p => (on ? [...p, key] : p.filter(k => k !== key)))

  const print = async () => {
    // Opened now, inside the click, so the browser doesn't treat it as a popup.
    const win = window.open('', '_blank')
    setBusy(true)
    try {
      const known = new Set(departments.map(d => d.id))
      await printNeedsList({
        list,
        // Items whose department was deleted print under "No department".
        items: items.map(i => (known.has(i.department_id) ? i : { ...i, department_id: null })),
        departments: groups.filter(g => picked.includes(g.key)).map(g => ({ id: g.id, name: g.name })),
        layout, includeReady, pagePerDept, lang, win,
      })
      onClose()
    } catch {
      win?.close()
      addToast('The list could not be printed. Try again.', 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Print list"
      description="Opens a print-ready PDF. Each line gets a tick box; ready items come pre-ticked."
      footer={
        <>
          <Button onClick={onClose} data-dialog-dismiss="true">Cancel</Button>
          <Button variant="primary" onClick={print} busy={busy} busyLabel="Preparing…" disabled={!picked.length}>Print</Button>
        </>
      }
    >
      <div className="space-y-5">
        <div>
          <span className="adm-label">What to print</span>
          <div className="flex flex-wrap gap-2">
            <button type="button" className="adm-export-choice" data-active={layout === 'checklist' || undefined} onClick={() => setLayout('checklist')}>
              <ListChecks size={16} /> Full checklist
            </button>
            <button type="button" className="adm-export-choice" data-active={layout === 'shopping' || undefined} onClick={() => setLayout('shopping')}>
              <ShoppingCart size={16} /> Shopping list
            </button>
          </div>
          <p className="text-xs mt-1.5" style={{ color: 'var(--adm-silk-faint)' }}>
            {layout === 'shopping' ? 'Only items marked “Buy” that are not ready yet.' : 'Every item with its type, source, status and who is on it.'}
          </p>
        </div>

        <LanguageChoice value={lang} onChange={setLang} />

        <div>
          <span className="adm-label">Departments</span>
          {groups.length ? (
            <div className="grid sm:grid-cols-2 gap-2.5">
              {groups.map(g => (
                <CheckField key={g.key} label={g.name} checked={picked.includes(g.key)} onChange={on => toggle(g.key, on)} />
              ))}
            </div>
          ) : (
            <p className="text-sm" style={{ color: 'var(--adm-silk-faint)' }}>The list is empty.</p>
          )}
        </div>

        <div className="space-y-2.5">
          {layout === 'checklist' && (
            <CheckField label="Include ready items" description="Leave them out to print only what is still missing."
              checked={includeReady} onChange={setIncludeReady} />
          )}
          <CheckField label="Each department on its own page" description="To hand each team its own sheet."
            checked={pagePerDept} onChange={setPagePerDept} />
        </div>
      </div>
    </Modal>
  )
}
