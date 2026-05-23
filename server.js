import express from 'express'
import multer from 'multer'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'
import { createClient } from '@supabase/supabase-js'
import nodemailer from 'nodemailer'
import QRCodeLib from 'qrcode'
import rateLimit from 'express-rate-limit'
import ws from 'ws'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const uploadDir = path.resolve(__dirname, 'upload')
const distDir = path.resolve(__dirname, 'dist')

fs.mkdirSync(uploadDir, { recursive: true })

const supabaseAdmin = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { realtime: { transport: ws } },
)

// --- Helpers ---

const escapeHtml = (str) => {
  if (typeof str !== 'string') return ''
  return str.replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
  )
}

const requireAuth = async (req, res, next) => {
  const token = req.headers.authorization?.replace('Bearer ', '')
  if (!token) return res.status(401).json({ error: 'Unauthorized' })
  const { data, error } = await supabaseAdmin.auth.getUser(token)
  if (error || !data?.user) return res.status(401).json({ error: 'Unauthorized' })
  req.user = data.user
  next()
}

const requireRole = (...roles) => async (req, res, next) => {
  const { data: admin } = await supabaseAdmin
    .from('admin_users')
    .select('*, role:admin_roles(name)')
    .eq('user_id', req.user.id)
    .single()
  if (!admin?.is_active) return res.status(403).json({ error: 'Forbidden' })
  const userRole = admin.role?.name
  if (!roles.includes(userRole) && userRole !== 'super_admin')
    return res.status(403).json({ error: 'Forbidden' })
  req.adminProfile = admin
  next()
}

// --- Rate limiting ---

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
})
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
})

// --- Multer with file-type whitelist ---

const allowedExts = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg']

const storage = multer.diskStorage({
  destination: uploadDir,
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase()
    const name = `${Date.now()}_${Math.random().toString(36).slice(2)}${ext}`
    cb(null, name)
  },
})

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase()
    if (allowedExts.includes(ext)) return cb(null, true)
    cb(new Error(`File type ${ext} not allowed`))
  },
})

const app = express()
app.use(express.json())
app.use('/api/', apiLimiter)

// --- File uploads ---

app.post('/api/upload', requireAuth, (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file' })
  res.json({ url: `/uploads/${req.file.filename}` })
})

app.delete('/api/upload', requireAuth, (req, res) => {
  const { url } = req.body
  if (!url) return res.status(400).json({ error: 'No url' })
  const filename = path.basename(url)
  const filepath = path.join(uploadDir, filename)
  if (fs.existsSync(filepath)) fs.unlinkSync(filepath)
  res.json({ ok: true })
})

app.use('/uploads', express.static(uploadDir))

// --- Admin user management (service_role required) ---

app.post('/api/admin/users', requireAuth, requireRole('super_admin'), async (req, res) => {
  const { email, password, full_name, role_id } = req.body
  if (!password || password.length < 8)
    return res.status(400).json({ error: 'Password must be at least 8 characters' })
  const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
    email, password, email_confirm: true,
  })
  if (authError) {
    console.error('Create admin auth error:', authError)
    return res.status(400).json({ error: 'Failed to create user' })
  }
  const { error: insertError } = await supabaseAdmin.from('admin_users').insert({
    user_id: authData.user.id,
    email,
    full_name,
    role_id: parseInt(role_id),
    is_active: true,
  })
  if (insertError) {
    console.error('Create admin insert error:', insertError)
    await supabaseAdmin.auth.admin.deleteUser(authData.user.id)
    return res.status(400).json({ error: 'Failed to create admin record' })
  }
  res.json({ ok: true })
})

app.delete('/api/admin/users/:id', requireAuth, requireRole('super_admin'), async (req, res) => {
  const { id } = req.params
  const { data: admin } = await supabaseAdmin.from('admin_users').select('user_id').eq('id', id).single()
  if (admin) {
    await supabaseAdmin.auth.admin.deleteUser(admin.user_id)
    await supabaseAdmin.from('admin_users').delete().eq('id', id)
  }
  res.json({ ok: true })
})

// --- Email auto-reply ---

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: process.env.SMTP_PORT === '465',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
})

const sendEmail = async ({ to, subject, html }) => {
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    console.log(`[EMAIL SKIPPED] No SMTP configured. Would send to ${to}: ${subject}`)
    return { ok: true, skipped: true }
  }
  await transporter.sendMail({
    from: process.env.EMAIL_FROM || '"AFAQ Scientific Club" <noreply@afaq-club.dz>',
    to,
    subject,
    html,
  })
  return { ok: true }
}

app.post('/api/email/registration-confirmation', async (req, res) => {
  const { email, name, event_title, date } = req.body
  try {
    const safeName = escapeHtml(name)
    const safeEvent = escapeHtml(event_title)
    const safeDate = date ? escapeHtml(date) : ''
    await sendEmail({
      to: email,
      subject: `Registration Confirmed — ${safeEvent}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 560px; margin: 0 auto;">
          <div style="background: #0F172A; padding: 24px; text-align: center;">
            <h1 style="color: #fff; margin: 0; font-size: 22px;">AFAQ Scientific Club</h1>
          </div>
          <div style="padding: 32px 24px; background: #f8fafc;">
            <h2 style="margin: 0 0 8px;">Hello ${safeName},</h2>
            <p style="color: #475569; font-size: 15px; line-height: 1.6;">
              Thank you for registering for <strong>${safeEvent}</strong>.
              ${safeDate ? `The event will take place on <strong>${safeDate}</strong>.` : ''}
            </p>
            <p style="color: #475569; font-size: 15px; line-height: 1.6;">
              We look forward to seeing you there! Stay tuned for further details.
            </p>
            <p style="color: #94a3b8; font-size: 13px; margin-top: 24px;">
              Best regards,<br/>AFAQ Scientific Club Team
            </p>
          </div>
        </div>
      `,
    })
    res.json({ ok: true })
  } catch (err) {
    console.error('Email error:', err)
    res.status(500).json({ error: 'Failed to send email' })
  }
})

app.post('/api/email/membership-confirmation', async (req, res) => {
  const { email, name } = req.body
  try {
    const safeName = escapeHtml(name)
    await sendEmail({
      to: email,
      subject: 'Membership Application Received — AFAQ Scientific Club',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 560px; margin: 0 auto;">
          <div style="background: #0F172A; padding: 24px; text-align: center;">
            <h1 style="color: #fff; margin: 0; font-size: 22px;">AFAQ Scientific Club</h1>
          </div>
          <div style="padding: 32px 24px; background: #f8fafc;">
            <h2 style="margin: 0 0 8px;">Thank You, ${safeName}!</h2>
            <p style="color: #475569; font-size: 15px; line-height: 1.6;">
              We have received your membership application. Our team will review it and
              get back to you soon.
            </p>
            <p style="color: #475569; font-size: 15px; line-height: 1.6;">
              If you have any questions, feel free to reach out to us via the contact page.
            </p>
            <p style="color: #94a3b8; font-size: 13px; margin-top: 24px;">
              Best regards,<br/>AFAQ Scientific Club Team
            </p>
          </div>
        </div>
      `,
    })
    res.json({ ok: true })
  } catch (err) {
    console.error('Email error:', err)
    res.status(500).json({ error: 'Failed to send email' })
  }
})

// --- Approve endpoints (update DB + send email) ---

app.post('/api/approve/registration', requireAuth, requireRole('super_admin', 'event_manager'), async (req, res) => {
  const { id } = req.body
  if (!id) return res.status(400).json({ error: 'Missing id' })

  const { data: reg, error: fetchErr } = await supabaseAdmin
    .from('event_registrations')
    .select('*, event:events(title_en, title_ar, title_fr, date)')
    .eq('id', id)
    .single()
  if (fetchErr || !reg) {
    console.error('Fetch registration error:', fetchErr)
    return res.status(404).json({ error: 'Registration not found' })
  }

  const payload = JSON.stringify({ id: reg.id, event: reg.event?.title_en || '', name: reg.full_name, email: reg.email })
  const qrDataUrl = await QRCodeLib.toDataURL(payload, { width: 300, margin: 2 })

  const { error: updateErr } = await supabaseAdmin
    .from('event_registrations')
    .update({ status: 'approved', qr_code: qrDataUrl })
    .eq('id', id)
  if (updateErr) {
    console.error('Update registration error:', updateErr)
    return res.status(500).json({ error: 'Failed to approve registration' })
  }

  const eventTitle = reg.event ? (reg.event.title_en || '') : ''
  const eventDate = reg.event?.date ? new Date(reg.event.date + 'T00:00:00').toLocaleDateString() : ''
  const safeName = escapeHtml(reg.full_name)
  const safeEvent = escapeHtml(eventTitle)
  const safeDate = escapeHtml(eventDate)

  await sendEmail({
    to: reg.email,
    subject: `Registration Approved — ${safeEvent}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 560px; margin: 0 auto;">
        <div style="background: #0F172A; padding: 24px; text-align: center;">
          <h1 style="color: #fff; margin: 0; font-size: 22px;">AFAQ Scientific Club</h1>
        </div>
        <div style="padding: 32px 24px; background: #f8fafc;">
          <h2 style="margin: 0 0 8px;">Congratulations ${safeName}!</h2>
          <p style="color: #475569; font-size: 15px; line-height: 1.6;">
            Your registration for <strong>${safeEvent}</strong> has been <strong>approved</strong>.
            ${safeDate ? `The event takes place on <strong>${safeDate}</strong>.` : ''}
          </p>
          <p style="color: #475569; font-size: 15px; line-height: 1.6;">
            Your QR code is attached below. Please present it at the entrance.
          </p>
          <div style="text-align: center; margin: 20px 0;">
            <img src="${qrDataUrl}" alt="QR Code" style="width: 180px; height: 180px; border-radius: 12px;" />
          </div>
          <p style="color: #94a3b8; font-size: 13px; margin-top: 24px;">
            Best regards,<br/>AFAQ Scientific Club Team
          </p>
        </div>
      </div>
    `,
  })

  res.json({ ok: true })
})

app.post('/api/approve/membership', requireAuth, requireRole('super_admin', 'event_manager'), async (req, res) => {
  const { id } = req.body
  if (!id) return res.status(400).json({ error: 'Missing id' })

  const { data: app, error: fetchErr } = await supabaseAdmin
    .from('membership_applications')
    .select('*')
    .eq('id', id)
    .single()
  if (fetchErr || !app) {
    console.error('Fetch application error:', fetchErr)
    return res.status(404).json({ error: 'Application not found' })
  }

  const { error: updateErr } = await supabaseAdmin
    .from('membership_applications')
    .update({ status: 'approved' })
    .eq('id', id)
  if (updateErr) {
    console.error('Update application error:', updateErr)
    return res.status(500).json({ error: 'Failed to approve application' })
  }

  const safeName = escapeHtml(app.full_name)

  await sendEmail({
    to: app.email,
    subject: 'Membership Approved — Welcome to AFAQ!',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 560px; margin: 0 auto;">
        <div style="background: #0F172A; padding: 24px; text-align: center;">
          <h1 style="color: #fff; margin: 0; font-size: 22px;">AFAQ Scientific Club</h1>
        </div>
        <div style="padding: 32px 24px; background: #f8fafc;">
          <h2 style="margin: 0 0 8px;">Welcome to AFAQ, ${safeName}!</h2>
          <p style="color: #475569; font-size: 15px; line-height: 1.6;">
            Your membership application has been <strong>approved</strong>! We are thrilled
            to have you on board.
          </p>
          <p style="color: #475569; font-size: 15px; line-height: 1.6;">
            Stay tuned for upcoming events, workshops, and projects. You are now part of a
            community where technology meets innovation.
          </p>
          <p style="color: #94a3b8; font-size: 13px; margin-top: 24px;">
            Best regards,<br/>AFAQ Scientific Club Team
          </p>
        </div>
      </div>
    `,
  })

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
