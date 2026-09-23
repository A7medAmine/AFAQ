import { useEffect } from 'react'
import { Navigate, Routes, Route, useLocation, useNavigate } from 'react-router-dom'
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
import ResetPassword from './admin/pages/ResetPassword'
import Dashboard from './admin/pages/Dashboard'
import EventsPage from './admin/pages/EventsPage'
import RegistrationsPage from './admin/pages/RegistrationsPage'
import ApplicationsPage from './admin/pages/ApplicationsPage'
import MembersPage from './admin/pages/MembersPage'
import CardPrintPage from './admin/pages/CardPrintPage'
import TasksPage from './admin/pages/TasksPage'
import VerifyMember from './pages/VerifyMember'
import InventoryPage from './admin/pages/InventoryPage'
import LabelPrintPage from './admin/pages/LabelPrintPage'
import BorrowingPage from './admin/pages/BorrowingPage'
import ProjectsPage from './admin/pages/ProjectsPage'
import GalleryPage from './admin/pages/GalleryPage'
import MessagesPage from './admin/pages/MessagesPage'
import AnnouncementsPage from './admin/pages/AnnouncementsPage'
import AdminUsersPage from './admin/pages/AdminUsersPage'
import SettingsPage from './admin/pages/SettingsPage'
import AIKnowledgePage from './admin/pages/AIKnowledgePage'
import ActivityPage from './admin/pages/ActivityPage'
import AdminNotFound from './admin/pages/NotFound'
import ProtectedRoute from './admin/components/guards/ProtectedRoute'
import RoleGuard from './admin/components/guards/RoleGuard'
import Chatbot from './components/chatbot/Chatbot'

export default function App() {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  // The visitor chatbot is for the public site; it used to float over the
  // admin console too, covering the toast area.
  const isAdmin = pathname.startsWith('/admin')

  useEffect(() => {
    const hash = window.location.hash
    if (hash.includes('type=recovery') && !window.location.pathname.includes('/admin/reset-password')) {
      navigate('/admin/reset-password' + hash, { replace: true })
    }
  }, [navigate])

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

        <Route path="/verify/:memberCode" element={<VerifyMember />} />

        {/* Admin Routes */}
        <Route path="/admin/login" element={<Login />} />
        <Route path="/admin/reset-password" element={<ResetPassword />} />
        {/* Every screen is guarded by the same permission the sidebar uses to
            decide whether to show its link. */}
        <Route path="/admin" element={<ProtectedRoute />}>
          <Route index element={<Dashboard />} />
          <Route path="events" element={
            <RoleGuard permission="events.manage"><EventsPage /></RoleGuard>
          } />
          <Route path="registrations" element={
            <RoleGuard permission="events.registrations.manage"><RegistrationsPage /></RoleGuard>
          } />
          <Route path="applications" element={
            <RoleGuard permission="membership.manage"><ApplicationsPage /></RoleGuard>
          } />
          <Route path="members" element={
            <RoleGuard permission="membership.manage"><MembersPage /></RoleGuard>
          } />
          <Route path="members/:id/card" element={
            <RoleGuard permission="membership.manage"><CardPrintPage /></RoleGuard>
          } />
          <Route path="members/cards" element={
            <RoleGuard permission="membership.manage"><CardPrintPage /></RoleGuard>
          } />
          <Route path="board" element={<Navigate to="/admin/members" replace />} />
          <Route path="tasks" element={
            <RoleGuard permission="tasks.manage"><TasksPage /></RoleGuard>
          } />
          <Route path="inventory" element={
            <RoleGuard permission="inventory.manage"><InventoryPage /></RoleGuard>
          } />
          <Route path="inventory/:id/label" element={
            <RoleGuard permission="inventory.manage"><LabelPrintPage /></RoleGuard>
          } />
          <Route path="borrowing" element={
            <RoleGuard permission="inventory.manage"><BorrowingPage /></RoleGuard>
          } />
          <Route path="projects" element={
            <RoleGuard permission="projects.manage"><ProjectsPage /></RoleGuard>
          } />
          <Route path="gallery" element={
            <RoleGuard permission="gallery.manage"><GalleryPage /></RoleGuard>
          } />
          <Route path="messages" element={
            <RoleGuard permission="messages.view"><MessagesPage /></RoleGuard>
          } />
          <Route path="announcements" element={
            <RoleGuard permission="announcements.manage"><AnnouncementsPage /></RoleGuard>
          } />
          <Route path="admins" element={
            <RoleGuard permission="admin_users.manage"><AdminUsersPage /></RoleGuard>
          } />
          <Route path="ai-knowledge" element={
            <RoleGuard permission="ai_knowledge.manage"><AIKnowledgePage /></RoleGuard>
          } />
          <Route path="activity" element={
            <RoleGuard permission="activity.view"><ActivityPage /></RoleGuard>
          } />
          <Route path="settings" element={
            <RoleGuard permission="settings.manage"><SettingsPage /></RoleGuard>
          } />
          <Route path="*" element={<AdminNotFound />} />
        </Route>
      </Routes>
      {!isAdmin && <Chatbot />}
    </>
  )
}
