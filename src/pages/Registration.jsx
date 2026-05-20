import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import { Send, Check, User, BookOpen, Heart, ArrowLeft, ArrowRight } from 'lucide-react'
import { supabase } from '../lib/supabase'
import SideImage from '../components/shared/SideImage'
// import Lanyard from '../components/shared/Lanyard'

const spring = { type: 'spring', damping: 28, stiffness: 120 }

const steps = ['personal', 'academic', 'interests']
const stepIcons = [User, BookOpen, Heart]

const initialForm = {
  full_name: '',
  email: '',
  phone: '',
  department: '',
  study_year: '',
  interests: [],
  skills: [],
  motivation: '',
}

const containerVariants = {
  hidden: { opacity: 0, x: 20 },
  visible: { opacity: 1, x: 0, transition: spring },
  exit: { opacity: 0, x: -20, transition: { type: 'spring', damping: 28, stiffness: 120 } },
}

export default function Registration() {
  const { t } = useTranslation('register')
  const [step, setStep] = useState(0)
  const [form, setForm] = useState(initialForm)
  const [status, setStatus] = useState('idle')
  const [errors, setErrors] = useState({})

  const validate = () => {
    const errs = {}
    if (step === 0) {
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
    return Object.keys(errs).length === 0
  }

  const nextStep = () => {
    if (!validate()) return
    setStep(s => Math.min(s + 1, 2))
  }

  const prevStep = () => setStep(s => Math.max(s - 1, 0))

  const handleSubmit = async () => {
    if (!validate()) return
    setStatus('loading')
    const { error } = await supabase.from('registrations').insert([form])
    if (error) {
      console.error(error)
      setStatus('error')
    } else {
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
  const departments = Object.keys(t('departments', { returnObjects: true }))
  const years = Object.keys(t('years', { returnObjects: true }))

  const inputStyle = (field) => ({
    background: 'var(--color-bg)',
    border: `1.5px solid ${errors[field] ? '#EF4444' : 'var(--color-border-light)'}`,
    borderRadius: 100,
    padding: '16px 20px',
    fontSize: 15,
    color: 'var(--color-text)',
    width: '100%',
    outline: 'none',
    transition: 'all 0.2s',
  })

  return (
    <div className="relative">
      {/* <div className="fixed right-2 sm:right-4 top-1/2 -translate-y-1/2 z-50 w-[120px] h-[160px] sm:w-[250px] sm:h-[330px] md:w-[320px] md:h-[420px] lg:w-[380px] lg:h-[500px]">
        <Lanyard position={[0, 0, 15]} gravity={[0, -40, 0]} fov={20} transparent />
      </div> */}
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
                  transition={{ ...spring, delay: 0.2 }}
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
                <h3
                  className="text-2xl font-bold mb-3"
                >
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
                      <>
                        <div
                          className={`step-circle ${isActive ? 'active' : ''} ${isDone ? 'done' : ''}`}
                        >
                          {isDone ? <Check size={16} /> : <StepIcon size={16} />}
                        </div>
                        {i < steps.length - 1 && (
                          <div className={`step-line ${isDone || (isActive && step < steps.length - 1) ? 'active' : ''} ${isDone ? 'done' : ''}`} />
                        )}
                      </>
                    )
                  })}
                </div>

                <div className="text-center mb-8">
                  <p className="text-xs font-semibold" style={{ color: 'var(--color-text-muted)', letterSpacing: '0.05em' }}>
                    Step {step + 1} of 3
                  </p>
                  <p className="text-sm font-bold mt-1">
                    {step === 0 ? t('form.fullName') : step === 1 ? t('form.department') : t('form.interests')}
                  </p>
                </div>

                <AnimatePresence mode="wait">
                  <motion.div
                    key={step}
                    variants={containerVariants}
                    initial="hidden"
                    animate="visible"
                    exit="exit"
                  >
                    {step === 0 && (
                      <div className="space-y-5">
                        <div>
                          <label className="block text-xs font-semibold mb-2" style={{ color: 'var(--color-text-muted)', letterSpacing: '0.03em', textTransform: 'uppercase' }}>
                            {t('form.fullName')} *
                          </label>
                          <input
                            style={inputStyle('full_name')}
                            value={form.full_name}
                            onChange={e => setForm({...form, full_name: e.target.value})}
                            placeholder="Ahmed Mansouri"
                          />
                          {errors.full_name && <p className="text-xs mt-1.5" style={{ color: '#EF4444' }}>{errors.full_name}</p>}
                        </div>
                        <div>
                          <label className="block text-xs font-semibold mb-2" style={{ color: 'var(--color-text-muted)', letterSpacing: '0.03em', textTransform: 'uppercase' }}>
                            {t('form.email')} *
                          </label>
                          <input
                            style={inputStyle('email')}
                            type="email"
                            value={form.email}
                            onChange={e => setForm({...form, email: e.target.value})}
                            placeholder="ahmed@univ-bouira.dz"
                          />
                          {errors.email && <p className="text-xs mt-1.5" style={{ color: '#EF4444' }}>{errors.email}</p>}
                        </div>
                        <div>
                          <label className="block text-xs font-semibold mb-2" style={{ color: 'var(--color-text-muted)', letterSpacing: '0.03em', textTransform: 'uppercase' }}>
                            {t('form.phone')}
                          </label>
                          <input
                            style={inputStyle('phone')}
                            value={form.phone}
                            onChange={e => setForm({...form, phone: e.target.value})}
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
                          <select style={inputStyle('department')} value={form.department} onChange={e => setForm({...form, department: e.target.value})}>
                            <option value="">—</option>
                            {departments.map(d => (
                              <option key={d} value={d}>{t(`departments.${d}`)}</option>
                            ))}
                          </select>
                          {errors.department && <p className="text-xs mt-1.5" style={{ color: '#EF4444' }}>{errors.department}</p>}
                        </div>
                        <div>
                          <label className="block text-xs font-semibold mb-2" style={{ color: 'var(--color-text-muted)', letterSpacing: '0.03em', textTransform: 'uppercase' }}>
                            {t('form.studyYear')} *
                          </label>
                          <select style={inputStyle('study_year')} value={form.study_year} onChange={e => setForm({...form, study_year: e.target.value})}>
                            <option value="">—</option>
                            {years.map(y => (
                              <option key={y} value={y}>{t(`years.${y}`)}</option>
                            ))}
                          </select>
                          {errors.study_year && <p className="text-xs mt-1.5" style={{ color: '#EF4444' }}>{errors.study_year}</p>}
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
                              <button
                                key={i}
                                type="button"
                                onClick={() => toggleArray('interests', i)}
                                className={`pill ${form.interests.includes(i) ? 'active' : ''}`}
                              >
                                {form.interests.includes(i) && <Check size={12} />}
                                {t(`interestOptions.${i}`)}
                              </button>
                            ))}
                          </div>
                        </div>
                        <div>
                          <label className="block text-xs font-semibold mb-2" style={{ color: 'var(--color-text-muted)', letterSpacing: '0.03em', textTransform: 'uppercase' }}>
                            {t('form.skills')}
                          </label>
                          <div className="flex flex-wrap gap-2">
                            {skillOpts.map(s => (
                              <button
                                key={s}
                                type="button"
                                onClick={() => toggleArray('skills', s)}
                                className={`pill ${form.skills.includes(s) ? 'active' : ''}`}
                              >
                                {form.skills.includes(s) && <Check size={12} />}
                                {t(`skillOptions.${s}`)}
                              </button>
                            ))}
                          </div>
                        </div>
                        <div>
                          <label className="block text-xs font-semibold mb-2" style={{ color: 'var(--color-text-muted)', letterSpacing: '0.03em', textTransform: 'uppercase' }}>
                            {t('form.motivation')} *
                          </label>
                          <textarea
                            style={{ ...inputStyle('motivation'), borderRadius: 20, minHeight: 120, resize: 'vertical' }}
                            rows={4}
                            value={form.motivation}
                            onChange={e => setForm({...form, motivation: e.target.value})}
                            placeholder={t('form.motivationPlaceholder')}
                          />
                          {errors.motivation && <p className="text-xs mt-1.5" style={{ color: '#EF4444' }}>{errors.motivation}</p>}
                        </div>
                      </div>
                    )}
                  </motion.div>
                </AnimatePresence>

                {status === 'error' && (
                  <p className="text-sm text-center mt-4" style={{ color: '#EF4444' }}>{t('form.error')}</p>
                )}

                <div className="flex items-center justify-between mt-8 gap-4">
                  <button
                    onClick={prevStep}
                    disabled={step === 0}
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
                    Back
                  </button>

                  {step < 2 ? (
                    <button
                      onClick={nextStep}
                      className="inline-flex items-center gap-2 px-6 py-2.5 rounded-[100px] font-semibold text-sm transition-all duration-200"
                      style={{ background: 'var(--color-accent)', color: '#fff' }}
                    >
                      Next <ArrowRight size={14} />
                    </button>
                  ) : (
                    <button
                      onClick={handleSubmit}
                      disabled={status === 'loading'}
                      className="inline-flex items-center gap-2 px-6 py-2.5 rounded-[100px] font-semibold text-sm transition-all duration-200"
                      style={{
                        background: status === 'loading' ? 'var(--color-accent-dark)' : 'var(--color-accent)',
                        color: '#fff',
                        opacity: status === 'loading' ? 0.8 : 1,
                      }}
                    >
                      {status === 'loading' ? (
                        <div style={{ width: 16, height: 16, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'white', borderRadius: '50%', animation: 'spin .6s linear infinite' }} />
                      ) : (
                        <Send size={14} />
                      )}
                      {status === 'loading' ? 'Submitting...' : t('form.submit')}
                    </button>
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
