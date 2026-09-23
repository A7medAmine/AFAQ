export default function Badge({ tone = 'neutral', children, className = '' }) {
  return (
    <span className={`adm-badge ${className}`} data-tone={tone === 'neutral' ? undefined : tone}>
      {children}
    </span>
  )
}

/** Shared vocabulary for record state — one word, one colour, everywhere. */
const STATUS = {
  pending: { tone: 'wait', label: 'Pending' },
  approved: { tone: 'ok', label: 'Approved' },
  rejected: { tone: 'fault', label: 'Rejected' },
  cancelled: { tone: 'neutral', label: 'Cancelled' },
  published: { tone: 'ok', label: 'Published' },
  draft: { tone: 'wait', label: 'Draft' },
  open: { tone: 'ok', label: 'Open' },
  closed: { tone: 'neutral', label: 'Closed' },
  active: { tone: 'ok', label: 'Active' },
  inactive: { tone: 'fault', label: 'Inactive' },
  new: { tone: 'signal', label: 'New' },
  read: { tone: 'neutral', label: 'Read' },
  scheduled: { tone: 'signal', label: 'Scheduled' },
  available: { tone: 'ok', label: 'Available' },
  borrowed: { tone: 'signal', label: 'Borrowed' },
  repair: { tone: 'wait', label: 'In repair' },
  retired: { tone: 'neutral', label: 'Retired' },
  overdue: { tone: 'fault', label: 'Overdue' },
  returned: { tone: 'neutral', label: 'Returned' },
  suspended: { tone: 'fault', label: 'Suspended' },
  lost: { tone: 'fault', label: 'Lost' },
  none: { tone: 'neutral', label: 'No card' },
  alumni: { tone: 'neutral', label: 'Alumni' },
  todo: { tone: 'wait', label: 'To do' },
  in_progress: { tone: 'signal', label: 'In progress' },
  done: { tone: 'ok', label: 'Done' },
}

export function StatusBadge({ status }) {
  const entry = STATUS[status] || { tone: 'neutral', label: status || '—' }
  return <Badge tone={entry.tone}>{entry.label}</Badge>
}

export function Led({ state = 'idle', className = '' }) {
  return <span className={`adm-led ${className}`} data-state={state} aria-hidden="true" />
}
