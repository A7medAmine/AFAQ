/**
 * HR vocabulary shared by the members roster, the board page and the task list,
 * so a position or a status reads the same wherever it shows up.
 */

import { toDateInput } from './format'

/** Office titles in board order — the order the board page lists them in. */
export const POSITION_TITLES = [
  { value: 'president', label: 'President' },
  { value: 'vice_president', label: 'Vice president' },
  { value: 'secretary_general', label: 'Secretary general' },
  { value: 'treasurer', label: 'Treasurer' },
  { value: 'head_of_department', label: 'Head of department' },
  { value: 'team_lead', label: 'Team lead' },
  { value: 'coordinator', label: 'Coordinator' },
  { value: 'advisor', label: 'Advisor' },
]

export function positionLabel(title) {
  return POSITION_TITLES.find(p => p.value === title)?.label || title || '—'
}

/**
 * Built-in offices followed by the club's custom roles (rows of member_roles).
 * A custom role's value is its name, which is what member_positions.title stores.
 */
export function roleOptions(customRoles = []) {
  const custom = customRoles
    .filter(r => !POSITION_TITLES.some(p => p.value === r.name || p.label.toLowerCase() === r.name.toLowerCase()))
    .map(r => ({ value: r.name, label: r.name, id: r.id }))
  return [...POSITION_TITLES, ...custom]
}

export function positionRank(title) {
  const index = POSITION_TITLES.findIndex(p => p.value === title)
  return index === -1 ? POSITION_TITLES.length : index
}

export const MEMBER_STATUSES = [
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
  { value: 'alumni', label: 'Alumni' },
  { value: 'suspended', label: 'Suspended' },
]

export const CARD_STATUSES = [
  { value: 'active', label: 'Active' },
  { value: 'lost', label: 'Lost' },
  { value: 'suspended', label: 'Suspended' },
]

export const GENDERS = [
  { value: '', label: 'Not specified' },
  { value: 'male', label: 'Male' },
  { value: 'female', label: 'Female' },
]

export const TASK_STATUSES = [
  { value: 'todo', label: 'To do' },
  { value: 'in_progress', label: 'In progress' },
  { value: 'done', label: 'Done' },
  { value: 'cancelled', label: 'Cancelled' },
]

export const TASK_PRIORITIES = [
  { value: 'low', label: 'Low' },
  { value: 'normal', label: 'Normal' },
  { value: 'high', label: 'High' },
]

export const isOpenTask = task => task.status === 'todo' || task.status === 'in_progress'

export function isOverdue(task) {
  return isOpenTask(task) && !!task.due_date && task.due_date < toDateInput()
}

/**
 * A term runs up to (not including) its end date, so "End term" can stamp
 * today and the position drops off the board straight away. An open-ended
 * term never lapses.
 */
export function isCurrentTerm(position, today = toDateInput()) {
  return position.term_start <= today && (!position.term_end || position.term_end > today)
}

/** Current positions first (by board rank), then past terms newest first. */
export function sortPositions(positions = []) {
  return [...positions].sort((a, b) => {
    const ca = isCurrentTerm(a), cb = isCurrentTerm(b)
    if (ca !== cb) return ca ? -1 : 1
    if (ca) return positionRank(a.title) - positionRank(b.title)
    return (b.term_start || '').localeCompare(a.term_start || '')
  })
}

/** "a, b , c" → ['a', 'b', 'c'] for the free-text tag fields. */
export function splitList(value) {
  return String(value || '').split(',').map(s => s.trim()).filter(Boolean)
}
