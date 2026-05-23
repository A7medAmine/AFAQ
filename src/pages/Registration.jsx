import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import { Send, Check } from 'lucide-react'
import { supabase } from '../lib/supabase'
import SideImage from '../components/shared/SideImage'

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

export default function Registration() {
  const { t, i18n } = useTranslation('register')
  const [form, setForm] = useState(initialForm)
  const [status, setStatus] = useState('idle')
  const [errors, setErrors] = useState({})
  const [shaking, setShaking] = useState(null)
  const [events, setEvents] = useState([])

  useEffect(() => {
    const today = new Date().toISOString().split('T')[0]
    supabase
      .from('events')
      .select('id, title_en, title_ar, title_fr, date')
      .eq('is_published', true)
      .eq('registration_open', true)
      .gte('date', today)
      .order('date', { ascending: true })
      .then(({ data }) => setEvents(data || []))
  }, [])

  const deptKeys = ['fsas', 'fnlses', 'flps', 'fecms', 'fshs', 'fll', 'istaps', 'iot', 'fes']

  const validate = () => {
    const errs = {}
    if (!form.event_id) errs.event_id = t('form.validation.required')
    if (!form.full_name.trim()) errs.full_name = t('form.validation.required')
    if (!form.email.trim()) errs.email = t('form.validation.required')
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) errs.email = t('form.validation.email')
    if (!form.agreed_to_policies) errs.agreed_to_policies = t('form.validation.requiredPolicies')
    setErrors(errs)
    if (Object.keys(errs).length > 0) {
      const firstField = Object.keys(errs)[0]
      setShaking(firstField)
      setTimeout(() => setShaking(null), 500)
    }
    return Object.keys(errs).length === 0
  }

  const handleSubmit = async () => {
    if (!validate()) return
    setStatus('loading')
    const { error } = await supabase.from('event_registrations').insert([{
      event_id: form.event_id,
      full_name: form.full_name,
      student_id: form.student_id || null,
      email: form.email,
      phone: form.phone || null,
      department: form.department || null,
      agreed_to_policies: true,
    }])
    if (error) {
      console.error(error)
      setStatus('error')
    } else {
      const ev = events.find(e => e.id === form.event_id)
      const eventTitle = ev ? (ev[`title_${i18n.language}`] || ev.title_en) : ''
      const eventDate = ev?.date ? new Date(ev.date + 'T00:00:00').toLocaleDateString() : ''
      fetch('/api/email/registration-confirmation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: form.email, name: form.full_name, event_title: eventTitle, date: eventDate }),
      }).catch(() => {})
      setStatus('success')
      setForm(initialForm)
    }
  }

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
              <div className="space-y-5">
                <div>
                  <label className="block text-xs font-semibold mb-2" style={{ color: 'var(--color-text-muted)', letterSpacing: '0.03em', textTransform: 'uppercase' }}>
                    {t('form.event')} *
                  </label>
                  <motion.div animate={{ x: shaking === 'event_id' ? [0, -6, 6, -6, 6, 0] : 0 }} transition={{ duration: 0.4 }}>
                    <select
                      style={inputStyle('event_id')}
                      value={form.event_id}
                      onChange={e => setForm({...form, event_id: e.target.value})}
                      onFocus={e => { e.target.style.boxShadow = '0 0 0 3px rgba(36,96,231,0.15)'; e.target.style.borderColor = 'var(--color-accent)' }}
                      onBlur={e => { e.target.style.boxShadow = 'none'; e.target.style.borderColor = 'var(--color-border-light)' }}
                    >
                      <option value="">{t('form.selectEvent')}</option>
                      {events.map(e => {
                        const lang = i18n.language
                        const title = e[`title_${lang}`] || e.title_en || ''
                        const d = e.date ? new Date(e.date + 'T00:00:00').toLocaleDateString() : ''
                        return (
                          <option key={e.id} value={e.id}>
                            {title} {d ? `(${d})` : ''}
                          </option>
                        )
                      })}
                    </select>
                  </motion.div>
                  <AnimatePresence>
                    {errors.event_id && (
                      <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="text-xs mt-1.5" style={{ color: '#EF4444' }}>{errors.event_id}</motion.p>
                    )}
                  </AnimatePresence>
                </div>

                <div>
                  <label className="block text-xs font-semibold mb-2" style={{ color: 'var(--color-text-muted)', letterSpacing: '0.03em', textTransform: 'uppercase' }}>
                    {t('form.fullName')} *
                  </label>
                  <motion.div animate={{ x: shaking === 'full_name' ? [0, -6, 6, -6, 6, 0] : 0 }} transition={{ duration: 0.4 }}>
                    <input
                      style={inputStyle('full_name')}
                      value={form.full_name}
                      onChange={e => setForm({...form, full_name: e.target.value})}
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
                    {t('form.studentId')}
                  </label>
                  <input
                    style={inputStyle('student_id')}
                    value={form.student_id}
                    onChange={e => setForm({...form, student_id: e.target.value})}
                    onFocus={e => { e.target.style.boxShadow = '0 0 0 3px rgba(36,96,231,0.15)'; e.target.style.borderColor = 'var(--color-accent)' }}
                    onBlur={e => { e.target.style.boxShadow = 'none'; e.target.style.borderColor = 'var(--color-border-light)' }}
                    placeholder="2024XXXXX"
                  />
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
                      onChange={e => setForm({...form, email: e.target.value})}
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
                    onChange={e => setForm({...form, phone: e.target.value})}
                    onFocus={e => { e.target.style.boxShadow = '0 0 0 3px rgba(36,96,231,0.15)'; e.target.style.borderColor = 'var(--color-accent)' }}
                    onBlur={e => { e.target.style.boxShadow = 'none'; e.target.style.borderColor = 'var(--color-border-light)' }}
                    placeholder="+213 6XX XXX XXX"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold mb-2" style={{ color: 'var(--color-text-muted)', letterSpacing: '0.03em', textTransform: 'uppercase' }}>
                    {t('form.department')}
                  </label>
                  <select
                    style={inputStyle('department')}
                    value={form.department}
                    onChange={e => setForm({...form, department: e.target.value})}
                    onFocus={e => { e.target.style.boxShadow = '0 0 0 3px rgba(36,96,231,0.15)'; e.target.style.borderColor = 'var(--color-accent)' }}
                    onBlur={e => { e.target.style.boxShadow = 'none'; e.target.style.borderColor = 'var(--color-border-light)' }}
                  >
                    <option value="">{t('form.selectDepartment')}</option>
                    {deptKeys.map(key => (
                      <option key={key} value={key}>{t(`departments.${key}`)}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <motion.div
                    animate={{ x: shaking === 'agreed_to_policies' ? [0, -6, 6, -6, 6, 0] : 0 }}
                    transition={{ duration: 0.4 }}
                    className="flex items-start gap-3"
                  >
                    <input
                      type="checkbox"
                      id="policies"
                      checked={form.agreed_to_policies}
                      onChange={e => setForm({...form, agreed_to_policies: e.target.checked})}
                      style={{
                        marginTop: 2,
                        width: 18,
                        height: 18,
                        accentColor: 'var(--color-accent)',
                        cursor: 'pointer',
                        flexShrink: 0,
                      }}
                    />
                    <label htmlFor="policies" className="text-sm" style={{ color: 'var(--color-text)', cursor: 'pointer', lineHeight: 1.5 }}>
                      {t('form.policies')}
                    </label>
                  </motion.div>
                  <AnimatePresence>
                    {errors.agreed_to_policies && (
                      <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="text-xs mt-1.5" style={{ color: '#EF4444' }}>{errors.agreed_to_policies}</motion.p>
                    )}
                  </AnimatePresence>
                </div>

                <AnimatePresence>
                  {status === 'error' && (
                    <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="text-sm text-center" style={{ color: '#EF4444' }}>{t('form.error')}</motion.p>
                  )}
                </AnimatePresence>

                <motion.button
                  onClick={handleSubmit}
                  disabled={status === 'loading'}
                  whileHover={status !== 'loading' ? { scale: 1.03 } : {}}
                  whileTap={status !== 'loading' ? { scale: 0.95 } : {}}
                  className="inline-flex items-center justify-center gap-2 w-full px-6 py-3.5 rounded-[100px] font-semibold text-sm transition-all duration-200 mt-2"
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
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  )
}
