import { useState, useEffect, useCallback, useMemo } from 'react'
import { motion } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import { Expand } from 'lucide-react'
import Lightbox from '../components/shared/Lightbox'
import SideImage from '../components/shared/SideImage'
import { supabase } from '../lib/supabase'

const spring = { type: 'spring', damping: 28, stiffness: 120 }

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
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="rounded-2xl p-3" style={{ background: 'var(--color-card)', border: '1px solid var(--color-border-light)' }}>
                  <div className="rounded-xl" style={{ paddingBottom: '75%', background: 'var(--color-bg-alt)', animation: 'shimmer 1.5s ease-in-out infinite' }} />
                </div>
              ))}
            </div>
          ) : images.length === 0 ? (
            <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-20 text-sm" style={{ color: 'var(--color-text-muted)' }}>{t('noImages')}</motion.p>
          ) : (
            <div className="space-y-20">
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
                    transition={{ ...spring, delay: gi * 0.06 }}
                  >
                    {albumTitle && (
                      <div className="flex items-center gap-5 mb-10">
                        <div className="flex-1 min-w-0">
                          <h2 className="text-sm font-bold tracking-[0.2em] uppercase" style={{ color: 'var(--color-text)' }}>
                            {albumTitle}
                          </h2>
                        </div>
                        <div className="h-px flex-[2]" style={{ background: 'var(--color-border-light)' }} />
                        <span className="text-[11px] font-medium tracking-widest uppercase whitespace-nowrap" style={{ color: 'var(--color-text-muted)' }}>
                          {group.images.length} {group.images.length === 1 ? 'photo' : 'photos'}
                        </span>
                      </div>
                    )}

                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5 md:gap-6">
                      {group.images.map((img, i) => {
                        const rot = ((i % 5) - 2) * 0.8
                        return (
                          <motion.button
                            key={img.id || i}
                            initial={{ opacity: 0, y: 16, rotate: 0 }}
                            whileInView={{ opacity: 1, y: 0, rotate: rot }}
                            viewport={{ once: true, margin: '-30px' }}
                            transition={{ ...spring, delay: i * 0.04 }}
                            whileHover={{ rotate: 0, scale: 1.03, y: -4 }}
                            onClick={() => setLightboxIndex(images.indexOf(img))}
                            className="group cursor-pointer border-0 outline-none text-left"
                            style={{ perspective: 800 }}
                          >
                            <div
                              className="relative overflow-hidden transition-all duration-300 rounded-xl"
                              style={{
                                paddingBottom: '75%',
                                background: 'var(--color-bg-alt)',
                                boxShadow: '0 2px 8px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)',
                              }}
                            >
                              <img
                                src={img.url}
                                alt={img.alt_text || ''}
                                loading="lazy"
                                className="absolute inset-0 w-full h-full object-cover transition-all duration-500 group-hover:scale-105"
                              />
                              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors duration-300" />
                              <div className="absolute bottom-2 right-2 w-7 h-7 rounded-full bg-white/80 backdrop-blur-sm flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300 translate-y-1 group-hover:translate-y-0">
                                <Expand size={12} className="text-slate-800" />
                              </div>
                            </div>
                          </motion.button>
                        )
                      })}
                    </div>
                  </motion.div>
                )
              })}

              <div className="text-center">
                <span className="inline-flex items-center gap-2 px-5 py-2 rounded-full text-xs font-medium" style={{ background: 'var(--color-bg-alt)', color: 'var(--color-text-muted)' }}>
                  {images.length} {images.length === 1 ? 'image' : 'images'}
                </span>
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
