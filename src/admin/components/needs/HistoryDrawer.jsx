import { useEffect, useState } from 'react'
import { read, supabase } from '../../lib/db'
import { formatDateTime, relativeTime } from '../../lib/format'
import { itemStatusLabel, kindLabel, loadAdminDirectory, priorityLabel, sourceLabel } from '../../lib/needs'
import Drawer from '../ui/Drawer'
import Skeleton from '../ui/Skeleton'

const VERB = { created: 'added it', updated: 'changed it', deleted: 'removed it' }

/** One logged change in words: "status → Ready, quantity → 4". */
function describe(entry, departments) {
  const m = entry.metadata || {}
  if (m.stocked) return `added ${m.stocked} to inventory`
  if (m.batch_id) return 'checked it out from stock'
  const parts = []
  if (m.status) parts.push(`status → ${itemStatusLabel(m.status)}`)
  if (m.quantity) parts.push(`quantity → ${m.quantity}`)
  if ('unit' in m) parts.push(`unit → ${m.unit || 'none'}`)
  if (m.kind) parts.push(`type → ${kindLabel(m.kind)}`)
  if (m.source) parts.push(`source → ${sourceLabel(m.source)}`)
  if (m.priority) parts.push(priorityLabel(m.priority))
  if ('assignee' in m) parts.push(`who → ${m.assignee || 'nobody'}`)
  if ('supplier' in m) parts.push(`supplier → ${m.supplier || 'none'}`)
  if ('department_id' in m) parts.push(`department → ${departments.find(d => d.id === m.department_id)?.name || 'none'}`)
  if ('notes' in m) parts.push('notes edited')
  return parts.length ? parts.join(', ') : VERB[entry.action] || entry.action
}

/** Who changed an item and how, newest first, from the activity log. */
export default function HistoryDrawer({ item, departments, onClose }) {
  const [entries, setEntries] = useState(null)
  const [names, setNames] = useState(new Map())

  useEffect(() => {
    if (!item) return
    setEntries(null)
    Promise.all([
      read(supabase.from('activity_logs').select('*').eq('entity_type', 'need_items').eq('entity_id', item.id).order('created_at', { ascending: false }).limit(100)),
      loadAdminDirectory(),
    ]).then(([logs, dir]) => {
      setEntries(logs.ok ? logs.data || [] : [])
      setNames(new Map((dir.data || []).map(a => [a.user_id, a.full_name || a.email])))
    })
  }, [item])

  return (
    <Drawer open={!!item} onClose={onClose} title={item?.name || ''} subtitle="History">
      {entries === null ? (
        <div className="space-y-3">{[0, 1, 2].map(i => <Skeleton key={i} style={{ height: 36 }} />)}</div>
      ) : entries.length === 0 ? (
        <p className="text-sm" style={{ color: 'var(--adm-silk-faint)' }}>No changes recorded yet.</p>
      ) : (
        <ol className="space-y-3">
          {entries.map(e => (
            <li key={e.id} className="flex gap-3">
              <span className="rounded-full shrink-0 mt-1.5" style={{ width: 7, height: 7, background: 'var(--adm-signal)' }} aria-hidden="true" />
              <div className="min-w-0">
                <p className="text-sm"><strong>{names.get(e.user_id) || 'Someone'}</strong> {describe(e, departments)}</p>
                <p className="adm-data text-[11px]" style={{ color: 'var(--adm-silk-faint)' }} title={formatDateTime(e.created_at)}>{relativeTime(e.created_at)}</p>
              </div>
            </li>
          ))}
        </ol>
      )}
    </Drawer>
  )
}
