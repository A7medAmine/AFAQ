import { promises as dns } from 'dns'

const { Resolver } = dns

/**
 * Cheap deliverability check for addresses typed into public forms.
 *
 * It answers "can this domain receive mail at all?" — not "does this exact
 * mailbox exist". Probing the mailbox over SMTP is unreliable (big providers
 * accept every RCPT, many hosts block outbound port 25), so we stop at DNS:
 * the domain must publish MX records (or, per RFC 5321, an A/AAAA fallback),
 * must not publish a null MX, and must not be a throwaway inbox provider.
 *
 * DNS hiccups (timeouts, SERVFAIL, unreachable resolver) fail open — a slow resolver must never
 * block a real student from signing up.
 */

const LOOKUP_TIMEOUT_MS = 3000
const CACHE_TTL_MS = 60 * 60 * 1000
const CACHE_MAX = 5000
const cache = new Map()

const DISPOSABLE_DOMAINS = new Set([
  'mailinator.com', 'guerrillamail.com', 'guerrillamail.net', 'sharklasers.com',
  '10minutemail.com', 'tempmail.com', 'temp-mail.org', 'yopmail.com', 'yopmail.fr',
  'trashmail.com', 'getnada.com', 'dispostable.com', 'maildrop.cc', 'throwawaymail.com',
  'fakeinbox.com', 'mintemail.com', 'mohmal.com', 'emailondeck.com', 'tempail.com',
  'mailnesia.com', 'spamgourmet.com', 'moakt.com', 'tempmailo.com', 'burnermail.io',
])

/** Common slips on the providers our members actually use. */
const TYPO_DOMAINS = {
  'gmial.com': 'gmail.com', 'gmai.com': 'gmail.com', 'gamil.com': 'gmail.com',
  'gmail.co': 'gmail.com', 'gmail.cm': 'gmail.com', 'gmail.con': 'gmail.com',
  'gmaill.com': 'gmail.com', 'gnail.com': 'gmail.com', 'gmail.fr': 'gmail.com',
  'hotmial.com': 'hotmail.com', 'hotmai.com': 'hotmail.com', 'hotmail.co': 'hotmail.com',
  'hotmail.con': 'hotmail.com', 'yaho.com': 'yahoo.com', 'yahoo.co': 'yahoo.com',
  'yahoo.con': 'yahoo.com', 'yahooo.com': 'yahoo.com', 'outlok.com': 'outlook.com',
  'outlook.co': 'outlook.com', 'outlook.con': 'outlook.com', 'icloud.co': 'icloud.com',
}

// The host's own resolver first. Some hosts point it at a local stub Node's
// resolver cannot talk to (ECONNREFUSED on 127.0.0.1), so a resolver-level
// failure is retried once against public DNS before we give up.
const systemResolver = new Resolver({ timeout: LOOKUP_TIMEOUT_MS, tries: 1 })
const publicResolver = new Resolver({ timeout: LOOKUP_TIMEOUT_MS, tries: 1 })
publicResolver.setServers((process.env.EMAIL_CHECK_DNS || '1.1.1.1,8.8.8.8').split(',').map(s => s.trim()))

// "Domain has no such record" answers. Anything else is a resolver problem.
const isMissing = err => ['ENOTFOUND', 'ENODATA', 'NXDOMAIN'].includes(err?.code)

async function query(method, domain) {
  try {
    return await systemResolver[method](domain)
  } catch (err) {
    if (isMissing(err)) throw err
    return publicResolver[method](domain)
  }
}

/** true / false when DNS gave a real answer, null when it could not be reached. */
async function domainAcceptsMail(domain) {
  try {
    const mx = await query('resolveMx', domain)
    // RFC 7505 null MX: the domain explicitly refuses mail.
    if (mx.length === 1 && (mx[0].exchange === '' || mx[0].exchange === '.')) return false
    if (mx.length) return true
  } catch (err) {
    if (!isMissing(err)) return null
  }

  // No MX: RFC 5321 falls back to the domain's own address.
  const fallbacks = await Promise.allSettled([query('resolve4', domain), query('resolve6', domain)])
  if (fallbacks.some(r => r.status === 'fulfilled' && r.value.length)) return true
  return fallbacks.every(r => r.status === 'rejected' && isMissing(r.reason)) ? false : null
}

/**
 * @returns {Promise<{ ok: true } | { ok: false, reason: 'typo'|'disposable'|'no_mail', suggestion?: string }>}
 */
export async function checkEmailDeliverable(email) {
  const domain = String(email).split('@').pop().toLowerCase()

  const suggestion = TYPO_DOMAINS[domain]
  if (suggestion) {
    return { ok: false, reason: 'typo', suggestion: `${email.slice(0, email.lastIndexOf('@'))}@${suggestion}` }
  }
  if (DISPOSABLE_DOMAINS.has(domain)) return { ok: false, reason: 'disposable' }

  const hit = cache.get(domain)
  if (hit && hit.expires > Date.now()) return hit.result

  const accepts = await domainAcceptsMail(domain)
  // Unreachable DNS fails open and is not cached, so the next try asks again.
  if (accepts === null) return { ok: true }

  const result = accepts ? { ok: true } : { ok: false, reason: 'no_mail' }
  // Random junk domains from bots must not grow the map forever.
  if (cache.size >= CACHE_MAX) cache.clear()
  cache.set(domain, { result, expires: Date.now() + CACHE_TTL_MS })
  return result
}

const MESSAGES = {
  typo: s => `Did you mean ${s}? Check the spelling of your email address.`,
  disposable: () => 'Temporary email addresses are not accepted. Use an address you check regularly.',
  no_mail: () => 'That email domain cannot receive mail. Check the address and try again.',
}

/** Express-friendly wrapper: null when fine, else a 400 payload. */
export async function undeliverableEmailError(email) {
  const check = await checkEmailDeliverable(email)
  if (check.ok) return null
  return {
    error: MESSAGES[check.reason](check.suggestion),
    code: 'undeliverable',
    reason: check.reason,
    ...(check.suggestion && { suggestion: check.suggestion }),
  }
}
