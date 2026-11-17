import {
  Accessibility, Armchair, BookOpen, Bus, CalendarDays, DoorOpen, Droplets, HeartPulse,
  House, Leaf, Lightbulb, MessagesSquare, Plug, ShieldCheck, Users, UtensilsCrossed, Wifi,
} from 'lucide-react'
import { supabase } from './supabase'

// Student Voice (/student-voice): the icons a problem card can show. The
// admin screen offers these; anything unknown falls back to the light bulb.
export const PROBLEM_ICONS = [
  { value: 'Bus', label: 'Transport', Icon: Bus },
  { value: 'DoorOpen', label: 'Rooms', Icon: DoorOpen },
  { value: 'Wifi', label: 'Internet', Icon: Wifi },
  { value: 'BookOpen', label: 'Library & study', Icon: BookOpen },
  { value: 'UtensilsCrossed', label: 'Food', Icon: UtensilsCrossed },
  { value: 'House', label: 'Housing', Icon: House },
  { value: 'Armchair', label: 'Facilities', Icon: Armchair },
  { value: 'Plug', label: 'Power & equipment', Icon: Plug },
  { value: 'Droplets', label: 'Water & hygiene', Icon: Droplets },
  { value: 'HeartPulse', label: 'Health', Icon: HeartPulse },
  { value: 'ShieldCheck', label: 'Safety', Icon: ShieldCheck },
  { value: 'Accessibility', label: 'Accessibility', Icon: Accessibility },
  { value: 'Leaf', label: 'Environment', Icon: Leaf },
  { value: 'CalendarDays', label: 'Schedules', Icon: CalendarDays },
  { value: 'Users', label: 'Student life', Icon: Users },
  { value: 'MessagesSquare', label: 'Communication', Icon: MessagesSquare },
  { value: 'Lightbulb', label: 'Other', Icon: Lightbulb },
]

export function ProblemIcon({ name, ...props }) {
  const Icon = PROBLEM_ICONS.find(i => i.value === name)?.Icon || Lightbulb
  return <Icon {...props} />
}

export const STUDENT_VOICE_PATH = '/student-voice'

/** When the event ends, or null without a date. Missing times count as end of day. */
export function eventEnd(settings) {
  if (!settings?.event_date) return null
  const time = /^\d{2}:\d{2}$/.test(settings.end_time || '') ? settings.end_time : '23:59'
  return new Date(`${settings.event_date}T${time}:00`)
}

/** Settings and active problems for the public page, in one call. */
export async function loadStudentVoice() {
  const { data, error } = await supabase.rpc('campus_voice_public')
  if (error) throw error
  return { settings: data?.settings || null, problems: data?.problems || [] }
}

/** A row's text in the visitor's language, falling back to English. */
export const localized = (row, field, lang) => row?.[`${field}_${lang}`] || row?.[`${field}_en`] || ''
