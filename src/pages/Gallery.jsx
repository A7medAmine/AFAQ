import { useState, useCallback } from 'react'
import { motion } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import { Search } from 'lucide-react'
import Lightbox from '../components/shared/Lightbox'
import { galleryImages } from '../data'

const spring = { type: 'spring', damping: 28, stiffness: 120 }

export default function Gallery() {
  const { t } = useTranslation('gallery')
  const [lightboxIndex, setLightboxIndex] = useState(null)

  const showPrev = useCallback(() => {
    setLightboxIndex(i => i > 0 ? i - 1 : galleryImages.length - 1)
  }, [])

  const showNext = useCallback(() => {
    setLightboxIndex(i => i < galleryImages.length - 1 ? i + 1 : 0)
  }, [])

  return (
    <>
      <section
        className="pt-24 pb-16 md:pt-32 md:pb-20"
        style={{ background: 'var(--color-bg-alt)' }}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={spring}
            className="eyebrow eyebrow-center mb-4"
          >
            {t('hero.title')}
          </motion.div>
          <motion.h1
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...spring, delay: 0.1 }}
            className="text-4xl md:text-5xl lg:text-6xl font-bold mb-4"
          >
            {t('hero.title')}
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...spring, delay: 0.2 }}
            className="text-lg max-w-2xl mx-auto"
            style={{ color: 'var(--color-text-muted)' }}
          >
            {t('hero.subtitle')}
          </motion.p>
        </div>
      </section>

      <section className="py-16 md:py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div
            className="gallery-masonry"
            style={{ columns: '2', columnGap: 16 }}
          >
            <style>{`
              @media (min-width: 1024px) {
                .gallery-masonry { columns: 3 !important; }
              }
            `}</style>
            {galleryImages.map((img, i) => (
              <motion.button
                key={i}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-30px' }}
                transition={{ ...spring, delay: i * 0.04 }}
                onClick={() => setLightboxIndex(i)}
                className="gallery-item"
                style={{ aspectRatio: i % 3 === 0 ? '3/4' : '4/3', marginBottom: 16 }}
              >
                <img
                  src={img}
                  alt=""
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
                <div className="gallery-overlay">
                  <Search size={24} />
                </div>
              </motion.button>
            ))}
          </div>

          <div className="text-center mt-10 text-sm" style={{ color: 'var(--color-text-muted)' }}>
            {galleryImages.length} {t('images') || 'images'}
          </div>
        </div>
      </section>

      {lightboxIndex !== null && (
        <Lightbox
          images={galleryImages}
          currentIndex={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
          onPrev={showPrev}
          onNext={showNext}
        />
      )}
    </>
  )
}
