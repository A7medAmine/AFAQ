import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import Card from '../components/shared/Card'
import SideImage from '../components/shared/SideImage'
import { supabase } from '../lib/supabase'

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
      <section className="pt-24 pb-16 md:pt-32 md:pb-20" style={{ background: 'var(--color-bg-alt)' }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
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
          <div className="flex flex-wrap justify-center gap-2 mb-12">
            {categories.map(c => (
              <button key={c} onClick={() => setActive(c)} className={`pill ${active === c ? 'active' : ''}`}>
                {t(`filters.${filterKey(c)}`)}
              </button>
            ))}
          </div>

          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1, 2, 3].map(i => (
                <div key={i} className="rounded-2xl" style={{ height: 360, background: 'var(--color-bg-alt)', animation: 'shimmer 1.5s ease-in-out infinite' }} />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <p className="text-center py-12" style={{ color: 'var(--color-text-muted)' }}>
              {t('noProjects')}
            </p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filtered.map((p, i) => (
                <Card key={p.id} delay={i * 0.07}>
                  <div className="card-image-overlay relative" style={{ height: 200, background: 'var(--color-bg-alt)' }}>
                    {p.thumbnail_url ? (
                      <img src={p.thumbnail_url} alt="" className="w-full h-full object-cover" loading="lazy" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-xs" style={{ color: 'var(--color-text-muted)' }}>No image</div>
                    )}
                    <div className="category-tag">{p.category}</div>
                  </div>
                  <div className="p-7">
                    <h3 className="font-bold text-lg mb-2 leading-snug">{tField(p, 'title')}</h3>
                    <p className="text-sm mb-4 line-clamp-2 leading-relaxed" style={{ color: 'var(--color-text-muted)' }}>
                      {tField(p, 'description')}
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {(p.technologies || []).map(tch => (
                        <span key={tch} className="tech-tag">{tch}</span>
                      ))}
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      </section>
    </>
  )
}
