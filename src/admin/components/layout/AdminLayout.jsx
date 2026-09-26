import { Suspense, useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import Sidebar from './Sidebar'
import TopNav from './TopNav'
import CommandPalette from './CommandPalette'
import ToastContainer from '../ui/ToastContainer'
import useAdminStore from '../../store/adminStore'
import '../../admin.css'

export default function AdminLayout({ children }) {
  const navExpanded = useAdminStore(s => s.navExpanded)
  const theme = useAdminStore(s => s.theme)
  const setMobileNav = useAdminStore(s => s.setMobileNav)
  const { pathname } = useLocation()

  // A route change should never leave the mobile drawer sitting open over the
  // screen you just navigated to.
  useEffect(() => { setMobileNav(false) }, [pathname, setMobileNav])

  return (
    <div
      dir="ltr"
      className="adm adm-chassis min-h-screen"
      data-theme={theme}
      data-rail={navExpanded ? 'open' : 'closed'}
    >
      <Sidebar />

      <div className="adm-content min-h-screen flex flex-col">
        <TopNav />
        <main className="flex-1 px-4 sm:px-6 py-6 sm:py-8">
          <div className="mx-auto w-full" style={{ maxWidth: 1240 }}>
            {/* Screens are lazy chunks; keep the chrome up while one loads. */}
            <Suspense fallback={null}>{children}</Suspense>
          </div>
        </main>
      </div>

      <CommandPalette />
      <ToastContainer />
    </div>
  )
}
