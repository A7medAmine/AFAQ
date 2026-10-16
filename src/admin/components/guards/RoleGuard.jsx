import { Navigate } from 'react-router-dom'
import { Lock } from 'lucide-react'
import useAdminStore from '../../store/adminStore'
import { extraPermissions, hasPermission, isTopRole } from '../../lib/permissions'
import Panel from '../ui/Panel'
import EmptyState from '../ui/EmptyState'

/**
 * Guards a route by permission rather than by role name, so the rule matches
 * what the sidebar already uses to decide whether to show the link at all.
 *
 * Reaching a blocked screen by typing its URL explains the block instead of
 * bouncing you back to the overview with no reason given.
 */
export default function RoleGuard({ permission, role, children }) {
  const currentRole = useAdminStore(s => s.role())
  const headsDepartment = useAdminStore(s => s.headsDepartment())

  // `role` is the older API — a bare role name — kept working here.
  const allowed = permission
    ? hasPermission(currentRole, permission) || extraPermissions({ headsDepartment }).includes(permission)
    : currentRole === role || isTopRole(currentRole)

  if (!currentRole) return <Navigate to="/admin/login" replace />

  if (!allowed) {
    return (
      <Panel>
        <EmptyState
          icon={Lock}
          title="You do not have access to this screen"
          description="Your role does not include this area of the console. Ask a super admin if you need it."
        />
      </Panel>
    )
  }

  return children
}
