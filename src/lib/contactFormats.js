// Student IDs and phone numbers arrive in many shapes: PROGRES returns the
// matricule with the enrolment year in front ("202533157711", sometimes the
// year twice as "262633157711"), people type "+213 555 12 34 56" or drop the
// leading zero. Both are reduced to one stored form so lookups and duplicate
// checks compare like with like. Anything that does not fit is kept as typed
// rather than guessed at.

// The matricule proper: 8 digits starting with 3 (e.g. 33157711).
const STUDENT_ID_RE = /^3\d{7}$/

export function normalizeStudentId(raw) {
  const value = String(raw ?? '').trim()
  if (!value || value.includes('@')) return value
  const digits = value.replace(/\D/g, '')
  if (STUDENT_ID_RE.test(digits)) return digits
  const tail = digits.slice(-8)
  return digits.length > 8 && STUDENT_ID_RE.test(tail) ? tail : value
}

// Algerian mobile/landline in national form: 0 followed by 9 digits.
const PHONE_RE = /^0[1-9]\d{8}$/

export function normalizePhone(raw) {
  const value = String(raw ?? '').trim()
  let digits = value.replace(/\D/g, '')
  if (digits.startsWith('00213')) digits = digits.slice(5)
  else if (digits.startsWith('213') && digits.length >= 12) digits = digits.slice(3)
  if (digits.length === 9) digits = `0${digits}`
  return PHONE_RE.test(digits) ? digits : value
}
