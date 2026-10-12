import { useEffect, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import {
  Cpu,
  Bot,
  RadioTower,
  Timer,
  Trophy,
  Code2,
  GraduationCap,
  MessagesSquare,
  PenLine,
  Globe2,
} from 'lucide-react'

/*
  Two sides, one horizon. AFAQ is a tech club and a language club, so the
  section is split down the middle on a brand-midnight panel: the Tech Lab
  on one side, the Language Lab on the other, the mark sitting on the seam.
  Colors are the brand kit's (see /brand), fixed rather than themed, so the
  panel reads the same in light and dark like the brand's own poster.
*/

const TECH = [
  { key: 'workshops', icon: Cpu },
  { key: 'robotics', icon: Bot },
  { key: 'iot', icon: RadioTower },
  { key: 'software', icon: Code2 },
  { key: 'hackathons', icon: Timer },
  { key: 'competitions', icon: Trophy },
  { key: 'training', icon: GraduationCap },
]

const LANGS = [
  { key: 'english', code: 'EN', native: 'English' },
  { key: 'german', code: 'DE', native: 'Deutsch' },
]

const LANG_TRACKS = [
  { key: 'speaking', icon: MessagesSquare },
  { key: 'writing', icon: PenLine },
  { key: 'culture', icon: Globe2 },
]

// What each side "says" on loop: commands on one, greetings on the other.
const COMMANDS = ['upload sketch.ino', 'git push origin main', 'robot --calibrate', 'npm run build']
const GREETINGS = [
  { text: 'Hello', lang: 'en' },
  { text: 'Hallo', lang: 'de' },
  { text: 'Azul', lang: 'kab' },
  { text: 'مرحبا', lang: 'ar', rtl: true },
  { text: 'Bonjour', lang: 'fr' },
]

const spring = { type: 'spring', damping: 28, stiffness: 120 }

function useCycle(length, ms) {
  const reduced = useReducedMotion()
  const [i, setI] = useState(0)
  useEffect(() => {
    if (reduced) return
    const id = setInterval(() => setI(n => (n + 1) % length), ms)
    return () => clearInterval(id)
  }, [length, ms, reduced])
  return i
}

function Ticker({ children, k }) {
  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.span
        key={k}
        className="sides-ticker-text"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
      >
        {children}
      </motion.span>
    </AnimatePresence>
  )
}

function SideHead({ index, label, title, desc }) {
  return (
    <>
      <div className="sides-index">
        <span dir="ltr">{index} /</span> {label}
      </div>
      <h3 className="sides-title">{title}</h3>
      <p className="sides-desc">{desc}</p>
    </>
  )
}

function TechSide() {
  const { t } = useTranslation('home')
  const i = useCycle(COMMANDS.length, 2600)
  return (
    <div className="sides-half">
      <SideHead index="01" label={t('sides.tech.label')} title={t('sides.tech.title')} desc={t('sides.tech.desc')} />

      <div className="sides-ticker" dir="ltr" aria-hidden="true">
        <span className="sides-prompt">&gt;</span>
        <Ticker k={i}>{COMMANDS[i]}</Ticker>
        <span className="sides-caret" />
      </div>

      <ul className="sides-list">
        {TECH.map(({ key, icon: Icon }) => (
          <li key={key} className="sides-row">
            <span className="sides-icon"><Icon size={16} /></span>
            <span className="min-w-0">
              <span className="sides-row-title">{t(`activities.${key}.title`)}</span>
              <span className="sides-row-desc">{t(`activities.${key}.desc`)}</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}

function LanguageSide() {
  const { t } = useTranslation('home')
  const i = useCycle(GREETINGS.length, 1900)
  const g = GREETINGS[i]
  return (
    <div className="sides-half">
      <SideHead index="02" label={t('sides.lang.label')} title={t('sides.lang.title')} desc={t('sides.lang.desc')} />

      <div className="sides-ticker" aria-hidden="true">
        <span className="sides-prompt">“</span>
        <Ticker k={i}>
          <span lang={g.lang} dir={g.rtl ? 'rtl' : 'ltr'} className={g.rtl ? 'sides-ar' : undefined}>{g.text}</span>
        </Ticker>
        <span className="sides-prompt">”</span>
      </div>

      <div className="sides-langs">
        {LANGS.map(l => (
          <div key={l.key} className="sides-lang">
            <span className="sides-lang-code" dir="ltr">{l.code}</span>
            <span className="min-w-0">
              <span className="sides-row-title">{t(`sides.lang.${l.key}.title`)}</span>
              {t(`sides.lang.${l.key}.title`) !== l.native && (
                <span className="sides-lang-native" lang={l.code.toLowerCase()} dir="ltr">{l.native}</span>
              )}
            </span>
            <span className="sides-row-desc sides-lang-desc">{t(`sides.lang.${l.key}.desc`)}</span>
          </div>
        ))}
      </div>

      <ul className="sides-list">
        {LANG_TRACKS.map(({ key, icon: Icon }) => (
          <li key={key} className="sides-row">
            <span className="sides-icon"><Icon size={16} /></span>
            <span className="min-w-0">
              <span className="sides-row-title">{t(`sides.lang.tracks.${key}.title`)}</span>
              <span className="sides-row-desc">{t(`sides.lang.tracks.${key}.desc`)}</span>
            </span>
          </li>
        ))}
      </ul>

      <p className="sides-note">{t('sides.lang.note')}</p>
    </div>
  )
}

export default function ClubSides() {
  const { t } = useTranslation('home')
  return (
    <section className="py-16 md:py-20 relative z-0">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-30px' }}
          transition={spring}
          className="text-center mb-12 md:mb-14"
        >
          <div className="eyebrow eyebrow-center mb-4">{t('sides.eyebrow')}</div>
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold leading-tight">
            {t('activities.title')}
          </h2>
          <p className="mt-4 text-base md:text-lg max-w-2xl mx-auto leading-relaxed" style={{ color: 'var(--color-text-muted)' }}>
            {t('activities.sub')}
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-40px' }}
          transition={{ ...spring, delay: 0.1 }}
          className="sides"
        >
          <img src="/brand/logo/afaq-mark-white.svg" alt="" className="sides-watermark" />
          <TechSide />
          <div className="sides-seam" aria-hidden="true">
            <span className="sides-seam-line" />
            <span className="sides-seam-mark">
              <img src="/brand/logo/afaq-mark-white.svg" alt="" width="30" height="30" />
            </span>
            <span className="sides-seam-line" />
          </div>
          <LanguageSide />
        </motion.div>
      </div>
    </section>
  )
}
