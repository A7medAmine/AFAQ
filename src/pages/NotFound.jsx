import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import { Compass, ArrowLeft } from 'lucide-react'
import SEO from '../components/SEO'

const spring = { type: 'spring', damping: 28, stiffness: 120 }

export default function NotFound() {
  const { t, i18n } = useTranslation('common')
  const rtl = i18n.language?.startsWith('ar')

  return (
    <>
      <SEO title={t('notFound.title')} description={t('notFound.description')} noindex />
      <section className="min-h-[70vh] flex items-center pt-28 pb-20" style={{ background: 'var(--color-bg-alt)' }}>
        <div className="max-w-2xl mx-auto px-4 sm:px-6 text-center">
          <motion.div
            initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={spring}
            className="inline-flex items-center justify-center w-16 h-16 rounded-full mb-6"
            style={{ background: 'var(--color-accent-soft)', color: 'var(--color-accent)' }}
          >
            <Compass size={30} aria-hidden="true" />
          </motion.div>
          <motion.div
            initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ ...spring, delay: 0.05 }}
            className="eyebrow eyebrow-center mb-4"
          >
            404
          </motion.div>
          <motion.h1
            initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ ...spring, delay: 0.1 }}
            className="text-3xl md:text-5xl font-bold mb-4"
          >
            {t('notFound.title')}
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ ...spring, delay: 0.2 }}
            className="text-lg mb-10" style={{ color: 'var(--color-text-muted)' }}
          >
            {t('notFound.description')}
          </motion.p>
          <motion.div
            initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ ...spring, delay: 0.3 }}
            className="flex flex-wrap items-center justify-center gap-3"
          >
            <Link
              to="/"
              className="inline-flex items-center gap-2 px-7 py-3 rounded-[100px] font-semibold transition-colors duration-200"
              style={{ background: 'var(--color-accent)', color: '#fff' }}
            >
              <ArrowLeft size={18} aria-hidden="true" style={rtl ? { transform: 'scaleX(-1)' } : undefined} />
              {t('notFound.home')}
            </Link>
            <Link
              to="/contact"
              className="inline-flex items-center gap-2 px-7 py-3 rounded-[100px] font-semibold border transition-colors duration-200"
              style={{ borderColor: 'var(--color-border)', color: 'var(--color-text)' }}
            >
              {t('notFound.contact')}
            </Link>
          </motion.div>
        </div>
      </section>
    </>
  )
}
