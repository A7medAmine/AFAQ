import { Helmet } from 'react-helmet-async'
import { useTranslation } from 'react-i18next'

export const SITE_NAME = 'AFAQ Scientific Club'
export const SITE_URL = 'https://afaq.club'
export const DEFAULT_IMAGE = `${SITE_URL}/images/og/og-default.jpg`
export const DEFAULT_DESCRIPTION =
  'A student club at the University of Akli Mohand Oulhadj — Bouira, pushing the boundaries of electronics, robotics, and creative technology.'

const OG_LOCALE = { ar: 'ar_DZ', fr: 'fr_FR', en: 'en_US' }

// Crawlers want absolute image URLs; uploads are sometimes stored as /uploads/...
const absoluteUrl = (src) => (src && src.startsWith('/') ? `${SITE_URL}${src}` : src)

/**
 * Per-route <head> tags. Client-rendered only (no SSR), so this helps
 * JS-executing crawlers (Google) and browser tabs; it does not reach
 * crawlers that don't run JS (Facebook/WhatsApp link previews) — that
 * would need server-side injection, out of scope here.
 */
export default function SEO({ title, description, path = '', image, type = 'website', jsonLd, noindex = false }) {
  const { i18n } = useTranslation()
  const lang = i18n.language?.slice(0, 2) || 'en'
  const fullTitle = title ? `${title} — ${SITE_NAME}` : SITE_NAME
  const desc = (description || DEFAULT_DESCRIPTION).trim()
  const url = `${SITE_URL}${path}`
  const customImage = absoluteUrl(image)
  const ogImage = customImage || DEFAULT_IMAGE

  return (
    <Helmet>
      <html lang={lang} dir={lang === 'ar' ? 'rtl' : 'ltr'} />
      <title>{fullTitle}</title>
      <meta name="description" content={desc} />
      {/* A noindex page must not point its canonical at another URL (the
          not-found page has no path of its own and would claim the homepage). */}
      {!noindex && <link rel="canonical" href={url} />}
      {noindex && <meta name="robots" content="noindex, nofollow" />}

      <meta property="og:site_name" content={SITE_NAME} />
      <meta property="og:type" content={type} />
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={desc} />
      {!noindex && <meta property="og:url" content={url} />}
      <meta property="og:image" content={ogImage} />
      <meta property="og:image:alt" content={title || SITE_NAME} />
      {/* The default card's size is known; a project or tutorial cover's isn't. */}
      {!customImage && <meta property="og:image:type" content="image/jpeg" />}
      {!customImage && <meta property="og:image:width" content="1200" />}
      {!customImage && <meta property="og:image:height" content="630" />}
      <meta property="og:locale" content={OG_LOCALE[lang] || OG_LOCALE.en} />

      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={desc} />
      <meta name="twitter:image" content={ogImage} />

      {jsonLd && (
        <script type="application/ld+json">{JSON.stringify(jsonLd)}</script>
      )}
    </Helmet>
  )
}
