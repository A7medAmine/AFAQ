import { Router } from 'express'
import { validateChatRequest } from '../middleware/validator.js'
import { aiRateLimiter } from '../middleware/rateLimiter.js'
import { searchAll, getAllClubInfo } from '../repositories/searchRepository.js'
import { buildContext } from '../services/contextBuilder.js'
import { generateResponse, detectInjection, QuotaError } from '../services/geminiService.js'

const router = Router()

router.post('/chat', aiRateLimiter, validateChatRequest, async (req, res) => {
  try {
    const { message } = req.body

    if (detectInjection(message)) {
      return res.json({
        reply: 'I can only answer questions about AFAQ Scientific Club. Please ask about the club, events, projects, or other club-related topics.',
      })
    }

    const [searchResults, allClubData] = await Promise.all([
      searchAll(message),
      getAllClubInfo(),
    ])

    const searchContext = buildContext(searchResults)
    const fullContext = buildContext(allClubData)

    const context = [fullContext, searchContext].filter(Boolean).join('\n\n')

    const reply = await generateResponse(message, context)
    console.log('AI response:', reply)

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

export default router
