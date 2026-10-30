import { useEffect, useState } from 'react'
import { Check, Copy, KeyRound, TriangleAlert } from 'lucide-react'
import { api, logActivity } from '../../lib/db'
import useAdminStore from '../../store/adminStore'
import Modal from '../ui/Modal'
import Button from '../ui/Button'
import { CheckField, TextField } from '../ui/Field'

/**
 * Gives a member a temporary member-area password, for members whose email
 * links do not arrive or who are signed up at a club desk. The member must
 * choose their own password right after signing in with it.
 */
export default function TempPasswordModal({ member, onClose, onDone }) {
  const addToast = useAdminStore(s => s.addToast)
  const [own, setOwn] = useState(false)
  const [password, setPassword] = useState('')
  const [sendEmail, setSendEmail] = useState(true)
  const [error, setError] = useState(null)
  const [saving, setSaving] = useState(false)
  const [result, setResult] = useState(null) // the password to hand over, shown once
  const [copied, setCopied] = useState(false)

  // Keyed on the id: the member list reloads after saving, which hands us a
  // new object, and that must not wipe the password before it is read.
  const memberId = member?.id
  useEffect(() => {
    if (!memberId) return
    setOwn(false); setPassword(''); setSendEmail(true); setError(null); setResult(null); setCopied(false)
  }, [memberId])

  const save = async () => {
    if (own && password.length < 8) { setError('Use at least 8 characters.'); return }
    setSaving(true)
    const { ok, data, message } = await api('/api/portal/temp-password', {
      method: 'POST',
      body: { member_id: member.id, password: own ? password : undefined, send_email: sendEmail },
    })
    setSaving(false)
    if (!ok) { setError(message); return }
    logActivity('updated', 'members', member.id, { name: member.full_name, portal: sendEmail ? 'temporary password emailed' : 'temporary password set' })
    onDone?.()
    if (data.emailed) {
      addToast(`Temporary password emailed to ${member.email}.`, 'success')
      onClose()
    } else {
      setResult(data.password)
    }
  }

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(result)
      setCopied(true)
    } catch { /* clipboard blocked; the password is on screen */ }
  }

  return (
    <Modal
      open={!!member}
      onClose={onClose}
      title={result ? 'Hand this password over' : 'Set a temporary password'}
      description={member ? `${member.full_name} · ${member.email}` : ''}
      footer={result ? (
        <Button variant="primary" onClick={onClose}>Done</Button>
      ) : (
        <>
          <Button onClick={onClose} data-dialog-dismiss="true">Cancel</Button>
          <Button variant="primary" icon={KeyRound} onClick={save} busy={saving} busyLabel="Saving…">
            {sendEmail ? 'Set and email it' : 'Set password'}
          </Button>
        </>
      )}
    >
      {result ? (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <code className="adm-data text-lg flex-1 px-3 py-2 rounded-lg" style={{ background: 'var(--adm-well, rgba(127,127,127,.12))', letterSpacing: 1 }}>
              {result}
            </code>
            <Button icon={copied ? Check : Copy} onClick={copy}>{copied ? 'Copied' : 'Copy'}</Button>
          </div>
          <p className="text-[13px]" style={{ color: 'var(--adm-silk-dim)' }}>
            The member signs in at <span className="adm-data">/portal/login</span> with their email and this password, and must choose their own right away.
            It is shown only now; close this and it cannot be seen again.
          </p>
          <p className="flex items-start gap-2 text-[12px]" style={{ color: 'var(--adm-signal)' }}>
            <TriangleAlert size={14} className="shrink-0 mt-0.5" />
            Give it to the member in person or in a private message, never in a group chat.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          <CheckField
            label="Email it to the member"
            description="They get the password and a sign-in button. Leave off to see it here and hand it over yourself."
            checked={sendEmail}
            onChange={setSendEmail}
          />
          <CheckField
            label="Type the password myself"
            description="Otherwise a random one like Kx7m-Qa3z-Rt9w is made for you."
            checked={own}
            onChange={v => { setOwn(v); setError(null) }}
          />
          {own && (
            <TextField label="Temporary password" value={password} autoComplete="off" maxLength={72}
              hint="At least 8 characters." onChange={e => { setPassword(e.target.value); setError(null) }} />
          )}
          {error && <p className="text-xs" style={{ color: 'var(--adm-fault)' }}>{error}</p>}
          <p className="text-[12px]" style={{ color: 'var(--adm-silk-faint)' }}>
            This replaces any password the member already set. Members who are also admins cannot get one; send them a link instead.
          </p>
        </div>
      )}
    </Modal>
  )
}
