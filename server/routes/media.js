import { Router } from 'express'
import { requireAuth, requirePermission } from '../middleware/auth.js'
import { generateResponse, QuotaError } from '../services/geminiService.js'

/**
 * AI help for the media planner: post ideas from a topic or event, and
 * captions in the club's three languages. Same providers as the rest of the
 * console's AI, so nothing here costs extra.
 */
const router = Router()

const requireMedia = [requireAuth, requirePermission('media.manage', 'media_manager')]

const CLUB = `AFAQ Scientific Club is a student science and robotics club (electronics, programming, AI, workshops, hackathons, competitions). Its audience is university and high-school students in Algeria. It posts in Arabic, French and English.`

const FORMATS = ['post', 'carousel', 'story', 'reel', 'video', 'article']
const PLATFORMS = ['instagram', 'facebook', 'tiktok', 'linkedin', 'x', 'youtube']

const clip = (value, max) => String(value ?? '').trim().slice(0, max)

/** The model wraps JSON in prose or fences now and then; take the first JSON value in the reply. */
function parseJson(raw) {
  const text = String(raw || '').replace(/```(?:json)?/gi, '').trim()
  const start = text.search(/[[{]/)
  if (start === -1) return null
  const open = text[start]
  const end = text.lastIndexOf(open === '[' ? ']' : '}')
  if (end <= start) return null
  try {
    return JSON.parse(text.slice(start, end + 1))
  } catch {
    return null
  }
}

function eventLines(event) {
  if (!event || typeof event !== 'object') return ''
  return [
    event.title && `Event: ${clip(event.title, 200)}`,
    event.date && `Date: ${clip(event.date, 40)}`,
    event.location && `Location: ${clip(event.location, 200)}`,
    event.description && `About: ${clip(event.description, 1500)}`,
  ].filter(Boolean).join('\n')
}

function sendError(res, error, label) {
  console.error(`${label}:`, error.message)
  if (error instanceof QuotaError) {
    const seconds = Math.ceil(error.retryAfter || 60)
    return res.status(429).json({ error: `The AI assistant is busy. Try again in ${seconds} seconds.`, retryAfter: seconds })
  }
  res.status(500).json({ error: 'Sorry, that did not work. Please try again.' })
}

router.post('/ideas', requireMedia, async (req, res) => {
  try {
    const topic = clip(req.body?.topic, 1000)
    const event = eventLines(req.body?.event)
    const count = Math.min(Math.max(Number(req.body?.count) || 6, 1), 12)
    if (!topic && !event) return res.status(400).json({ error: 'Give a topic or pick an event.' })

    const system = `${CLUB}
You are the club's social media strategist. Suggest ${count} distinct, concrete post ideas a small student media team can actually make.
Mix formats (${FORMATS.join(', ')}) and angles: behind the scenes, member spotlight, tutorial or tip, countdown, recap, fun fact, question to the audience.
Return ONLY a JSON array, no prose. Each item: {"title": short working title, "brief": 2-3 sentences on what the post shows and says, "format": one of ${FORMATS.join('|')}, "platforms": array from ${PLATFORMS.join('|')}, "shot_list": what the photographer should capture, or "" if no shoot is needed}.
Write titles and briefs in English.`

    const message = [topic && `Topic: ${topic}`, event].filter(Boolean).join('\n\n')
    const result = await generateResponse(message, null, system)
    if (!result) return res.status(500).json({ error: 'The AI assistant is not configured.' })

    const list = parseJson(result)
    if (!Array.isArray(list)) return res.status(502).json({ error: 'The AI returned something unreadable. Try again.' })

    const ideas = list.slice(0, count).map(item => ({
      title: clip(item?.title, 160) || 'Untitled idea',
      brief: clip(item?.brief, 1500),
      format: FORMATS.includes(item?.format) ? item.format : 'post',
      platforms: (Array.isArray(item?.platforms) ? item.platforms : []).filter(p => PLATFORMS.includes(p)),
      shot_list: clip(item?.shot_list, 1500),
    }))
    res.json({ ideas })
  } catch (error) {
    sendError(res, error, 'Media ideas AI error')
  }
})

const TONES = {
  friendly: 'warm, upbeat and welcoming, with a few fitting emoji',
  formal: 'professional and clear, no slang, at most one emoji',
  hype: 'energetic and exciting, short punchy lines, emoji welcome',
  informative: 'educational and precise, explains the idea simply',
}

router.post('/captions', requireMedia, async (req, res) => {
  try {
    const title = clip(req.body?.title, 200)
    const brief = clip(req.body?.brief, 2000)
    const event = eventLines(req.body?.event)
    const format = FORMATS.includes(req.body?.format) ? req.body.format : 'post'
    const platforms = (Array.isArray(req.body?.platforms) ? req.body.platforms : []).filter(p => PLATFORMS.includes(p))
    const tone = TONES[req.body?.tone] ? req.body.tone : 'friendly'
    const notes = clip(req.body?.notes, 1000)
    if (!title && !brief && !event) return res.status(400).json({ error: 'Write a title or brief first.' })

    const short = platforms.includes('x')
    const system = `${CLUB}
You write the club's social media captions. Tone: ${TONES[tone]}.
Write one caption for a ${format}${platforms.length ? ` going to ${platforms.join(', ')}` : ''} in each language: Arabic (Modern Standard, natural for Algerian students), French and English.
Each caption is written natively in its language, not translated word for word. Open with a strong first line (it shows before "more"). ${short ? 'Keep each caption under 260 characters so it fits X.' : 'Keep each caption under 900 characters.'}
End with a clear call to action when it fits. Do not put hashtags inside the captions.
Also suggest 6-10 relevant hashtags (mix Arabic and Latin), space separated, always including #AFAQ.
Return ONLY JSON: {"ar": "...", "fr": "...", "en": "...", "hashtags": "#AFAQ ..."}`

    const message = [
      title && `Post: ${title}`,
      brief && `Brief: ${brief}`,
      event,
      notes && `Extra instructions: ${notes}`,
    ].filter(Boolean).join('\n\n')

    const result = await generateResponse(message, null, system)
    if (!result) return res.status(500).json({ error: 'The AI assistant is not configured.' })

    const data = parseJson(result)
    if (!data || typeof data !== 'object' || Array.isArray(data)) {
      return res.status(502).json({ error: 'The AI returned something unreadable. Try again.' })
    }
    res.json({
      ar: clip(data.ar, 5000),
      fr: clip(data.fr, 5000),
      en: clip(data.en, 5000),
      hashtags: clip(data.hashtags, 600),
    })
  } catch (error) {
    sendError(res, error, 'Media captions AI error')
  }
})

const LANG_NAMES = { en: 'English', ar: 'Arabic (Modern Standard)', fr: 'French' }

// Improve or translate one caption. The console's content-assist endpoint
// is limited to built-in roles; media roles made in the console come here.
router.post('/rewrite', requireMedia, async (req, res) => {
  try {
    const text = clip(req.body?.text, 5000)
    const action = req.body?.action
    const target = LANG_NAMES[req.body?.targetLang]
    if (!text) return res.status(400).json({ error: 'There is no text to work on.' })
    if (!['improve', 'translate', 'shorten'].includes(action)) return res.status(400).json({ error: 'Unknown action.' })
    if (action === 'translate' && !target) return res.status(400).json({ error: 'targetLang must be en, ar or fr.' })

    const system = action === 'translate'
      ? `${CLUB}\nRewrite this social media caption in ${target} so it reads as if written natively in that language, keeping the meaning, tone, emoji and line breaks. Return ONLY the caption.`
      : action === 'shorten'
        ? `${CLUB}\nShorten this social media caption to under 260 characters in its original language, keeping the hook and the call to action. Return ONLY the caption.`
        : `${CLUB}\nImprove this social media caption in its original language: a stronger first line, clearer wording, correct spelling, same length or shorter. Return ONLY the caption.`

    const result = await generateResponse(text, null, system)
    if (!result) return res.status(500).json({ error: 'The AI assistant is not configured.' })
    res.json({ text: result.trim().replace(/^["']|["']$/g, '') })
  } catch (error) {
    sendError(res, error, 'Media rewrite AI error')
  }
})

export default router
