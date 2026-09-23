/**
 * Turning someone else's spreadsheet into member rows: read the file, guess
 * which column is which (headers come in English, French or Arabic), and clean
 * each value into the shape the members table expects.
 */

import { MEMBER_STATUSES, splitList } from './hr'

/** Import targets in the order the mapping step shows them. */
export const IMPORT_FIELDS = [
  { key: 'full_name', label: 'Full name', aliases: ['full name', 'name', 'nom complet', 'nom et prenom', 'nom prenom', 'الاسم الكامل', 'الاسم واللقب', 'الاسم'] },
  { key: 'first_name', label: 'First name', aliases: ['first name', 'firstname', 'given name', 'prenom', 'الاسم الأول'] },
  { key: 'last_name', label: 'Last name', aliases: ['last name', 'lastname', 'surname', 'family name', 'nom', 'nom de famille', 'اللقب'] },
  { key: 'email', label: 'Email', aliases: ['email', 'e-mail', 'mail', 'email address', 'adresse email', 'courriel', 'البريد الإلكتروني', 'البريد'] },
  { key: 'phone', label: 'Phone', aliases: ['phone', 'phone number', 'mobile', 'tel', 'telephone', 'الهاتف', 'رقم الهاتف'] },
  { key: 'student_id', label: 'Student ID', aliases: ['student id', 'student number', 'matricule', 'numero d inscription', 'رقم التسجيل', 'رقم الطالب'] },
  { key: 'department', label: 'Department', aliases: ['department', 'faculty', 'field', 'departement', 'faculte', 'filiere', 'specialite', 'القسم', 'التخصص', 'الكلية'] },
  { key: 'study_year', label: 'Study year', aliases: ['study year', 'year', 'level', 'annee', 'niveau', 'السنة', 'المستوى'] },
  { key: 'team', label: 'Team', aliases: ['team', 'cell', 'equipe', 'cellule', 'الفريق', 'الخلية'] },
  { key: 'status', label: 'Status', aliases: ['status', 'statut', 'الحالة'] },
  { key: 'joined_at', label: 'Joined on', aliases: ['joined', 'joined on', 'join date', 'joined at', 'date d adhesion', 'adhesion', 'تاريخ الانضمام'] },
  { key: 'birth_date', label: 'Date of birth', aliases: ['date of birth', 'birth date', 'birthday', 'dob', 'date de naissance', 'تاريخ الميلاد'] },
  { key: 'gender', label: 'Gender', aliases: ['gender', 'sex', 'sexe', 'genre', 'الجنس'] },
  { key: 'skills', label: 'Skills', aliases: ['skills', 'competences', 'المهارات'] },
  { key: 'interests', label: 'Interests', aliases: ['interests', 'centres d interet', 'interets', 'الاهتمامات'] },
  { key: 'notes', label: 'Notes', aliases: ['notes', 'note', 'remarks', 'remarques', 'commentaire', 'ملاحظات'] },
]

export const TEMPLATE_HEADERS = [
  'Full name', 'Email', 'Phone', 'Student ID', 'Department', 'Study year', 'Team',
  'Status', 'Joined on', 'Date of birth', 'Gender', 'Skills', 'Interests', 'Notes',
]

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/** "Adresse E-mail :" → "adresse e mail" so headers compare loosely. */
function normalizeHeader(value) {
  return String(value ?? '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[_\-.:'’()/]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Read a .xlsx or .csv file into an array of rows (arrays of cells). Parsers
 * are imported on demand so the console doesn't ship them to every page.
 */
export async function readSpreadsheet(file) {
  const name = file.name.toLowerCase()
  if (name.endsWith('.csv') || name.endsWith('.tsv') || file.type === 'text/csv') {
    const { default: Papa } = await import('papaparse')
    const text = await file.text()
    const { data, errors } = Papa.parse(text.replace(/^﻿/, ''), { skipEmptyLines: 'greedy' })
    if (!data.length && errors.length) throw new Error('That CSV file could not be read.')
    return data
  }
  if (name.endsWith('.xlsx')) {
    const { readSheet } = await import('read-excel-file/browser')
    return readSheet(file)
  }
  if (name.endsWith('.xls')) {
    throw new Error('Old .xls files are not supported. In Excel, use “Save as” → .xlsx or CSV, then import that.')
  }
  throw new Error('Choose an Excel (.xlsx) or CSV file.')
}

/**
 * Find the header row (the first row with at least two non-empty cells — some
 * sheets start with a title line) and split it from the data rows.
 */
export function splitHeader(rows) {
  const index = rows.findIndex(r => r.filter(c => String(c ?? '').trim()).length >= 2)
  if (index === -1) return { headers: [], body: [] }
  const headers = rows[index].map((h, i) => String(h ?? '').trim() || `Column ${i + 1}`)
  const body = rows.slice(index + 1).filter(r => r.some(c => String(c ?? '').trim()))
  return { headers, body }
}

/** Best guess of { fieldKey: columnIndex } from the header row. */
export function guessMapping(headers) {
  const normalized = headers.map(normalizeHeader)
  const mapping = {}
  const used = new Set()
  // Exact matches first, so "Nom" lands on last name before "Nom complet" is tried loosely.
  for (const pass of ['exact', 'contains']) {
    for (const field of IMPORT_FIELDS) {
      if (mapping[field.key] !== undefined) continue
      const aliases = field.aliases.map(normalizeHeader)
      const index = normalized.findIndex((h, i) => !used.has(i) && (
        pass === 'exact' ? aliases.includes(h) : aliases.some(a => a.length > 3 && h.includes(a))
      ))
      if (index !== -1) { mapping[field.key] = index; used.add(index) }
    }
  }
  // A single "Nom" column with no first-name column is really the full name.
  if (mapping.full_name === undefined && mapping.last_name !== undefined && mapping.first_name === undefined) {
    mapping.full_name = mapping.last_name
    delete mapping.last_name
  }
  return mapping
}

// Excel dates come back as UTC midnight; read them in UTC so no timezone shifts the day.
const isoDay = d => d.toISOString().slice(0, 10)

function text(value) {
  if (value === null || value === undefined) return ''
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? '' : isoDay(value)
  return String(value).trim()
}

/** Dates arrive as Date objects, Excel serial numbers, or dd/mm/yyyy text. */
function toDate(value) {
  if (value === null || value === undefined || value === '') return null
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : isoDay(value)
  if (typeof value === 'number' && value > 20000 && value < 80000) {
    // Excel serial day count from 1899-12-30.
    return isoDay(new Date(Date.UTC(1899, 11, 30) + Math.round(value) * 86400000))
  }
  const s = String(value).trim()
  let m = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/)
  if (m) return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`
  m = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/)
  if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}` // day first, as written in Algeria
  return undefined // present but unreadable
}

/** Excel stores 0555123456 as the number 555123456; put the leading zero back. */
function toPhone(value) {
  if (typeof value === 'number') {
    const digits = String(Math.trunc(value))
    return digits.length === 9 ? `0${digits}` : digits
  }
  return text(value)
}

// Compared after the same normalisation as the cell (NFD splits Arabic hamza too).
const oneOf = (s, words) => words.some(w => normalizeHeader(w) === s)

function toGender(value) {
  const s = normalizeHeader(value)
  if (!s) return null
  if (oneOf(s, ['m', 'male', 'man', 'h', 'homme', 'masculin', 'ذكر'])) return 'male'
  if (oneOf(s, ['f', 'female', 'woman', 'femme', 'feminin', 'أنثى', 'انثى'])) return 'female'
  return undefined
}

function toStatus(value) {
  const s = normalizeHeader(value)
  if (!s) return null
  const known = MEMBER_STATUSES.find(st => st.value === s || normalizeHeader(st.label) === s)
  if (known) return known.value
  if (oneOf(s, ['actif', 'نشط'])) return 'active'
  if (oneOf(s, ['inactif', 'غير نشط'])) return 'inactive'
  if (oneOf(s, ['ancien', 'ancien membre', 'خريج'])) return 'alumni'
  if (oneOf(s, ['suspendu', 'موقوف'])) return 'suspended'
  return undefined
}

const tags = value => (Array.isArray(value) ? value : splitList(text(value).replace(/[;|]/g, ',')))

/**
 * Clean every row against the mapping. Each result carries the payload for the
 * database plus the problems found, so the preview can say exactly what will
 * happen to each line before anything is written.
 *
 * @param existing  current members, to spot people already on the roster
 */
export function buildImportRows(body, mapping, existing) {
  const byEmail = new Map(existing.filter(m => m.email).map(m => [m.email.toLowerCase(), m]))
  const byStudentId = new Map(existing.filter(m => m.student_id).map(m => [String(m.student_id).toLowerCase(), m]))
  const seen = new Set()
  const cell = (row, key) => (mapping[key] === undefined ? undefined : row[mapping[key]])

  return body.map((row, i) => {
    const errors = []
    const warnings = []

    let fullName = text(cell(row, 'full_name'))
    if (!fullName) fullName = [text(cell(row, 'first_name')), text(cell(row, 'last_name'))].filter(Boolean).join(' ')
    const email = text(cell(row, 'email')).toLowerCase()
    const studentId = text(cell(row, 'student_id'))

    if (!fullName) errors.push('No name')
    if (!email) errors.push('No email')
    else if (!EMAIL.test(email)) errors.push('Invalid email')

    const joined = toDate(cell(row, 'joined_at'))
    const birth = toDate(cell(row, 'birth_date'))
    const gender = toGender(cell(row, 'gender'))
    const status = toStatus(cell(row, 'status'))
    if (joined === undefined) warnings.push('Joined date not understood')
    if (birth === undefined) warnings.push('Birth date not understood')
    if (gender === undefined) warnings.push('Gender not understood')
    if (status === undefined) warnings.push('Status not understood, set to active')

    const payload = {
      full_name: fullName,
      email,
      phone: toPhone(cell(row, 'phone')) || null,
      student_id: studentId || null,
      department: text(cell(row, 'department')) || null,
      study_year: text(cell(row, 'study_year')) || null,
      team: text(cell(row, 'team')) || null,
      // null when the cell is empty: new members default to active, updates keep what is there.
      status: status === undefined ? 'active' : status,
      gender: gender || null,
      birth_date: birth || null,
      skills: tags(cell(row, 'skills')),
      interests: tags(cell(row, 'interests')),
      notes: text(cell(row, 'notes')) || null,
    }
    if (joined) payload.joined_at = joined

    const key = email || `sid:${studentId.toLowerCase()}`
    if (!errors.length && seen.has(key)) errors.push('Duplicate of an earlier row')
    if (!errors.length) seen.add(key)

    const match = (email && byEmail.get(email)) || (studentId && byStudentId.get(studentId.toLowerCase())) || null

    return { line: i + 1, payload, errors, warnings, match }
  })
}

/**
 * On update, only overwrite what the file actually provides: an empty cell
 * never wipes data an admin already entered.
 */
export function updatePatch(payload, mapping) {
  const provided = key => mapping[key] !== undefined
  const patch = {}
  for (const [key, value] of Object.entries(payload)) {
    const source = key === 'full_name' ? (provided('full_name') || provided('first_name') || provided('last_name')) : provided(key)
    if (!source) continue
    if (value === null || value === '' || (Array.isArray(value) && !value.length)) continue
    patch[key] = value
  }
  return patch
}
