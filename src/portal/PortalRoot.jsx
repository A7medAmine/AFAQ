import { Outlet } from 'react-router-dom'
import { PortalProvider } from './lib/portal'

/** Holds the member session for every /portal screen. */
export default function PortalRoot() {
  return (
    <PortalProvider>
      <Outlet />
    </PortalProvider>
  )
}
