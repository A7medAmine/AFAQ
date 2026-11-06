import { useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import {
  ArrowLeft, ArrowUpRight, BookOpen, CalendarDays, Check, Clock, Download, FileCode2, FileText, Languages, Link2,
  ListTree, MapPin, Presentation, Share2, SquareCheck, CirclePlay,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import SEO, { SITE_URL } from '../components/SEO'
import Markdown from '../components/markdown/Markdown'
import { readingMinutes } from '../components/markdown/plugins'

const spring = { type: 'spring', damping: 28, stiffness: 120 }
const KIND_ICONS = { link: Link2, code: FileCode2, slides: Presentation, download: Download, video: CirclePlay, doc: FileText }

export default function TutorialDetail() {
  const { slug } = useParams()
  const { t, i18n } = useTranslation('learn')
  const lang = i18n.language?.slice(0, 2) || 'en'
  const [tutorial, setTutorial] = useState(null)
  const [others, setOthers] = useState([])
  const [loading, setLoading] = useState(true)
  const [toc, setToc] = useState([])
  const [shared, setShared] = useState(false)
  const articleRef = useRef(null)
  // Ticks on the "before you start" list stay on this device between visits.
  const storeKey = `afaq-learn-ticks:${slug}`
  const [ticked, setTicked] = useState(() => new Set())

  useEffect(() => {
    try { setTicked(new Set(JSON.parse(localStorage.getItem(storeKey) || '[]'))) } catch { setTicked(new Set()) }
  }, [storeKey])

  const toggleNeed = item => setTicked(prev => {
    const next = new Set(prev)
    if (next.has(item)) next.delete(item)
    else next.add(item)
    try { localStorage.setItem(storeKey, JSON.stringify([...next])) } catch { /* private mode */ }
    return next
  })

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    const load = async () => {
      const { data } = await supabase
        .from('tutorials')
        .select('*, event:events(id, title_en, title_ar, title_fr, date, time, location_en, location_ar, location_fr, is_published)')
        .eq('slug', slug)
        .eq('is_published', true)
        .maybeSingle()
      if (cancelled) return
      setTutorial(data || null)
      setLoading(false)
      if (!data) return
      const { data: rest } = await supabase
        .from('tutorials')
        .select('id, slug, title, level, tags, cover_url')
        .eq('is_published', true)
        .neq('id', data.id)
        .order('published_at', { ascending: false })
        .limit(12)
      if (cancelled) return
      // Shared tags first, then the newest of the rest.
      const mine = new Set(data.tags || [])
      const score = r => (r.tags || []).filter(tg => mine.has(tg)).length
      setOthers([...(rest || [])].sort((a, b) => score(b) - score(a)).slice(0, 3))
    }
    load()
    return () => { cancelled = true }
  }, [slug])

  // The contents list reads the rendered headings, so its links always match their ids.
  useEffect(() => {
    if (!tutorial || !articleRef.current) { setToc([]); return }
    const items = [...articleRef.current.querySelectorAll('.md-doc h2[id], .md-doc h3[id]')]
      .map(h => ({ id: h.id, text: h.textContent, depth: h.tagName === 'H3' ? 3 : 2 }))
    setToc(items)
  }, [tutorial])

  const share = async () => {
    const url = `${SITE_URL}/learn/${tutorial.slug}`
    try {
      if (navigator.share) await navigator.share({ title: tutorial.title, url })
      else { await navigator.clipboard.writeText(url); setShared(true); setTimeout(() => setShared(false), 1800) }
    } catch { /* closed the share sheet */ }
  }

  if (loading) {
    return (
      <section className="pt-28 pb-20 md:pt-36">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
          <div className="h-5 w-32 rounded-lg" style={{ background: 'var(--color-bg-alt)', animation: 'shimmer 1.5s ease-in-out infinite' }} />
          <div className="h-12 w-2/3 rounded-xl" style={{ background: 'var(--color-bg-alt)', animation: 'shimmer 1.5s ease-in-out infinite' }} />
          <div className="rounded-3xl" style={{ height: 420, background: 'var(--color-bg-alt)', animation: 'shimmer 1.5s ease-in-out infinite' }} />
        </div>
      </section>
    )
  }

  if (!tutorial) {
    return (
      <section className="pt-32 pb-24 md:pt-40">
        <SEO title={t('detail.notFound')} path={`/learn/${slug}`} noindex />
        <div className="max-w-xl mx-auto px-4 text-center">
          <BookOpen size={40} className="mx-auto mb-4" style={{ color: 'var(--color-text-muted)' }} />
          <h1 className="text-3xl font-bold mb-3">{t('detail.notFound')}</h1>
          <p className="mb-8" style={{ color: 'var(--color-text-muted)' }}>{t('detail.notFoundBody')}</p>
          <BackLink label={t('detail.back')} />
        </div>
      </section>
    )
  }

  const minutes = readingMinutes(tutorial.content)
  const tags = tutorial.tags || []
  const resources = (Array.isArray(tutorial.resources) ? tutorial.resources : []).filter(r => /^https?:\/\//i.test(r?.url || ''))
  const needs = (tutorial.requirements || '').split('\n').map(s => s.replace(/^\s*(?:[-*]\s*(?:\[[ xX]\]\s*)?)?/, '').trim()).filter(Boolean)
  const event = tutorial.event?.is_published ? tutorial.event : null
  const localized = (obj, field) => obj?.[`${field}_${lang}`] || obj?.[`${field}_en`] || ''
  const dateFmt = (d, opts = { year: 'numeric', month: 'long', day: 'numeric' }) =>
    new Intl.DateTimeFormat(lang === 'ar' ? 'ar-DZ' : lang, opts).format(new Date(d))
  const published = tutorial.published_at ? dateFmt(tutorial.published_at) : null

  return (
    <>
      <SEO
        title={tutorial.title}
        description={(tutorial.summary || '').slice(0, 200)}
        path={`/learn/${tutorial.slug}`}
        image={tutorial.cover_url || undefined}
        type="article"
        jsonLd={{
          '@context': 'https://schema.org',
          '@type': 'TechArticle',
          headline: tutorial.title,
          description: tutorial.summary || undefined,
          image: tutorial.cover_url || undefined,
          url: `${SITE_URL}/learn/${tutorial.slug}`,
          inLanguage: 'en',
          keywords: tags.join(', ') || undefined,
          proficiencyLevel: tutorial.level,
          datePublished: tutorial.published_at || undefined,
          dateModified: tutorial.updated_at || undefined,
          author: { '@type': 'Organization', name: 'AFAQ Scientific Club', url: SITE_URL },
          publisher: { '@type': 'Organization', name: 'AFAQ Scientific Club', url: SITE_URL },
        }}
      />

      <section className="pt-24 pb-10 md:pt-32 md:pb-14 relative overflow-hidden" style={{ background: 'var(--color-bg-alt)' }}>
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={spring}>
            <BackLink label={t('detail.back')} />
          </motion.div>
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ ...spring, delay: 0.05 }} className="eyebrow mt-8 mb-4">
            {t(`levels.${tutorial.level}`)}
          </motion.div>
          <div dir="ltr" lang="en">
            <motion.h1 initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ ...spring, delay: 0.1 }} className="text-4xl md:text-5xl font-bold mb-5 max-w-4xl text-start">
              {tutorial.title}
            </motion.h1>
            {tutorial.summary && (
              <motion.p initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ ...spring, delay: 0.15 }} className="text-lg max-w-3xl leading-relaxed text-start" style={{ color: 'var(--color-text-muted)' }}>
                {tutorial.summary}
              </motion.p>
            )}
          </div>
          <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ ...spring, delay: 0.2 }} className="flex flex-wrap items-center gap-x-5 gap-y-2 mt-6 text-sm" style={{ color: 'var(--color-text-muted)' }}>
            <span className="inline-flex items-center gap-1.5"><Clock size={15} /> {t('minRead', { count: minutes })}</span>
            {published && <span className="inline-flex items-center gap-1.5"><CalendarDays size={15} /> {t('detail.published')} {published}</span>}
            {lang !== 'en' && <span className="inline-flex items-center gap-1.5"><Languages size={15} /> {t('detail.englishOnly')}</span>}
            <button type="button" onClick={share} className="inline-flex items-center gap-1.5 font-semibold transition-opacity hover:opacity-70" style={{ color: 'var(--color-accent)' }}>
              {shared ? <Check size={15} /> : <Share2 size={15} />} {shared ? t('detail.copied') : t('detail.share')}
            </button>
          </motion.div>
          {tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-5" dir="ltr">
              {tags.map(tg => <span key={tg} className="tech-tag">#{tg}</span>)}
            </div>
          )}
          {resources.length > 0 && (
            <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ ...spring, delay: 0.25 }} className="flex flex-wrap gap-2.5 mt-7" dir="ltr">
              {resources.map((r, i) => {
                const Icon = KIND_ICONS[r.kind] || Link2
                return (
                  <a key={`${r.url}-${i}`} href={r.url} target="_blank" rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl text-sm font-semibold transition-opacity hover:opacity-85"
                    style={i === 0 ? { background: 'var(--color-text)', color: 'var(--color-bg)' } : { border: '2px solid var(--color-text)', color: 'var(--color-text)' }}>
                    <Icon size={16} />
                    {r.label || r.url}
                    <ArrowUpRight size={14} />
                  </a>
                )
              })}
            </motion.div>
          )}
        </div>
      </section>

      <section className="py-12 md:py-16">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          {tutorial.cover_url && (
            <motion.div
              initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ ...spring, delay: 0.25 }}
              className="rounded-3xl overflow-hidden mb-12 md:mb-16 -mt-20 md:-mt-24 relative z-10 shadow-xl"
              style={{ background: 'var(--color-bg-alt)', border: '1px solid var(--color-border-light)' }}
            >
              <img src={tutorial.cover_url} alt="" className="w-full max-h-[520px] object-cover" />
            </motion.div>
          )}

          <div className="grid lg:grid-cols-[minmax(0,1fr)_300px] gap-10 lg:gap-14">
            <article ref={articleRef} className="min-w-0" dir="ltr" lang="en">
              <Markdown>{tutorial.content || tutorial.summary || ''}</Markdown>
            </article>

            {/* Only the contents list sticks; a long "bring" list no longer
                turns the whole sidebar into its own scroll box. */}
            <aside className="space-y-5 lg:h-full">
              {event && (
                <div className="card-pro card-static p-6">
                  <SideHeading icon={CalendarDays}>{t('detail.workshop')}</SideHeading>
                  <div className="font-semibold mb-2">{localized(event, 'title')}</div>
                  <div className="text-sm space-y-1 mb-4" style={{ color: 'var(--color-text-muted)' }}>
                    <div>{dateFmt(`${event.date}T00:00:00`)}{event.time ? ` · ${String(event.time).slice(0, 5)}` : ''}</div>
                    {localized(event, 'location') && <div className="flex items-center gap-1.5"><MapPin size={13} /> {localized(event, 'location')}</div>}
                  </div>
                  <Link to="/events" className="inline-flex items-center gap-1 text-sm font-semibold" style={{ color: 'var(--color-accent)' }}>
                    {t('detail.viewEvent')} <ArrowUpRight size={14} className="rtl:-scale-x-100" />
                  </Link>
                </div>
              )}

              {needs.length > 0 && (
                <div className="card-pro card-static p-6">
                  <div className="flex items-start justify-between gap-2">
                    <SideHeading icon={SquareCheck}>{t('detail.bring')}</SideHeading>
                    <span className="text-xs font-semibold tabular-nums" style={{ color: 'var(--color-text-muted)' }}>
                      {needs.filter(n => ticked.has(n)).length}/{needs.length}
                    </span>
                  </div>
                  <ul className="space-y-1 text-sm" dir="ltr" lang="en">
                    {needs.map((n, i) => {
                      const done = ticked.has(n)
                      return (
                        <li key={i}>
                          <label className="flex items-start gap-2.5 py-1 cursor-pointer select-none">
                            <input
                              type="checkbox"
                              checked={done}
                              onChange={() => toggleNeed(n)}
                              className="mt-[3px] shrink-0 cursor-pointer"
                              style={{ width: 15, height: 15, accentColor: 'var(--color-accent)' }}
                            />
                            <span style={{ color: 'var(--color-text-muted)', textDecoration: done ? 'line-through' : 'none', opacity: done ? 0.6 : 1 }}>{n}</span>
                          </label>
                        </li>
                      )
                    })}
                  </ul>
                </div>
              )}

              {toc.length > 1 && (
                <nav className="card-pro card-static p-6 lg:sticky lg:top-28 lg:max-h-[calc(100vh-8rem)] lg:overflow-y-auto" aria-label={t('detail.onThisPage')}>
                  <SideHeading icon={ListTree}>{t('detail.onThisPage')}</SideHeading>
                  <ul className="space-y-1.5 text-sm" dir="ltr" lang="en">
                    {toc.map(item => (
                      <li key={item.id} style={{ paddingInlineStart: item.depth === 3 ? 14 : 0 }}>
                        <a href={`#${item.id}`} className="hover:underline" style={{ color: item.depth === 3 ? 'var(--color-text-muted)' : 'var(--color-text)' }}>
                          {item.text}
                        </a>
                      </li>
                    ))}
                  </ul>
                </nav>
              )}
            </aside>
          </div>
        </div>
      </section>

      {others.length > 0 && (
        <section className="py-14 md:py-20" style={{ background: 'var(--color-bg-alt)' }}>
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className="text-2xl md:text-3xl font-bold mb-8">{t('detail.more')}</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {others.map(o => (
                <Link key={o.id} to={`/learn/${o.slug}`} className="card-pro group block">
                  <div className="relative overflow-hidden" style={{ height: 170, background: 'var(--color-bg)' }}>
                    {o.cover_url ? (
                      <img src={o.cover_url} alt="" loading="lazy" className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center" style={{ color: 'var(--color-text-muted)' }}><BookOpen size={28} /></div>
                    )}
                    <div className="category-tag">{t(`levels.${o.level}`)}</div>
                  </div>
                  <div className="p-5 flex items-center justify-between gap-3" dir="ltr">
                    <h3 className="font-bold leading-snug" lang="en">{o.title}</h3>
                    <ArrowUpRight size={18} className="shrink-0" style={{ color: 'var(--color-accent)' }} />
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}
    </>
  )
}

function BackLink({ label }) {
  return (
    <Link to="/learn" className="inline-flex items-center gap-2 text-sm font-semibold transition-opacity hover:opacity-70" style={{ color: 'var(--color-text-muted)' }}>
      <ArrowLeft size={16} className="rtl:-scale-x-100" />
      {label}
    </Link>
  )
}

function SideHeading({ icon: Icon, children }) {
  return (
    <h2 className="text-sm font-bold mb-4 flex items-center gap-2">
      <Icon size={16} style={{ color: 'var(--color-accent)' }} />
      {children}
    </h2>
  )
}
