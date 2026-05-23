import { Routes, Route } from 'react-router-dom'
import Layout from './components/layout/Layout'
import ScrollToTop from './components/shared/ScrollToTop'
import Home from './pages/Home'
import About from './pages/About'
import Projects from './pages/Projects'
import Events from './pages/Events'
import Gallery from './pages/Gallery'
import JoinUs from './pages/JoinUs'
import Registration from './pages/Registration'
import Announcements from './pages/Announcements'
import Contact from './pages/Contact'

// Admin
import Login from './admin/pages/Login'
import Dashboard from './admin/pages/Dashboard'
import EventsPage from './admin/pages/EventsPage'
import RegistrationsPage from './admin/pages/RegistrationsPage'
import MembershipPage from './admin/pages/MembershipPage'
import ProjectsPage from './admin/pages/ProjectsPage'
import GalleryPage from './admin/pages/GalleryPage'
import MessagesPage from './admin/pages/MessagesPage'
import AnnouncementsPage from './admin/pages/AnnouncementsPage'
import AdminUsersPage from './admin/pages/AdminUsersPage'
import SettingsPage from './admin/pages/SettingsPage'
import ProtectedRoute from './admin/components/guards/ProtectedRoute'
import RoleGuard from './admin/components/guards/RoleGuard'

export default function App() {
  return (
    <>
      <ScrollToTop />
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Home />} />
          <Route path="/about" element={<About />} />
          <Route path="/projects" element={<Projects />} />
          <Route path="/events" element={<Events />} />
          <Route path="/gallery" element={<Gallery />} />
          <Route path="/join" element={<JoinUs />} />
          <Route path="/register" element={<Registration />} />
          <Route path="/announcements" element={<Announcements />} />
          <Route path="/contact" element={<Contact />} />
        </Route>

        {/* Admin Routes */}
        <Route path="/admin/login" element={<Login />} />
        <Route path="/admin" element={<ProtectedRoute />}>
          <Route index element={<Dashboard />} />
          <Route path="events" element={<EventsPage />} />
          <Route path="registrations" element={<RegistrationsPage />} />
          <Route path="membership" element={<MembershipPage />} />
          <Route path="projects" element={<ProjectsPage />} />
          <Route path="gallery" element={<GalleryPage />} />
          <Route path="messages" element={<MessagesPage />} />
          <Route path="announcements" element={<AnnouncementsPage />} />
          <Route path="admins" element={
            <RoleGuard role="super_admin"><AdminUsersPage /></RoleGuard>
          } />
          <Route path="settings" element={
            <RoleGuard role="super_admin"><SettingsPage /></RoleGuard>
          } />
        </Route>
      </Routes>
    </>
  )
}
