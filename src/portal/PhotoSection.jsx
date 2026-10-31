import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Camera, Clock, Upload } from 'lucide-react'
import { squarePhoto, uploadPhoto, usePortal, withdrawPhoto } from './lib/portal'

const initials = name => name.split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase()

/**
 * Profile photo: the approved one, plus a new one waiting for HR. Nothing a
 * member uploads is shown to anyone else until it is approved.
 */
export default function PhotoSection() {
  const { t } = useTranslation('portal')
  const { me, refresh } = usePortal()
  const input = useRef(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  const pick = async e => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    if (!/^image\/(jpeg|png|webp|heic|heif)$/.test(file.type) || file.size > 15 * 1024 * 1024) { setError('bad_file'); return }
    setError(null)
    setBusy(true)
    try {
      const problem = await uploadPhoto(await squarePhoto(file))
      if (problem) setError(problem)
      else await refresh()
    } catch {
      setError('bad_file')
    }
    setBusy(false)
  }

  const withdraw = async () => {
    setBusy(true)
    if (await withdrawPhoto()) await refresh()
    setBusy(false)
  }

  return (
    <section className="portal-card">
      <h2 className="font-bold mb-1">{t('profile.photo')}</h2>
      <p className="text-sm portal-muted mb-4">{t('profile.photoNote')}</p>
      <div className="flex flex-wrap items-center gap-5">
        {me.photo_url ? (
          <img src={me.photo_url} alt="" className="w-24 h-24 rounded-full object-cover" />
        ) : (
          <div className="w-24 h-24 rounded-full flex items-center justify-center text-2xl font-bold"
            style={{ background: 'var(--color-accent-soft)', color: 'var(--color-accent)' }}>
            {initials(me.full_name)}
          </div>
        )}

        {me.photo_pending_url && (
          <div className="flex items-center gap-3">
            <img src={me.photo_pending_url} alt="" className="w-16 h-16 rounded-full object-cover" style={{ opacity: 0.7 }} />
            <div>
              <p className="portal-badge warn mb-1"><Clock size={11} /> {t('profile.photoPending')}</p>
              <button type="button" className="block text-xs portal-muted underline" onClick={withdraw} disabled={busy}>
                {t('profile.photoWithdraw')}
              </button>
            </div>
          </div>
        )}

        <div>
          <input ref={input} type="file" accept="image/jpeg,image/png,image/webp,image/heic" className="hidden" onChange={pick} />
          <button type="button" className="portal-btn" onClick={() => input.current?.click()} disabled={busy}>
            {busy ? t('login.wait') : me.photo_url || me.photo_pending_url ? <><Camera size={15} /> {t('profile.photoChange')}</> : <><Upload size={15} /> {t('profile.photoUpload')}</>}
          </button>
        </div>
      </div>

      {me.photo_review_note && !me.photo_pending_url && (
        <div className="portal-alert error mt-4" role="status">{t('profile.photoRefused', { note: me.photo_review_note })}</div>
      )}
      {error && <div className="portal-alert error mt-4" role="alert">{t(`profile.photoErrors.${error}`)}</div>}
      <p className="text-xs portal-muted mt-4">{t('profile.photoRules')}</p>
    </section>
  )
}
