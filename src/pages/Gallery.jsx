import { useState, useEffect, useCallback, useMemo } from 'react'
import { motion } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import { Search } from 'lucide-react'
import Lightbox from '../components/shared/Lightbox'
import SideImage from '../components/shared/SideImage'
import { supabase } from '../lib/supabase'

const spring = { type: 'spring', damping: 28, stiffness: 120 }
const staggerSpring = { type: 'spring', damping: 25, stiffness: 100 }

const sizes = ['tall', 'wide', 'square', 'wide', 'square', 'tall', 'square', 'big', 'square', 'wide']

function getSize(i) {
  const s = sizes[i % sizes.length]
  if (s === 'tall') return { gridRow: 'span 2', gridColumn: 'span 1' }
  if (s === 'wide') return { gridRow: 'span 1', gridColumn: 'span 2' }
  if (s === 'big')  return { gridRow: 'span 2', gridColumn: 'span 2' }
  return { gridRow: 'span 1', gridColumn: 'span 1' }
}

export default function Gallery() {
  const { t, i18n } = useTranslation('gallery')
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

  const imageUrls = useMemo(() => images.map(img => img.url), [images])

  const grouped = useMemo(() => {
    const map = {}
    images.forEach(img => {
      const albumId = img.album?.id || 'other'
      if (!map[albumId]) map[albumId] = { album: img.album, images: [] }
      map[albumId].images.push(img)
    })
    return Object.values(map)
  }, [images])

  return (
    <>
      <section className="pt-24 pb-16 md:pt-32 md:pb-20 relative overflow-hidden" style={{ background: 'var(--color-bg-alt)' }}>
        <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{
          backgroundImage: 'radial-gradient(circle at 25% 25%, var(--color-accent) 0%, transparent 50%), radial-gradient(circle at 75% 75%, var(--color-accent) 0%, transparent 50%)',
        }} />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative z-10">
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
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="rounded-2xl" style={{
                  background: 'var(--color-bg-alt)',
                  animation: 'shimmer 1.5s ease-in-out infinite',
                  aspectRatio: i % 3 === 0 ? '3/4' : i % 3 === 1 ? '4/3' : '1',
                }} />
              ))}
            </div>
          ) : images.length === 0 ? (
            <p className="text-center py-12 text-sm" style={{ color: 'var(--color-text-muted)' }}>{t('noImages')}</p>
          ) : (
            <div className="space-y-16">
              {grouped.map((group, gi) => {
                const lang = i18n.language
                const albumTitle = group.album
                  ? group.album[`title_${lang}`] || group.album.title_en || ''
                  : null

                return (
                  <motion.div
                    key={gi}
                    initial={{ opacity: 0, y: 40 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, margin: '-50px' }}
                    transition={{ ...spring, delay: gi * 0.08 }}
                  >
                    {albumTitle && (
                      <div className="flex items-center gap-4 mb-8">
                        <div className="h-px flex-1" style={{ background: 'var(--color-border-light)' }} />
                        <span className="text-xs font-semibold tracking-[0.15em] uppercase" style={{ color: 'var(--color-text-muted)' }}>
                          {albumTitle}
                        </span>
                        <div className="h-px flex-1" style={{ background: 'var(--color-border-light)' }} />
                      </div>
                    )}

                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-4 auto-rows-[160px] md:auto-rows-[200px]">
                      {group.images.map((img, i) => {
                        const size = getSize(gi * 1000 + i)
                        return (
                          <motion.button
                            key={img.id || i}
                            initial={{ opacity: 0, scale: 0.92 }}
                            whileInView={{ opacity: 1, scale: 1 }}
                            viewport={{ once: true, margin: '-30px' }}
                            transition={{ ...staggerSpring, delay: i * 0.04 }}
                            whileHover={{ scale: 1.02, zIndex: 10 }}
                            onClick={() => setLightboxIndex(images.indexOf(img))}
                            className="relative group overflow-hidden rounded-2xl border-0 outline-none"
                            style={{
                              ...size,
                              gridRowEnd: `span ${size.gridRow}`,
                              gridColumnEnd: `span ${size.gridColumn}`,
                            }}
                          >
                            <img
                              src={img.url}
                              alt={img.alt_text || ''}
                              loading="lazy"
                              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                            />
                            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-all duration-300 flex items-center justify-center">
                              <div className="p-3 rounded-full bg-white/90 text-slate-800 opacity-0 group-hover:opacity-100 transition-all duration-300 scale-50 group-hover:scale-100">
                                <Search size={18} />
                              </div>
                            </div>
                          </motion.button>
                        )
                      })}
                    </div>
                  </motion.div>
                )
              })}

              <div className="text-center text-sm" style={{ color: 'var(--color-text-muted)' }}>
                {images.length} {t('images') || 'images'}
              </div>
            </div>
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
