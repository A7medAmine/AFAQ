// Contact details a student typed on a successful sign-up, kept in this browser
// so the next event registration (or membership application) starts filled in.
// Storage can be blocked (private mode, cleared site data), so every access is
// guarded and a failure just means an empty form.

const KEY = 'afaq.profile'
const FIELDS = ['full_name', 'student_id', 'email', 'phone', 'department']

export function loadProfile() {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return null
    const data = JSON.parse(raw)
    const profile = {}
    for (const f of FIELDS) if (typeof data[f] === 'string') profile[f] = data[f]
    return profile.full_name || profile.email ? profile : null
  } catch {
    return null
  }
}

export function saveProfile(form) {
  try {
    const profile = {}
    for (const f of FIELDS) profile[f] = (form[f] || '').trim()
    localStorage.setItem(KEY, JSON.stringify(profile))
  } catch {
    // Not remembering is fine.
  }
}

export function clearProfile() {
  try {
    localStorage.removeItem(KEY)
  } catch {
    // Nothing to clear.
  }
}
