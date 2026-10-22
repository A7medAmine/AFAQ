import { useCallback, useState } from 'react'
import { motion } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import { Maximize2 } from 'lucide-react'
import Lightbox from '../shared/Lightbox'

const spring = { type: 'spring', damping: 28, stiffness: 120 }

// Order matters: it is the masonry flow and the lightbox order.
const SAMPLES = [
  { key: 'openWeekPoster', src: '/brand/samples/open-week-poster.webp', w: 1131, h: 1600 },
  { key: 'trifold', src: '/brand/samples/trifold-brochure.webp', w: 1600, h: 1132 },
  { key: 'slideWelcome', src: '/brand/samples/slide-welcome.webp', w: 1280, h: 1600 },
  { key: 'rollup', src: '/brand/samples/rollup-banner.webp', w: 680, h: 1600 },
  { key: 'slideOpenWeek', src: '/brand/samples/slide-open-week.webp', w: 1280, h: 1600 },
  { key: 'badgePresidentFront', src: '/brand/samples/badge-president-front.webp', w: 808, h: 566 },
  { key: 'badgePresidentBack', src: '/brand/samples/badge-president-back.webp', w: 808, h: 566 },
  { key: 'photoBooth', src: '/brand/samples/photo-booth-sheet.webp', w: 1080, h: 1528 },
  { key: 'slideWhoWeAre', src: '/brand/samples/slide-who-we-are.webp', w: 1280, h: 1600 },
  { key: 'flyerFront', src: '/brand/samples/opening-flyer-front.webp', w: 1131, h: 1600 },
  { key: 'badgeMediaFront', src: '/brand/samples/badge-media-front.webp', w: 808, h: 566 },
  { key: 'badgeMediaBack', src: '/brand/samples/badge-media-back.webp', w: 808, h: 566 },
  { key: 'flyerBack', src: '/brand/samples/opening-flyer-back.webp', w: 1131, h: 1600 },
  { key: 'trifoldRoute', src: '/brand/samples/trifold-inside.webp', w: 1600, h: 1132 },
  { key: 'wifi', src: '/brand/samples/wifi-poster.webp', w: 1131, h: 1600 },
  { key: 'espRacer', src: '/brand/samples/esp-racer-sheet.webp', w: 1131, h: 1600 },
]

export default function SamplesSection() {
  const { t } = useTranslation('brand')
  const [index, setIndex] = useState(null)
  const images = SAMPLES.map(s => s.src)

  const prev = useCallback(() => setIndex(i => (i > 0 ? i - 1 : SAMPLES.length - 1)), [])
  const next = useCallback(() => setIndex(i => (i < SAMPLES.length - 1 ? i + 1 : 0)), [])

  return (
    <>
      <div className="columns-1 sm:columns-2 lg:columns-3 gap-5">
        {SAMPLES.map((s, i) => (
          <motion.figure
            key={s.key}
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-40px' }}
            transition={{ ...spring, delay: (i % 3) * 0.06 }}
            className="bk-card bk-sample mb-5 break-inside-avoid overflow-hidden"
          >
            <button type="button" className="bk-sample-img" onClick={() => setIndex(i)} aria-label={t(`samples.items.${s.key}.t`)}>
              <img src={s.src} width={s.w} height={s.h} alt={t(`samples.items.${s.key}.t`)} loading="lazy" decoding="async" />
              <span className="bk-sample-zoom"><Maximize2 size={16} /></span>
            </button>
            <figcaption className="p-4 flex items-baseline justify-between gap-3">
              <span className="bk-title text-base">{t(`samples.items.${s.key}.t`)}</span>
              <span className="text-xs bk-muted text-end">{t(`samples.items.${s.key}.f`)}</span>
            </figcaption>
          </motion.figure>
        ))}
      </div>

      {index !== null && (
        <Lightbox images={images} currentIndex={index} onClose={() => setIndex(null)} onPrev={prev} onNext={next} />
      )}
    </>
  )
}
