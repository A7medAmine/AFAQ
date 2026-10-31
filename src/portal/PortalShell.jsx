import { Navigate, NavLink, Outlet, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Bell, CalendarDays, Home, KeyRound, ListChecks, Loader2, LogOut, Trophy, UserRound } from 'lucide-react'
import SEO from '../components/SEO'
import { displayName, usePortal } from './lib/portal'
import PasswordForm from './PasswordForm'
import CopyCode from './CopyCode'
import './portal.css'

const TABS = [
  { key: 'home', path: '/portal', icon: Home, end: true },
  { key: 'points', path: '/portal/points', icon: Trophy },
  { key: 'events', path: '/portal/events', icon: CalendarDays },
  { key: 'tasks', path: '/portal/tasks', icon: ListChecks },
  { key: 'notices', path: '/portal/notices', icon: Bell },
  { key: 'profile', path: '/portal/profile', icon: UserRound },
]

export function PortalLoading() {
  return (
    <div className="portal-page flex items-center justify-center" style={{ minHeight: '60vh' }}>
      <Loader2 size={28} className="animate-spin" style={{ color: 'var(--color-text-muted)' }} />
    </div>
  )
}

/** After a temporary password, nothing else opens until the member picks their own. */
function ForcedPasswordChange() {
  const { t } = useTranslation('portal')
  const { me, refresh, signOut } = usePortal()
  return (
    <div className="portal-page">
      <SEO title={t('setPassword.title')} path="/portal" noindex />
      <div className="max-w-md mx-auto px-4">
        <div className="text-center mb-8">
          <KeyRound size={32} className="mx-auto mb-3" style={{ color: 'var(--color-accent)' }} />
          <h1 className="text-3xl font-bold mb-2">{t('hello', { name: displayName(me) })}</h1>
          <p className="text-sm portal-muted">{t('setPassword.temporary')}</p>
        </div>
        <div className="portal-card" style={{ padding: '1.75rem' }}>
          <PasswordForm submitLabel={t('setPassword.submit')} onDone={refresh} />
        </div>
        <p className="text-center mt-4">
          <button type="button" onClick={signOut} className="text-sm portal-muted inline-flex items-center gap-1.5">
            <LogOut size={14} /> {t('signOut')}
          </button>
        </p>
      </div>
    </div>
  )
}

/** Signed-in frame for every portal screen: greeting, tabs, sign out. */
export default function PortalShell() {
  const { t } = useTranslation('portal')
  const { me, signOut } = usePortal()
  const { pathname } = useLocation()

  if (me === undefined) return <PortalLoading />
  if (!me) return <Navigate to="/portal/login" replace state={{ from: pathname }} />
  if (me.must_change_password) return <ForcedPasswordChange />


  return (
    <div className="portal-page">
      <SEO title={t('title')} path="/portal" noindex />
      <div className="max-w-5xl mx-auto px-4 sm:px-6">
        <div className="flex flex-wrap items-end justify-between gap-4 mb-6">
          <div className="min-w-0">
            <div className="eyebrow mb-2">{t('title')}</div>
            <h1 className="text-2xl md:text-3xl font-bold truncate">{t('hello', { name: displayName(me) })}</h1>
            <p className="text-sm mt-1 portal-muted">
              <CopyCode code={me.member_code} />
              {me.departments.length > 0 && <> · {me.departments.map(d => d.name).join(', ')}</>}
            </p>
          </div>
          <button type="button" onClick={signOut} className="portal-btn">
            <LogOut size={15} /> {t('signOut')}
          </button>
        </div>

        <nav className="portal-tabs mb-8" aria-label={t('title')}>
          {TABS.map(tab => (
            <NavLink key={tab.key} to={tab.path} end={tab.end} className={({ isActive }) => `portal-tab ${isActive ? 'active' : ''}`}>
              <tab.icon size={15} /> <span>{t(`tabs.${tab.key}`)}</span>
            </NavLink>
          ))}
        </nav>

        <Outlet />
      </div>
    </div>
  )
}
