import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ChevronRight, Search } from 'lucide-react'
import Lightbox from '../shared/Lightbox'
import SideImage from '../shared/SideImage'
import { supabase } from '../../lib/supabase'

const spring = { type: 'spring', damping: 28, stiffness: 120 }

export default function GalleryPreview() {
  const { t } = useTranslation('home')
  const [images, setImages] = useState([])
  const [lightboxIndex, setLightboxIndex] = useState(null)

  useEffect(() => {
    supabase
      .from('gallery_images')
      .select('url')
      .order('sort_order')
      .limit(4)
      .then(({ data }) => {
        setImages((data || []).map(img => img.url))
      })
  }, [])

  const showPrev = useCallback(() => setLightboxIndex(i => i > 0 ? i - 1 : images.length - 1), [images.length])
  const showNext = useCallback(() => setLightboxIndex(i => i < images.length - 1 ? i + 1 : 0), [images.length])

  if (images.length === 0) return null

  return (
    <section className="py-16 md:py-20 relative z-0" style={{ background: 'var(--color-bg)' }}>
      <SideImage side="right" />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <div className="eyebrow eyebrow-center mb-4">{t('gallery.title')}</div>
          <h2 className="text-3xl md:text-4xl font-bold">{t('gallery.title')}</h2>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {images.map((url, i) => (
            <motion.button
              key={i}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-30px' }}
              transition={{ ...spring, delay: i * 0.08 }}
              onClick={() => setLightboxIndex(i)}
              className="gallery-item"
              style={{ aspectRatio: '4/3' }}
            >
              <img src={url} alt="" className="w-full h-full object-cover" loading="lazy" />
              <div className="gallery-overlay"><Search size={22} /></div>
            </motion.button>
          ))}
        </div>

        <div className="text-center mt-10">
          <Link to="/gallery" className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl font-semibold text-sm transition-all duration-200"
            style={{ background: '#fff', color: '#0F172A', border: '2px solid #0F172A' }}>
            {t('gallery.viewAll')} <ChevronRight size={15} />
          </Link>
        </div>
      </div>

      {lightboxIndex !== null && (
        <Lightbox
          images={images}
          currentIndex={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
          onPrev={showPrev}
          onNext={showNext}
        />
      )}
    </section>
  )
}
