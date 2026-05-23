import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ChevronRight, Expand } from 'lucide-react'
import Lightbox from '../shared/Lightbox'
import SideImage from '../shared/SideImage'
import { supabase } from '../../lib/supabase'

const spring = { type: 'spring', damping: 28, stiffness: 120 }
const sizes = [
  { row: 'span 1', col: 'span 2' },
  { row: 'span 1', col: 'span 1' },
  { row: 'span 2', col: 'span 1' },
  { row: 'span 1', col: 'span 1' },
]

function getSize(i) {
  return sizes[i % sizes.length]
}

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

        <div className="hidden md:grid gap-3" style={{ gridTemplateColumns: 'repeat(4, 1fr)', gridAutoRows: '180px' }}>
          {images.map((url, i) => {
            const s = getSize(i)
            return (
              <motion.button
                key={i}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-30px' }}
                transition={{ ...spring, delay: i * 0.08 }}
                onClick={() => setLightboxIndex(i)}
                className="relative overflow-hidden rounded-2xl group cursor-pointer border-0 outline-none"
                style={{ gridRow: s.row, gridColumn: s.col }}
              >
                <img src={url} alt="" className="w-full h-full object-cover transition-all duration-500 group-hover:scale-105 group-hover:brightness-[1.05]" loading="lazy" />
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors duration-300" />
                <div className="absolute bottom-2 right-2 w-7 h-7 rounded-full bg-white/80 backdrop-blur-sm flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300 translate-y-1 group-hover:translate-y-0">
                  <Expand size={12} className="text-slate-800" />
                </div>
              </motion.button>
            )
          })}
        </div>

        <div className="grid grid-cols-2 gap-2 md:hidden">
          {images.map((url, i) => (
            <motion.button
              key={i}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ ...spring, delay: i * 0.06 }}
              onClick={() => setLightboxIndex(i)}
              className="relative overflow-hidden rounded-xl group cursor-pointer border-0 outline-none"
              style={{ aspectRatio: i % 3 === 0 ? '4/5' : '1' }}
            >
              <img src={url} alt="" className="w-full h-full object-cover transition-all duration-500 group-hover:scale-105" loading="lazy" />
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
