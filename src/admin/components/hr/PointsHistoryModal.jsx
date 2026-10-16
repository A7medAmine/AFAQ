import { formatDateTime } from '../../lib/format'
import { categoryLabel, formatPoints, pointsTone } from '../../lib/points'
import Modal from '../ui/Modal'
import Badge from '../ui/Badge'
import Button from '../ui/Button'

/**
 * One member's points, newest first. `entries` are their point_entries rows;
 * `admins` maps an admin's user id to their name for the "by" line.
 */
export default function PointsHistoryModal({ member, entries = [], admins = {}, onClose }) {
  const rows = [...entries].sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
  const total = rows.reduce((n, e) => n + e.points, 0)

  return (
    <Modal
      open={!!member}
      onClose={onClose}
      title={member ? `${member.full_name}: ${total} points` : ''}
      description="Every change to this member's points, newest first."
      footer={<Button onClick={onClose} data-dialog-dismiss="true">Close</Button>}
    >
      {rows.length === 0 ? (
        <p className="text-sm" style={{ color: 'var(--adm-silk-faint)' }}>No points yet.</p>
      ) : (
        <ul>
          {rows.map(e => (
            <li key={e.id} className="flex items-start gap-3 py-2.5" style={{ borderTop: '1px solid var(--adm-trace)' }}>
              <span className="adm-data text-sm font-semibold shrink-0 text-right" style={{ width: 48 }}>
                <Badge tone={pointsTone(e.points)}>{formatPoints(e.points)}</Badge>
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm">{e.reason}</span>
                <span className="block text-[11px] mt-0.5" style={{ color: 'var(--adm-silk-faint)' }}>
                  {categoryLabel(e.category)} · {formatDateTime(e.created_at)} · {e.awarded_by ? admins[e.awarded_by] || 'An admin' : 'Automatic'}
                </span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </Modal>
  )
}
