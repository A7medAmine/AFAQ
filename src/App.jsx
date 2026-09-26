import { lazy, Suspense, useEffect, useState } from 'react'
import { Navigate, Routes, Route, useLocation, useNavigate } from 'react-router-dom'
import Layout from './components/layout/Layout'
import ScrollToTop from './components/shared/ScrollToTop'
// Home stays in the entry chunk so the landing page paints without waiting on
// a second request; every other screen is split into its own chunk.
import Home from './pages/Home'

const About = lazy(() => import('./pages/About'))
const Projects = lazy(() => import('./pages/Projects'))
const Events = lazy(() => import('./pages/Events'))
const Gallery = lazy(() => import('./pages/Gallery'))
const JoinUs = lazy(() => import('./pages/JoinUs'))
const Registration = lazy(() => import('./pages/Registration'))
const Announcements = lazy(() => import('./pages/Announcements'))
const Contact = lazy(() => import('./pages/Contact'))
const VerifyMember = lazy(() => import('./pages/VerifyMember'))

// Admin — none of this should ship to public visitors.
const Login = lazy(() => import('./admin/pages/Login'))
const ResetPassword = lazy(() => import('./admin/pages/ResetPassword'))
const Dashboard = lazy(() => import('./admin/pages/Dashboard'))
const EventsPage = lazy(() => import('./admin/pages/EventsPage'))
const RegistrationsPage = lazy(() => import('./admin/pages/RegistrationsPage'))
const ApplicationsPage = lazy(() => import('./admin/pages/ApplicationsPage'))
const MembersPage = lazy(() => import('./admin/pages/MembersPage'))
const CardPrintPage = lazy(() => import('./admin/pages/CardPrintPage'))
const TasksPage = lazy(() => import('./admin/pages/TasksPage'))
const FinancePage = lazy(() => import('./admin/pages/FinancePage'))
const InventoryPage = lazy(() => import('./admin/pages/InventoryPage'))
const LabelPrintPage = lazy(() => import('./admin/pages/LabelPrintPage'))
const BorrowingPage = lazy(() => import('./admin/pages/BorrowingPage'))
const ProjectsPage = lazy(() => import('./admin/pages/ProjectsPage'))
const GalleryPage = lazy(() => import('./admin/pages/GalleryPage'))
const MessagesPage = lazy(() => import('./admin/pages/MessagesPage'))
const AnnouncementsPage = lazy(() => import('./admin/pages/AnnouncementsPage'))
const EmailPage = lazy(() => import('./admin/pages/EmailPage'))
const AdminUsersPage = lazy(() => import('./admin/pages/AdminUsersPage'))
const SettingsPage = lazy(() => import('./admin/pages/SettingsPage'))
const AIKnowledgePage = lazy(() => import('./admin/pages/AIKnowledgePage'))
const ActivityPage = lazy(() => import('./admin/pages/ActivityPage'))
const AdminNotFound = lazy(() => import('./admin/pages/NotFound'))
const ProtectedRoute = lazy(() => import('./admin/components/guards/ProtectedRoute'))
const RoleGuard = lazy(() => import('./admin/components/guards/RoleGuard'))
const Chatbot = lazy(() => import('./components/chatbot/Chatbot'))

export default function App() {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  // The visitor chatbot is for the public site; it used to float over the
  // admin console too, covering the toast area.
  const isAdmin = pathname.startsWith('/admin')

  // The chatbot (mascot avatar + framer) is ~60 KB gzip; fetch it once the
  // browser is idle so it never competes with the landing page's first paint.
  const [chatbotReady, setChatbotReady] = useState(false)
  useEffect(() => {
    const ready = () => setChatbotReady(true)
    if ('requestIdleCallback' in window) {
      const id = window.requestIdleCallback(ready, { timeout: 4000 })
      return () => window.cancelIdleCallback(id)
    }
    const id = setTimeout(ready, 2000)
    return () => clearTimeout(id)
  }, [])

  useEffect(() => {
    const hash = window.location.hash
    if (hash.includes('type=recovery') && !window.location.pathname.includes('/admin/reset-password')) {
      navigate('/admin/reset-password' + hash, { replace: true })
    }
  }, [navigate])

  return (
    <>
      <ScrollToTop />
      <Suspense fallback={null}>
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
            <Route path="finance" element={
              <RoleGuard permission="finance.manage"><FinancePage /></RoleGuard>
            } />
            <Route path="inventory" element={
              <RoleGuard permission="inventory.manage"><InventoryPage /></RoleGuard>
            } />
            <Route path="inventory/:id/label" element={
              <RoleGuard permission="inventory.manage"><LabelPrintPage /></RoleGuard>
            } />
            <Route path="inventory/labels" element={
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
            <Route path="email" element={
              <RoleGuard permission="email.send"><EmailPage /></RoleGuard>
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
      </Suspense>
      {!isAdmin && chatbotReady && (
        <Suspense fallback={null}><Chatbot /></Suspense>
      )}
    </>
  )
}
