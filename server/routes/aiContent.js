import { Router } from 'express'
import { requireAuth, requireRole } from '../middleware/auth.js'
import { generateResponse, QuotaError } from '../services/geminiService.js'

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

export default router
