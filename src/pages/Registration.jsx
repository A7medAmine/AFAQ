import { useCallback, useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import { Link, useSearchParams } from 'react-router-dom'
import { AlertCircle, ArrowLeft, ArrowRight, CalendarDays, Check, MapPin, Send } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { clearProfile, loadProfile, saveProfile } from '../lib/savedProfile'
import SideImage from '../components/shared/SideImage'
import ProgresButton from '../components/registration/ProgresButton'
import AddToCalendar from '../components/shared/AddToCalendar'
import SEO from '../components/SEO'
import {
  CheckboxField, FormError, SelectField, TextField,
} from '../components/forms/Field'

const spring = { type: 'spring', damping: 22, stiffness: 200 }
const fastSpring = { type: 'spring', damping: 16, stiffness: 300 }

const initialForm = {
  event_id: '',
  full_name: '',
  student_id: '',
  email: '',
  phone: '',
  department: '',
  agreed_to_policies: false,
}

const BASE_DEPTS = ['fsas', 'fnlses', 'flps', 'fecms', 'fshs', 'fll', 'istaps', 'iot', 'fes']

/* Event ids are bigints; a <select> hands them back as strings and the URL
   carries them as strings too. Comparing the two forms directly is why the
   confirmation email used to go out with an empty event name. */
const sameId = (a, b) => String(a) === String(b)

export default function Registration() {
  const { t, i18n } = useTranslation('register')
  const { t: tc } = useTranslation('common')
  const lang = i18n.language
  const [params, setParams] = useSearchParams()
  const eventParam = params.get('event')

  // A returning student starts with the details from their last sign-up.
  const [savedProfile, setSavedProfile] = useState(loadProfile)
  const [form, setForm] = useState(() => ({ ...initialForm, ...savedProfile }))
  const [status, setStatus] = useState('idle')
  const [errors, setErrors] = useState({})
  const [shaking, setShaking] = useState(null)
  const [formError, setFormError] = useState('')
  const [showAutoFillBanner, setShowAutoFillBanner] = useState(false)

  const [events, setEvents] = useState([])
  const [seats, setSeats] = useState({})
  const [loadingEvents, setLoadingEvents] = useState(true)
  const [linkNotice, setLinkNotice] = useState('')
  const [submitted, setSubmitted] = useState(null)

  const tField = useCallback(
    (row, field) => (row ? row[`${field}_${lang}`] || row[`${field}_en`] || '' : ''),
    [lang]
  )

  // ── Load what is open, and how full each one is ──────────────────────────
  useEffect(() => {
    let cancelled = false

    const load = async () => {
      const today = new Date().toISOString().split('T')[0]
      const { data } = await supabase
        .from('events')
        .select('id, title_en, title_ar, title_fr, location_en, location_ar, location_fr, date, time, poster_url, max_participants')
        .eq('is_published', true)
        .eq('registration_open', true)
        .gte('date', today)
        .order('date', { ascending: true })

      if (cancelled) return
      const open = data || []
      setEvents(open)

      if (open.length) {
        /* Seat counts come from the server. Anonymous visitors hold
           INSERT-only rights on event_registrations, so counting them from the
           browser returns nothing and every event looks empty. */
        try {
          const res = await fetch('/api/events/availability')
          const payload = await res.json()
          if (cancelled) return
          const tally = {}
          for (const row of payload.events || []) tally[row.id] = row.taken
          setSeats(tally)
        } catch {
          // No counts is better than wrong counts; the form still works.
        }
      }

      setLoadingEvents(false)
    }

    load()
    return () => { cancelled = true }
  }, [])

  // ── Honour ?event=<id> from the events page ──────────────────────────────
  useEffect(() => {
    if (loadingEvents || !eventParam) return

    const match = events.find(e => sameId(e.id, eventParam))
    if (match) {
      setForm(f => (f.event_id ? f : { ...f, event_id: String(match.id) }))
      setLinkNotice('')
      return
    }

    // The link points at something that is not open for registration. Say
    // which of those it is instead of silently dropping them on a blank picker.
    let cancelled = false
    supabase
      .from('events')
      .select('id, date, is_published, registration_open')
      .eq('id', eventParam)
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled) return
        const today = new Date().toISOString().split('T')[0]
        if (!data || !data.is_published) setLinkNotice(t('form.eventNotFound'))
        else if (data.date < today) setLinkNotice(t('form.eventClosed'))
        else if (!data.registration_open) setLinkNotice(t('form.eventClosed'))
        else setLinkNotice(t('form.eventNotFound'))
      })

    return () => { cancelled = true }
  }, [loadingEvents, eventParam, events, t])

  const selectedEvent = useMemo(
    () => events.find(e => sameId(e.id, form.event_id)) || null,
    [events, form.event_id]
  )

  const capacity = selectedEvent?.max_participants || 0
  const taken = selectedEvent ? seats[selectedEvent.id] || 0 : 0
  const seatsLeft = capacity ? Math.max(0, capacity - taken) : null
  const isFull = capacity > 0 && seatsLeft === 0

  const deptKeys = form.department && !BASE_DEPTS.includes(form.department)
    ? [...BASE_DEPTS, form.department]
    : BASE_DEPTS

  // ── Form plumbing ────────────────────────────────────────────────────────
  const autoFillFields = ['full_name', 'student_id', 'email', 'phone', 'department']

  const updateForm = patch => {
    setForm(f => ({ ...f, ...patch }))
    setErrors(e => {
      const next = { ...e }
      for (const key of Object.keys(patch)) delete next[key]
      return next
    })
    setFormError('')
    if (showAutoFillBanner && Object.keys(patch).some(k => autoFillFields.includes(k))) {
      setShowAutoFillBanner(false)
    }
  }

  const chooseEvent = id => {
    updateForm({ event_id: id })
    setLinkNotice('')
    // Keep the URL in step, so the page can be reloaded or shared as-is.
    setParams(current => {
      const next = new URLSearchParams(current)
      if (id) next.set('event', id)
      else next.delete('event')
      return next
    }, { replace: true })
  }

  const forgetProfile = () => {
    clearProfile()
    setSavedProfile(null)
    setForm(f => ({ ...initialForm, event_id: f.event_id }))
  }

  const handleProgresSuccess = data => {
    const patch = {}
    if (data.userName || data.student_id) patch.student_id = data.userName || data.student_id
    if (data.full_name) patch.full_name = data.full_name
    if (data.email) patch.email = data.email
    if (data.phone) patch.phone = data.phone
    if (data.department) patch.department = data.department
    updateForm(patch)
    setShowAutoFillBanner(true)
  }

  const validate = () => {
    const errs = {}
    if (!form.event_id) errs.event_id = t('form.validation.required')
    if (!form.full_name.trim()) errs.full_name = t('form.validation.required')
    if (!form.email.trim()) errs.email = t('form.validation.required')
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) errs.email = t('form.validation.email')
    if (!form.agreed_to_policies) errs.agreed_to_policies = t('form.validation.requiredPolicies')

    setErrors(errs)
    const first = Object.keys(errs)[0]
    if (first) {
      setShaking(first)
      setTimeout(() => setShaking(null), 500)
    }
    return !first
  }

  const handleSubmit = async e => {
    e.preventDefault()
    setFormError('')
    if (isFull) { setFormError(t('form.eventFull')); return }
    if (!validate()) return

    setStatus('loading')
    const email = form.email.trim().toLowerCase()

    /* The server owns the rules that need to read existing rows -- one seat
       per email, and capacity. Deciding them here would mean trusting a query
       the browser is not permitted to run. */
    let result
    try {
      const res = await fetch('/api/register/event', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event_id: form.event_id,
          full_name: form.full_name.trim(),
          student_id: form.student_id.trim() || null,
          email,
          phone: form.phone.trim() || null,
          department: form.department || null,
          agreed_to_policies: true,
        }),
      })
      result = { ok: res.ok, payload: await res.json().catch(() => ({})) }
    } catch {
      setStatus('idle')
      setFormError(t('form.networkError'))
      return
    }

    if (!result.ok) {
      setStatus('idle')
      const { code, error: message } = result.payload
      if (code === 'duplicate') {
        setErrors({ email: t('form.duplicate') })
        setShaking('email')
        setTimeout(() => setShaking(null), 500)
      } else if (code === 'full') {
        setFormError(t('form.eventFull'))
      } else {
        setFormError(message || t('form.error'))
      }
      return
    }

    saveProfile(form)
    setSavedProfile(loadProfile())

    const eventTitle = tField(selectedEvent, 'title')
    setSubmitted({ event: eventTitle, email, eventId: selectedEvent?.id })
    setStatus('success')
  }

  const registerAnother = () => {
    setForm({ ...initialForm, ...savedProfile })
    setErrors({})
    setFormError('')
    setSubmitted(null)
    setStatus('idle')
    setParams(new URLSearchParams(), { replace: true })
  }

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="relative">
      <SEO title={t('hero.title')} description={t('hero.subtitle')} path="/register" noindex />
      <section className="pt-24 pb-16 md:pt-32 md:pb-20" style={{ background: 'var(--color-bg-alt)' }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={spring} className="eyebrow eyebrow-center mb-4">
            {t('form.title')}
          </motion.div>
          <motion.h1 initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ ...spring, delay: 0.1 }} className="text-4xl md:text-5xl lg:text-6xl font-bold mb-4">
            {t('hero.title')}
          </motion.h1>
          <motion.p initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ ...spring, delay: 0.2 }} className="text-lg max-w-2xl mx-auto" style={{ color: 'var(--color-text-muted)' }}>
            {t('hero.subtitle')}
          </motion.p>
        </div>
      </section>

      <section className="py-16 md:py-20 -mt-12 relative z-0">
        <SideImage side="right" />
        <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="card-pro card-static p-8 md:p-10">
            {status === 'success' ? (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ ...spring, delay: 0.1 }}
                className="text-center py-4"
              >
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ ...fastSpring, delay: 0.2 }}
                  className="inline-flex items-center justify-center mb-6"
                  style={{ width: 72, height: 72, borderRadius: '50%', background: 'rgba(22, 163, 74, 0.1)', color: '#16A34A' }}
                >
                  <Check size={36} style={{ strokeWidth: 3 }} />
                </motion.div>
                <h3 className="text-2xl font-bold mb-3">{t('form.successTitle')}</h3>
                <p className="text-base leading-relaxed max-w-md mx-auto" style={{ color: 'var(--color-text-muted)' }}>
                  {t('form.successBody', { event: submitted?.event, email: submitted?.email })}
                </p>
                {submitted?.eventId && (
                  <div className="mt-4 flex justify-center">
                    <AddToCalendar eventId={submitted.eventId} />
                  </div>
                )}
                <button
                  type="button"
                  onClick={registerAnother}
                  className="inline-flex items-center gap-2 mt-7 px-6 py-3 rounded-[100px] font-semibold text-sm"
                  style={{ border: '1.5px solid var(--color-border)', color: 'var(--color-text)' }}
                >
                  {t('form.registerAnother')}
                </button>
                <div className="mt-8 pt-6" style={{ borderTop: '1px solid var(--color-border)' }}>
                  <p className="text-sm mb-2" style={{ color: 'var(--color-text-muted)' }}>
                    {t('form.joinNudge')}
                  </p>
                  <Link
                    to="/join"
                    className="inline-flex items-center gap-1.5 text-sm font-semibold"
                    style={{ color: 'var(--color-accent)' }}
                  >
                    {t('form.joinCta')} <ArrowRight size={14} className="rtl:rotate-180" />
                  </Link>
                </div>
              </motion.div>
            ) : (
              /* A real <form>, so Enter submits and browsers offer autofill —
                 the old markup was a bare <div> with a click handler. */
              <form onSubmit={handleSubmit} className="space-y-5" noValidate>
                {linkNotice && (
                  <p className="pf-form-error">
                    <AlertCircle size={15} aria-hidden="true" style={{ flexShrink: 0, marginTop: 1 }} />
                    <span>{linkNotice}</span>
                  </p>
                )}

                {selectedEvent ? (
                  <SelectedEvent
                    event={selectedEvent}
                    title={tField(selectedEvent, 'title')}
                    location={tField(selectedEvent, 'location')}
                    capacity={capacity}
                    seatsLeft={seatsLeft}
                    seatsTaken={taken}
                    isFull={isFull}
                    changeLabel={t('form.changeEvent')}
                    eyebrow={t('form.registeringFor')}
                    seatsLabel={
                      capacity
                        ? t('form.seatsLeft', { left: seatsLeft, total: capacity })
                        : t('form.seatsUnlimited')
                    }
                    fullLabel={t('form.eventFull')}
                    onChange={() => chooseEvent('')}
                  />
                ) : loadingEvents ? (
                  <div className="rounded-[100px]" style={{ height: 54, background: 'var(--color-bg-alt)', animation: 'shimmer 1.5s ease-in-out infinite' }} />
                ) : events.length === 0 ? (
                  <div className="text-center py-6">
                    <p className="text-sm mb-4" style={{ color: 'var(--color-text-muted)' }}>
                      {t('form.noOpenEvents')}
                    </p>
                    <Link
                      to="/events"
                      className="inline-flex items-center gap-2 px-5 py-2.5 rounded-[100px] font-semibold text-sm"
                      style={{ border: '1.5px solid var(--color-border)', color: 'var(--color-text)' }}
                    >
                      <CalendarDays size={15} /> {t('hero.title')}
                    </Link>
                  </div>
                ) : (
                  <SelectField
                    label={t('form.event')}
                    required
                    error={errors.event_id}
                    shake={shaking === 'event_id'}
                    value={form.event_id}
                    onChange={e => chooseEvent(e.target.value)}
                  >
                    <option value="">{t('form.selectEvent')}</option>
                    {events.map(e => {
                      const title = tField(e, 'title')
                      const date = e.date ? new Date(`${e.date}T00:00:00`).toLocaleDateString() : ''
                      const cap = e.max_participants || 0
                      const left = cap ? Math.max(0, cap - (seats[e.id] || 0)) : null
                      return (
                        <option key={e.id} value={e.id} disabled={left === 0}>
                          {title}{date ? ` — ${date}` : ''}{left === 0 ? ` (${t('form.full')})` : ''}
                        </option>
                      )
                    })}
                  </SelectField>
                )}

                {events.length > 0 && (
                  <>
                    {savedProfile && !showAutoFillBanner ? (
                      <p className="text-sm flex flex-wrap items-center justify-between gap-2" style={{ color: 'var(--color-text-muted)' }}>
                        <span>{t('form.welcomeBack', { name: savedProfile.full_name || savedProfile.email })}</span>
                        <button
                          type="button"
                          onClick={forgetProfile}
                          className="text-xs font-semibold"
                          style={{ color: 'var(--color-accent)' }}
                        >
                          {t('form.notYou')}
                        </button>
                      </p>
                    ) : (
                      <div className="text-center">
                        <ProgresButton onSuccess={handleProgresSuccess} />
                        {showAutoFillBanner ? (
                          <motion.p
                            initial={{ opacity: 0, y: -4 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="text-sm mt-3"
                            style={{ color: '#16A34A' }}
                          >
                            {tc('progres.banner')}
                          </motion.p>
                        ) : (
                          <p className="text-xs mt-3" style={{ color: 'var(--color-text-muted)' }}>
                            {t('form.orManual')}
                          </p>
                        )}
                      </div>
                    )}

                    <TextField
                      label={t('form.fullName')} required autoComplete="name"
                      value={form.full_name} error={errors.full_name} shake={shaking === 'full_name'}
                      onChange={e => updateForm({ full_name: e.target.value })}
                      placeholder="Ahmed Mansouri"
                    />

                    <TextField
                      label={t('form.studentId')} autoComplete="off" inputMode="numeric"
                      value={form.student_id}
                      onChange={e => updateForm({ student_id: e.target.value })}
                      placeholder="2024XXXXX"
                    />

                    <TextField
                      label={t('form.email')} required type="email" autoComplete="email"
                      value={form.email} error={errors.email} shake={shaking === 'email'}
                      onChange={e => updateForm({ email: e.target.value })}
                      placeholder="ahmed@univ-bouira.dz"
                    />

                    <TextField
                      label={t('form.phone')} type="tel" autoComplete="tel"
                      value={form.phone}
                      onChange={e => updateForm({ phone: e.target.value })}
                      placeholder="+213 6XX XXX XXX"
                    />

                    <SelectField
                      label={t('form.department')}
                      value={form.department}
                      onChange={e => updateForm({ department: e.target.value })}
                    >
                      <option value="">{t('form.selectDepartment')}</option>
                      {deptKeys.map(key => (
                        <option key={key} value={key}>{t(`departments.${key}`)}</option>
                      ))}
                    </SelectField>

                    <CheckboxField
                      label={t('form.policies')}
                      checked={form.agreed_to_policies}
                      onChange={v => updateForm({ agreed_to_policies: v })}
                      error={errors.agreed_to_policies}
                      shake={shaking === 'agreed_to_policies'}
                    />

                    <FormError message={formError} />

                    <motion.button
                      type="submit"
                      disabled={status === 'loading' || isFull}
                      whileHover={status !== 'loading' && !isFull ? { scale: 1.02 } : {}}
                      whileTap={status !== 'loading' && !isFull ? { scale: 0.97 } : {}}
                      className="inline-flex items-center justify-center gap-2 w-full px-6 py-3.5 rounded-[100px] font-semibold text-sm transition-all duration-200 mt-2"
                      style={{
                        background: status === 'loading' ? 'var(--color-accent-dark)' : 'var(--color-accent)',
                        color: '#fff',
                        opacity: status === 'loading' || isFull ? 0.65 : 1,
                        cursor: isFull ? 'not-allowed' : 'pointer',
                      }}
                    >
                      {status === 'loading' ? (
                        <motion.span
                          animate={{ rotate: 360 }}
                          transition={{ repeat: Infinity, duration: 0.6, ease: 'linear' }}
                          style={{ width: 16, height: 16, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'white', borderRadius: '50%' }}
                        />
                      ) : (
                        <Send size={14} />
                      )}
                      {status === 'loading' ? t('form.submitting') : t('form.submit')}
                    </motion.button>

                  </>
                )}
              </form>
            )}
          </div>
        </div>
      </section>
    </div>
  )
}

/**
 * Arriving from an event card, the event is already decided — so it is shown
 * as a confirmed choice with its seat count, not as a dropdown you have to
 * find your way back through.
 */
function SelectedEvent({
  event, title, location, capacity, seatsLeft, isFull,
  eyebrow, changeLabel, seatsLabel, fullLabel, onChange,
}) {
  const date = event.date
    ? new Date(`${event.date}T00:00:00`).toLocaleDateString(undefined, {
      weekday: 'short', day: 'numeric', month: 'long',
    })
    : ''
  const filled = capacity ? Math.min(1, (capacity - seatsLeft) / capacity) : 0

  return (
    <div>
      <p className="pf-label">{eyebrow}</p>
      <div className="pf-event-card">
        {event.poster_url && <img src={event.poster_url} alt="" className="pf-event-poster" />}
        <div style={{ minWidth: 0, flex: 1 }}>
          <p className="font-bold text-base leading-tight mb-1">{title}</p>
          <p className="text-xs flex flex-wrap items-center gap-x-3 gap-y-1" style={{ color: 'var(--color-text-muted)' }}>
            {date && <span className="flex items-center gap-1.5"><CalendarDays size={12} /> {date}{event.time ? ` · ${event.time.slice(0, 5)}` : ''}</span>}
            {location && <span className="flex items-center gap-1.5"><MapPin size={12} /> {location}</span>}
          </p>
          <p className="text-xs mt-1.5" style={{ color: isFull ? '#EF4444' : 'var(--color-text-muted)' }}>
            {isFull ? fullLabel : seatsLabel}
          </p>
          {capacity > 0 && (
            <div className="pf-event-seats" role="img" aria-label={seatsLabel}>
              <span style={{ width: `${filled * 100}%`, background: isFull ? '#EF4444' : 'var(--color-accent)' }} />
            </div>
          )}
        </div>
      </div>
      <button
        type="button"
        onClick={onChange}
        className="inline-flex items-center gap-1.5 mt-2.5 text-xs font-semibold"
        style={{ color: 'var(--color-accent)' }}
      >
        <ArrowLeft size={13} /> {changeLabel}
      </button>
    </div>
  )
}
