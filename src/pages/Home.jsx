import { motion } from 'framer-motion'
import HeroSection from '../components/home/HeroSection'
import IntroSection from '../components/home/IntroSection'
import FeaturedActivities from '../components/home/FeaturedActivities'
import UpcomingEvents from '../components/home/UpcomingEvents'
import ProjectHighlights from '../components/home/ProjectHighlights'
import StatisticsSection from '../components/home/StatisticsSection'
import GalleryPreview from '../components/home/GalleryPreview'
import { useTranslation } from 'react-i18next'
import { ArrowRight } from 'lucide-react'

const spring = { type: 'spring', damping: 28, stiffness: 120 }

function CTASection() {
  const { t } = useTranslation('home')
  return (
    <section className="py-16 md:py-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="blue-highlight text-center">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-30px' }}
            transition={spring}
            style={{ position: 'relative', zIndex: 1, maxWidth: 640, margin: '0 auto' }}
          >
            <h2 className="text-3xl md:text-5xl font-bold mb-5" style={{ fontFamily: "'DM Sans', 'Inter', sans-serif", fontWeight: 700, letterSpacing: '-0.02em' }}>
              {t('cta.title')}
            </h2>
            <p className="text-base md:text-lg mb-8 leading-relaxed" style={{ color: 'rgba(255,255,255,0.7)' }}>
              {t('cta.sub')}
            </p>
            <a href="/register"
              className="inline-flex items-center gap-2 px-8 py-3.5 rounded-[100px] font-semibold text-base transition-all duration-200"
              style={{ background: '#fff', color: '#0A1628' }}
              onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 8px 28px rgba(0,0,0,0.2)' }}
              onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'none' }}>
              {t('hero.cta1')} <ArrowRight size={18} />
            </a>
          </motion.div>
        </div>
      </div>
    </section>
  )
}

export default function Home() {
  return (
    <>
      <HeroSection />
      <IntroSection />
      <FeaturedActivities />
      <UpcomingEvents />
      <ProjectHighlights />
      <StatisticsSection />
      <GalleryPreview />
      <CTASection />
    </>
  )
}
