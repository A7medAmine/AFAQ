import { useEffect, useState } from 'react'
import { logActivity, run, supabase } from '../../lib/db'
import { toDateInput } from '../../lib/format'
import { CARD_STATUSES, GENDERS, MEMBER_STATUSES, splitList } from '../../lib/hr'
import Modal from '../ui/Modal'
import Button from '../ui/Button'
import { CheckField, SelectField, TextArea, TextField } from '../ui/Field'
import RoleField, { NEW_ROLE, saveRole } from './RoleField'

const blank = () => ({
  full_name: '', email: '', phone: '', student_id: '', department: '', study_year: '',
  team: '', status: 'active', card_status: 'active',
  joined_at: toDateInput(), left_at: '', birth_date: '', gender: '',
  skills: '', interests: '', notes: '',
  role: '', new_role: '', email_opt_out: false,
})

const fromMember = m => ({
  full_name: m.full_name || '',
  email: m.email || '',
  phone: m.phone || '',
  student_id: m.student_id || '',
  department: m.department || '',
  study_year: m.study_year || '',
  team: m.team || '',
  status: m.status || 'active',
  card_status: m.card_status || 'active',
  joined_at: m.joined_at || '',
  left_at: m.left_at || '',
  birth_date: m.birth_date || '',
  gender: m.gender || '',
  skills: (m.skills || []).join(', '),
  interests: (m.interests || []).join(', '),
  notes: m.notes || '',
  email_opt_out: !!m.email_opt_out,
})

/**
 * One form for adding and editing a member. The member number is never typed:
 * the database assigns it on insert, and it stays fixed so printed cards and
 * their QR codes keep verifying after an edit.
 *
 * @param member  the row to edit, or null to add a new member
 * @param teams        existing team names, offered as suggestions
 * @param customRoles  rows of member_roles; a new member can be given a role
 *                     straight away (roles of existing members are managed
 *                     from the detail drawer, where each term is kept)
 */
export default function MemberFormModal({ open, member, teams = [], customRoles = [], onClose, onSaved }) {
  const editing = !!member
  const [form, setForm] = useState(blank)
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open) {
      setForm(member ? fromMember(member) : blank())
      setErrors({})
    }
  }, [open, member])

  const set = (key, value) => {
    setForm(f => ({ ...f, [key]: value }))
    setErrors(e => ({ ...e, [key]: undefined }))
  }

  const submit = async () => {
    const next = {}
    if (!form.full_name.trim()) next.full_name = 'Enter the member’s name.'
    if (!form.email.trim()) next.email = 'Enter an email address.'
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) next.email = 'That is not a valid email address.'
    if (form.left_at && form.joined_at && form.left_at < form.joined_at) next.left_at = 'The leaving date is before the joining date.'
    if (!editing && form.role === NEW_ROLE && !form.new_role.trim()) next.new_role = 'Name the role.'
    if (Object.keys(next).length) { setErrors(next); return }

    const text = v => v.trim() || null
    const payload = {
      full_name: form.full_name.trim(),
      email: form.email.trim(),
      phone: text(form.phone),
      student_id: text(form.student_id),
      department: text(form.department),
      study_year: text(form.study_year),
      team: text(form.team),
      status: form.status,
      joined_at: form.joined_at || null,
      left_at: form.left_at || null,
      birth_date: form.birth_date || null,
      gender: form.gender || null,
      skills: splitList(form.skills),
      interests: splitList(form.interests),
      notes: text(form.notes),
      email_opt_out: form.email_opt_out,
    }

    setSaving(true)
    const { ok, data } = editing
      ? await run(
          supabase.from('members')
            .update({ ...payload, card_status: form.card_status, updated_at: new Date().toISOString() })
            .eq('id', member.id).select('*').single(),
          { success: 'Changes saved.', failure: 'The changes did not save.' }
        )
      : await run(
          supabase.from('members').insert(payload).select('*').single(),
          { success: `${payload.full_name} added to the club.`, failure: 'The member was not added.' }
        )
    if (ok && !editing && form.role) await assignRole(data)
    setSaving(false)
    if (!ok) return
    logActivity(editing ? 'updated' : 'created', 'members', data.id, { name: data.full_name })
    onSaved(data)
    onClose()
  }

  const assignRole = async created => {
    const title = await saveRole(form.role, form.new_role, customRoles)
    if (!title) return
    const { ok, data } = await run(
      supabase.from('member_positions').insert({
        member_id: created.id,
        title,
        team: created.team,
        term_start: created.joined_at || toDateInput(),
      }).select('id').single(),
      { failure: 'The member was added, but the role was not assigned. Assign it from their profile.' }
    )
    if (ok) logActivity('created', 'member_positions', data.id, { name: title, member: created.full_name })
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title={editing ? `Edit ${member.full_name}` : 'Add a member'}
      description={editing
        ? `Member number ${member.member_code || '—'} stays the same, so printed cards keep working.`
        : 'For people who joined in person. No email is sent; they get a member number and card straight away.'}
      footer={
        <>
          <Button onClick={onClose} data-dialog-dismiss="true">Cancel</Button>
          <Button variant="primary" onClick={submit} busy={saving} busyLabel="Saving…">
            {editing ? 'Save changes' : 'Add member'}
          </Button>
        </>
      }
    >
      <div className="space-y-6">
        <Section title="Identity">
          <TextField label="Full name" required value={form.full_name} error={errors.full_name}
            onChange={e => set('full_name', e.target.value)} placeholder="Ahmed Mansouri" className="sm:col-span-2" />
          <TextField label="Email" type="email" required value={form.email} error={errors.email}
            onChange={e => set('email', e.target.value)} placeholder="ahmed@univ-bouira.dz" />
          <TextField label="Phone" value={form.phone} onChange={e => set('phone', e.target.value)} placeholder="+213 6XX XXX XXX" />
          <TextField label="Date of birth" type="date" value={form.birth_date} onChange={e => set('birth_date', e.target.value)} />
          <SelectField label="Gender" value={form.gender} onChange={e => set('gender', e.target.value)}>
            {GENDERS.map(g => <option key={g.value} value={g.value}>{g.label}</option>)}
          </SelectField>
        </Section>

        <Section title="Studies">
          <TextField label="Student ID" value={form.student_id} onChange={e => set('student_id', e.target.value)} />
          <TextField label="Study year" value={form.study_year} onChange={e => set('study_year', e.target.value)} placeholder="L2" />
          <TextField label="Department" value={form.department} onChange={e => set('department', e.target.value)}
            placeholder="Computer Science" className="sm:col-span-2" />
        </Section>

        <Section title="Membership">
          <TextField label="Team" value={form.team} onChange={e => set('team', e.target.value)}
            placeholder="Robotics" list="member-teams" hint="The cell or team they work in." />
          <datalist id="member-teams">{teams.map(t => <option key={t} value={t} />)}</datalist>
          <SelectField label="Status" value={form.status} onChange={e => set('status', e.target.value)}
            hint="Only active members’ cards verify.">
            {MEMBER_STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
          </SelectField>
          {!editing && (
            <RoleField emptyLabel="Member (no role)" value={form.role} newName={form.new_role} error={errors.new_role}
              customRoles={customRoles} onChange={v => set('role', v)} onNewNameChange={v => set('new_role', v)} />
          )}
          <TextField label="Joined on" type="date" value={form.joined_at} onChange={e => set('joined_at', e.target.value)} />
          <TextField label="Left on" type="date" value={form.left_at} error={errors.left_at}
            onChange={e => set('left_at', e.target.value)} />
          {editing && (
            <SelectField label="Card" value={form.card_status} onChange={e => set('card_status', e.target.value)}
              hint="Mark a card lost to stop it verifying.">
              {CARD_STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
            </SelectField>
          )}
        </Section>

        <Section title="Profile">
          <TextField label="Skills" value={form.skills} onChange={e => set('skills', e.target.value)}
            placeholder="Arduino, Python, 3D printing" hint="Separate with commas." className="sm:col-span-2" />
          <TextField label="Interests" value={form.interests} onChange={e => set('interests', e.target.value)}
            placeholder="Robotics, AI" hint="Separate with commas." className="sm:col-span-2" />
          <TextArea label="Internal notes" value={form.notes} onChange={e => set('notes', e.target.value)}
            hint="Only admins see this." className="sm:col-span-2" />
          <div className="sm:col-span-2">
            <CheckField
              label="No notification emails"
              description="Leave this member out when announcements and events are emailed to members."
              checked={form.email_opt_out}
              onChange={v => set('email_opt_out', v)}
            />
          </div>
        </Section>
      </div>
    </Modal>
  )
}

function Section({ title, children }) {
  return (
    <fieldset>
      <legend className="adm-label mb-3" style={{ color: 'var(--adm-silk-faint)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
        {title}
      </legend>
      <div className="grid sm:grid-cols-2 gap-4">{children}</div>
    </fieldset>
  )
}
