import { motion } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import Logo from '../shared/Logo'
import SocialIcons from '../shared/SocialIcons'
import { Mail, MapPin } from 'lucide-react'

const spring = { type: 'spring', damping: 28, stiffness: 120 }

export default function Footer() {
  const { t } = useTranslation()

  const navItems = ['about', 'projects', 'events', 'gallery', 'contact']

  return (
    <footer
      className="border-t"
      style={{
        background: 'var(--color-card)',
        borderColor: 'var(--color-border-light)',
      }}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14 md:py-20">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-30px' }}
            transition={spring}
            className="md:col-span-5"
          >
            <Link to="/" className="flex items-center gap-3 mb-4 group">
              <Logo size={40} />
              <div>
                <div
                  className="text-lg tracking-tight"
                  style={{ fontFamily: "'DM Sans', 'Inter', sans-serif", fontWeight: 700 }}
                >
                  AFAQ
                </div>
                <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: -2 }}>
                  Scientific Club
                </div>
              </div>
            </Link>
            <p
              className="text-sm leading-relaxed max-w-md mb-6"
              style={{ color: 'var(--color-text-muted)' }}
            >
              {t('footer.description')}
            </p>
            <SocialIcons />
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-30px' }}
            transition={{ ...spring, delay: 0.1 }}
            className="md:col-span-3 md:pl-4"
          >
            <h3
              className="text-xs font-semibold tracking-widest uppercase mb-5"
              style={{ color: 'var(--color-text-muted)', fontFamily: "'Inter', sans-serif" }}
            >
              {t('footer.quickLinks')}
            </h3>
            <div className="flex flex-col gap-2.5">
              {navItems.map(k => (
                <Link
                  key={k}
                  to={`/${k === 'about' ? 'about' : k}`}
                  className="text-sm transition-colors"
                  style={{ color: 'var(--color-text)' }}
                >
                  {t(`nav.${k}`)}
                </Link>
              ))}
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-30px' }}
            transition={{ ...spring, delay: 0.2 }}
            className="md:col-span-4"
          >
            <h3
              className="text-xs font-semibold tracking-widest uppercase mb-5"
              style={{ color: 'var(--color-text-muted)', fontFamily: "'Inter', sans-serif" }}
            >
              {t('footer.connect')}
            </h3>
            <div className="flex flex-col gap-3.5">
              <a
                href="mailto:afaqclub.bouira@gmail.com"
                className="flex items-center gap-3 text-sm transition-colors"
                style={{ color: 'var(--color-text)' }}
              >
                <Mail size={14} style={{ color: 'var(--color-accent)' }} />
                afaqclub.bouira@gmail.com
              </a>
              <div
                className="flex items-center gap-3 text-sm"
                style={{ color: 'var(--color-text)' }}
              >
                <MapPin size={14} style={{ color: 'var(--color-accent)' }} />
                Bouira, Algeria
              </div>
            </div>
          </motion.div>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-30px' }}
          transition={{ ...spring, delay: 0.3 }}
          className="mt-12 pt-6 flex flex-col sm:flex-row items-center justify-between gap-4"
          style={{ borderTop: '1px solid var(--color-border-light)' }}
        >
          <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
            &copy; {new Date().getFullYear()} AFAQ Scientific Club. {t('footer.rights')}
          </p>
          <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
            {t('footer.university')}
          </p>
        </motion.div>
      </div>
    </footer>
  )
}
