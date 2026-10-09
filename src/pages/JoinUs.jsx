import { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import { Send, Check, User, BookOpen, Heart, ArrowLeft, ArrowRight } from 'lucide-react'
import SideImage from '../components/shared/SideImage'
import ProgresButton from '../components/registration/ProgresButton'
import {
  FormError, SelectField, TextAreaField, TextField,
} from '../components/forms/Field'
import SEO from '../components/SEO'
import { loadProfile, saveProfile } from '../lib/savedProfile'

const spring = { type: 'spring', damping: 22, stiffness: 200 }
const fastSpring = { type: 'spring', damping: 16, stiffness: 300 }

const steps = ['personal', 'academic', 'interests']
const stepIcons = [User, BookOpen, Heart]

const initialForm = {
  student_id: '',
  full_name: '',
  email: '',
  phone: '',
  department: '',
  study_year: '',
  interests: [],
  skills: [],
  motivation: '',
}

export default function JoinUs() {
  const { t, i18n } = useTranslation('join')
  // Interests are managed in the console (they route applications to review
  // teams). Until they load, or if the request fails, fall back to the
  // built-in list so the form always works.
  const [interestRows, setInterestRows] = useState(null)
  useEffect(() => {
    let alive = true
    fetch('/api/interests')
      .then(r => (r.ok ? r.json() : null))
      .then(rows => { if (alive && Array.isArray(rows) && rows.length) setInterestRows(rows) })
      .catch(() => {})
    return () => { alive = false }
  }, [])
  const [step, setStep] = useState(0)
  // Someone who already registered for an event doesn't retype their details.
  const [form, setForm] = useState(() => ({ ...initialForm, ...loadProfile() }))
  const [status, setStatus] = useState('idle')
  const [errors, setErrors] = useState({})
  const [formError, setFormError] = useState('')
  const [shaking, setShaking] = useState(null)
  const [showAutoFillBanner, setShowAutoFillBanner] = useState(false)
  const firstFieldRefs = useRef({})

  useEffect(() => {
    firstFieldRefs.current[step]?.focus()
  }, [step])

  const validate = () => {
    const errs = {}
    if (step === 0) {
      if (!form.full_name.trim()) errs.full_name = t('form.validation.required')
      if (!form.student_id.trim()) errs.student_id = t('form.validation.required')
      if (!form.email.trim()) errs.email = t('form.validation.required')
      else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) errs.email = t('form.validation.email')
    } else if (step === 1) {
      if (!form.department) errs.department = t('form.validation.required')
      if (!form.study_year) errs.study_year = t('form.validation.required')
    } else if (step === 2) {
      if (!form.motivation.trim()) errs.motivation = t('form.validation.required')
    }

    setErrors(errs)
    const first = Object.keys(errs)[0]
    if (first) {
      setShaking(first)
      setTimeout(() => setShaking(null), 500)
    }
    return !first
  }

  const autoFillFields = ['full_name', 'student_id', 'email', 'phone', 'department', 'study_year']

  const updateForm = patch => {
    setForm(prev => ({ ...prev, ...patch }))
    setErrors(prev => {
      const next = { ...prev }
      for (const key of Object.keys(patch)) delete next[key]
      return next
    })
    setFormError('')
    if (showAutoFillBanner && Object.keys(patch).some(k => autoFillFields.includes(k))) {
      setShowAutoFillBanner(false)
    }
  }

  const handleProgresSuccess = data => {
    const patch = {}
    if (data.userName || data.student_id) patch.student_id = data.userName || data.student_id
    if (data.full_name) patch.full_name = data.full_name
    if (data.email) patch.email = data.email
    if (data.phone) patch.phone = data.phone
    if (data.department) patch.department = data.department
    if (data.study_year) patch.study_year = data.study_year
    updateForm(patch)
    setShowAutoFillBanner(true)
  }

  const nextStep = () => {
    if (!validate()) return
    setFormError('')
    setStep(s => Math.min(s + 1, 2))
  }

  const prevStep = () => {
    setFormError('')
    setStep(s => Math.max(s - 1, 0))
  }

  const submitApplication = async () => {
    if (!validate()) return
    setStatus('loading')
    setFormError('')

    const email = form.email.trim().toLowerCase()
    const studentId = form.student_id.trim()

    /* The duplicate check runs on the server. Anonymous visitors may INSERT
       into membership_applications but not SELECT from it, so a browser-side
       lookup can never see an existing application — it matches nothing and
       lets every repeat straight through. (The old query was also written as
       .eq(email).or(student_id), which PostgREST reads as "email AND
       student_id"; both problems are gone now the check runs where the rows
       are visible.) */
    let result
    try {
      const res = await fetch('/api/register/membership', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          full_name: form.full_name.trim(),
          student_id: studentId || null,
          email,
          phone: form.phone.trim() || null,
          department: form.department || null,
          study_year: form.study_year || null,
          interests: form.interests,
          skills: form.skills,
          motivation: form.motivation.trim(),
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
      const { code, error: message, reason, suggestion } = result.payload
      setFormError(
        code === 'duplicate' ? t('form.duplicateApplication')
          : code === 'undeliverable' ? t(`form.undeliverable.${reason}`, { suggestion, defaultValue: message })
          : message || t('form.error')
      )
      return
    }

    saveProfile(form)
    setStatus('success')
    setForm(initialForm)
  }

  /* One submit path for the whole wizard, so Enter advances a step and, on the
     last one, sends the application. The old markup had no <form> at all, so
     the keyboard did nothing. */
  const handleFormSubmit = e => {
    e.preventDefault()
    if (step < 2) nextStep()
    else submitApplication()
  }

  const toggleArray = (field, value) => {
    setForm(prev => ({
      ...prev,
      [field]: prev[field].includes(value)
        ? prev[field].filter(v => v !== value)
        : [...prev[field], value],
    }))
  }

  const lang = (i18n.language || 'en').slice(0, 2)
  const interests = interestRows
    ? interestRows.map(i => i.key)
    : Object.keys(t('interestOptions', { returnObjects: true }))
  const interestLabel = key => {
    const row = interestRows?.find(i => i.key === key)
    return row ? row[`label_${lang}`] || row.label_en : t(`interestOptions.${key}`)
  }
  const skillOpts = Object.keys(t('skillOptions', { returnObjects: true }))
  const deptOptions = Object.keys(t('departments', { returnObjects: true }))
  const departments = form.department && !deptOptions.includes(form.department)
    ? [...deptOptions, form.department]
    : deptOptions
  const yearOptions = Object.keys(t('years', { returnObjects: true }))
  const years = form.study_year && !yearOptions.includes(form.study_year)
    ? [...yearOptions, form.study_year]
    : yearOptions

  return (
    <div className="relative">
      <SEO title={t('hero.title')} description={t('hero.subtitle')} path="/join" />
      <section className="pt-24 pb-16 md:pt-32 md:pb-20" style={{ background: 'var(--color-bg-alt)' }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={spring} className="eyebrow eyebrow-center mb-4">
            {t('hero.title')}
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
                className="text-center py-6"
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
                  {t('form.successBody')}
                </p>
              </motion.div>
            ) : (
              <form onSubmit={handleFormSubmit} noValidate>
                <div className="step-indicator">
                  {steps.map((s, i) => {
                    const StepIcon = stepIcons[i]
                    const isActive = step === i
                    const isDone = step > i
                    return (
                      <motion.div key={s} layout="position" transition={spring} style={{ display: 'flex', alignItems: 'center' }}>
                        <motion.div
                          animate={{ scale: isActive ? 1.15 : 1 }}
                          transition={fastSpring}
                          className={`step-circle ${isActive ? 'active' : ''} ${isDone ? 'done' : ''}`}
                          aria-current={isActive ? 'step' : undefined}
                        >
                          {isDone ? <Check size={16} /> : <StepIcon size={16} />}
                        </motion.div>
                        {i < steps.length - 1 && (
                          <motion.div
                            animate={{ scaleX: isDone || (isActive && step < steps.length - 1) ? 1 : 0.3 }}
                            transition={spring}
                            className={`step-line ${isDone || (isActive && step < steps.length - 1) ? 'active' : ''} ${isDone ? 'done' : ''}`}
                          />
                        )}
                      </motion.div>
                    )
                  })}
                </div>

                <div className="text-center mb-8">
                  <motion.p
                    key={`step-${step}`}
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={spring}
                    className="text-xs font-semibold"
                    style={{ color: 'var(--color-text-muted)', letterSpacing: '0.05em' }}
                    aria-live="polite"
                  >
                    {t('form.step', { current: step + 1, total: 3 })}
                  </motion.p>
                  <motion.p
                    key={`label-${step}`}
                    initial={{ opacity: 0, y: -6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ ...spring, delay: 0.05 }}
                    className="text-sm font-bold mt-1"
                  >
                    {step === 0 ? t('form.fullName') : step === 1 ? t('form.department') : t('form.interests')}
                  </motion.p>
                </div>

                <AnimatePresence mode="wait">
                  <motion.div
                    key={step}
                    initial={{ opacity: 0, scale: 0.96, y: 10 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.96, y: -10 }}
                    transition={{ ...spring, duration: 0.3 }}
                  >
                    {step === 0 && (
                      <div className="space-y-5">
                        <TextField
                          label={t('form.fullName')} required autoComplete="name"
                          inputRef={el => { firstFieldRefs.current[0] = el }}
                          value={form.full_name} error={errors.full_name} shake={shaking === 'full_name'}
                          onChange={e => updateForm({ full_name: e.target.value })}
                          placeholder="Ahmed Mansouri"
                        />
                        <TextField
                          label={t('form.studentId')} required inputMode="numeric" autoComplete="off"
                          value={form.student_id} error={errors.student_id} shake={shaking === 'student_id'}
                          onChange={e => updateForm({ student_id: e.target.value })}
                          placeholder="20XX000XXXXX"
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
                      </div>
                    )}

                    {step === 1 && (
                      <div className="space-y-5">
                        <SelectField
                          label={t('form.department')} required
                          inputRef={el => { firstFieldRefs.current[1] = el }}
                          value={form.department} error={errors.department} shake={shaking === 'department'}
                          onChange={e => updateForm({ department: e.target.value })}
                        >
                          <option value="">—</option>
                          {departments.map(d => (
                            <option key={d} value={d}>{t(`departments.${d}`)}</option>
                          ))}
                        </SelectField>
                        <SelectField
                          label={t('form.studyYear')} required
                          value={form.study_year} error={errors.study_year} shake={shaking === 'study_year'}
                          onChange={e => updateForm({ study_year: e.target.value })}
                        >
                          <option value="">—</option>
                          {years.map(y => (
                            <option key={y} value={y}>{t(`years.${y}`)}</option>
                          ))}
                        </SelectField>
                      </div>
                    )}

                    {step === 2 && (
                      <div className="space-y-6">
                        <PillGroup
                          legend={t('form.interests')}
                          options={interests}
                          selected={form.interests}
                          labelFor={interestLabel}
                          onToggle={i => toggleArray('interests', i)}
                        />
                        <PillGroup
                          legend={t('form.skills')}
                          options={skillOpts}
                          selected={form.skills}
                          labelFor={s => t(`skillOptions.${s}`)}
                          onToggle={s => toggleArray('skills', s)}
                        />
                        <TextAreaField
                          label={t('form.motivation')} required rows={4}
                          inputRef={el => { firstFieldRefs.current[2] = el }}
                          style={{ borderRadius: 20, minHeight: 120 }}
                          value={form.motivation} error={errors.motivation} shake={shaking === 'motivation'}
                          onChange={e => updateForm({ motivation: e.target.value })}
                          placeholder={t('form.motivationPlaceholder')}
                        />
                      </div>
                    )}
                  </motion.div>
                </AnimatePresence>

                {formError && (
                  <div className="mt-5">
                    <FormError message={formError} />
                  </div>
                )}

                <div className="flex items-center justify-between mt-8 gap-4">
                  <motion.button
                    type="button"
                    onClick={prevStep}
                    disabled={step === 0}
                    whileTap={step !== 0 ? { scale: 0.95 } : {}}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-[100px] font-semibold text-sm transition-all duration-200"
                    style={{
                      background: 'transparent',
                      color: step === 0 ? 'var(--color-border)' : 'var(--color-text-muted)',
                      border: '1.5px solid var(--color-border)',
                      cursor: step === 0 ? 'not-allowed' : 'pointer',
                      opacity: step === 0 ? 0.4 : 1,
                    }}
                  >
                    <ArrowLeft size={14} />
                    {t('form.back')}
                  </motion.button>

                  {step < 2 ? (
                    <motion.button
                      type="submit"
                      whileHover={{ scale: 1.03 }}
                      whileTap={{ scale: 0.95 }}
                      className="inline-flex items-center gap-2 px-6 py-2.5 rounded-[100px] font-semibold text-sm transition-all duration-200"
                      style={{ background: 'var(--color-accent)', color: '#fff' }}
                    >
                      {t('form.next')} <ArrowRight size={14} />
                    </motion.button>
                  ) : (
                    <motion.button
                      type="submit"
                      disabled={status === 'loading'}
                      whileHover={status !== 'loading' ? { scale: 1.03 } : {}}
                      whileTap={status !== 'loading' ? { scale: 0.95 } : {}}
                      className="inline-flex items-center gap-2 px-6 py-2.5 rounded-[100px] font-semibold text-sm transition-all duration-200"
                      style={{
                        background: status === 'loading' ? 'var(--color-accent-dark)' : 'var(--color-accent)',
                        color: '#fff',
                        opacity: status === 'loading' ? 0.8 : 1,
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
                  )}
                </div>

                {/* <div className="text-center mt-6">
                  <ProgresButton onSuccess={handleProgresSuccess} />
                  {showAutoFillBanner && (
                    <motion.p
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="text-sm mt-3"
                      style={{ color: '#16A34A' }}
                    >
                      {t('progres.banner', { ns: 'common' })}
                    </motion.p>
                  )}
                </div> */}
              </form>
            )}
          </div>
        </div>
      </section>
    </div>
  )
}

/** Multi-select pills grouped under a real legend rather than a loose label. */
function PillGroup({ legend, options, selected, labelFor, onToggle }) {
  return (
    <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
      <legend className="pf-label">{legend}</legend>
      <div className="flex flex-wrap gap-2">
        {options.map(option => {
          const isOn = selected.includes(option)
          return (
            <motion.button
              key={option}
              type="button"
              whileTap={{ scale: 0.92 }}
              aria-pressed={isOn}
              onClick={() => onToggle(option)}
              className={`pill ${isOn ? 'active' : ''}`}
            >
              {isOn && <Check size={12} />}
              {labelFor(option)}
            </motion.button>
          )
        })}
      </div>
    </fieldset>
  )
}
