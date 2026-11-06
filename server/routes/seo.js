import { Router } from 'express'
import { supabaseAdmin } from '../db/client.js'

const router = Router()

const SITE_URL = 'https://afaq.club'

// Public pages that should show up in search. Login, registration, the portal
// and share links stay out: they are either private or noindex.
const STATIC_PAGES = [
  { path: '/', changefreq: 'weekly', priority: '1.0' },
  { path: '/about', changefreq: 'monthly', priority: '0.7' },
  { path: '/projects', changefreq: 'weekly', priority: '0.8' },
  { path: '/learn', changefreq: 'weekly', priority: '0.8' },
  { path: '/events', changefreq: 'weekly', priority: '0.9' },
  { path: '/gallery', changefreq: 'monthly', priority: '0.6' },
  { path: '/announcements', changefreq: 'weekly', priority: '0.7' },
  { path: '/join', changefreq: 'monthly', priority: '0.8' },
  { path: '/contact', changefreq: 'monthly', priority: '0.5' },
  { path: '/brand', changefreq: 'monthly', priority: '0.4' },
]

const escapeXml = (s) =>
  String(s).replace(/[<>&'"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' }[c]))

const lastmod = (row) => {
  const d = new Date(row.updated_at || row.created_at)
  return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10)
}

function urlEntry({ path, lastmod, changefreq, priority }) {
  return [
    '  <url>',
    `    <loc>${escapeXml(SITE_URL + path)}</loc>`,
    lastmod && `    <lastmod>${lastmod}</lastmod>`,
    changefreq && `    <changefreq>${changefreq}</changefreq>`,
    priority && `    <priority>${priority}</priority>`,
    '  </url>',
  ].filter(Boolean).join('\n')
}

// Built from the database so new projects and tutorials are listed as soon as
// they are published. If a query fails the static pages are still served.
router.get('/sitemap.xml', async (_req, res) => {
  const [projects, tutorials] = await Promise.all([
    supabaseAdmin.from('projects').select('id, updated_at, created_at').eq('is_published', true),
    supabaseAdmin.from('tutorials').select('slug, updated_at, created_at').eq('is_published', true),
  ])
  if (projects.error) console.error('Sitemap projects:', projects.error.message)
  if (tutorials.error) console.error('Sitemap tutorials:', tutorials.error.message)

  const entries = [
    ...STATIC_PAGES,
    ...(projects.data || []).map((p) => ({
      path: `/projects/${encodeURIComponent(p.id)}`,
      lastmod: lastmod(p),
      changefreq: 'monthly',
      priority: '0.6',
    })),
    ...(tutorials.data || []).map((t) => ({
      path: `/learn/${encodeURIComponent(t.slug)}`,
      lastmod: lastmod(t),
      changefreq: 'monthly',
      priority: '0.6',
    })),
  ]

  const xml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...entries.map(urlEntry),
    '</urlset>',
    '',
  ].join('\n')

  res.setHeader('Cache-Control', 'public, max-age=3600, s-maxage=3600')
  res.type('application/xml').send(xml)
})

export default router
