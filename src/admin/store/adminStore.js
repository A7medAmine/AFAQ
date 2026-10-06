import { create } from 'zustand'
import { supabase } from '../../lib/supabase'
import { registerRolePermissions } from '../lib/permissions'

const PROFILE_SELECT = '*, role:admin_roles(name, label, description, permissions)'

const readStored = (key, fallback) => {
  try {
    return localStorage.getItem(key) ?? fallback
  } catch {
    return fallback
  }
}

const store = (set, get) => ({
  // ── Auth ────────────────────────────────────────────────────────────────
  user: null,
  adminProfile: null,
  session: null,
  isLoading: true,
  isAuthenticated: false,
  authError: null,
  initialized: false,

  // ── Console UI ──────────────────────────────────────────────────────────
  navExpanded: readStored('afaq.admin.nav', 'expanded') === 'expanded',
  closedNavGroups: readStored('afaq.admin.navGroups', '').split(',').filter(Boolean),
  mobileNavOpen: false,
  paletteOpen: false,
  theme: readStored('afaq.admin.theme', 'system'),

  // ── Attention counts driving the status rail ────────────────────────────
  counts: { pendingRegistrations: 0, pendingMembership: 0, unreadMessages: 0, drafts: 0 },
  countsLoadedAt: null,

  toasts: [],

  /** Resolve the current session into an admin profile. Safe to call twice. */
  initialize: async () => {
    if (get().initialized) return
    set({ initialized: true })
    await get().refreshSession()

    supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') {
        set({ user: null, adminProfile: null, session: null, isAuthenticated: false, isLoading: false })
      } else if (session) {
        set({ session })
      }
    })
  },

  refreshSession: async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      set({ isLoading: false, isAuthenticated: false, user: null, adminProfile: null, session: null })
      return
    }

    const { data: profile, error } = await supabase
      .from('admin_users')
      .select(PROFILE_SELECT)
      .eq('user_id', session.user.id)
      .maybeSingle()

    if (error || !profile || !profile.is_active) {
      // A valid Supabase user who is not an active admin must not sit in a
      // half-signed-in state — drop the session outright.
      await supabase.auth.signOut()
      set({
        isLoading: false,
        isAuthenticated: false,
        user: null,
        adminProfile: null,
        session: null,
        authError: profile && !profile.is_active
          ? 'This admin account has been deactivated.'
          : null,
      })
      return
    }

    registerRolePermissions(profile.role?.name, profile.role?.permissions)
    set({
      user: session.user,
      adminProfile: profile,
      session,
      isAuthenticated: true,
      isLoading: false,
      authError: null,
    })
  },

  login: async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      throw new Error(
        /invalid login credentials/i.test(error.message)
          ? 'That email and password do not match an account.'
          : error.message
      )
    }

    const { data: profile } = await supabase
      .from('admin_users')
      .select(PROFILE_SELECT)
      .eq('user_id', data.user.id)
      .maybeSingle()

    if (!profile) {
      await supabase.auth.signOut()
      throw new Error('This account does not have console access.')
    }
    if (!profile.is_active) {
      await supabase.auth.signOut()
      throw new Error('This admin account has been deactivated. Ask a super admin to restore it.')
    }

    registerRolePermissions(profile.role?.name, profile.role?.permissions)
    set({
      user: data.user,
      adminProfile: profile,
      session: data.session,
      isAuthenticated: true,
      isLoading: false,
      authError: null,
    })
  },

  logout: async () => {
    await supabase.auth.signOut()
    set({
      user: null, adminProfile: null, session: null,
      isAuthenticated: false, isLoading: false, mobileNavOpen: false, paletteOpen: false,
    })
  },

  // ── Roles ───────────────────────────────────────────────────────────────
  role: () => get().adminProfile?.role?.name || null,
  isSuperAdmin: () => get().adminProfile?.role?.name === 'super_admin',
  hasRole: role => {
    const current = get().adminProfile?.role?.name
    return current === role || current === 'super_admin'
  },

  // ── UI ──────────────────────────────────────────────────────────────────
  toggleNav: () => set(s => {
    const navExpanded = !s.navExpanded
    try { localStorage.setItem('afaq.admin.nav', navExpanded ? 'expanded' : 'collapsed') } catch { /* private mode */ }
    return { navExpanded }
  }),
  toggleNavGroup: id => set(s => {
    const closedNavGroups = s.closedNavGroups.includes(id)
      ? s.closedNavGroups.filter(g => g !== id)
      : [...s.closedNavGroups, id]
    try { localStorage.setItem('afaq.admin.navGroups', closedNavGroups.join(',')) } catch { /* private mode */ }
    return { closedNavGroups }
  }),
  setMobileNav: open => set({ mobileNavOpen: open }),
  setPalette: open => set({ paletteOpen: open }),

  setTheme: theme => {
    try { localStorage.setItem('afaq.admin.theme', theme) } catch { /* private mode */ }
    set({ theme })
  },

  setCounts: counts => set({ counts: { ...get().counts, ...counts }, countsLoadedAt: Date.now() }),

  // ── Toasts ──────────────────────────────────────────────────────────────
  addToast: (message, type = 'success') => {
    if (!message) return
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
    set(s => ({ toasts: [...s.toasts, { id, message, type }] }))
    // Errors stay long enough to read and act on; confirmations get out of the way.
    setTimeout(() => get().removeToast(id), type === 'error' ? 7000 : 4000)
  },
  removeToast: id => set(s => ({ toasts: s.toasts.filter(t => t.id !== id) })),
})

const useAdminStore = create(store)

export default useAdminStore
