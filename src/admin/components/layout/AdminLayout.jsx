import Sidebar from './Sidebar'
import TopNav from './TopNav'
import ToastContainer from '../ui/ToastContainer'
import useAdminStore from '../../store/adminStore'

export default function AdminLayout({ children }) {
  const sidebarOpen = useAdminStore(s => s.sidebarOpen)
  const toggleSidebar = useAdminStore(s => s.toggleSidebar)

  return (
    <div dir="ltr" style={{ background: 'var(--color-bg)', minHeight: '100vh' }}>
      <Sidebar />
      {sidebarOpen && (
        <div
          onClick={() => toggleSidebar()}
          className="fixed inset-0 z-30 lg:hidden"
          style={{ background: 'rgba(0,0,0,0.3)' }}
        />
      )}
      <TopNav />
      <main className="pt-16 min-h-screen lg:ml-16">
        <div className="p-8 max-w-7xl mx-auto">
          {children}
        </div>
      </main>
      <ToastContainer />
    </div>
  )
}
