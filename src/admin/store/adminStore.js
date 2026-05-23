import { create } from 'zustand'
import { supabase } from '../../lib/supabase'

const useAdminStore = create((set, get) => ({
  // Auth state
  user: null,
  adminProfile: null,
  session: null,
  isLoading: true,
  isAuthenticated: false,

  // UI state
  sidebarOpen: true,
  toasts: [],

  // Initialize — check existing session
  initialize: async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (session) {
      const { data: profile } = await supabase
        .from('admin_users')
        .select('*, role:admin_roles(name, label)')
        .eq('user_id', session.user.id)
        .single()

      if (profile && profile.is_active) {
        set({
          user: session.user,
          adminProfile: profile,
          session,
          isAuthenticated: true,
          isLoading: false,
        })
        return
      }
    }
    set({ isLoading: false, isAuthenticated: false })
  },

  // Login
  login: async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error

    const { data: profile } = await supabase
      .from('admin_users')
      .select('*, role:admin_roles(name, label)')
      .eq('user_id', data.user.id)
      .single()

    if (!profile || !profile.is_active) {
      await supabase.auth.signOut()
      throw new Error('Access denied')
    }

    set({
      user: data.user,
      adminProfile: profile,
      session: data.session,
      isAuthenticated: true,
      isLoading: false,
    })
  },

  // Logout
  logout: async () => {
    await supabase.auth.signOut()
    set({
      user: null,
      adminProfile: null,
      session: null,
      isAuthenticated: false,
      isLoading: false,
    })
  },

  // Role helpers
  role: () => get().adminProfile?.role?.name || null,
  hasRole: (role) => get().adminProfile?.role?.name === role || get().adminProfile?.role?.name === 'super_admin',
  isSuperAdmin: () => get().adminProfile?.role?.name === 'super_admin',

  // UI helpers
  toggleSidebar: () => set(s => ({ sidebarOpen: !s.sidebarOpen })),

  // Toast
  addToast: (message, type = 'success') => {
    const id = Date.now()
    set(s => ({ toasts: [...s.toasts, { id, message, type }] }))
    setTimeout(() => {
      set(s => ({ toasts: s.toasts.filter(t => t.id !== id) }))
    }, 4000)
  },
  removeToast: (id) => set(s => ({ toasts: s.toasts.filter(t => t.id !== id) })),
}))

export default useAdminStore
