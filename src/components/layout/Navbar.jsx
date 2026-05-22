import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Link, NavLink, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Menu, X } from 'lucide-react'
import LanguageSwitcher from '../shared/LanguageSwitcher'
import Logo from '../shared/Logo'

const sidebarSpring = { type: 'spring', damping: 28, stiffness: 200 }
const linkVariants = {
  hidden: { opacity: 0, x: 20 },
  visible: (i) => ({ opacity: 1, x: 0, transition: { ...sidebarSpring, delay: 0.1 + i * 0.04 } }),
}

const navLinks = [
  { key: 'home', path: '/' },
  { key: 'about', path: '/about' },
  { key: 'projects', path: '/projects' },
  { key: 'events', path: '/events' },
  { key: 'gallery', path: '/gallery' },
  { key: 'contact', path: '/contact' },
]

export default function Navbar() {
  const { t } = useTranslation()
  const { pathname } = useLocation()
  const [scrolled, setScrolled] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 30)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    setMobileOpen(false)
  }, [pathname])

  const linkClass = ({ isActive }) =>
    `nav-link ${isActive ? 'active' : ''}`

  return (
    <header
      className="fixed top-0 left-0 right-0 z-50 transition-all duration-300 bg-white"
      style={{
        borderBottom: '1px solid #E2E8F0',
        backdropFilter: scrolled ? 'blur(16px)' : 'none',
        boxShadow: scrolled ? '0 2px 20px rgba(0,0,0,0.04)' : 'none',
      }}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 md:h-20">
          <Link to="/" className="flex items-center gap-2.5 group">
            <div className="transition-transform duration-300 group-hover:scale-105">
              <Logo size={36} />
            </div>
            <span
              className="font-bold text-base tracking-tight text-slate-800"
              style={{ fontFamily: "'Minecraft', sans-serif", fontWeight: 700 }}
            >
              AFAQ
            </span>
          </Link>

          <nav className="hidden md:flex items-center gap-0">
            {navLinks.map(l => (
              <NavLink key={l.key} to={l.path} className={linkClass}>
                {t(`nav.${l.key}`)}
              </NavLink>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            <LanguageSwitcher />
            <Link
              to="/register"
              className="hidden md:inline-flex items-center px-6 py-2.5 rounded-2xl font-semibold text-sm transition-all duration-200 bg-[#0F172A] text-white hover:bg-blue-700"
            >
              {t('nav.register')}
            </Link>
            <button
              className="md:hidden w-10 h-10 rounded-xl flex items-center justify-center transition-colors bg-slate-100 border border-slate-200 text-slate-500"
              onClick={() => setMobileOpen(true)}
              aria-label="Open menu"
            >
              <Menu size={18} />
            </button>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 z-40 md:hidden"
              style={{ background: 'rgba(0,0,0,0.5)' }}
              onClick={() => setMobileOpen(false)}
            />
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={sidebarSpring}
              className="fixed top-0 right-0 h-full z-50 shadow-2xl md:hidden"
              style={{
                width: 280,
                background: 'var(--color-card)',
                borderLeft: '1px solid var(--color-border-light)',
              }}
            >
              <div className="flex items-center justify-between p-4" style={{ borderBottom: '1px solid var(--color-border-light)' }}>
                <motion.div
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ ...sidebarSpring, delay: 0.05 }}
                  className="flex items-center gap-2"
                >
                  <Logo size={32} />
                  <span style={{ fontFamily: "'Minecraft', sans-serif", fontWeight: 700, fontSize: 16 }}>AFAQ</span>
                </motion.div>
                <motion.button
                  initial={{ opacity: 0, rotate: -90 }}
                  animate={{ opacity: 1, rotate: 0 }}
                  transition={{ ...sidebarSpring, delay: 0.08 }}
                  className="w-9 h-9 rounded-lg flex items-center justify-center transition-colors hover:bg-black/5"
                  style={{ color: 'var(--color-text-muted)' }}
                  onClick={() => setMobileOpen(false)}
                  aria-label="Close menu"
                >
                  <X size={18} />
                </motion.button>
              </div>
              <nav className="flex flex-col p-4 gap-1">
                {navLinks.map((l, i) => (
                  <motion.div
                    key={l.key}
                    custom={i}
                    variants={linkVariants}
                    initial="hidden"
                    animate="visible"
                  >
                    <NavLink
                      to={l.path}
                      className={({ isActive }) =>
                        `block px-4 py-3 rounded-xl text-sm font-medium transition-colors`
                      }
                      style={({ isActive }) => ({
                        color: isActive ? 'var(--color-accent)' : 'var(--color-text-muted)',
                        background: isActive ? 'var(--color-accent-soft)' : 'transparent',
                      })}
                    >
                      {t(`nav.${l.key}`)}
                    </NavLink>
                  </motion.div>
                ))}
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ ...sidebarSpring, delay: 0.35 }}
                  className="mt-4 pt-4"
                  style={{ borderTop: '1px solid var(--color-border-light)' }}
                >
                  <Link
                    to="/register"
                    className="block w-full text-center px-4 py-3 rounded-2xl font-semibold text-sm transition-all bg-[#0F172A] text-white"
                  >
                    {t('nav.register')}
                  </Link>
                </motion.div>
              </nav>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </header>
  )
}
