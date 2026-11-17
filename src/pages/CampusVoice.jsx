import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { motion } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import QRCode from 'qrcode'
import {
  ArrowRight, CalendarDays, Clock, Lightbulb, MapPin, MessageSquareText, Printer, ScanLine,
} from 'lucide-react'
import SEO, { SITE_URL } from '../components/SEO'
import { ProblemIcon, STUDENT_VOICE_PATH, eventEnd, loadStudentVoice, localized } from '../lib/campusVoice'

const spring = { type: 'spring', damping: 28, stiffness: 120 }

// The QR always carries the public address, so frames printed from a laptop
// running the site locally still send students to the live poll.
const pollUrl = slug => `${SITE_URL}/p/${slug}`

function QrCanvas({ value, size }) {
  const ref = useRef(null)
  useEffect(() => {
    if (!ref.current) return
    QRCode.toCanvas(ref.current, value, {
      errorCorrectionLevel: 'M',
      margin: 1,
      width: size * 2,
      color: { dark: '#0a1220', light: '#ffffff' },
    }).then(() => {
      if (!ref.current) return
      ref.current.style.width = `${size}px`
      ref.current.style.height = `${size}px`
    }).catch(() => {})
  }, [value, size])
  return <canvas ref={ref} width={size} height={size} aria-hidden="true" />
}

function ProblemCard({ problem, index, t, lang }) {
  const live = Boolean(problem.poll_slug)
  return (
    <motion.article
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-30px' }}
      transition={{ ...spring, delay: index * 0.06 }}
      className="flex flex-col rounded-2xl p-6"
      style={{ background: 'var(--color-card)', border: '1px solid var(--color-border-light)' }}
    >
      <div className="flex items-center gap-3 mb-4">
        <span className="inline-flex items-center justify-center w-11 h-11 rounded-xl shrink-0"
          style={{ background: 'var(--color-accent-soft)', color: 'var(--color-accent)' }}>
          <ProblemIcon name={problem.icon} size={22} />
        </span>
        <span className="text-xs font-semibold" style={{ color: 'var(--color-text-muted)', fontFamily: "'Minecraft', sans-serif" }}>
          {String(index + 1).padStart(2, '0')}
        </span>
      </div>
      <h3 className="font-bold text-lg mb-2">{localized(problem, 'title', lang)}</h3>
      <p className="text-sm leading-relaxed mb-5 flex-1" style={{ color: 'var(--color-text-muted)' }}>
        {localized(problem, 'description', lang)}
      </p>
      {live ? (
        <div className="flex items-center gap-4">
          <div className="hidden sm:block rounded-lg overflow-hidden shrink-0" style={{ background: '#fff', padding: 4 }}>
            <QrCanvas value={pollUrl(problem.poll_slug)} size={84} />
          </div>
          <a
            href={`/p/${problem.poll_slug}`}
            className="inline-flex items-center justify-center gap-1.5 flex-1 px-4 py-2.5 rounded-[100px] font-semibold text-sm transition-opacity hover:opacity-85"
            style={{ background: 'var(--color-accent)', color: '#fff' }}
          >
            {t('answer')} <ArrowRight size={15} className="rtl:rotate-180" />
          </a>
        </div>
      ) : (
        <span className="inline-flex items-center justify-center px-4 py-2.5 rounded-[100px] text-sm font-semibold"
          style={{ border: '1px dashed var(--color-border)', color: 'var(--color-text-muted)' }}>
          {t('soon')}
        </span>
      )}
    </motion.article>
  )
}

/**
 * One A5-ish frame per problem for the table. Rendered straight into <body>
 * and shown only when printing, while the app itself is hidden.
 */
function PrintFrames({ problems, t, lang }) {
  const live = problems.filter(p => p.poll_slug)
  return createPortal(
    <div className="cv-print">
      {live.map((p, i) => (
        <section key={p.id} className="cv-frame">
          <div className="cv-frame-top">
            <img src="/images/logo/logo_trnsp_black.webp" alt="" />
            <span>AFAQ · {t('title')}</span>
          </div>
          <div className="cv-frame-num">{String(i + 1).padStart(2, '0')}</div>
          <h2>{localized(p, 'title', lang)}</h2>
          <p>{localized(p, 'description', lang)}</p>
          <div className="cv-frame-qr"><QrCanvas value={pollUrl(p.poll_slug)} size={260} /></div>
          <strong>{t('frame.scan')}</strong>
          <small>{pollUrl(p.poll_slug).replace(/^https?:\/\//, '')}</small>
        </section>
      ))}
    </div>,
    document.body,
  )
}

export default function CampusVoice() {
  const { t, i18n } = useTranslation('campus')
  const lang = i18n.language?.slice(0, 2) || 'en'
  const [data, setData] = useState({ loading: true, error: false, settings: null, problems: [] })

  useEffect(() => {
    let cancelled = false
    loadStudentVoice()
      .then(res => { if (!cancelled) setData({ loading: false, error: false, ...res }) })
      .catch(() => { if (!cancelled) setData(d => ({ ...d, loading: false, error: true })) })
    return () => { cancelled = true }
  }, [])

  const { settings, problems } = data
  const end = eventEnd(settings)
  const isPast = end ? Date.now() > end.getTime() : false
  const anyLive = problems.some(p => p.poll_slug)
  const date = settings?.event_date
    ? new Date(`${settings.event_date}T00:00:00`).toLocaleDateString(lang, { weekday: 'long', day: 'numeric', month: 'long' })
    : null
  const time = [settings?.start_time, settings?.end_time].filter(Boolean).join(' – ')
  const place = localized(settings, 'place', lang)

  const steps = [
    { icon: ScanLine, key: 'scan' },
    { icon: MessageSquareText, key: 'answer' },
    { icon: Lightbulb, key: 'suggest' },
  ]

  return (
    <>
      <SEO title={t('title')} description={t('subtitle')} path={STUDENT_VOICE_PATH} />

      <section className="pt-24 pb-16 md:pt-32 md:pb-20" style={{ background: 'var(--color-bg-alt)' }}>
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={spring} className="eyebrow eyebrow-center mb-4">
            {t('eyebrow')}
          </motion.div>
          <motion.h1 initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ ...spring, delay: 0.1 }}
            className="text-4xl md:text-5xl lg:text-6xl font-bold mb-4">
            {t('title')}
          </motion.h1>
          <motion.p initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ ...spring, delay: 0.2 }}
            className="text-lg max-w-2xl mx-auto mb-8" style={{ color: 'var(--color-text-muted)' }}>
            {t('subtitle')}
          </motion.p>
          {(date || time || place) && (
            <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ ...spring, delay: 0.3 }}
              className="inline-flex flex-wrap justify-center gap-x-6 gap-y-2 px-6 py-3 rounded-2xl text-sm font-semibold"
              style={{ background: 'var(--color-card)', border: '1px solid var(--color-border-light)' }}>
              {date && <span className="inline-flex items-center gap-1.5"><CalendarDays size={15} style={{ color: 'var(--color-accent)' }} /> {date}</span>}
              {time && <span className="inline-flex items-center gap-1.5" dir="ltr"><Clock size={15} style={{ color: 'var(--color-accent)' }} /> {time}</span>}
              {place && <span className="inline-flex items-center gap-1.5"><MapPin size={15} style={{ color: 'var(--color-accent)' }} /> {place}</span>}
            </motion.div>
          )}
          {isPast && (
            <p className="mt-4 text-sm" style={{ color: 'var(--color-text-muted)' }}>{t('missed')}</p>
          )}
        </div>
      </section>

      <section className="py-14 md:py-16">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="eyebrow eyebrow-center mb-8">{t('how.title')}</div>
          <ol className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {steps.map(({ icon: Icon, key }, i) => (
              <li key={key} className="flex items-start gap-3 rounded-2xl p-5"
                style={{ background: 'var(--color-card)', border: '1px solid var(--color-border-light)' }}>
                <span className="inline-flex items-center justify-center w-9 h-9 rounded-lg shrink-0"
                  style={{ background: 'var(--color-accent)', color: '#fff' }}>
                  <Icon size={18} />
                </span>
                <div>
                  <div className="font-bold text-sm mb-1">{i + 1}. {t(`how.${key}.title`)}</div>
                  <div className="text-sm" style={{ color: 'var(--color-text-muted)' }}>{t(`how.${key}.desc`)}</div>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="pb-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-wrap items-end justify-between gap-4 mb-8">
            <div>
              <h2 className="text-2xl md:text-3xl font-bold mb-1">{t('problemsTitle')}</h2>
              <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>{t('problemsSub')}</p>
            </div>
            {anyLive && (
              <button type="button" onClick={() => window.print()}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-[100px] text-sm font-semibold transition-opacity hover:opacity-80"
                style={{ border: '2px solid var(--color-accent)', color: 'var(--color-accent)' }}>
                <Printer size={15} /> {t('print')}
              </button>
            )}
          </div>
          {data.loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1, 2, 3].map(i => (
                <div key={i} className="rounded-2xl" style={{ height: 240, background: 'var(--color-bg-alt)', animation: 'shimmer 1.5s ease-in-out infinite' }} />
              ))}
            </div>
          ) : data.error ? (
            <p className="text-center py-12" style={{ color: 'var(--color-text-muted)' }}>{t('loadError')}</p>
          ) : problems.length === 0 ? (
            <p className="text-center py-12" style={{ color: 'var(--color-text-muted)' }}>{t('empty')}</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {problems.map((p, i) => <ProblemCard key={p.id} problem={p} index={i} t={t} lang={lang} />)}
            </div>
          )}
          <p className="text-xs text-center mt-10" style={{ color: 'var(--color-text-muted)' }}>{t('privacy')}</p>
        </div>
      </section>

      {anyLive && <PrintFrames problems={problems} t={t} lang={lang} />}
    </>
  )
}
