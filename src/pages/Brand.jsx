import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import { useLenis } from 'lenis/react'
import { Download as DownloadIcon } from 'lucide-react'
import SEO from '../components/SEO'
import { CopyProvider, Download } from '../components/brand/copy'
import LogoSection from '../components/brand/LogoSection'
import ColorSection from '../components/brand/ColorSection'
import TypeSection from '../components/brand/TypeSection'
import BackgroundGenerator from '../components/brand/BackgroundGenerator'
import { BRAND_ZIP, LOGO_SVG } from '../data/brand'
import './brand.css'

const spring = { type: 'spring', damping: 28, stiffness: 120 }
const SECTIONS = ['logo', 'colors', 'typography', 'backgrounds', 'usage']

function useActiveSection() {
  const [active, setActive] = useState(SECTIONS[0])
  useEffect(() => {
    const io = new IntersectionObserver(
      entries => entries.forEach(e => e.isIntersecting && setActive(e.target.id)),
      { rootMargin: '-40% 0px -55% 0px' }
    )
    SECTIONS.forEach(id => { const el = document.getElementById(id); if (el) io.observe(el) })
    return () => io.disconnect()
  }, [])
  return active
}

function Section({ id, index, title, subtitle, children }) {
  return (
    <section id={id} className="bk-section">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.header
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-40px' }}
          transition={spring}
          className="mb-10 md:mb-12 max-w-3xl"
        >
          <div className="bk-title text-sm mb-3" style={{ color: 'var(--bk-blue)' }}>
            <span dir="ltr">{String(index).padStart(2, '0')} /</span>
          </div>
          <h2 className="bk-title text-4xl md:text-5xl mb-4">{title}</h2>
          {subtitle && <p className="text-base md:text-lg bk-muted leading-relaxed">{subtitle}</p>}
        </motion.header>
        {children}
      </div>
    </section>
  )
}

function Usage() {
  const { t } = useTranslation('brand')
  const items = t('usage.items', { returnObjects: true })
  return (
    <div className="grid lg:grid-cols-[1fr_1.1fr] gap-6">
      <div className="grid sm:grid-cols-2 gap-4 content-start">
        {Array.isArray(items) && items.map((it, i) => (
          <div key={i} className="bk-card p-5">
            <div className="bk-title text-base mb-2" style={{ color: 'var(--bk-blue)' }}>{it.t}</div>
            <p className="text-sm bk-muted leading-relaxed">{it.d}</p>
          </div>
        ))}
      </div>

      {/* The system in one composition: a sample event poster. */}
      <div className="rounded-[22px] overflow-hidden relative p-8 md:p-10 flex flex-col justify-between min-h-[440px]" style={{ background: 'var(--bk-midnight)', color: '#fff' }}>
        <div className="absolute inset-0 pointer-events-none" style={{
          backgroundImage: 'linear-gradient(rgba(92,188,249,.08) 1px, transparent 1px), linear-gradient(90deg, rgba(92,188,249,.08) 1px, transparent 1px)',
          backgroundSize: '20px 20px',
        }} />
        <img src={LOGO_SVG('white')} alt="" className="absolute -bottom-16 -end-16 w-72 opacity-10" />
        <div className="relative flex items-center justify-between">
          <img src={LOGO_SVG('white')} alt="" className="w-10" />
          <span className="bk-f-mine text-xs tracking-widest" style={{ color: 'var(--bk-sky)' }}>WORKSHOP · 2026</span>
        </div>
        <div className="relative">
          <div className="bk-f-mine text-4xl md:text-5xl leading-none mb-3" dir="ltr">ARDUINO<br /><span style={{ color: 'var(--bk-sky)' }}>BOOTCAMP</span></div>
          <div className="bk-f-unixel text-3xl md:text-4xl mb-5" dir="rtl">معسكر الأردوينو</div>
          <p className="bk-f-sans text-base leading-relaxed max-w-md" dir="rtl" style={{ color: 'var(--bk-ice)' }}>
            ثلاثة أيام من البرمجة والإلكترونيات والعمل الجماعي. مفتوح لجميع طلبة الجامعة.
          </p>
        </div>
        <div className="relative flex items-center gap-3">
          <span className="px-4 py-2 rounded-lg text-sm font-bold" style={{ background: 'var(--bk-blue)' }}>afaq-club.com</span>
          <span className="flex gap-1">
            {['#050A30', '#12229D', '#233DFF', '#3C4C59', '#5CBCF9', '#CAE8FF', '#F4F6FC'].map(c => (
              <i key={c} className="w-3 h-3 block" style={{ background: c, boxShadow: 'inset 0 0 0 1px rgba(255,255,255,.2)' }} />
            ))}
          </span>
        </div>
      </div>
    </div>
  )
}

export default function Brand() {
  const { t } = useTranslation('brand')
  const active = useActiveSection()
  const lenis = useLenis()

  // Lenis owns scrolling and its animated scrollTo overshoots on this long
  // page, so jump natively (html has scroll-behavior: smooth, turn it off for
  // the jump) and let Lenis pick up the new position.
  const jump = (id) => {
    const el = document.getElementById(id)
    if (!el) return
    const navH = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--nav-h')) || 64
    const y = el.getBoundingClientRect().top + window.scrollY - navH - 50
    const html = document.documentElement
    const prev = html.style.scrollBehavior
    html.style.scrollBehavior = 'auto'
    lenis?.stop()
    window.scrollTo(0, y)
    lenis?.start()
    html.style.scrollBehavior = prev
    history.replaceState(null, '', `#${id}`)
  }

  useEffect(() => {
    const id = window.location.hash.slice(1)
    if (lenis && SECTIONS.includes(id)) setTimeout(() => jump(id), 300)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lenis])

  return (
    <CopyProvider>
      <SEO title={t('seo.title')} description={t('seo.description')} path="/brand" />
      <div className="bk">
        <section className="bk-hero">
          <img src={LOGO_SVG('blue')} alt="" className="bk-hero-mark" />
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative">
            <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={spring} className="bk-pixel-tag bk-title mb-7">
              {t('hero.eyebrow')}
            </motion.div>
            <motion.h1 initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ ...spring, delay: 0.08 }} className="bk-title text-5xl sm:text-6xl lg:text-7xl leading-[1.05] mb-6 max-w-3xl">
              {t('hero.title')}
            </motion.h1>
            <motion.p initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ ...spring, delay: 0.16 }} className="text-lg md:text-xl max-w-2xl leading-relaxed mb-10" style={{ color: 'var(--bk-ice)' }}>
              {t('hero.subtitle')}
            </motion.p>
            <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ ...spring, delay: 0.24 }} className="flex flex-wrap items-center gap-4">
              <Download href={BRAND_ZIP} className="bk-btn bk-btn-primary bk-btn-lg">
                <DownloadIcon size={18} />{t('hero.downloadAll')}
              </Download>
              <span className="text-sm" style={{ color: 'rgba(202,232,255,.7)' }}>{t('hero.zipNote')}</span>
            </motion.div>
          </div>
        </section>

        <nav className="bk-subnav">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex gap-6 overflow-x-auto">
            {SECTIONS.map(id => (
              <a key={id} href={`#${id}`} className={active === id ? 'active' : ''} onClick={e => { e.preventDefault(); jump(id) }}>{t(`nav.${id}`)}</a>
            ))}
          </div>
        </nav>

        <Section id="logo" index={1} title={t('logo.title')} subtitle={t('logo.subtitle')}>
          <LogoSection />
        </Section>
        <Section id="colors" index={2} title={t('colors.title')} subtitle={t('colors.subtitle')}>
          <ColorSection />
        </Section>
        <Section id="typography" index={3} title={t('type.title')} subtitle={t('type.subtitle')}>
          <TypeSection />
        </Section>
        <Section id="backgrounds" index={4} title={t('bg.title')} subtitle={t('bg.subtitle')}>
          <BackgroundGenerator />
        </Section>
        <Section id="usage" index={5} title={t('usage.title')}>
          <Usage />
        </Section>
      </div>
    </CopyProvider>
  )
}
