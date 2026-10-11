import { Router } from 'express'
import { validateChatRequest } from '../middleware/validator.js'
import { aiRateLimiter } from '../middleware/rateLimiter.js'
import { getAllClubInfo } from '../repositories/searchRepository.js'
import { buildContext } from '../services/contextBuilder.js'
import { sanitizeHistory } from '../services/assistantPrompt.js'
import { generateResponse, generateResponseStream, detectInjection, QuotaError } from '../services/geminiService.js'

const router = Router()

const OFF_TOPIC_REPLY = 'I can only answer questions about AFAQ Scientific Club. Please ask about the club, events, projects, or other club-related topics.'

// Club data changes rarely; rebuilding it for every message is wasted queries.
const CONTEXT_TTL_MS = 60_000
let cachedContext = { text: '', at: 0 }

async function getClubContext() {
  if (cachedContext.text && Date.now() - cachedContext.at < CONTEXT_TTL_MS) return cachedContext.text
  const text = buildContext(await getAllClubInfo())
  if (text !== cachedContext.text) answerCache.clear() // club data changed: old answers may be stale
  cachedContext = { text, at: Date.now() }
  return text
}

// Answers to opening questions ("how do I join?") are the same for everyone,
// so they are served from memory. Follow-ups depend on the conversation and
// are never cached.
const ANSWER_TTL_MS = 30 * 60_000
const ANSWER_CACHE_MAX = 300
const answerCache = new Map()

function answerKey(message, history) {
  if (history.length) return null
  return message.toLowerCase().replace(/[\s?!.؟،,]+/g, ' ').trim()
}

function getCachedAnswer(key) {
  if (!key) return null
  const hit = answerCache.get(key)
  if (!hit) return null
  if (Date.now() - hit.at > ANSWER_TTL_MS) {
    answerCache.delete(key)
    return null
  }
  return hit.text
}

function cacheAnswer(key, text) {
  if (!key || !text?.trim()) return
  if (answerCache.size >= ANSWER_CACHE_MAX) answerCache.delete(answerCache.keys().next().value)
  answerCache.set(key, { text, at: Date.now() })
}

function quotaMessage(error) {
  return `The AI assistant is temporarily unavailable due to high demand. Please try again in ${Math.ceil(error.retryAfter || 60)} seconds.`
}

router.post('/chat', aiRateLimiter, validateChatRequest, async (req, res) => {
  try {
    const { message } = req.body
    const history = sanitizeHistory(req.body.history)

    if (detectInjection(message)) return res.json({ reply: OFF_TOPIC_REPLY })

    const context = await getClubContext()
    const key = answerKey(message, history)
    const cached = getCachedAnswer(key)
    if (cached) return res.json({ reply: cached })

    const reply = await generateResponse(message, context, null, history)
    cacheAnswer(key, reply)
    res.json({ reply })
  } catch (error) {
    console.error('AI chat error:', error.message)

    if (error instanceof QuotaError) {
      return res.status(429).json({ error: quotaMessage(error), retryAfter: Math.ceil(error.retryAfter || 60) })
    }
    if (error.message?.includes('API_KEY')) {
      return res.status(500).json({ error: 'The AI assistant is not configured. Contact the site administrator.' })
    }
    res.status(500).json({ error: 'Sorry, I encountered an error. Please try again later.' })
  }
})

function startEventStream(res) {
  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')
  res.setHeader('X-Accel-Buffering', 'no')
}

function sendWhole(res, text) {
  startEventStream(res)
  res.write(`data: ${JSON.stringify({ text })}\n\n`)
  res.write('data: [DONE]\n\n')
  res.end()
}

router.post('/chat/stream', aiRateLimiter, validateChatRequest, async (req, res) => {
  try {
    const { message } = req.body
    const history = sanitizeHistory(req.body.history)

    if (detectInjection(message)) return sendWhole(res, OFF_TOPIC_REPLY)

    const context = await getClubContext()
    const key = answerKey(message, history)
    const cached = getCachedAnswer(key)
    if (cached) return sendWhole(res, cached)

    startEventStream(res)
    let full = ''

    try {
      for await (const chunk of generateResponseStream(message, context, null, history)) {
        full += chunk
        res.write(`data: ${JSON.stringify({ text: chunk })}\n\n`)
      }
      res.write('data: [DONE]\n\n')
      cacheAnswer(key, full)
    } catch (streamError) {
      // Provider errors can carry raw upstream pages; visitors get a plain message.
      console.error('Stream error:', streamError.message)
      const isQuota = streamError instanceof QuotaError
      if (!res.headersSent) {
        return res.status(isQuota ? 429 : 500).json({
          error: isQuota ? quotaMessage(streamError) : 'Sorry, the assistant could not answer right now. Please try again.',
        })
      }
      res.write(`data: ${JSON.stringify({ error: 'The assistant stopped before finishing. Please try again.' })}\n\n`)
    }

    res.end()
  } catch (error) {
    console.error('AI stream error:', error.message)
    if (!res.headersSent) {
      if (error instanceof QuotaError) return res.status(429).json({ error: quotaMessage(error) })
      res.status(500).json({ error: 'Sorry, I encountered an error.' })
    }
  }
})

export default router
