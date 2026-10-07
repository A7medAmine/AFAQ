import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import { read, supabase } from '../../lib/db'
import { formatDate } from '../../lib/format'
import { isLate, listContext, progressOf } from '../../lib/needs'
import useAdminStore from '../../store/adminStore'
import Panel, { PanelHead } from '../ui/Panel'
import Skeleton from '../ui/Skeleton'

/**
 * Overview tile: open needs lists, soonest due first, with how much is ready
 * and how many items are on the signed-in admin.
 */
export default function NeedsWidget() {
  const me = useAdminStore(s => s.adminProfile?.user_id)
  const [lists, setLists] = useState(null)

  useEffect(() => {
    read(supabase.from('need_lists')
      .select('id, title, scope, due_date, status, event:events(title_en), department:departments(name), items:need_items(status, assignee_user_id)')
      .eq('status', 'open').eq('is_template', false))
      .then(({ ok, data }) => setLists(ok ? data || [] : []))
  }, [])

  const sorted = (lists || []).slice().sort((a, b) => (a.due_date || '9999').localeCompare(b.due_date || '9999'))
  const stillNeeded = sorted.reduce((n, l) => n + l.items.filter(i => i.status === 'needed' || i.status === 'ordered').length, 0)
  const mine = sorted.reduce((n, l) => n + l.items.filter(i => i.assignee_user_id === me && (i.status === 'needed' || i.status === 'ordered')).length, 0)
  const late = sorted.filter(isLate).length

  return (
    <Panel>
      <PanelHead
        eyebrow="Logistics"
        title="Needs lists"
        description={lists ? `${sorted.length} open · ${stillNeeded} item${stillNeeded === 1 ? '' : 's'} still to get${late ? ` · ${late} late` : ''}${mine ? ` · ${mine} on you` : ''}` : undefined}
        action={
          <Link to="/admin/needs" className="text-[13px] font-semibold inline-flex items-center gap-1" style={{ color: 'var(--adm-signal)' }}>
            All lists <ArrowRight size={13} />
          </Link>
        }
      />
      <div className="p-2">
        {lists === null ? (
          <div className="p-3 space-y-3">{[0, 1, 2].map(i => <Skeleton key={i} style={{ height: 30 }} />)}</div>
        ) : sorted.length === 0 ? (
          <p className="text-sm text-center py-8 px-4" style={{ color: 'var(--adm-silk-faint)' }}>No open lists.</p>
        ) : (
          <ul>
            {sorted.slice(0, 5).map(list => {
              const p = progressOf(list.items)
              const lateList = isLate(list)
              return (
                <li key={list.id}>
                  <Link to={`/admin/needs/${list.id}`} className="block px-3 py-2.5 rounded-lg hover:brightness-[1.03]">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-sm font-semibold adm-truncate">{list.title}</span>
                      <span className="adm-data text-[11px] shrink-0" style={{ color: 'var(--adm-silk-faint)' }}>{p.ready}/{p.total}</span>
                    </div>
                    <div className="h-1 rounded-full overflow-hidden mt-1.5" style={{ background: 'var(--adm-board-sunk)' }}>
                      <div style={{ width: `${p.pct}%`, height: '100%', background: p.pct === 100 ? 'var(--adm-ok)' : 'var(--adm-signal)' }} />
                    </div>
                    <p className="text-[11.5px] mt-1" style={{ color: lateList ? 'var(--adm-fault)' : 'var(--adm-silk-faint)' }}>
                      {listContext(list)}{list.due_date ? ` · ${lateList ? 'late, ' : ''}due ${formatDate(list.due_date)}` : ''}
                    </p>
                  </Link>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </Panel>
  )
}
