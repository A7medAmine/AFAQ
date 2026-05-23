import { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import { Search } from 'lucide-react'
import Lightbox from '../components/shared/Lightbox'
import SideImage from '../components/shared/SideImage'
import { supabase } from '../lib/supabase'

const spring = { type: 'spring', damping: 28, stiffness: 120 }

export default function Gallery() {
  const { t, i18n } = useTranslation('gallery')
  const lang = i18n.language
  const [images, setImages] = useState([])
  const [loading, setLoading] = useState(true)
  const [lightboxIndex, setLightboxIndex] = useState(null)

  useEffect(() => {
    supabase
      .from('gallery_images')
      .select('url, alt_text, sort_order, album:gallery_albums(id, title_en, title_ar, title_fr)')
      .order('sort_order')
      .then(({ data }) => {
        setImages(data || [])
        setLoading(false)
      })
  }, [])

  const showPrev = useCallback(() => {
    setLightboxIndex(i => i > 0 ? i - 1 : images.length - 1)
  }, [images.length])

  const showNext = useCallback(() => {
    setLightboxIndex(i => i < images.length - 1 ? i + 1 : 0)
  }, [images.length])

  const imageUrls = images.map(img => img.url)

  return (
    <>
      <section className="pt-24 pb-16 md:pt-32 md:pb-20" style={{ background: 'var(--color-bg-alt)' }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={spring} className="eyebrow eyebrow-center mb-4">
            {t('hero.title')}
          </motion.div>
          <motion.h1 initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ ...spring, delay: 0.1 }} className="text-4xl md:text-5xl lg:text-6xl font-bold mb-4">
            {t('hero.title')}
          </motion.h1>
          <motion.p initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ ...spring, delay: 0.2 }} className="text-lg max-w-2xl mx-auto" style={{ color: 'var(--color-text-muted)' }}>
            {t('hero.subtitle')}
          </motion.p>
        </div>
      </section>

      <section className="py-16 md:py-20 relative z-0">
        <SideImage side="right" />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {loading ? (
            <div className="columns-2 lg:columns-3 gap-4" style={{ columnGap: 16 }}>
              {[1, 2, 3, 4, 5, 6].map(i => (
                <div key={i} className="rounded-2xl mb-4" style={{ background: 'var(--color-bg-alt)', animation: 'shimmer 1.5s ease-in-out infinite', height: i % 2 === 0 ? 200 : 260 }} />
              ))}
            </div>
          ) : images.length === 0 ? (
            <p className="text-center py-12 text-sm" style={{ color: 'var(--color-text-muted)' }}>{t('noImages')}</p>
          ) : (
            <>
              <div className="gallery-masonry" style={{ columns: '2', columnGap: 16 }}>
                <style>{`
                  @media (min-width: 1024px) {
                    .gallery-masonry { columns: 3 !important; }
                  }
                `}</style>
                {images.map((img, i) => (
                  <motion.button
                    key={img.id || i}
                    initial={{ opacity: 0, y: 30 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, margin: '-30px' }}
                    transition={{ ...spring, delay: i * 0.04 }}
                    onClick={() => setLightboxIndex(i)}
                    className="gallery-item"
                    style={{ aspectRatio: i % 3 === 0 ? '3/4' : '4/3', marginBottom: 16 }}
                  >
                    <img src={img.url} alt={img.alt_text || ''} className="w-full h-full object-cover" loading="lazy" />
                    <div className="gallery-overlay"><Search size={24} /></div>
                  </motion.button>
                ))}
              </div>
              <div className="text-center mt-10 text-sm" style={{ color: 'var(--color-text-muted)' }}>
                {images.length} {t('images') || 'images'}
              </div>
            </>
          )}
        </div>
      </section>

      {lightboxIndex !== null && (
        <Lightbox
          images={imageUrls}
          currentIndex={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
          onPrev={showPrev}
          onNext={showNext}
        />
      )}
    </>
  )
}
