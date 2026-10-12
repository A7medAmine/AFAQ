import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { ArrowRight, ArrowUpRight, FolderGit2 } from 'lucide-react'
import Card from '../components/shared/Card'
import SideImage from '../components/shared/SideImage'
import { GitHubIcon } from '../components/shared/SocialIcons'
import { supabase } from '../lib/supabase'
import SEO from '../components/SEO'

const spring = { type: 'spring', damping: 28, stiffness: 120 }

const categories = ['all', 'Arduino', 'Robotics', 'IoT', 'Electronics', 'Embedded Systems', 'AI']
const filterKey = (cat) => cat === 'all' ? 'all' : cat.toLowerCase().replace(/\s+/g, '_')

export default function Projects() {
  const { t, i18n } = useTranslation('projects')
  const lang = i18n.language
  const [projects, setProjects] = useState([])
  const [active, setActive] = useState('all')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase
      .from('projects')
      .select('*')
      .eq('is_published', true)
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        setProjects(data || [])
        setLoading(false)
      })
  }, [])

  const filtered = active === 'all' ? projects : projects.filter(p => p.category === active)

  const tField = (obj, field) => obj[`${field}_${lang}`] || obj[`${field}_en`] || ''

  return (
    <>
      <SEO title={t('hero.title')} description={t('hero.subtitle')} path="/projects" />
      <section className="pt-24 pb-16 md:pt-32 md:pb-20 relative overflow-hidden" style={{ background: 'var(--color-bg-alt)' }}>
        <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{
          backgroundImage: 'radial-gradient(circle at 25% 25%, var(--color-accent) 0%, transparent 50%), radial-gradient(circle at 75% 75%, var(--color-accent) 0%, transparent 50%)',
        }} />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative z-10">
          <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={spring} className="eyebrow eyebrow-center mb-4">
            {t('hero.title')}
          </motion.div>
          <motion.h1 initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ ...spring, delay: 0.1 }} className="text-4xl md:text-5xl lg:text-6xl font-bold mb-4">
            {t('hero.title')}
          </motion.h1>
          <motion.p initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ ...spring, delay: 0.2 }} className="text-lg max-w-2xl mx-auto" style={{ color: 'var(--color-text-muted)' }}>
            {t('hero.subtitle')}
          </motion.p>
        </div>
      </section>

      <section className="py-16 md:py-20 -mt-12 relative z-0">
        <SideImage side="right" />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Filter Buttons */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="flex flex-wrap justify-center gap-2 mb-12"
          >
            {categories.map(c => (
              <motion.button
                key={c}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setActive(c)}
                className={`pill ${active === c ? 'active' : ''}`}
              >
                {t(`filters.${filterKey(c)}`)}
              </motion.button>
            ))}
          </motion.div>

          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1, 2, 3, 4, 5, 6].map(i => (
                <div key={i} className="rounded-2xl" style={{ height: 360, background: 'var(--color-bg-alt)', animation: 'shimmer 1.5s ease-in-out infinite' }} />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-center py-12" style={{ color: 'var(--color-text-muted)' }}
            >
              {t('noProjects')}
            </motion.p>
          ) : (
            <motion.div layout className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <AnimatePresence mode="popLayout">
                {filtered.map((p, i) => (
                  <motion.div
                    key={p.id}
                    layout
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    transition={{ duration: 0.3, delay: i * 0.05 }}
                    className="h-full"
                  >
                    <Card className="group relative h-full flex flex-col">
                      {/* Stretched link: the whole card opens the project, while the
                          GitHub button sits above it and keeps its own target. */}
                      <Link to={`/projects/${p.id}`} className="absolute inset-0 z-[1]" aria-label={`${t('card.viewDetails')}: ${tField(p, 'title')}`} />
                      <div className="card-image-overlay relative overflow-hidden" style={{ height: 200, background: 'var(--color-bg-alt)' }}>
                        {p.thumbnail_url ? (
                          <img
                            src={p.thumbnail_url}
                            alt=""
                            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110"
                            loading="lazy"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-xs" style={{ color: 'var(--color-text-muted)' }}>
                            <FolderGit2 size={32} />
                          </div>
                        )}
                        <div className="absolute inset-0 flex items-center justify-center bg-black/50 backdrop-blur-sm opacity-0 transition-opacity duration-200 group-hover:opacity-100">
                          <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-white">
                            {t('card.viewDetails')}
                            <ArrowUpRight size={16} className="rtl:-scale-x-100" />
                          </span>
                        </div>
                        {p.category && <div className="category-tag">{p.category}</div>}
                      </div>
                      <div className="p-7 flex flex-col flex-1">
                        <h3 className="font-bold text-lg mb-2 leading-snug">{tField(p, 'title')}</h3>
                        <p className="text-sm mb-4 line-clamp-3 leading-relaxed" style={{ color: 'var(--color-text-muted)' }}>
                          {tField(p, 'description')}
                        </p>
                        <div className="flex flex-wrap gap-1.5 mb-5">
                          {(p.technologies || []).slice(0, 5).map(tch => (
                            <span key={tch} className="tech-tag">{tch}</span>
                          ))}
                          {(p.technologies || []).length > 5 && (
                            <span className="tech-tag">+{p.technologies.length - 5}</span>
                          )}
                        </div>
                        <div className="mt-auto flex items-center justify-between gap-3">
                          <span className="inline-flex items-center gap-1 text-sm font-semibold" style={{ color: 'var(--color-accent)' }}>
                            {t('card.viewDetails')}
                            <ArrowRight size={15} className="transition-transform group-hover:translate-x-1 rtl:-scale-x-100 rtl:group-hover:-translate-x-1" />
                          </span>
                          {p.github_url && (
                            <a
                              href={p.github_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="relative z-[2] inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold transition-opacity hover:opacity-85"
                              style={{ background: 'var(--color-text)', color: 'var(--color-bg)' }}
                              title={t('card.github')}
                            >
                              <GitHubIcon size={14} />
                              GitHub
                            </a>
                          )}
                        </div>
                      </div>
                    </Card>
                  </motion.div>
                ))}
              </AnimatePresence>
            </motion.div>
          )}
        </div>
      </section>
    </>
  )
}
