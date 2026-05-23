import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import { Pin } from 'lucide-react'
import { supabase } from '../lib/supabase'
import SideImage from '../components/shared/SideImage'

const spring = { type: 'spring', damping: 28, stiffness: 120 }
const stagger = { animate: { transition: { staggerChildren: 0.06 } } }
const fadeUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.5, ease: 'easeOut' } },
}

export default function Announcements() {
  const { t, i18n } = useTranslation('announcements')
  const [announcements, setAnnouncements] = useState([])
  const [loading, setLoading] = useState(true)
  const lang = i18n.language

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from('announcements')
        .select('*')
        .eq('is_published', true)
        .order('is_pinned', { ascending: false })
        .order('created_at', { ascending: false })
      setAnnouncements(data || [])
      setLoading(false)
    }
    load()
  }, [])

  return (
    <motion.div initial="initial" animate="animate">
      <section className="pt-24 pb-16 md:pt-32 md:pb-20" style={{ background: 'var(--color-bg-alt)' }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={spring} className="eyebrow eyebrow-center mb-4">
            {t('title')}
          </motion.div>
          <motion.h1 initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ ...spring, delay: 0.1 }} className="text-4xl md:text-5xl lg:text-6xl font-bold mb-4">
            {t('title')}
          </motion.h1>
          <motion.p initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ ...spring, delay: 0.2 }} className="text-lg max-w-2xl mx-auto" style={{ color: 'var(--color-text-muted)' }}>
            {t('subtitle')}
          </motion.p>
        </div>
      </section>

      <section className="py-16 md:py-20 -mt-12 relative z-0">
        <SideImage side="right" />
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          {loading ? (
            <div className="space-y-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-28 rounded-2xl animate-pulse" style={{ background: 'var(--color-skeleton)' }} />
              ))}
            </div>
          ) : announcements.length === 0 ? (
            <motion.div variants={fadeUp} className="text-center py-20">
              <p className="text-lg" style={{ color: 'var(--color-text-muted)' }}>{t('empty')}</p>
            </motion.div>
          ) : (
            <motion.div variants={stagger} className="space-y-4">
              {announcements.map(a => {
                const title = a[`title_${lang}`] || a.title_en
                const content = a[`content_${lang}`] || a.content_en
                return (
                  <motion.div
                    key={a.id}
                    variants={fadeUp}
                    className="rounded-2xl border p-6 transition-shadow hover:shadow-md"
                    style={{
                      background: 'var(--color-card)',
                      borderColor: a.is_pinned ? 'var(--color-accent)' : 'var(--color-border-light)',
                    }}
                  >
                    <div className="flex items-start gap-3">
                      {a.is_pinned && (
                        <div className="mt-0.5 shrink-0">
                          <Pin size={16} style={{ color: 'var(--color-accent)' }} />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <h2 className="text-lg font-semibold mb-2" style={{ color: 'var(--color-text)' }}>{title}</h2>
                        <p className="text-sm leading-relaxed whitespace-pre-line" style={{ color: 'var(--color-text-muted)' }}>{content}</p>
                        <p className="text-xs mt-3" style={{ color: 'var(--color-text-muted)' }}>
                          {new Date(a.created_at).toLocaleDateString(lang === 'ar' ? 'ar-SA' : lang === 'fr' ? 'fr-FR' : 'en-US', {
                            year: 'numeric', month: 'long', day: 'numeric',
                          })}
                        </p>
                      </div>
                    </div>
                  </motion.div>
                )
              })}
            </motion.div>
          )}
        </div>
      </section>
    </motion.div>
  )
}
