import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { formatDay, portalRpc, usePortal } from '../lib/portal'
import { normalizePhone } from '../../lib/contactFormats'
import joinEn from '../../locales/en/join.json'
import PasswordForm from '../PasswordForm'
import PhotoSection from '../PhotoSection'
import IdCardSection from '../IdCardSection'
import CopyCode from '../CopyCode'

// The same choices as the join form, stored as keys.
const SKILLS = Object.keys(joinEn.skillOptions)

/** Indexes of the full-name words the preferred name uses (all of them by default). */
function chosenWords(words, preferred) {
  if (!preferred) return words.map((_, i) => i)
  const wanted = preferred.toLowerCase().split(/\s+/)
  const picked = []
  words.forEach((w, i) => {
    const at = wanted.indexOf(w.toLowerCase())
    if (at !== -1) { picked.push(i); wanted.splice(at, 1) }
  })
  return picked.length ? picked : words.map((_, i) => i)
}

function Row({ label, children }) {
  return (
    <div className="py-2.5 flex flex-wrap justify-between gap-x-4 gap-y-1">
      <dt className="text-sm portal-muted">{label}</dt>
      <dd className="text-sm font-medium">{children || '—'}</dd>
    </div>
  )
}

export default function PortalProfile() {
  const { t, i18n } = useTranslation('portal')
  const { t: tJoin } = useTranslation('join')
  const { me, refresh } = usePortal()
  const nameWords = me.full_name.split(/\s+/).filter(Boolean)
  const [form, setForm] = useState({
    phone: me.phone || '', skills: me.skills, emailOptOut: me.email_opt_out,
    nameWords: chosenWords(nameWords, me.preferred_name),
  })
  const shownName = form.nameWords.slice().sort((a, b) => a - b).map(i => nameWords[i]).join(' ')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState(null)
  const [passwordSaved, setPasswordSaved] = useState(false)

  const save = async e => {
    e.preventDefault()
    setSaving(true)
    setMessage(null)
    const { error } = await portalRpc('portal_update_profile', {
      p_phone: normalizePhone(form.phone),
      p_skills: form.skills,
      p_email_opt_out: form.emailOptOut,
      p_preferred_name: shownName,
    })
    setSaving(false)
    setMessage(error ? { ok: false, text: t('profile.saveFailed') } : { ok: true, text: t('profile.saved') })
    if (!error) refresh()
  }

  const positions = me.positions.filter(p => !p.term_end || p.term_end >= new Date().toISOString().slice(0, 10))

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2 space-y-6">
        <section className="portal-card">
          <h2 className="font-bold mb-2">{t('profile.details')}</h2>
          <dl className="portal-list">
            <Row label={t('profile.name')}>{me.full_name}</Row>
            <Row label={t('profile.email')}><span dir="ltr">{me.email}</span></Row>
            <Row label={t('profile.memberCode')}><CopyCode code={me.member_code} /></Row>
            <Row label={t('profile.studentId')}><span className="portal-mono">{me.student_id}</span></Row>
            <Row label={t('profile.study')}>{[
              me.study_department && tJoin(`departments.${me.study_department}`, { defaultValue: me.study_department }),
              me.study_year && tJoin(`years.${me.study_year}`, { defaultValue: me.study_year }),
            ].filter(Boolean).join(' · ')}</Row>
            <Row label={t('profile.status')}>{t(`profile.statuses.${me.status}`, { defaultValue: me.status })}</Row>
            <Row label={t('profile.joined')}>{formatDay(me.joined_at, i18n.language)}</Row>
          </dl>
        </section>

        <section className="portal-card">
          <h2 className="font-bold mb-3">{t('profile.club')}</h2>
          <div className="space-y-4">
            <div>
              <p className="portal-label">{t('profile.departments')}</p>
              {me.departments.length ? (
                <div className="flex flex-wrap gap-2">
                  {me.departments.map(d => (
                    <span key={d.id} className="portal-badge" style={d.color ? { background: `${d.color}1f`, color: d.color } : undefined}>{d.name}</span>
                  ))}
                </div>
              ) : <p className="text-sm portal-muted">{t('profile.noDepartment')}</p>}
            </div>
            {me.interests.length > 0 && (
              <div>
                <p className="portal-label">{t('profile.interests')}</p>
                <div className="flex flex-wrap gap-2">
                  {me.interests.map(key => <span key={key} className="portal-badge plain">{tJoin(`interestOptions.${key}`, { defaultValue: key })}</span>)}
                </div>
              </div>
            )}
            {positions.length > 0 && (
              <div>
                <p className="portal-label">{t('profile.positions')}</p>
                <div className="flex flex-wrap gap-2">
                  {positions.map((p, i) => (
                    <span key={i} className="portal-badge plain">
                      {t(`positions.${p.title}`, { defaultValue: p.title })}{p.team && ` · ${p.team}`}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {me.groups.length > 0 && (
              <div>
                <p className="portal-label">{t('profile.groups')}</p>
                <div className="flex flex-wrap gap-2">{me.groups.map(g => <span key={g.id} className="portal-badge plain">{g.name}</span>)}</div>
              </div>
            )}
          </div>
        </section>

        <PhotoSection />

        <section className="portal-card">
          <h2 className="font-bold mb-1">{t('profile.edit')}</h2>
          <p className="text-sm portal-muted mb-4">{t('profile.editNote')}</p>
          <form onSubmit={save} className="space-y-4">
            <fieldset>
              <legend className="portal-label">{t('profile.shownName')}</legend>
              <p className="text-xs portal-muted mb-2">{t('profile.shownNameHint')}</p>
              <div className="flex flex-wrap gap-2">
                {nameWords.map((word, i) => {
                  const on = form.nameWords.includes(i)
                  return (
                    <button key={i} type="button" aria-pressed={on}
                      className={`portal-badge ${on ? '' : 'plain'}`} style={{ padding: '0.35rem 0.8rem', cursor: 'pointer' }}
                      // At least one word stays picked.
                      onClick={() => setForm(f => ({ ...f, nameWords: on ? (f.nameWords.length > 1 ? f.nameWords.filter(x => x !== i) : f.nameWords) : [...f.nameWords, i] }))}>
                      {word}
                    </button>
                  )
                })}
              </div>
              <p className="text-sm mt-2">{t('profile.shownAs')} <strong>{t('hello', { name: shownName })}</strong></p>
            </fieldset>
            <div>
              <label className="portal-label" htmlFor="profile-phone">{t('profile.phone')}</label>
              <input id="profile-phone" className="portal-input" dir="ltr" maxLength={40} value={form.phone}
                onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
            </div>
            <fieldset>
              <legend className="portal-label">{t('profile.skills')}</legend>
              <div className="flex flex-wrap gap-2">
                {[...new Set([...SKILLS, ...form.skills])].map(key => {
                  const on = form.skills.includes(key)
                  return (
                    <button key={key} type="button" aria-pressed={on}
                      className={`portal-badge ${on ? '' : 'plain'}`} style={{ padding: '0.35rem 0.8rem', cursor: 'pointer' }}
                      onClick={() => setForm(f => ({ ...f, skills: on ? f.skills.filter(s => s !== key) : [...f.skills, key] }))}>
                      {tJoin(`skillOptions.${key}`, { defaultValue: key })}
                    </button>
                  )
                })}
              </div>
            </fieldset>
            <label className="flex items-start gap-2 text-sm">
              <input type="checkbox" className="mt-1" checked={!form.emailOptOut}
                onChange={e => setForm(f => ({ ...f, emailOptOut: !e.target.checked }))} />
              <span>{t('profile.emails')}</span>
            </label>
            {message && <div className={`portal-alert ${message.ok ? '' : 'error'}`} role="status">{message.text}</div>}
            <button type="submit" className="portal-btn-primary" disabled={saving}>{saving ? t('login.wait') : t('profile.save')}</button>
          </form>
        </section>

        <section className="portal-card">
          <h2 className="font-bold mb-1">{t('profile.password')}</h2>
          <p className="text-sm portal-muted mb-4">{t('profile.passwordNote')}</p>
          {passwordSaved && <div className="portal-alert mb-4" role="status">{t('profile.passwordSaved')}</div>}
          <div className="max-w-sm">
            <PasswordForm submitLabel={t('profile.passwordSubmit')} onDone={() => setPasswordSaved(true)} />
          </div>
        </section>
      </div>

      <aside>
        <IdCardSection />
      </aside>
    </div>
  )
}
