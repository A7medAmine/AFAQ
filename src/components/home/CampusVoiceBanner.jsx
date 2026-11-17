import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { ArrowRight, Megaphone } from 'lucide-react'
import { STUDENT_VOICE_PATH, eventEnd, loadStudentVoice } from '../../lib/campusVoice'

const WEEK = 7 * 24 * 60 * 60 * 1000

// On the home page while the admin keeps it switched on, until a week after
// the event. Without a date it stays up as long as it is switched on.
const visible = settings => {
  if (!settings?.show_on_home) return false
  const end = eventEnd(settings)
  return !end || Date.now() < end.getTime() + WEEK
}

export default function CampusVoiceBanner() {
  const { t } = useTranslation('campus')
  const [show, setShow] = useState(false)
  useEffect(() => {
    let cancelled = false
    loadStudentVoice()
      .then(({ settings, problems }) => { if (!cancelled) setShow(visible(settings) && problems.length > 0) })
      .catch(() => {})
    return () => { cancelled = true }
  }, [])
  if (!show) return null
  return (
    <section className="pt-12 md:pt-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="flex flex-col sm:flex-row items-start sm:items-center gap-4 rounded-2xl p-5 md:p-6"
          style={{ background: 'var(--color-card)', border: '2px solid var(--color-accent)' }}
        >
          <span className="inline-flex items-center justify-center w-11 h-11 rounded-xl shrink-0"
            style={{ background: 'var(--color-accent)', color: '#fff' }}>
            <Megaphone size={20} />
          </span>
          <div className="flex-1">
            <div className="font-bold mb-0.5">{t('title')}</div>
            <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>{t('banner.text')}</p>
          </div>
          <Link to={STUDENT_VOICE_PATH}
            className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-[100px] font-semibold text-sm shrink-0 transition-opacity hover:opacity-85"
            style={{ background: 'var(--color-accent)', color: '#fff' }}>
            {t('banner.cta')} <ArrowRight size={15} className="rtl:rotate-180" />
          </Link>
        </motion.div>
      </div>
    </section>
  )
}
