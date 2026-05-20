import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ChevronRight, Search } from 'lucide-react'
import SectionHeader from '../shared/SectionHeader'
import Lightbox from '../shared/Lightbox'
import { galleryImages } from '../../data'

const spring = { type: 'spring', damping: 28, stiffness: 120 }

export default function GalleryPreview() {
  const { t } = useTranslation('home')
  const [lightboxIndex, setLightboxIndex] = useState(null)
  const preview = galleryImages.slice(0, 4)

  const showPrev = () => setLightboxIndex(i => i > 0 ? i - 1 : galleryImages.length - 1)
  const showNext = () => setLightboxIndex(i => i < galleryImages.length - 1 ? i + 1 : 0)

  return (
    <section className="py-16 md:py-20" style={{ background: 'var(--color-accent-soft)' }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <SectionHeader title={t('gallery.title')} />

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {preview.map((img, i) => (
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
              <img
                src={img}
                alt=""
                className="w-full h-full object-cover"
                loading="lazy"
              />
              <div className="gallery-overlay">
                <Search size={22} />
              </div>
            </motion.button>
          ))}
        </div>

        <div className="text-center mt-10">
          <Link
            to="/gallery"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-[100px] font-semibold text-sm transition-all duration-200"
            style={{ background: 'transparent', color: 'var(--color-accent)', border: '1.5px solid var(--color-accent)' }}
          >
            {t('gallery.viewAll')} <ChevronRight size={15} />
          </Link>
        </div>
      </div>

      {lightboxIndex !== null && (
        <Lightbox
          images={galleryImages}
          currentIndex={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
          onPrev={showPrev}
          onNext={showNext}
        />
      )}
    </section>
  )
}
