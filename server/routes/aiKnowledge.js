import { Router } from 'express'
import {
  getAllKnowledge, getPublishedKnowledge, getKnowledgeByCategory,
  createKnowledge, updateKnowledge, deleteKnowledge,
} from '../repositories/aiKnowledgeRepository.js'

const router = Router()

function slugify(text) {
  return text.toString().toLowerCase().trim()
    .replace(/\s+/g, '-')
    .replace(/[^\w-]+/g, '')
    .replace(/--+/g, '-')
    .replace(/^-+/, '')
    .replace(/-+$/, '')
}

router.get('/', async (req, res) => {
  try {
    const { category, published } = req.query
    if (category) {
      const results = await getKnowledgeByCategory(category)
      return res.json(results)
    }
    const all = await getAllKnowledge()
    res.json(all)
  } catch (error) {
    console.error('Get knowledge error:', error)
    res.status(500).json({ error: 'Failed to fetch knowledge' })
  }
})

router.get('/published', async (req, res) => {
  try {
    const results = await getPublishedKnowledge()
    res.json(results)
  } catch (error) {
    console.error('Get published knowledge error:', error)
    res.status(500).json({ error: 'Failed to fetch published knowledge' })
  }
})

router.get('/categories', async (req, res) => {
  try {
    const all = await getAllKnowledge()
    const cats = [...new Set(all.map(a => a.category).filter(Boolean))]
    res.json(cats)
  } catch (error) {
    console.error('Get categories error:', error)
    res.status(500).json({ error: 'Failed to fetch categories' })
  }
})

router.post('/', async (req, res) => {
  try {
    const { title, category, content, keywords, published } = req.body
    if (!title || !content) {
      return res.status(400).json({ error: 'title and content are required' })
    }
    let slug = slugify(title)
    if (!slug) slug = `article-${Date.now()}`
    const result = await createKnowledge({
      title, slug, category: category || null,
      content, keywords: keywords || [], published: published ?? true,
    })
    res.json(result)
  } catch (error) {
    console.error('Create knowledge error:', error)
    res.status(500).json({ error: 'Failed to create knowledge' })
  }
})

router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params
    const data = { ...req.body }
    if (data.title) {
      data.slug = slugify(data.title)
    }
    const result = await updateKnowledge(Number(id), data)
    res.json(result)
  } catch (error) {
    console.error('Update knowledge error:', error)
    res.status(500).json({ error: 'Failed to update knowledge' })
  }
})

router.patch('/:id/publish', async (req, res) => {
  try {
    const { id } = req.params
    const { published } = req.body
    const result = await updateKnowledge(Number(id), { published })
    res.json(result)
  } catch (error) {
    console.error('Toggle publish error:', error)
    res.status(500).json({ error: 'Failed to toggle publish status' })
  }
})

router.delete('/:id', async (req, res) => {
  try {
    await deleteKnowledge(Number(req.params.id))
    res.json({ ok: true })
  } catch (error) {
    console.error('Delete knowledge error:', error)
    res.status(500).json({ error: 'Failed to delete knowledge' })
  }
})

export default router
