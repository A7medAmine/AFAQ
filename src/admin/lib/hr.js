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

// Names the club gave built-in offices (member_roles rows with builtin_key),
// keyed by office value. Filled by rememberRoleNames wherever member_roles is
// loaded, so positionLabel reads the same on every page without threading it.
let renamedOffices = {}

function officeNames(rows) {
  return Object.fromEntries(rows.filter(r => r.builtin_key).map(r => [r.builtin_key, r]))
}

/** Record the club's renamed offices from rows of member_roles. */
export function rememberRoleNames(rows = []) {
  renamedOffices = Object.fromEntries(Object.entries(officeNames(rows)).map(([key, r]) => [key, r.name]))
}

/**
 * Built-in offices with the club's names applied. `defaultLabel` keeps the
 * original name; `renameId` is the member_roles row holding the new one.
 * Pass rows of member_roles to read names from them instead of the remembered ones.
 */
export function officeOptions(rows) {
  const named = rows ? officeNames(rows) : null
  return POSITION_TITLES.map(p => {
    const row = named?.[p.value]
    const label = named ? row?.name : renamedOffices[p.value]
    return { ...p, label: label || p.label, defaultLabel: p.label, renameId: row?.id }
  })
}

export function positionLabel(title) {
  return officeOptions().find(p => p.value === title)?.label || title || '—'
}

/**
 * Built-in offices followed by the club's custom roles (rows of member_roles).
 * A custom role's value is its name, which is what member_positions.title stores.
 * Rows with builtin_key only rename an office; they are not roles of their own.
 */
export function roleOptions(customRoles = []) {
  const offices = officeOptions(customRoles)
  const custom = customRoles
    .filter(r => !r.builtin_key)
    .filter(r => !offices.some(p => p.value === r.name || p.label.toLowerCase() === r.name.toLowerCase()))
    .map(r => ({ value: r.name, label: r.name, id: r.id }))
  return [...offices, ...custom]
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

/** What a member does, for printed cards and badges: "President · Robotics". */
export function memberRoleLine(member) {
  const current = sortPositions(member.member_positions || []).filter(p => isCurrentTerm(p))
  if (current.length) {
    const p = current[0]
    return `${positionLabel(p.title)}${p.team ? ` · ${p.team}` : ''}`
  }
  return member.team ? `${member.team} team` : member.department || 'Member'
}

/** "a, b , c" → ['a', 'b', 'c'] for the free-text tag fields. */
export function splitList(value) {
  return String(value || '').split(',').map(s => s.trim()).filter(Boolean)
}
