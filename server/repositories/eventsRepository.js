import { supabaseAdmin } from '../db/client.js'

const COLUMNS = 'id, title_en, title_ar, title_fr, description_en, description_ar, description_fr, date, time, location_en, location_ar, location_fr, max_participants, registration_open'

function todayIso() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Algiers' }).format(new Date())
}

export async function getUpcomingEvents(limit = 5) {
  const { data, error } = await supabaseAdmin
    .from('events')
    .select('*')
    .eq('is_published', true)
    .gte('date', todayIso())
    .order('date', { ascending: true })
    .limit(limit)

  if (error) {
    console.error('getUpcomingEvents error:', error)
    return []
  }
  return data || []
}

/**
 * Everything coming up, plus the most recent past events so the assistant can
 * still talk about what the club has done when nothing is scheduled.
 */
export async function getEventsForAssistant({ upcoming = 30, past = 20 } = {}) {
  const today = todayIso()
  const [next, before] = await Promise.all([
    supabaseAdmin.from('events').select(COLUMNS).eq('is_published', true)
      .gte('date', today).order('date', { ascending: true }).limit(upcoming),
    supabaseAdmin.from('events').select(COLUMNS).eq('is_published', true)
      .lt('date', today).order('date', { ascending: false }).limit(past),
  ])

  if (next.error) console.error('getEventsForAssistant upcoming error:', next.error)
  if (before.error) console.error('getEventsForAssistant past error:', before.error)
  return [...(next.data || []), ...(before.data || [])]
}
