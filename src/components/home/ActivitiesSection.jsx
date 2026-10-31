import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import { Cpu, Bot, RadioTower, Timer, Trophy, Code2, GraduationCap, ArrowUpRight } from 'lucide-react'

/*
  What the club does, as a bento grid on a brand-midnight panel. Workshops
  lead (it is where most members start), the other tracks fill the grid and
  the last cell invites people in. Colors are the brand kit's (see /brand),
  fixed rather than themed, so the panel reads the same in light and dark.
*/

const FEATURED = { key: 'workshops', icon: Cpu }

const TRACKS = [
  { key: 'robotics', icon: Bot },
  { key: 'iot', icon: RadioTower },
  { key: 'software', icon: Code2 },
  { key: 'hackathons', icon: Timer },
  { key: 'competitions', icon: Trophy },
  { key: 'training', icon: GraduationCap },
]

const COMMANDS = ['upload sketch.ino', 'robot --calibrate', 'git push origin main', 'npm run build']

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

function Terminal() {
  const i = useCycle(COMMANDS.length, 2600)
  return (
    <div className="acts-term" dir="ltr" aria-hidden="true">
      <span className="acts-term-prompt">&gt;</span>
      <AnimatePresence mode="wait" initial={false}>
        <motion.span
          key={i}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
        >
          {COMMANDS[i]}
        </motion.span>
      </AnimatePresence>
      <span className="acts-caret" />
    </div>
  )
}

const item = {
  hidden: { opacity: 0, y: 24 },
  show: { opacity: 1, y: 0, transition: spring },
}

export default function ActivitiesSection() {
  const { t } = useTranslation('home')
  const FeaturedIcon = FEATURED.icon

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
          <div className="eyebrow eyebrow-center mb-4">AFAQ.LAB</div>
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold leading-tight">
            {t('activities.title')}
          </h2>
          <p className="mt-4 text-base md:text-lg max-w-2xl mx-auto leading-relaxed" style={{ color: 'var(--color-text-muted)' }}>
            {t('activities.sub')}
          </p>
        </motion.div>

        <motion.div
          className="acts"
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: '-40px' }}
          variants={{ show: { transition: { staggerChildren: 0.06 } } }}
        >
          <img src="/brand/logo/afaq-mark-white.svg" alt="" className="acts-watermark" />

          <motion.article variants={item} className="acts-card acts-featured">
            <div className="acts-card-top">
              <span className="acts-icon acts-icon-lg"><FeaturedIcon size={22} /></span>
              <span className="acts-num" dir="ltr">01</span>
            </div>
            <h3 className="acts-featured-title">{t(`activities.${FEATURED.key}.title`)}</h3>
            <p className="acts-featured-desc">{t(`activities.${FEATURED.key}.details`)}</p>
            <Terminal />
          </motion.article>

          {TRACKS.map(({ key, icon: Icon }, n) => (
            <motion.article key={key} variants={item} className="acts-card">
              <div className="acts-card-top">
                <span className="acts-icon"><Icon size={18} /></span>
                <span className="acts-num" dir="ltr">{String(n + 2).padStart(2, '0')}</span>
              </div>
              <h3 className="acts-title">{t(`activities.${key}.title`)}</h3>
              <p className="acts-desc">{t(`activities.${key}.desc`)}</p>
            </motion.article>
          ))}

          <motion.div variants={item} className="acts-cta-wrap">
            <Link to="/join" className="acts-cta">
              <span>{t('hero.cta1')}</span>
              <ArrowUpRight size={22} className="acts-cta-arrow" />
            </Link>
          </motion.div>
        </motion.div>
      </div>
    </section>
  )
}
