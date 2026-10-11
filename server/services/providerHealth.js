// Remembers which AI models just failed so the next requests skip them instead
// of waiting on the same timeout or error again. In-memory: each server
// instance learns on its own, and a restart clears it.

const cooldownUntil = new Map()

const SHORT_MS = 2 * 60_000 // timeouts, 5xx, rate limits
const LONG_MS = 60 * 60_000 // bad key, model gone, access refused

export function isCoolingDown(name) {
  const until = cooldownUntil.get(name)
  if (!until) return false
  if (Date.now() >= until) {
    cooldownUntil.delete(name)
    return false
  }
  return true
}

export function markFailed(name, error) {
  const msg = String(error?.message || error || '')
  const permanent = /\b(401|403|404|410)\b|API_KEY|API key not valid|FreeTierError|deprecated|not found/i.test(msg)
  cooldownUntil.set(name, Date.now() + (permanent ? LONG_MS : SHORT_MS))
}

export function markOk(name) {
  cooldownUntil.delete(name)
}

/**
 * fetch() that gives up if the response headers do not arrive in time. Once
 * headers arrive the body may stream for as long as it needs.
 */
export async function fetchWithTimeout(url, options, timeoutMs) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await fetch(url, { ...options, signal: controller.signal })
  } catch (error) {
    if (error.name === 'AbortError') throw new Error(`timed out after ${timeoutMs}ms`)
    throw error
  } finally {
    clearTimeout(timer)
  }
}
