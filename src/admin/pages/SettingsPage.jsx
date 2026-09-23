import { useEffect, useState } from 'react'
import { Check, Monitor, Moon, Sun } from 'lucide-react'
import { api } from '../lib/db'
import useAdminStore from '../store/adminStore'
import { PERMISSIONS } from '../lib/permissions'
import { formatDate } from '../lib/format'
import PageHeader from '../components/ui/PageHeader'
import Panel, { PanelHead } from '../components/ui/Panel'
import Button from '../components/ui/Button'
import { TextField } from '../components/ui/Field'

const THEMES = [
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon },
  { value: 'system', label: 'Match my device', icon: Monitor },
]

/** Permission keys read as `events.registrations.manage`; people do not. */
const PERMISSION_LABELS = {
  'admin_users.manage': 'Add and remove admins',
  'events.manage': 'Create and publish events',
  'events.registrations.manage': 'Approve event registrations',
  'membership.manage': 'Approve membership applications, manage members and their roles',
  'tasks.manage': 'Assign and track member tasks',
  'projects.manage': 'Create and publish projects',
  'gallery.manage': 'Manage gallery albums and photos',
  'messages.view': 'Read contact messages',
  'announcements.manage': 'Post announcements',
  'ai_knowledge.manage': 'Edit the chatbot knowledge base',
  'activity.view': 'See the activity log',
  'settings.manage': 'Change console settings',
}

export default function SettingsPage() {
  const profile = useAdminStore(s => s.adminProfile)
  const addToast = useAdminStore(s => s.addToast)
  const theme = useAdminStore(s => s.theme)
  const setTheme = useAdminStore(s => s.setTheme)

  return (
    <div>
      <PageHeader
        eyebrow="Console"
        title="Settings"
        description="Your account and how this console looks to you. These changes affect nobody else."
      />

      <div className="grid gap-5 lg:grid-cols-2 items-start">
        <div className="space-y-5">
          <ProfileCard profile={profile} addToast={addToast} />
          <PasswordCard addToast={addToast} />
        </div>

        <div className="space-y-5">
          <Panel>
            <PanelHead eyebrow="Appearance" title="Theme" description="Applies to this console only, on this device." />
            <div className="p-5 flex flex-wrap gap-2">
              {THEMES.map(option => {
                const Icon = option.icon
                const active = theme === option.value
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setTheme(option.value)}
                    aria-pressed={active}
                    className="adm-btn"
                    style={
                      active
                        ? { borderColor: 'var(--adm-signal)', color: 'var(--adm-signal)', background: 'var(--adm-signal-wash)' }
                        : undefined
                    }
                  >
                    <Icon size={15} />
                    {option.label}
                    {active && <Check size={14} />}
                  </button>
                )
              })}
            </div>
          </Panel>

          <Panel>
            <PanelHead
              eyebrow="Access"
              title={profile?.role?.label || 'Role'}
              description={profile?.role?.description || 'What this role is allowed to do in the console.'}
            />
            <div className="p-5">
              <ul className="space-y-2">
                {(PERMISSIONS[profile?.role?.name] || []).map(permission => (
                  <li key={permission} className="flex items-center gap-2.5 text-sm">
                    <Check size={15} style={{ color: 'var(--adm-ok)', flexShrink: 0 }} />
                    <span style={{ color: 'var(--adm-silk-dim)' }}>
                      {PERMISSION_LABELS[permission] || permission}
                    </span>
                  </li>
                ))}
              </ul>
              <p className="text-xs mt-4 pt-4" style={{ borderTop: '1px solid var(--adm-trace)', color: 'var(--adm-silk-faint)' }}>
                Only a super admin can change roles. Ask one if you need more access.
              </p>
            </div>
          </Panel>
        </div>
      </div>
    </div>
  )
}

function ProfileCard({ profile, addToast }) {
  const [fullName, setFullName] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => { setFullName(profile?.full_name || '') }, [profile])

  const dirty = fullName.trim() !== (profile?.full_name || '')

  const save = async e => {
    e.preventDefault()
    if (!fullName.trim()) { setError('Your name cannot be empty.'); return }

    setSaving(true)
    setError('')
    const { ok, data, message } = await api('/api/admin/profile', {
      method: 'PUT',
      body: { full_name: fullName.trim() },
    })
    setSaving(false)

    if (!ok) { setError(message); return }
    if (data?.profile) useAdminStore.setState({ adminProfile: data.profile })
    addToast('Your name has been updated.')
  }

  return (
    <Panel as="form" onSubmit={save}>
      <PanelHead eyebrow="Account" title="Your details" />
      <div className="p-5 space-y-4">
        <TextField
          label="Full name" required
          value={fullName} error={error}
          onChange={e => { setFullName(e.target.value); setError('') }}
        />
        <div>
          <span className="adm-label">Email</span>
          <p className="adm-data text-sm" style={{ color: 'var(--adm-silk-dim)' }}>{profile?.email}</p>
          <p className="text-xs mt-1" style={{ color: 'var(--adm-silk-faint)' }}>
            Ask a super admin to change the address you sign in with.
          </p>
        </div>
        <div className="flex items-center gap-3 pt-1">
          <Button type="submit" variant="primary" busy={saving} busyLabel="Saving…" disabled={!dirty}>
            Save changes
          </Button>
          {profile?.created_at && (
            <span className="text-xs" style={{ color: 'var(--adm-silk-faint)' }}>
              Admin since {formatDate(profile.created_at)}
            </span>
          )}
        </div>
      </div>
    </Panel>
  )
}

function PasswordCard({ addToast }) {
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)

  const submit = async e => {
    e.preventDefault()
    const found = {}
    if (!current) found.current = 'Enter your current password.'
    if (next.length < 8) found.next = 'Use at least 8 characters.'
    if (next !== confirm) found.confirm = 'The two new passwords do not match.'
    if (next && next === current) found.next = 'The new password must be different.'
    if (Object.keys(found).length) { setErrors(found); return }

    setSaving(true)
    setErrors({})
    const { ok, message } = await api('/api/admin/password', {
      method: 'PUT',
      body: { current_password: current, new_password: next },
    })
    setSaving(false)

    if (!ok) { setErrors({ current: message }); return }
    setCurrent(''); setNext(''); setConfirm('')
    addToast('Your password has been changed.')
  }

  return (
    <Panel as="form" onSubmit={submit}>
      <PanelHead eyebrow="Account" title="Password" description="You stay signed in on this device after changing it." />
      <div className="p-5 space-y-4">
        <TextField
          label="Current password" type="password" required autoComplete="current-password"
          value={current} error={errors.current}
          onChange={e => { setCurrent(e.target.value); setErrors({}) }}
        />
        <TextField
          label="New password" type="password" required autoComplete="new-password"
          hint="At least 8 characters."
          value={next} error={errors.next}
          onChange={e => { setNext(e.target.value); setErrors({}) }}
        />
        <TextField
          label="Confirm new password" type="password" required autoComplete="new-password"
          value={confirm} error={errors.confirm}
          onChange={e => { setConfirm(e.target.value); setErrors({}) }}
        />
        <Button type="submit" variant="primary" busy={saving} busyLabel="Changing…">Change password</Button>
      </div>
    </Panel>
  )
}
