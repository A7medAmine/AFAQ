import { Router } from 'express'
import { supabaseAdmin } from '../db/client.js'
import { requireAuth, requirePermission } from '../middleware/auth.js'
import { isEmailConfigured, sendEmail } from '../services/mailer.js'

const router = Router()

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const STATUS_LABEL = { needed: 'Needed', ordered: 'Ordered', ready: 'Ready', cancelled: 'Dropped' }

const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))
const siteUrl = req => process.env.VITE_APP_URL || req.headers.origin || ''

/**
 * Read-only view of a list for anyone holding its share link. Only what a
 * department needs to follow progress: no notes on who is doing what, no
 * contact details.
 */
router.get('/share/:token', async (req, res) => {
  const { token } = req.params
  if (!UUID.test(token)) return res.status(404).json({ error: 'This link is not valid.' })

  const { data: list, error } = await supabaseAdmin
    .from('need_lists')
    .select('id, title, scope, due_date, status, updated_at, event:events(title_en, date), department:departments(name)')
    .eq('share_token', token)
    .eq('is_template', false)
    .maybeSingle()
  if (error) { console.error('Shared needs list:', error); return res.status(500).json({ error: 'The list could not be loaded.' }) }
  if (!list) return res.status(404).json({ error: 'This link has been turned off or never existed.' })

  const [{ data: items, error: itemError }, { data: departments }] = await Promise.all([
    supabaseAdmin.from('need_items')
      .select('id, name, quantity, unit, kind, status, priority, department_id, updated_at')
      .eq('list_id', list.id).neq('status', 'cancelled').order('created_at'),
    supabaseAdmin.from('departments').select('id, name, color, sort_order').order('sort_order').order('name'),
  ])
  if (itemError) { console.error('Shared needs items:', itemError); return res.status(500).json({ error: 'The list could not be loaded.' }) }

  const { id: _id, ...publicList } = list
  res.set('Cache-Control', 'no-store')
  res.json({ list: publicList, items: items || [], departments: departments || [] })
})

/**
 * Emails everyone with open items on a list their own items, with a link to
 * it. Only people picked from the admins or members are reached — a name
 * typed by hand has no address.
 */
router.post('/:id/remind', requireAuth, requirePermission('needs.manage', 'event_manager'), async (req, res) => {
  const listId = Number(req.params.id)
  if (!Number.isInteger(listId)) return res.status(400).json({ error: 'Unknown list.' })
  if (!isEmailConfigured()) return res.status(503).json({ error: 'Email is not set up on this server.' })

  const { data: list } = await supabaseAdmin.from('need_lists').select('id, title, due_date').eq('id', listId).maybeSingle()
  if (!list) return res.status(404).json({ error: 'That list does not exist.' })

  const { data: items, error } = await supabaseAdmin
    .from('need_items')
    .select('name, quantity, unit, status, assignee, assignee_user_id, assignee_member_id')
    .eq('list_id', listId).in('status', ['needed', 'ordered'])
  if (error) return res.status(500).json({ error: 'The items could not be loaded.' })

  const userIds = [...new Set(items.map(i => i.assignee_user_id).filter(Boolean))]
  const memberIds = [...new Set(items.map(i => i.assignee_member_id).filter(Boolean))]
  const [admins, members] = await Promise.all([
    userIds.length ? supabaseAdmin.from('admin_users').select('user_id, full_name, email').in('user_id', userIds) : { data: [] },
    memberIds.length ? supabaseAdmin.from('members').select('id, full_name, email').in('id', memberIds) : { data: [] },
  ])

  const people = new Map() // email → { name, items }
  const add = (person, item) => {
    if (!person?.email) return
    const key = person.email.toLowerCase()
    if (!people.has(key)) people.set(key, { email: person.email, name: person.full_name, items: [] })
    people.get(key).items.push(item)
  }
  const adminById = new Map((admins.data || []).map(a => [a.user_id, a]))
  const memberById = new Map((members.data || []).map(m => [m.id, m]))
  let unreachable = 0
  for (const item of items) {
    const person = adminById.get(item.assignee_user_id) || memberById.get(item.assignee_member_id)
    if (person?.email) add(person, item)
    else if (item.assignee) unreachable++
  }

  const link = `${siteUrl(req)}/admin/needs/${list.id}`
  const due = list.due_date ? ` It is needed by ${list.due_date}.` : ''
  let sent = 0
  let failed = 0
  for (const person of people.values()) {
    const rows = person.items.map(i =>
      `<tr><td style="padding:6px 10px;border-bottom:1px solid #e5e7eb">${escape(i.name)}</td>` +
      `<td style="padding:6px 10px;border-bottom:1px solid #e5e7eb">${escape(i.quantity)}${i.unit ? ` ${escape(i.unit)}` : ''}</td>` +
      `<td style="padding:6px 10px;border-bottom:1px solid #e5e7eb">${STATUS_LABEL[i.status] || escape(i.status)}</td></tr>`).join('')
    const html = `<div style="font-family:Arial,sans-serif;color:#111827;max-width:560px">
      <p>Hello ${escape(person.name || '')},</p>
      <p>You have ${person.items.length} item${person.items.length === 1 ? '' : 's'} still open on <strong>${escape(list.title)}</strong>.${escape(due)}</p>
      <table style="border-collapse:collapse;width:100%;font-size:14px">
        <thead><tr style="background:#f3f4f6"><th align="left" style="padding:6px 10px">Item</th><th align="left" style="padding:6px 10px">Qty</th><th align="left" style="padding:6px 10px">Status</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
      ${link.startsWith('http') ? `<p><a href="${escape(link)}">Open the list</a> to mark items as ordered or ready.</p>` : ''}
      <p style="color:#6b7280;font-size:12px">AFAQ Scientific Club · logistics</p>
    </div>`
    try {
      await sendEmail({ to: person.email, subject: `Reminder: your items for ${list.title}`, html })
      sent++
    } catch (err) {
      console.error('Needs reminder failed:', person.email, err.message)
      failed++
    }
  }

  res.json({ sent, failed, unreachable })
})

export default router
