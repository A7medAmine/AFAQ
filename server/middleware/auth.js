import { createClient } from '@supabase/supabase-js'

/**
 * Shared admin auth for routers mounted outside server.js.
 *
 * The AI knowledge routes shipped with no auth at all: any anonymous caller
 * could POST, PUT, PATCH or DELETE the articles the public chatbot answers
 * from. Reads stay open — the site itself needs them.
 */
const supabaseAdmin = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

export const requireAuth = async (req, res, next) => {
  const token = req.headers.authorization?.replace('Bearer ', '')
  if (!token) return res.status(401).json({ error: 'Unauthorized' })

  const { data, error } = await supabaseAdmin.auth.getUser(token)
  if (error || !data?.user) return res.status(401).json({ error: 'Unauthorized' })

  req.user = data.user
  next()
}

/** Must run after requireAuth. A super admin passes every role check. */
export const requireRole =
  (...roles) =>
  async (req, res, next) => {
    const { data: admin } = await supabaseAdmin
      .from('admin_users')
      .select('*, role:admin_roles(name)')
      .eq('user_id', req.user.id)
      .maybeSingle()

    if (!admin?.is_active) return res.status(403).json({ error: 'Forbidden' })

    const userRole = admin.role?.name
    if (userRole !== 'super_admin' && !roles.includes(userRole)) {
      return res.status(403).json({ error: 'Forbidden' })
    }

    req.adminProfile = admin
    next()
  }

/**
 * Like requireRole, but a role created in the console also passes when its
 * saved permission list (admin_roles.permissions) includes `permission`.
 * `roles` are the built-in roles that hold the permission on the client.
 */
export const requirePermission =
  (permission, ...roles) =>
  async (req, res, next) => {
    const { data: admin } = await supabaseAdmin
      .from('admin_users')
      .select('*, role:admin_roles(name, permissions)')
      .eq('user_id', req.user.id)
      .maybeSingle()

    if (!admin?.is_active) return res.status(403).json({ error: 'Forbidden' })

    const role = admin.role
    const saved = Array.isArray(role?.permissions) ? role.permissions : null
    const allowed = role?.name === 'super_admin' || (saved ? saved.includes(permission) : roles.includes(role?.name))
    if (!allowed) return res.status(403).json({ error: 'Forbidden' })

    req.adminProfile = admin
    next()
  }
