import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { createClient } from '@supabase/supabase-js'

/**
 * The member portal has its own Supabase client with its own storage key.
 * Sharing the admin client would let the console's guard sign a member out
 * (it drops any session that is not an admin) and vice versa, and an admin
 * who is also a member could not be signed in to both at once.
 */
export const portalSupabase = createClient(
  import.meta.env.VITE_SUPABASE_URL || 'https://placeholder.supabase.co',
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY || 'placeholder',
  { auth: { storageKey: 'afaq-portal-auth', detectSessionInUrl: false } }
)

const PortalContext = createContext(null)

export function PortalProvider({ children }) {
  // me: undefined while loading, null when signed out or not a member.
  const [me, setMe] = useState(undefined)

  const refresh = useCallback(async () => {
    const { data: { session } } = await portalSupabase.auth.getSession()
    if (!session) { setMe(null); return null }
    const { data, error } = await portalSupabase.rpc('portal_me')
    if (error || !data) {
      // Signed in but not (or no longer) a member who may use the portal.
      await portalSupabase.auth.signOut({ scope: 'local' })
      setMe(null)
      return null
    }
    setMe(data)
    return data
  }, [])

  useEffect(() => {
    refresh()
    const { data: { subscription } } = portalSupabase.auth.onAuthStateChange(event => {
      if (event === 'SIGNED_OUT') setMe(null)
    })
    return () => subscription.unsubscribe()
  }, [refresh])

  const signIn = async (email, password) => {
    const { error } = await portalSupabase.auth.signInWithPassword({ email: email.trim(), password })
    if (error) return { error: /invalid login credentials/i.test(error.message) ? 'invalid' : 'failed' }
    const member = await refresh()
    return member ? { ok: true } : { error: 'notMember' }
  }

  const signOut = async () => {
    await portalSupabase.auth.signOut({ scope: 'local' })
    setMe(null)
  }

  return (
    <PortalContext.Provider value={{ me, refresh, signIn, signOut }}>
      {children}
    </PortalContext.Provider>
  )
}

export const usePortal = () => useContext(PortalContext)

/** Calls a portal_* function; `data` is null when it failed. */
export async function portalRpc(name, args) {
  const { data, error } = await portalSupabase.rpc(name, args)
  if (error) console.error(`[portal] ${name}:`, error.message)
  return { data: error ? null : data, error }
}

/**
 * Sets the signed-in member's password through the server, which also clears
 * the "must change" flag left by a temporary password. Returns an error key
 * from setPassword.errors, or null.
 */
export async function changePassword(password) {
  const { data: { session } } = await portalSupabase.auth.getSession()
  if (!session) return 'failed'
  try {
    const res = await fetch('/api/portal/password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({ password }),
    })
    if (res.ok) return null
    const body = await res.json().catch(() => ({}))
    return body.code === 'same' ? 'same' : res.status === 429 ? 'tooMany' : 'failed'
  } catch {
    return 'failed'
  }
}

/** Text for the current language, falling back to English. */
export const localized = (row, field, lang) => row?.[`${field}_${lang}`] || row?.[`${field}_en`] || ''

export const baseLang = lang => (lang || 'en').split('-')[0]

const LOCALES = { en: 'en-GB', fr: 'fr-FR', ar: 'ar-DZ' }

/** A date (YYYY-MM-DD or timestamp) in the reader's language. */
export function formatDay(value, lang, withTime = false) {
  if (!value) return ''
  const date = new Date(/^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T00:00:00` : value)
  return date.toLocaleDateString(LOCALES[baseLang(lang)] || 'en-GB', {
    day: 'numeric', month: 'short', year: 'numeric',
    ...(withTime ? { hour: '2-digit', minute: '2-digit' } : {}),
  })
}

export const signedPoints = n => (n > 0 ? `+${n}` : String(n))
