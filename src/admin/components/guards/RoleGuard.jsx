import { Navigate } from 'react-router-dom'
import useAdminStore from '../../store/adminStore'

export default function RoleGuard({ role, children }) {
  const hasRole = useAdminStore(s => s.hasRole)

  if (!hasRole(role)) {
    return <Navigate to="/admin" replace />
  }

  return children
}
