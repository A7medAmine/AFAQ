import { Router } from 'express'
import { validateChatRequest } from '../middleware/validator.js'
import { aiRateLimiter } from '../middleware/rateLimiter.js'
import { searchAll, getAllClubInfo } from '../repositories/searchRepository.js'
import { buildContext } from '../services/contextBuilder.js'
import { generateResponse, generateResponseStream, detectInjection, QuotaError } from '../services/geminiService.js'

const router = Router()

async function buildContextFromMessage(message) {
  const [searchResults, allClubData] = await Promise.all([
    searchAll(message),
    getAllClubInfo(),
  ])
  const searchContext = buildContext(searchResults)
  const fullContext = buildContext(allClubData)
  return [fullContext, searchContext].filter(Boolean).join('\n\n')
}

router.post('/chat', aiRateLimiter, validateChatRequest, async (req, res) => {
  try {
    const { message } = req.body

    if (detectInjection(message)) {
      return res.json({
        reply: 'I can only answer questions about AFAQ Scientific Club. Please ask about the club, events, projects, or other club-related topics.',
      })
    }

    const context = await buildContextFromMessage(message)

    const reply = await generateResponse(message, context)
    console.log('AI response:', reply?.slice(0, 100))

    res.json({ reply })
  } catch (error) {
    console.error('AI chat error:', error.message)

    if (error instanceof QuotaError) {
      const seconds = Math.ceil(error.retryAfter || 60)
      return res.status(429).json({
        error: `The AI assistant is temporarily unavailable due to high demand. Please try again in ${seconds} seconds.`,
        retryAfter: seconds,
      })
    }

    if (error.message?.includes('API_KEY')) {
      return res.status(500).json({
        error: 'The AI assistant is not configured. Contact the site administrator.',
      })
    }

    res.status(500).json({
      error: 'Sorry, I encountered an error. Please try again later.',
    })
  }
})

router.post('/chat/stream', aiRateLimiter, validateChatRequest, async (req, res) => {
  try {
    const { message } = req.body

    if (detectInjection(message)) {
      return res.json({
        reply: 'I can only answer questions about AFAQ Scientific Club. Please ask about the club, events, projects, or other club-related topics.',
      })
    }

    const context = await buildContextFromMessage(message)

    res.setHeader('Content-Type', 'text/event-stream')
    res.setHeader('Cache-Control', 'no-cache')
    res.setHeader('Connection', 'keep-alive')
    res.setHeader('X-Accel-Buffering', 'no')

    const stream = generateResponseStream(message, context)

    try {
      for await (const chunk of stream) {
        res.write(`data: ${JSON.stringify({ text: chunk })}\n\n`)
      }
      res.write('data: [DONE]\n\n')
    } catch (streamError) {
      console.error('Stream error:', streamError.message)
      if (streamError.stack) console.error('Stack:', streamError.stack.slice(0, 300))
      if (streamError instanceof QuotaError) {
        if (!res.headersSent) {
          return res.status(429).json({
            error: `The AI assistant is temporarily unavailable. Please try again in ${Math.ceil(streamError.retryAfter || 60)} seconds.`,
          })
        }
        res.write(`data: ${JSON.stringify({ error: 'AI assistant temporarily unavailable. Please try again.' })}\n\n`)
      } else if (!res.headersSent) {
        return res.status(500).json({ error: streamError.message || 'Stream failed' })
      } else {
        res.write(`data: ${JSON.stringify({ error: streamError.message || 'Stream failed' })}\n\n`)
      }
    }

    res.end()
  } catch (error) {
    console.error('AI stream error:', error.message)
    if (!res.headersSent) {
      if (error instanceof QuotaError) {
        return res.status(429).json({
          error: `The AI assistant is temporarily unavailable due to high demand. Please try again in ${Math.ceil(error.retryAfter || 60)} seconds.`,
        })
      }
      res.status(500).json({ error: 'Sorry, I encountered an error.' })
    }
  }
})

export default router
