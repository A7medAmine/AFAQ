import { Router } from 'express'
import multer from 'multer'
import { supabaseAdmin } from '../db/client.js'
import { requireAuth, requireRole } from '../middleware/auth.js'
import { buildICS, parseICS } from '../services/icsService.js'

const router = Router()

const icsUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024 }, // 2MB — a calendar export, not a video
  fileFilter: (req, file, cb) => {
    if (/\.ics$/i.test(file.originalname)) return cb(null, true)
    cb(new Error('Only .ics files are accepted'))
  },
})

// --- Public export: subscribe to, or download, published events ---

router.get('/calendar.ics', async (req, res) => {
  const { data, error } = await supabaseAdmin
    .from('events')
    .select('id, title_en, description_en, location_en, date, time')
    .eq('is_published', true)
    .order('date', { ascending: true })

  if (error) return res.status(500).send('Could not build the calendar feed.')

  res.setHeader('Content-Type', 'text/calendar; charset=utf-8')
  res.setHeader('Content-Disposition', 'inline; filename="afaq-events.ics"')
  res.send(buildICS(data || []))
})

router.get('/:id.ics', async (req, res) => {
  const { id } = req.params
  const { data, error } = await supabaseAdmin
    .from('events')
    .select('id, title_en, description_en, location_en, date, time')
    .eq('id', id)
    .eq('is_published', true)
    .maybeSingle()

  if (error || !data) return res.status(404).send('Event not found.')

  res.setHeader('Content-Type', 'text/calendar; charset=utf-8')
  res.setHeader('Content-Disposition', `attachment; filename="${data.title_en.replace(/[^\w-]+/g, '-')}.ics"`)
  res.send(buildICS([data]))
})

// --- Admin import: preview an .ics file or feed URL, then create drafts ---

const requireEditor = [requireAuth, requireRole('super_admin', 'event_manager')]

router.post('/import/preview', requireEditor, icsUpload.single('file'), async (req, res) => {
  try {
    let text
    if (req.file) {
      text = req.file.buffer.toString('utf-8')
    } else {
      const url = (req.body?.icsUrl || '').trim()
      if (!/^https?:\/\//i.test(url)) return res.status(400).json({ error: 'Give an http(s) calendar URL, or upload a .ics file.' })
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 10000)
      try {
        const upstream = await fetch(url, { signal: controller.signal })
        if (!upstream.ok) return res.status(400).json({ error: `That calendar URL returned ${upstream.status}.` })
        text = await upstream.text()
      } catch {
        return res.status(400).json({ error: 'Could not reach that calendar URL.' })
      } finally {
        clearTimeout(timeout)
      }
    }

    const events = parseICS(text)
    if (!events.length) return res.status(400).json({ error: 'No events found in that calendar.' })
    res.json({ events })
  } catch (error) {
    console.error('Calendar import preview error:', error.message)
    res.status(400).json({ error: 'Could not read that as a calendar (.ics) file.' })
  }
})

router.post('/import/confirm', requireEditor, async (req, res) => {
  try {
    const events = Array.isArray(req.body?.events) ? req.body.events : []
    if (!events.length) return res.status(400).json({ error: 'No events selected.' })

    const rows = events
      .filter(e => e.title && e.date)
      .map(e => ({
        title_en: String(e.title).slice(0, 300),
        description_en: e.description ? String(e.description).slice(0, 5000) : null,
        location_en: e.location ? String(e.location).slice(0, 300) : null,
        date: e.date,
        time: e.time || null,
        is_published: false,
        registration_open: false,
        created_by: req.user.id,
      }))

    if (!rows.length) return res.status(400).json({ error: 'None of the selected events had a title and date.' })

    const { data, error } = await supabaseAdmin.from('events').insert(rows).select('id')
    if (error) return res.status(500).json({ error: 'The events did not save.' })

    res.json({ ok: true, created: data.length })
  } catch (error) {
    console.error('Calendar import confirm error:', error.message)
    res.status(500).json({ error: 'The import did not complete.' })
  }
})

export default router
