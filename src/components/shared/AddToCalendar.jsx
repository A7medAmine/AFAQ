import { CalendarPlus } from 'lucide-react'

/** Downloads the event as a .ics file — opens directly in Google/Outlook/Apple Calendar. */
export default function AddToCalendar({ eventId, label = 'Add to calendar', className = '' }) {
  return (
    <a
      href={`/api/events/${eventId}.ics`}
      download
      className={`inline-flex items-center gap-1.5 text-xs font-semibold ${className}`}
      style={{ color: 'var(--color-text-muted)' }}
    >
      <CalendarPlus size={13} /> {label}
    </a>
  )
}
