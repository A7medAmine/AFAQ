import { Router } from 'express'
import { SCOPES, searchProducts } from '../services/digikeyService.js'
import { requireAuth, requireRole } from '../middleware/auth.js'

const router = Router()

// Same roles that hold inventory.manage on the client.
router.use(requireAuth, requireRole('event_manager'))

router.get('/search', async (req, res) => {
  const q = String(req.query.q || '').trim()
  if (q.length < 2) return res.status(400).json({ error: 'Enter at least 2 characters.' })
  if (q.length > 250) return res.status(400).json({ error: 'Search is too long.' })

  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 10, 1), 25)
  const scope = Object.hasOwn(SCOPES, req.query.scope) ? req.query.scope : 'boards'

  try {
    res.json(await searchProducts(q, limit, scope))
  } catch (error) {
    console.error('DigiKey search error:', error.message, error.detail || '')
    const status = error.status === 429 ? 429 : 502
    res.status(status).json({
      error: status === 429
        ? 'DigiKey rate limit reached. Try again in a minute.'
        : 'DigiKey search failed. Try again later.',
    })
  }
})

export default router
