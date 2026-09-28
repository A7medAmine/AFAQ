import { Helmet } from 'react-helmet-async'
import { useTranslation } from 'react-i18next'

export const SITE_NAME = 'AFAQ Scientific Club'
export const SITE_URL = 'https://afaq-club.com'
export const DEFAULT_IMAGE = `${SITE_URL}/images/hero/robocar.webp`

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
  const url = `${SITE_URL}${path}`
  const ogImage = image || DEFAULT_IMAGE

  return (
    <Helmet>
      <html lang={lang} dir={lang === 'ar' ? 'rtl' : 'ltr'} />
      <title>{fullTitle}</title>
      {description && <meta name="description" content={description} />}
      <link rel="canonical" href={url} />
      {noindex && <meta name="robots" content="noindex, nofollow" />}

      <meta property="og:site_name" content={SITE_NAME} />
      <meta property="og:type" content={type} />
      <meta property="og:title" content={fullTitle} />
      {description && <meta property="og:description" content={description} />}
      <meta property="og:url" content={url} />
      <meta property="og:image" content={ogImage} />
      <meta property="og:locale" content={lang === 'ar' ? 'ar_DZ' : lang === 'fr' ? 'fr_FR' : 'en_US'} />

      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={fullTitle} />
      {description && <meta name="twitter:description" content={description} />}
      <meta name="twitter:image" content={ogImage} />

      {jsonLd && (
        <script type="application/ld+json">{JSON.stringify(jsonLd)}</script>
      )}
    </Helmet>
  )
}
