import { Router } from 'express'
import { requireAuth, requireRole } from '../middleware/auth.js'
import { generateResponse, QuotaError } from '../services/geminiService.js'
import { TEMPLATE_VARIABLES } from '../../src/lib/emailTemplate.js'

const router = Router()

const requireEditor = [requireAuth, requireRole('super_admin', 'event_manager', 'project_manager', 'media_manager')]

const LANG_NAMES = { en: 'English', ar: 'Arabic', fr: 'French' }

function buildSystem(action, targetLang) {
  if (action === 'translate') {
    const target = LANG_NAMES[targetLang]
    return `You are a professional translator for AFAQ Scientific Club, a student robotics and science club. Translate the given text into ${target}. Preserve tone, meaning, and any line breaks or formatting. Return ONLY the translated text — no explanations, no quotes, no notes.`
  }
  return `You are a content editor for AFAQ Scientific Club, a student robotics and science club website. Improve the given text: fix grammar and spelling, make it clearer and more engaging, keep it professional, and keep it in its ORIGINAL language. Keep roughly the same length. Return ONLY the improved text — no explanations, no quotes, no notes.`
}

router.post('/content-assist', requireEditor, async (req, res) => {
  try {
    const { text, action, targetLang } = req.body
    if (!text || !text.trim()) return res.status(400).json({ error: 'text is required' })
    if (!['improve', 'translate'].includes(action)) return res.status(400).json({ error: 'action must be "improve" or "translate"' })
    if (action === 'translate' && !LANG_NAMES[targetLang]) return res.status(400).json({ error: 'targetLang must be en, ar or fr' })

    const system = buildSystem(action, targetLang)
    const result = await generateResponse(text, null, system)
    if (!result) return res.status(500).json({ error: 'The AI assistant is not configured.' })

    res.json({ text: result.trim() })
  } catch (error) {
    console.error('Content assist error:', error.message)
    if (error instanceof QuotaError) {
      const seconds = Math.ceil(error.retryAfter || 60)
      return res.status(429).json({ error: `The AI assistant is busy. Try again in ${seconds} seconds.`, retryAfter: seconds })
    }
    res.status(500).json({ error: 'Sorry, that did not work. Please try again.' })
  }
})

const requireEmailer = [requireAuth, requireRole('event_manager', 'media_manager', 'project_manager')]

const EMAIL_THEME_SYSTEM = `You design HTML email templates for AFAQ Scientific Club, a student robotics and science club.
Return ONE complete HTML email document (<!doctype html> … </html>) and NOTHING else — no markdown fences, no explanations.

Rules:
- Email-client safe: table-based layout, max-width 600px, inline styles only (a <style> block in <head> is allowed only for media queries).
- No <script>, no forms, no iframes, no external fonts or CSS, no JavaScript. Images only if the admin asks, as absolute https URLs.
- Use web-safe font stacks such as 'Segoe UI', Tahoma, Arial, sans-serif.
- Write placeholders exactly as {{name}} — they are filled per recipient. Available: ${TEMPLATE_VARIABLES.map(v => `{{${v.key}}} (${v.label})`).join(', ')}.
- Normally include {{content}} (the message text) and a button linking to {{link}}. Greet with {{first_name}} when it fits.
- Keep it compact: under 7000 characters. Make it look polished and on-theme with what the admin asks for.
- When the admin gives you an existing template, modify it according to the request instead of starting over.`

/** Defence in depth: the preview frame is sandboxed, but the HTML is also mailed out. */
function sanitizeEmailHtml(html) {
  return html
    .replace(/<\s*(script|iframe|object|embed|form)\b[\s\S]*?<\s*\/\s*\1\s*>/gi, '')
    .replace(/<\s*\/?\s*(script|iframe|object|embed|form|input|button|link|base)\b[^>]*>/gi, '')
    .replace(/<\s*meta\b[^>]*http-equiv[^>]*>/gi, '')
    .replace(/\son[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/(href|src)\s*=\s*(["'])\s*(javascript|vbscript|data):[^"']*\2/gi, '$1="#"')
}

function extractHtml(raw) {
  const text = String(raw || '').replace(/^```(?:html)?\s*/i, '').replace(/```\s*$/, '').trim()
  const start = text.search(/<!doctype html|<html/i)
  const end = text.toLowerCase().lastIndexOf('</html>')
  if (start === -1 || end === -1 || end < start) return null
  return text.slice(start, end + '</html>'.length)
}

router.post('/email-template', requireEmailer, async (req, res) => {
  try {
    const prompt = String(req.body?.prompt || '').trim()
    const current = String(req.body?.current_html || '').trim()
    if (!prompt) return res.status(400).json({ error: 'Describe the template you want.' })
    if (prompt.length > 1500) return res.status(400).json({ error: 'Keep the request under 1500 characters.' })
    if (current.length > 30000) return res.status(400).json({ error: 'The current template is too long to edit with the AI.' })

    const message = current
      ? `Existing template:\n${current}\n\nRequested change:\n${prompt}`
      : `Design a new email template:\n${prompt}`

    const result = await generateResponse(message, null, EMAIL_THEME_SYSTEM)
    if (!result) return res.status(500).json({ error: 'The AI assistant is not configured.' })

    const html = extractHtml(result)
    if (!html) return res.status(502).json({ error: 'The AI returned an incomplete template. Try again or shorten the request.' })

    res.json({ html: sanitizeEmailHtml(html) })
  } catch (error) {
    console.error('Email template AI error:', error.message)
    if (error instanceof QuotaError) {
      const seconds = Math.ceil(error.retryAfter || 60)
      return res.status(429).json({ error: `The AI assistant is busy. Try again in ${seconds} seconds.`, retryAfter: seconds })
    }
    res.status(500).json({ error: 'Sorry, that did not work. Please try again.' })
  }
})

export default router
