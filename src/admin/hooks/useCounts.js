import { useCallback, useEffect, useState } from 'react'
import { read, supabase } from '../lib/db'
import useAdminStore from '../store/adminStore'

const head = (table, apply) => {
  const q = supabase.from(table).select('*', { count: 'exact', head: true })
  return apply ? apply(q) : q
}

/**
 * The counts behind the status rail. Kept in the store so the rail, the nav
 * badges and the dashboard all read the same numbers, and refreshed on demand
 * rather than on a timer nobody asked for.
 */
export default function useCounts() {
  const counts = useAdminStore(s => s.counts)
  const setCounts = useAdminStore(s => s.setCounts)
  const loadedAt = useAdminStore(s => s.countsLoadedAt)
  const [loading, setLoading] = useState(!loadedAt)

  const refresh = useCallback(async () => {
    setLoading(true)
    const [registrations, membership, messages, eventDrafts, projectDrafts, overdueBorrows] = await Promise.all([
      read(head('event_registrations', q => q.eq('status', 'pending'))),
      read(head('membership_applications', q => q.eq('status', 'pending'))),
      read(head('contact_messages', q => q.eq('is_read', false))),
      read(head('events', q => q.eq('is_published', false))),
      read(head('projects', q => q.eq('is_published', false))),
      read(head('borrow_records', q => q.eq('status', 'active').lt('expected_return_at', new Date().toISOString()))),
    ])

    setCounts({
      pendingRegistrations: registrations.count,
      pendingMembership: membership.count,
      unreadMessages: messages.count,
      drafts: eventDrafts.count + projectDrafts.count,
      overdueBorrows: overdueBorrows.count,
    })
    setLoading(false)
  }, [setCounts])

  useEffect(() => {
    // Skip the refetch if another screen already loaded these in the last minute.
    if (loadedAt && Date.now() - loadedAt < 60_000) {
      setLoading(false)
      return
    }
    refresh()
  }, [refresh, loadedAt])

  return { counts, loading, refresh }
}
