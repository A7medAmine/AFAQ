import express from 'express'
import multer from 'multer'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'
import { createClient } from '@supabase/supabase-js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const uploadDir = path.resolve(__dirname, 'upload')
const distDir = path.resolve(__dirname, 'dist')

fs.mkdirSync(uploadDir, { recursive: true })

const supabaseAdmin = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
)

const storage = multer.diskStorage({
  destination: uploadDir,
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname)
    const name = `${Date.now()}_${Math.random().toString(36).slice(2)}${ext}`
    cb(null, name)
  },
})

const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } })

const app = express()
app.use(express.json())

// --- File uploads ---

app.post('/api/upload', upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file' })
  res.json({ url: `/uploads/${req.file.filename}` })
})

app.delete('/api/upload', (req, res) => {
  const { url } = req.body
  if (!url) return res.status(400).json({ error: 'No url' })
  const filename = path.basename(url)
  const filepath = path.join(uploadDir, filename)
  if (fs.existsSync(filepath)) fs.unlinkSync(filepath)
  res.json({ ok: true })
})

app.use('/uploads', express.static(uploadDir))

// --- Admin user management (service_role required) ---

app.post('/api/admin/users', async (req, res) => {
  const { email, password, full_name, role_id } = req.body
  const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
    email, password, email_confirm: true,
  })
  if (authError) return res.status(400).json({ error: authError.message })
  const { error: insertError } = await supabaseAdmin.from('admin_users').insert({
    user_id: authData.user.id,
    email,
    full_name,
    role_id: parseInt(role_id),
    is_active: true,
  })
  if (insertError) return res.status(400).json({ error: insertError.message })
  res.json({ ok: true })
})

app.delete('/api/admin/users/:id', async (req, res) => {
  const { id } = req.params
  const { data: admin } = await supabaseAdmin.from('admin_users').select('user_id').eq('id', id).single()
  if (admin) {
    await supabaseAdmin.auth.admin.deleteUser(admin.user_id)
    await supabaseAdmin.from('admin_users').delete().eq('id', id)
  }
  res.json({ ok: true })
})

// --- SPA fallback (production) ---

if (fs.existsSync(distDir)) {
  app.use(express.static(distDir))
  app.get('/{*path}', (req, res) => {
    res.sendFile(path.join(distDir, 'index.html'))
  })
}

const PORT = process.env.PORT || 3001
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`)
})
