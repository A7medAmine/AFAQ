import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { ChevronRight, Users } from 'lucide-react'
import Card from '../shared/Card'
import SideImage from '../shared/SideImage'
import { supabase } from '../../lib/supabase'

const spring = { type: 'spring', damping: 28, stiffness: 120 }

export default function ProjectHighlights() {
  const { t, i18n } = useTranslation('home')
  const lang = i18n.language
  const [projects, setProjects] = useState([])

  useEffect(() => {
    supabase
      .from('projects')
      .select('*')
      .eq('is_published', true)
      .order('created_at', { ascending: false })
      .limit(3)
      .then(({ data }) => setProjects(data || []))
  }, [])

  const tField = (obj, field) => obj[`${field}_${lang}`] || obj[`${field}_en`] || ''

  if (projects.length === 0) return null

  return (
    <section className="py-16 md:py-20 relative z-0" style={{ background: 'var(--color-bg)' }}>
      <SideImage side="right" />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <div className="eyebrow eyebrow-center mb-4">{t('projects.title')}</div>
          <h2 className="text-3xl md:text-4xl font-bold">{t('projects.title')}</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {projects.map((p, i) => (
            <Card key={p.id} delay={i * 0.08}>
              <div className="card-image-overlay relative" style={{ height: 200, background: 'var(--color-bg-alt)' }}>
                {p.thumbnail_url ? (
                  <img src={p.thumbnail_url} alt="" className="w-full h-full object-cover" loading="lazy" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-xs" style={{ color: 'var(--color-text-muted)' }}>No image</div>
                )}
                <div className="category-tag">{p.category}</div>
              </div>
              <div className="p-7">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs flex items-center gap-1.5" style={{ color: 'var(--color-text-muted)' }}>
                    <Users size={12} /> {p.team_members || 0} {t('projects:card.members')}
                  </span>
                </div>
                <h3 className="font-bold text-lg mb-2 leading-snug" style={{ fontFamily: "'Minecraft', sans-serif", fontWeight: 700 }}>
                  {tField(p, 'title')}
                </h3>
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

        <motion.div initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: '-30px' }} transition={spring} className="text-center mt-10">
          <Link to="/projects" className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl font-semibold text-sm transition-all duration-200"
            style={{ background: '#fff', color: '#0F172A', border: '2px solid #0F172A' }}>
            {t('projects.viewAll')} <ChevronRight size={15} />
          </Link>
        </motion.div>
      </div>
    </section>
  )
}
