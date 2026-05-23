import { useLocation } from 'react-router-dom'
import Sidebar from './Sidebar'
import TopNav from './TopNav'
import ToastContainer from '../ui/ToastContainer'
import useAdminStore from '../../store/adminStore'

export default function AdminLayout({ children }) {
  const pathname = useLocation().pathname
  const sidebarOpen = useAdminStore(s => s.sidebarOpen)

  const pageTitles = {
    '/admin': 'Overview',
    '/admin/events': 'Events',
    '/admin/registrations': 'Registrations',
    '/admin/projects': 'Projects',
    '/admin/gallery': 'Gallery',
    '/admin/messages': 'Messages',
    '/admin/announcements': 'Announcements',
    '/admin/admins': 'Admin Users',
    '/admin/settings': 'Settings',
  }
  const title = pageTitles[pathname] || 'Admin'

  return (
    <div style={{ background: 'var(--color-bg)', minHeight: '100vh' }}>
      <Sidebar />
      <TopNav title={title} />
      <main
        className="pt-16 min-h-screen transition-all duration-300"
        style={{ marginLeft: sidebarOpen ? 240 : 64 }}
      >
        <div className="p-6 max-w-7xl mx-auto">
          {children}
        </div>
      </main>
      <ToastContainer />
    </div>
  )
}
