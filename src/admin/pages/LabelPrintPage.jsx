import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { ArrowLeft, Printer, Tag } from 'lucide-react'
import { read, supabase } from '../lib/db'
import Button from '../components/ui/Button'
import { StatusBadge } from '../components/ui/Badge'
import EmptyState, { ErrorState } from '../components/ui/EmptyState'
import Panel from '../components/ui/Panel'

/** One label sheet, repeated — sized to fit a standard Avery-style label
 * column (about 38mm tall) so a batch of these lines up on pre-cut sheets. */
const LABEL_COUNT = 6

export default function LabelPrintPage() {
  const { id } = useParams()
  const [item, setItem] = useState(null)
  const [state, setState] = useState({ loading: true, error: null })

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      const { ok, data, message } = await read(
        supabase.from('inventory_items').select('*').eq('id', id).single()
      )
      if (cancelled) return
      if (!ok) { setState({ loading: false, error: message }); return }
      setItem(data)
      setState({ loading: false, error: null })
    }
    load()
    return () => { cancelled = true }
  }, [id])

  if (state.loading) return null
  if (state.error || !item) {
    return <Panel><ErrorState message={state.error || 'Item not found.'} /></Panel>
  }
  if (!item.qr_code) {
    return (
      <Panel>
        <EmptyState icon={Tag} title="No label yet" description="This item has no QR code generated." />
      </Panel>
    )
  }

  return (
    <div>
      <div className="adm-no-print flex items-center justify-between mb-6">
        <Link to="/admin/inventory" className="adm-btn adm-btn-ghost">
          <ArrowLeft size={15} /> Back to inventory
        </Link>
        <Button variant="primary" icon={Printer} onClick={() => window.print()}>Print</Button>
      </div>

      <div className="flex flex-col gap-3 items-start">
        {Array.from({ length: LABEL_COUNT }).map((_, i) => <Label key={i} item={item} />)}
      </div>
    </div>
  )
}

function Label({ item }) {
  return (
    <div style={{
      width: '70mm', height: '30mm', border: '1px dashed #94a3b8', borderRadius: '2mm',
      display: 'flex', alignItems: 'center', gap: '3mm', padding: '3mm', breakInside: 'avoid',
    }}>
      <img src={item.qr_code} alt="" style={{ width: '22mm', height: '22mm', flexShrink: 0 }} />
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: '10px', fontWeight: 700, color: '#0F172A', lineHeight: 1.2, wordBreak: 'break-word' }}>
          {item.name}
        </div>
        <div style={{ fontSize: '8px', fontFamily: 'monospace', color: '#475569', marginTop: '1mm' }}>
          {item.asset_code}
        </div>
        <div style={{ fontSize: '7px', color: '#94a3b8', marginTop: '1mm' }}>AFAQ Scientific Club</div>
      </div>
    </div>
  )
}
