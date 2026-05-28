import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import { Send, Check, User, BookOpen, Heart, ArrowLeft, ArrowRight } from 'lucide-react'
import { supabase } from '../lib/supabase'
import SideImage from '../components/shared/SideImage'
import ProgresButton from '../components/registration/ProgresButton'

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
  const [step, setStep] = useState(0)
  const [form, setForm] = useState(initialForm)
  const [status, setStatus] = useState('idle')
  const [errors, setErrors] = useState({})
  const [shaking, setShaking] = useState(null)
  const [showAutoFillBanner, setShowAutoFillBanner] = useState(false)
  const inputRefs = useRef({})

  useEffect(() => {
    const firstInput = inputRefs.current[`step-${step}`]
    if (firstInput) firstInput.focus()
  }, [step])

  const validate = () => {
    const errs = {}
    if (step === 0) {
      if (!form.student_id.trim()) errs.student_id = t('form.validation.required')
      if (!form.full_name.trim()) errs.full_name = t('form.validation.required')
      if (!form.email.trim()) errs.email = t('form.validation.required')
      else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) errs.email = t('form.validation.email')
    } else if (step === 1) {
      if (!form.department) errs.department = t('form.validation.required')
      if (!form.study_year) errs.study_year = t('form.validation.required')
    } else if (step === 2) {
      if (!form.motivation.trim()) errs.motivation = t('form.validation.required')
    }
    setErrors(errs)
    if (Object.keys(errs).length > 0) {
      const firstField = Object.keys(errs)[0]
      setShaking(firstField)
      setTimeout(() => setShaking(null), 500)
    }
    return Object.keys(errs).length === 0
  }

  const clearDuplicate = () => setErrors(prev => { const { duplicate, ...rest } = prev; return rest })

  const autoFillFields = ['full_name', 'student_id', 'email', 'phone', 'department', 'study_year']

  const updateForm = (patch) => {
    if ('student_id' in patch || 'email' in patch) clearDuplicate()
    if (showAutoFillBanner && Object.keys(patch).some(k => autoFillFields.includes(k))) {
      setShowAutoFillBanner(false)
    }
    setForm(prev => ({ ...prev, ...patch }))
  }

  const handleProgresSuccess = (data) => {
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
    clearDuplicate()
    setStep(s => Math.min(s + 1, 2))
  }

  const prevStep = () => {
    clearDuplicate()
    setStep(s => Math.max(s - 1, 0))
  }

  const handleSubmit = async () => {
    if (!validate()) return
    setStatus('loading')

    let query = supabase.from('membership_applications').select('id').eq('email', form.email)
    if (form.student_id) query = query.or(`student_id.eq.${form.student_id}`)

    const { data: existing, error: queryError } = await query

    if (queryError) {
      console.error(queryError)
      setStatus('error')
      return
    }

    if (existing && existing.length > 0) {
      setStatus('idle')
      setErrors({ duplicate: t('form.duplicateApplication') })
      return
    }

    const { error } = await supabase.from('membership_applications').insert([form])
    if (error) {
      console.error(error)
      setStatus('error')
    } else {
      fetch('/api/email/membership-confirmation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: form.email, name: form.full_name }),
      }).catch(() => {})
      setStatus('success')
      setForm(initialForm)
    }
  }

  const toggleArray = (field, value) => {
    setForm(prev => ({
      ...prev,
      [field]: prev[field].includes(value)
        ? prev[field].filter(v => v !== value)
        : [...prev[field], value],
    }))
  }

  const interests = Object.keys(t('interestOptions', { returnObjects: true }))
  const skillOpts = Object.keys(t('skillOptions', { returnObjects: true }))
  const deptOptions = Object.keys(t('departments', { returnObjects: true }))
  const departments = form.department && !deptOptions.includes(form.department)
    ? [...deptOptions, form.department]
    : deptOptions
  const yearOptions = Object.keys(t('years', { returnObjects: true }))
  const years = form.study_year && !yearOptions.includes(form.study_year)
    ? [...yearOptions, form.study_year]
    : yearOptions

  const inputStyle = (field) => ({
    background: 'var(--color-bg)',
    border: `1.5px solid ${errors[field] ? '#EF4444' : 'var(--color-border-light)'}`,
    borderRadius: 100,
    padding: '16px 20px',
    fontSize: 15,
    color: 'var(--color-text)',
    width: '100%',
    outline: 'none',
    transition: 'border-color 0.2s, box-shadow 0.2s',
  })

  const setInputRef = (stepIdx, el) => {
    inputRefs.current[`step-${stepIdx}`] = el
  }

  return (
    <div className="relative">
      <section
        className="pt-24 pb-16 md:pt-32 md:pb-20"
        style={{ background: 'var(--color-bg-alt)' }}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={spring}
            className="eyebrow eyebrow-center mb-4"
          >
            {t('hero.title')}
          </motion.div>
          <motion.h1
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...spring, delay: 0.1 }}
            className="text-4xl md:text-5xl lg:text-6xl font-bold mb-4"
          >
            {t('hero.title')}
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...spring, delay: 0.2 }}
            className="text-lg max-w-2xl mx-auto"
            style={{ color: 'var(--color-text-muted)' }}
          >
            {t('hero.subtitle')}
          </motion.p>
        </div>
      </section>

      <section className="py-16 md:py-20 -mt-12 relative z-0">
        <SideImage side="right" />
        <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="card-pro p-8 md:p-10">
            {status === 'success' ? (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ ...spring, delay: 0.1 }}
                className="text-center py-8"
              >
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ ...fastSpring, delay: 0.2 }}
                  className="inline-flex items-center justify-center mb-6"
                  style={{
                    width: 72,
                    height: 72,
                    borderRadius: '50%',
                    background: 'rgba(22, 163, 74, 0.1)',
                    color: '#16A34A',
                  }}
                >
                  <Check size={36} style={{ strokeWidth: 3 }} />
                </motion.div>
                <h3 className="text-2xl font-bold mb-3">
                  {t('form.success')}
                </h3>
              </motion.div>
            ) : (
              <>
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
                        <div>
                          <label className="block text-xs font-semibold mb-2" style={{ color: 'var(--color-text-muted)', letterSpacing: '0.03em', textTransform: 'uppercase' }}>
                            {t('form.fullName')} *
                          </label>
                          <motion.div animate={{ x: shaking === 'full_name' ? [0, -6, 6, -6, 6, 0] : 0 }} transition={{ duration: 0.4 }}>
                            <input
                              ref={el => setInputRef(0, el)}
                              style={inputStyle('full_name')}
                              value={form.full_name}
                              onChange={e => updateForm({ full_name: e.target.value })}
                              onFocus={e => { e.target.style.boxShadow = '0 0 0 3px rgba(36,96,231,0.15)'; e.target.style.borderColor = 'var(--color-accent)' }}
                              onBlur={e => { e.target.style.boxShadow = 'none'; e.target.style.borderColor = 'var(--color-border-light)' }}
                              placeholder="Ahmed Mansouri"
                            />
                          </motion.div>
                          <AnimatePresence>
                            {errors.full_name && (
                              <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="text-xs mt-1.5" style={{ color: '#EF4444' }}>{errors.full_name}</motion.p>
                            )}
                          </AnimatePresence>
                        </div>
                        <div>
                          <label className="block text-xs font-semibold mb-2" style={{ color: 'var(--color-text-muted)', letterSpacing: '0.03em', textTransform: 'uppercase' }}>
                            {t('form.studentId')} *
                          </label>
                          <motion.div animate={{ x: shaking === 'student_id' ? [0, -6, 6, -6, 6, 0] : 0 }} transition={{ duration: 0.4 }}>
                            <input
                              style={inputStyle('student_id')}
                              value={form.student_id}
                              onChange={e => updateForm({ student_id: e.target.value })}
                              onFocus={e => { e.target.style.boxShadow = '0 0 0 3px rgba(36,96,231,0.15)'; e.target.style.borderColor = 'var(--color-accent)' }}
                              onBlur={e => { e.target.style.boxShadow = 'none'; e.target.style.borderColor = 'var(--color-border-light)' }}
                              placeholder="20XX000XXXXX"
                            />
                          </motion.div>
                          <AnimatePresence>
                            {errors.student_id && (
                              <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="text-xs mt-1.5" style={{ color: '#EF4444' }}>{errors.student_id}</motion.p>
                            )}
                          </AnimatePresence>
                        </div>
                        <div>
                          <label className="block text-xs font-semibold mb-2" style={{ color: 'var(--color-text-muted)', letterSpacing: '0.03em', textTransform: 'uppercase' }}>
                            {t('form.email')} *
                          </label>
                          <motion.div animate={{ x: shaking === 'email' ? [0, -6, 6, -6, 6, 0] : 0 }} transition={{ duration: 0.4 }}>
                            <input
                              style={inputStyle('email')}
                              type="email"
                              value={form.email}
                              onChange={e => updateForm({ email: e.target.value })}
                              onFocus={e => { e.target.style.boxShadow = '0 0 0 3px rgba(36,96,231,0.15)'; e.target.style.borderColor = 'var(--color-accent)' }}
                              onBlur={e => { e.target.style.boxShadow = 'none'; e.target.style.borderColor = 'var(--color-border-light)' }}
                              placeholder="ahmed@univ-bouira.dz"
                            />
                          </motion.div>
                          <AnimatePresence>
                            {errors.email && (
                              <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="text-xs mt-1.5" style={{ color: '#EF4444' }}>{errors.email}</motion.p>
                            )}
                          </AnimatePresence>
                        </div>
                        <div>
                          <label className="block text-xs font-semibold mb-2" style={{ color: 'var(--color-text-muted)', letterSpacing: '0.03em', textTransform: 'uppercase' }}>
                            {t('form.phone')}
                          </label>
                          <input
                            style={inputStyle('phone')}
                            value={form.phone}
                            onChange={e => updateForm({ phone: e.target.value })}
                            onFocus={e => { e.target.style.boxShadow = '0 0 0 3px rgba(36,96,231,0.15)'; e.target.style.borderColor = 'var(--color-accent)' }}
                            onBlur={e => { e.target.style.boxShadow = 'none'; e.target.style.borderColor = 'var(--color-border-light)' }}
                            placeholder="+213 6XX XXX XXX"
                          />
                        </div>
                      </div>
                    )}

                    {step === 1 && (
                      <div className="space-y-5">
                        <div>
                          <label className="block text-xs font-semibold mb-2" style={{ color: 'var(--color-text-muted)', letterSpacing: '0.03em', textTransform: 'uppercase' }}>
                            {t('form.department')} *
                          </label>
                          <motion.div animate={{ x: shaking === 'department' ? [0, -6, 6, -6, 6, 0] : 0 }} transition={{ duration: 0.4 }}>
                            <select
                              ref={el => setInputRef(1, el)}
                              style={inputStyle('department')}
                              value={form.department}
                              onChange={e => updateForm({ department: e.target.value })}
                              onFocus={e => { e.target.style.boxShadow = '0 0 0 3px rgba(36,96,231,0.15)'; e.target.style.borderColor = 'var(--color-accent)' }}
                              onBlur={e => { e.target.style.boxShadow = 'none'; e.target.style.borderColor = 'var(--color-border-light)' }}
                            >
                              <option value="">—</option>
                              {departments.map(d => (
                                <option key={d} value={d}>{t(`departments.${d}`)}</option>
                              ))}
                            </select>
                          </motion.div>
                          <AnimatePresence>
                            {errors.department && (
                              <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="text-xs mt-1.5" style={{ color: '#EF4444' }}>{errors.department}</motion.p>
                            )}
                          </AnimatePresence>
                        </div>
                        <div>
                          <label className="block text-xs font-semibold mb-2" style={{ color: 'var(--color-text-muted)', letterSpacing: '0.03em', textTransform: 'uppercase' }}>
                            {t('form.studyYear')} *
                          </label>
                          <motion.div animate={{ x: shaking === 'study_year' ? [0, -6, 6, -6, 6, 0] : 0 }} transition={{ duration: 0.4 }}>
                            <select
                              style={inputStyle('study_year')}
                              value={form.study_year}
                              onChange={e => updateForm({ study_year: e.target.value })}
                              onFocus={e => { e.target.style.boxShadow = '0 0 0 3px rgba(36,96,231,0.15)'; e.target.style.borderColor = 'var(--color-accent)' }}
                              onBlur={e => { e.target.style.boxShadow = 'none'; e.target.style.borderColor = 'var(--color-border-light)' }}
                            >
                              <option value="">—</option>
                              {years.map(y => (
                                <option key={y} value={y}>{t(`years.${y}`)}</option>
                              ))}
                            </select>
                          </motion.div>
                          <AnimatePresence>
                            {errors.study_year && (
                              <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="text-xs mt-1.5" style={{ color: '#EF4444' }}>{errors.study_year}</motion.p>
                            )}
                          </AnimatePresence>
                        </div>
                      </div>
                    )}

                    {step === 2 && (
                      <div className="space-y-6">
                        <div>
                          <label className="block text-xs font-semibold mb-2" style={{ color: 'var(--color-text-muted)', letterSpacing: '0.03em', textTransform: 'uppercase' }}>
                            {t('form.interests')}
                          </label>
                          <div className="flex flex-wrap gap-2">
                            {interests.map(i => (
                              <motion.button
                                key={i}
                                type="button"
                                whileTap={{ scale: 0.92 }}
                                onClick={() => toggleArray('interests', i)}
                                className={`pill ${form.interests.includes(i) ? 'active' : ''}`}
                              >
                                {form.interests.includes(i) && <Check size={12} />}
                                {t(`interestOptions.${i}`)}
                              </motion.button>
                            ))}
                          </div>
                        </div>
                        <div>
                          <label className="block text-xs font-semibold mb-2" style={{ color: 'var(--color-text-muted)', letterSpacing: '0.03em', textTransform: 'uppercase' }}>
                            {t('form.skills')}
                          </label>
                          <div className="flex flex-wrap gap-2">
                            {skillOpts.map(s => (
                              <motion.button
                                key={s}
                                type="button"
                                whileTap={{ scale: 0.92 }}
                                onClick={() => toggleArray('skills', s)}
                                className={`pill ${form.skills.includes(s) ? 'active' : ''}`}
                              >
                                {form.skills.includes(s) && <Check size={12} />}
                                {t(`skillOptions.${s}`)}
                              </motion.button>
                            ))}
                          </div>
                        </div>
                        <div>
                          <label className="block text-xs font-semibold mb-2" style={{ color: 'var(--color-text-muted)', letterSpacing: '0.03em', textTransform: 'uppercase' }}>
                            {t('form.motivation')} *
                          </label>
                          <motion.div animate={{ x: shaking === 'motivation' ? [0, -6, 6, -6, 6, 0] : 0 }} transition={{ duration: 0.4 }}>
                            <textarea
                              ref={el => setInputRef(2, el)}
                              style={{ ...inputStyle('motivation'), borderRadius: 20, minHeight: 120, resize: 'vertical' }}
                              rows={4}
                              value={form.motivation}
                              onChange={e => updateForm({ motivation: e.target.value })}
                              onFocus={e => { e.target.style.boxShadow = '0 0 0 3px rgba(36,96,231,0.15)'; e.target.style.borderColor = 'var(--color-accent)' }}
                              onBlur={e => { e.target.style.boxShadow = 'none'; e.target.style.borderColor = 'var(--color-border-light)' }}
                              placeholder={t('form.motivationPlaceholder')}
                            />
                          </motion.div>
                          <AnimatePresence>
                            {errors.motivation && (
                              <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="text-xs mt-1.5" style={{ color: '#EF4444' }}>{errors.motivation}</motion.p>
                            )}
                          </AnimatePresence>
                        </div>
                      </div>
                    )}
                  </motion.div>
                </AnimatePresence>

                <AnimatePresence>
                  {status === 'error' && (
                    <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="text-sm text-center mt-4" style={{ color: '#EF4444' }}>{t('form.error')}</motion.p>
                  )}
                  {errors.duplicate && (
                    <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="text-sm text-center mt-4" style={{ color: '#EF4444' }}>{errors.duplicate}</motion.p>
                  )}
                </AnimatePresence>

                <div className="flex items-center justify-between mt-8 gap-4">
                  <motion.button
                    onClick={prevStep}
                    disabled={step === 0}
                    whileTap={step !== 0 ? { scale: 0.95 } : {}}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-[100px] font-semibold text-sm transition-all duration-200"
                    style={{
                      background: 'transparent',
                      color: step === 0 ? 'var(--color-border)' : 'var(--color-text-muted)',
                      border: `1.5px solid var(--color-border)`,
                      cursor: step === 0 ? 'not-allowed' : 'pointer',
                      opacity: step === 0 ? 0.4 : 1,
                    }}
                  >
                    <ArrowLeft size={14} />
                    {t('form.back')}
                  </motion.button>

                  {step < 2 ? (
                    <motion.button
                      onClick={nextStep}
                      whileHover={{ scale: 1.03 }}
                      whileTap={{ scale: 0.95 }}
                      className="inline-flex items-center gap-2 px-6 py-2.5 rounded-[100px] font-semibold text-sm transition-all duration-200"
                      style={{ background: 'var(--color-accent)', color: '#fff' }}
                    >
                      {t('form.next')} <ArrowRight size={14} />
                    </motion.button>
                  ) : (
                    <motion.button
                      onClick={handleSubmit}
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
                        <motion.div
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

                <div className="text-center mt-6">
                  <ProgresButton onSuccess={handleProgresSuccess} />

                  {showAutoFillBanner && (
                    <motion.p
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="text-sm mt-3"
                      style={{ color: '#16A34A' }}
                    >
                      ✓ Form filled from your Progres account — please review before submitting.
                    </motion.p>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </section>
    </div>
  )
}
