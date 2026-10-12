import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import ReactMarkdown from 'react-markdown'
import { ArrowLeft, ArrowUpRight, CalendarDays, FolderGit2, Layers, Link2 } from 'lucide-react'
import { supabase } from '../lib/supabase'
import SEO, { SITE_URL } from '../components/SEO'
import { GitHubIcon } from '../components/shared/SocialIcons'

const spring = { type: 'spring', damping: 28, stiffness: 120 }

const md = {
  h2: ({ children }) => <h2 className="text-2xl font-bold mt-10 mb-4 first:mt-0">{children}</h2>,
  h3: ({ children }) => <h3 className="text-lg font-bold mt-8 mb-3">{children}</h3>,
  p: ({ children }) => <p className="mb-4 leading-relaxed" style={{ color: 'var(--color-text-muted)' }}>{children}</p>,
  ul: ({ children }) => <ul className="list-disc ps-5 mb-5 space-y-1.5" style={{ color: 'var(--color-text-muted)' }}>{children}</ul>,
  ol: ({ children }) => <ol className="list-decimal ps-5 mb-5 space-y-1.5" style={{ color: 'var(--color-text-muted)' }}>{children}</ol>,
  li: ({ children }) => <li className="leading-relaxed ps-1">{children}</li>,
  strong: ({ children }) => <strong className="font-semibold" style={{ color: 'var(--color-text)' }}>{children}</strong>,
  code: ({ children }) => (
    <code className="text-[0.85em] px-1.5 py-0.5 rounded-md" style={{ background: 'var(--color-bg-alt)', color: 'var(--color-text)' }}>{children}</code>
  ),
  a: ({ href, children }) => (
    <a href={href} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2" style={{ color: 'var(--color-accent)' }}>{children}</a>
  ),
}

const isId = value => /^\d+$/.test(value || '')

export default function ProjectDetail() {
  const { id } = useParams()
  const { t, i18n } = useTranslation('projects')
  const lang = i18n.language?.slice(0, 2) || 'en'
  const [project, setProject] = useState(null)
  const [others, setOthers] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    const load = async () => {
      if (!isId(id)) { setProject(null); setLoading(false); return }
      const [{ data }, { data: rest }] = await Promise.all([
        supabase.from('projects').select('*').eq('id', id).eq('is_published', true).maybeSingle(),
        supabase.from('projects')
          .select('id, title_en, title_ar, title_fr, category, thumbnail_url')
          .eq('is_published', true)
          .neq('id', id)
          .order('created_at', { ascending: false })
          .limit(12),
      ])
      if (cancelled) return
      setProject(data || null)
      // Same category first, then the newest of the rest.
      const list = rest || []
      setOthers([...list.filter(p => p.category === data?.category), ...list.filter(p => p.category !== data?.category)].slice(0, 3))
      setLoading(false)
    }
    load()
    return () => { cancelled = true }
  }, [id])

  const tField = (obj, field) => obj?.[`${field}_${lang}`] || obj?.[`${field}_en`] || ''

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

  if (!project) {
    return (
      <section className="pt-32 pb-24 md:pt-40">
        <SEO title={t('detail.notFound')} path={`/projects/${id}`} noindex />
        <div className="max-w-xl mx-auto px-4 text-center">
          <FolderGit2 size={40} className="mx-auto mb-4" style={{ color: 'var(--color-text-muted)' }} />
          <h1 className="text-3xl font-bold mb-3">{t('detail.notFound')}</h1>
          <p className="mb-8" style={{ color: 'var(--color-text-muted)' }}>{t('detail.notFoundBody')}</p>
          <BackLink label={t('detail.back')} />
        </div>
      </section>
    )
  }

  const title = tField(project, 'title')
  const description = tField(project, 'description')
  const content = tField(project, 'content')
  const tech = project.technologies || []
  const added = project.created_at
    ? new Intl.DateTimeFormat(lang === 'ar' ? 'ar-DZ' : lang, { year: 'numeric', month: 'long', day: 'numeric' }).format(new Date(project.created_at))
    : null

  return (
    <>
      <SEO
        title={title}
        description={description.slice(0, 200)}
        path={`/projects/${project.id}`}
        image={project.thumbnail_url || undefined}
        type="article"
        jsonLd={{
          '@context': 'https://schema.org',
          '@type': 'CreativeWork',
          name: title,
          description,
          image: project.thumbnail_url || undefined,
          url: `${SITE_URL}/projects/${project.id}`,
          keywords: tech.join(', '),
          ...(project.github_url ? { codeRepository: project.github_url } : {}),
          creator: { '@type': 'Organization', name: 'AFAQ Scientific Club', url: SITE_URL },
        }}
      />

      <section className="pt-24 pb-10 md:pt-32 md:pb-14 relative overflow-hidden" style={{ background: 'var(--color-bg-alt)' }}>
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={spring}>
            <BackLink label={t('detail.back')} />
          </motion.div>
          {project.category && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ ...spring, delay: 0.05 }} className="eyebrow mt-8 mb-4">
              {project.category}
            </motion.div>
          )}
          <motion.h1 initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ ...spring, delay: 0.1 }} className="text-4xl md:text-5xl lg:text-6xl font-bold mb-5 max-w-4xl">
            {title}
          </motion.h1>
          {description && (
            <motion.p initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ ...spring, delay: 0.15 }} className="text-lg max-w-3xl leading-relaxed" style={{ color: 'var(--color-text-muted)' }}>
              {description}
            </motion.p>
          )}
          <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ ...spring, delay: 0.2 }} className="flex flex-wrap gap-3 mt-8">
            {project.github_url && (
              <a href={project.github_url} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl text-sm font-semibold transition-opacity hover:opacity-90"
                style={{ background: 'var(--color-text)', color: 'var(--color-bg)' }}>
                <GitHubIcon size={17} />
                {t('detail.viewCode')}
              </a>
            )}
            {project.demo_url && (
              <a href={project.demo_url} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl text-sm font-semibold transition-colors"
                style={{ border: '2px solid var(--color-text)', color: 'var(--color-text)' }}>
                {t('detail.liveDemo')}
                <ArrowUpRight size={16} className="rtl:-scale-x-100" />
              </a>
            )}
          </motion.div>
        </div>
      </section>

      <section className="py-12 md:py-16">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          {project.thumbnail_url && (
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ ...spring, delay: 0.25 }}
              className="rounded-3xl overflow-hidden mb-12 md:mb-16 -mt-20 md:-mt-24 relative z-10 shadow-xl"
              style={{ background: 'var(--color-bg-alt)', border: '1px solid var(--color-border-light)' }}
            >
              <img src={project.thumbnail_url} alt={title} className="w-full max-h-[560px] object-cover" />
            </motion.div>
          )}

          <div className="grid lg:grid-cols-[1fr_320px] gap-10 lg:gap-14">
            <article className="min-w-0">
              <h2 className="text-2xl font-bold mb-5">{t('detail.about')}</h2>
              {content ? (
                <ReactMarkdown components={md}>{content}</ReactMarkdown>
              ) : (
                <p className="leading-relaxed" style={{ color: 'var(--color-text-muted)' }}>{description}</p>
              )}
            </article>

            <aside className="space-y-5 lg:sticky lg:top-28 self-start">
              {tech.length > 0 && (
                <div className="card-pro card-static p-6">
                  <SideHeading icon={Layers}>{t('detail.builtWith')}</SideHeading>
                  <div className="flex flex-wrap gap-1.5">
                    {tech.map(tch => <span key={tch} className="tech-tag">{tch}</span>)}
                  </div>
                </div>
              )}
              <div className="card-pro card-static p-6 space-y-4 text-sm">
                {project.category && (
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: 'var(--color-text-muted)' }}>{t('detail.category')}</div>
                    <div className="font-semibold">{project.category}</div>
                  </div>
                )}
                {added && (
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-wide mb-1 flex items-center gap-1.5" style={{ color: 'var(--color-text-muted)' }}>
                      <CalendarDays size={13} /> {t('detail.added')}
                    </div>
                    <div className="font-semibold">{added}</div>
                  </div>
                )}
                {(project.github_url || project.demo_url) && (
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-wide mb-2 flex items-center gap-1.5" style={{ color: 'var(--color-text-muted)' }}>
                      <Link2 size={13} /> {t('detail.links')}
                    </div>
                    <div className="space-y-2">
                      {project.github_url && (
                        <a href={project.github_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 font-semibold hover:underline break-all" style={{ color: 'var(--color-accent)' }}>
                          <GitHubIcon size={15} />
                          {project.github_url.replace(/^https?:\/\/(www\.)?github\.com\//, '')}
                        </a>
                      )}
                      {project.demo_url && (
                        <a href={project.demo_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 font-semibold hover:underline break-all" style={{ color: 'var(--color-accent)' }}>
                          <ArrowUpRight size={15} className="shrink-0 rtl:-scale-x-100" />
                          {t('detail.liveDemo')}
                        </a>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </aside>
          </div>
        </div>
      </section>

      {others.length > 0 && (
        <section className="py-14 md:py-20" style={{ background: 'var(--color-bg-alt)' }}>
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className="text-2xl md:text-3xl font-bold mb-8">{t('detail.more')}</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {others.map(p => (
                <Link key={p.id} to={`/projects/${p.id}`} className="card-pro group block">
                  <div className="relative overflow-hidden" style={{ height: 170, background: 'var(--color-bg)' }}>
                    {p.thumbnail_url ? (
                      <img src={p.thumbnail_url} alt="" loading="lazy" className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center" style={{ color: 'var(--color-text-muted)' }}><FolderGit2 size={28} /></div>
                    )}
                    {p.category && <div className="category-tag">{p.category}</div>}
                  </div>
                  <div className="p-5 flex items-center justify-between gap-3">
                    <h3 className="font-bold leading-snug">{tField(p, 'title')}</h3>
                    <ArrowUpRight size={18} className="shrink-0 rtl:-scale-x-100" style={{ color: 'var(--color-accent)' }} />
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
    <Link to="/projects" className="inline-flex items-center gap-2 text-sm font-semibold transition-opacity hover:opacity-70" style={{ color: 'var(--color-text-muted)' }}>
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
