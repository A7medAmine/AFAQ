import { useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { ArrowRight, BookOpen, CalendarDays, Clock, Search } from 'lucide-react'
import Card from '../components/shared/Card'
import SideImage from '../components/shared/SideImage'
import { supabase } from '../lib/supabase'
import SEO from '../components/SEO'
import { readingMinutes } from '../components/markdown/plugins'

const spring = { type: 'spring', damping: 28, stiffness: 120 }
const LEVELS = ['beginner', 'intermediate', 'advanced']

export default function Learn() {
  const { t, i18n } = useTranslation('learn')
  const lang = i18n.language?.slice(0, 2) || 'en'
  const [tutorials, setTutorials] = useState([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [level, setLevel] = useState('all')
  const [tag, setTag] = useState('all')

  useEffect(() => {
    supabase
      .from('tutorials')
      .select('id, slug, title, summary, content, cover_url, level, tags, published_at, event:events(id, title_en, title_ar, title_fr, date)')
      .eq('is_published', true)
      .order('published_at', { ascending: false })
      .then(({ data }) => {
        setTutorials((data || []).map(({ content, ...rest }) => ({ ...rest, minutes: readingMinutes(content) })))
        setLoading(false)
      })
  }, [])

  // The most used topics first, capped so the row stays one or two lines.
  const tags = useMemo(() => {
    const counts = new Map()
    for (const tut of tutorials) for (const tg of tut.tags || []) counts.set(tg, (counts.get(tg) || 0) + 1)
    return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, 12).map(([tg]) => tg)
  }, [tutorials])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return tutorials.filter(tut =>
      (level === 'all' || tut.level === level)
      && (tag === 'all' || (tut.tags || []).includes(tag))
      && (!q || [tut.title, tut.summary, ...(tut.tags || [])].some(v => v?.toLowerCase().includes(q)))
    )
  }, [tutorials, query, level, tag])

  const eventTitle = e => e?.[`title_${lang}`] || e?.title_en || ''
  const dateFmt = d => new Intl.DateTimeFormat(lang === 'ar' ? 'ar-DZ' : lang, { day: 'numeric', month: 'short', year: 'numeric' })
    .format(new Date(`${d}T00:00:00`))

  return (
    <>
      <SEO title={t('hero.title')} description={t('hero.subtitle')} path="/learn" />
      <section className="pt-24 pb-16 md:pt-32 md:pb-20 relative overflow-hidden" style={{ background: 'var(--color-bg-alt)' }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative z-10">
          <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={spring} className="eyebrow eyebrow-center mb-4">
            {t('hero.eyebrow')}
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
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="mb-10 space-y-4">
            <label className="relative block max-w-md mx-auto">
              <span className="sr-only">{t('search')}</span>
              <Search size={17} className="absolute top-1/2 -translate-y-1/2 start-4 pointer-events-none" style={{ color: 'var(--color-text-muted)' }} />
              <input
                type="search"
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder={t('search')}
                className="w-full rounded-2xl py-3 ps-11 pe-4 text-sm outline-none focus:ring-2"
                style={{ background: 'var(--color-card)', border: '2px solid var(--color-border-light)', color: 'var(--color-text)', '--tw-ring-color': 'var(--color-accent)' }}
              />
            </label>
            <div className="flex flex-wrap justify-center gap-2">
              {['all', ...LEVELS].map(l => (
                <button key={l} onClick={() => setLevel(l)} className={`pill ${level === l ? 'active' : ''}`}>
                  {l === 'all' ? t('all') : t(`levels.${l}`)}
                </button>
              ))}
            </div>
            {tags.length > 1 && (
              <div className="flex flex-wrap justify-center gap-1.5">
                {['all', ...tags].map(tg => (
                  <button
                    key={tg}
                    onClick={() => setTag(tg)}
                    className="tech-tag transition-opacity"
                    style={tag === tg ? { background: 'var(--color-accent)', color: '#fff' } : { opacity: tag === 'all' ? 1 : 0.75 }}
                    aria-pressed={tag === tg}
                  >
                    {tg === 'all' ? t('allTags') : `#${tg}`}
                  </button>
                ))}
              </div>
            )}
          </motion.div>

          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1, 2, 3].map(i => (
                <div key={i} className="rounded-2xl" style={{ height: 360, background: 'var(--color-bg-alt)', animation: 'shimmer 1.5s ease-in-out infinite' }} />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <p className="text-center py-12" style={{ color: 'var(--color-text-muted)' }}>
              {tutorials.length ? t('noMatch') : t('empty')}
            </p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filtered.map((tut, i) => (
                <Card key={tut.id} delay={Math.min(i, 6) * 0.06} className="group relative h-full flex flex-col">
                  <Link to={`/learn/${tut.slug}`} className="absolute inset-0 z-[1]" aria-label={`${t('read')}: ${tut.title}`} />
                  <div className="card-image-overlay relative overflow-hidden" style={{ aspectRatio: '16/9', background: 'var(--color-bg-alt)' }}>
                    {tut.cover_url ? (
                      <img src={tut.cover_url} alt="" loading="lazy" className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center" style={{ color: 'var(--color-text-muted)' }}><BookOpen size={32} /></div>
                    )}
                    <div className="category-tag">{t(`levels.${tut.level}`)}</div>
                  </div>
                  <div className="p-7 flex flex-col flex-1" dir="ltr" lang="en">
                    <h2 className="font-bold text-lg mb-2 leading-snug">{tut.title}</h2>
                    {tut.summary && (
                      <p className="text-sm mb-4 line-clamp-3 leading-relaxed" style={{ color: 'var(--color-text-muted)' }}>{tut.summary}</p>
                    )}
                    {(tut.tags || []).length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mb-5">
                        {tut.tags.slice(0, 4).map(tg => <span key={tg} className="tech-tag">#{tg}</span>)}
                      </div>
                    )}
                    <div className="mt-auto flex flex-wrap items-center justify-between gap-3 text-xs" style={{ color: 'var(--color-text-muted)' }}>
                      <span className="inline-flex items-center gap-1.5">
                        <Clock size={13} /> {t('minRead', { count: tut.minutes })}
                      </span>
                      {tut.event && (
                        <span className="inline-flex items-center gap-1.5" dir="auto">
                          <CalendarDays size={13} /> {t('workshop')} · {dateFmt(tut.event.date)}
                        </span>
                      )}
                    </div>
                    <span className="mt-4 inline-flex items-center gap-1 text-sm font-semibold" style={{ color: 'var(--color-accent)' }}>
                      {t('read')}
                      <ArrowRight size={15} className="transition-transform group-hover:translate-x-1" />
                    </span>
                    {tut.event && <span className="sr-only">{eventTitle(tut.event)}</span>}
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
