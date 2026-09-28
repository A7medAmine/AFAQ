import { useState } from 'react'
import { motion } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import { Mail, MapPin, Send } from 'lucide-react'
import SocialIcons from '../components/shared/SocialIcons'
import SideImage from '../components/shared/SideImage'
import { supabase } from '../lib/supabase'
import { FloatingField, FormError } from '../components/forms/Field'
import SEO from '../components/SEO'

const spring = { type: 'spring', damping: 28, stiffness: 120 }

export default function Contact() {
  const { t } = useTranslation('contact')
  const blank = { name: '', email: '', subject: '', message: '' }
  const [form, setForm] = useState(blank)
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')
  const [errors, setErrors] = useState({})

  const update = (field, value) => {
    setForm(f => ({ ...f, [field]: value }))
    setErrors(e => ({ ...e, [field]: undefined }))
    setError('')
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    // Validated here rather than left to the browser, so each message arrives
    // in the visitor's own language and names the field it belongs to.
    const found = {}
    if (!form.name.trim()) found.name = t('form.validation.name')
    if (!form.email.trim()) found.email = t('form.validation.email')
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) found.email = t('form.validation.emailFormat')
    if (!form.message.trim()) found.message = t('form.validation.message')
    if (Object.keys(found).length) { setErrors(found); return }

    setLoading(true)
    setError('')

    const { error: err } = await supabase.from('contact_messages').insert([{
      name: form.name.trim(),
      email: form.email.trim().toLowerCase(),
      subject: form.subject.trim() || t('form.title'),
      message: form.message.trim(),
    }])

    setLoading(false)
    if (err) {
      // A raw Postgres string is not an answer to "what do I do now".
      setError(/fetch|network/i.test(err.message || '') ? t('form.networkError') : t('form.error'))
      return
    }
    setDone(true)
    setForm(blank)
  }

  const sendAnother = () => { setDone(false); setErrors({}); setError('') }

  return (
    <>
      <SEO title={t('hero.title')} description={t('hero.subtitle')} path="/contact" />
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
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-12 items-start">
            <motion.div initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: '-30px' }} transition={spring} className="lg:col-span-2">
              <div className="eyebrow mb-4">{t('info.title')}</div>
              <h2 className="text-3xl md:text-4xl font-bold mb-8 leading-tight">{t('info.title')}</h2>
              <div className="space-y-6 mb-8">
                <div className="flex items-center gap-4">
                  <div className="flex items-center justify-center" style={{ width: 48, height: 48, borderRadius: 14, background: 'var(--color-accent-soft)', color: 'var(--color-accent)', flexShrink: 0 }}>
                    <Mail size={20} />
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider mb-0.5" style={{ color: 'var(--color-text-muted)' }}>Email</p>
                    <p className="text-sm font-semibold">{t('info.email')}</p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="flex items-center justify-center" style={{ width: 48, height: 48, borderRadius: 14, background: 'var(--color-accent-soft)', color: 'var(--color-accent)', flexShrink: 0 }}>
                    <MapPin size={20} />
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider mb-0.5" style={{ color: 'var(--color-text-muted)' }}>Location</p>
                    <p className="text-sm font-semibold">{t('info.location')}</p>
                  </div>
                </div>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider mb-4" style={{ color: 'var(--color-text-muted)' }}>{t('info.followUs')}</p>
                <SocialIcons size="lg" />
              </div>
            </motion.div>

            <motion.div initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: '-30px' }} transition={{ ...spring, delay: 0.1 }} className="lg:col-span-3">
              <div className="card-pro p-8 md:p-10">
                {done ? (
                  <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={spring} className="text-center py-8">
                    <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ ...spring, delay: 0.1 }} className="inline-flex items-center justify-center mb-6"
                      style={{ width: 72, height: 72, borderRadius: '50%', background: 'rgba(22, 163, 74, 0.1)', color: '#16A34A' }}>
                      <Send size={32} />
                    </motion.div>
                    <h3 className="text-2xl font-bold mb-3">{t('form.successTitle')}</h3>
                    <p className="text-base leading-relaxed max-w-sm mx-auto" style={{ color: 'var(--color-text-muted)' }}>
                      {t('form.successBody')}
                    </p>
                    <button
                      type="button"
                      onClick={sendAnother}
                      className="mt-7 px-6 py-3 rounded-[100px] font-semibold text-sm"
                      style={{ border: '1.5px solid var(--color-border)', color: 'var(--color-text)' }}
                    >
                      {t('form.sendAnother')}
                    </button>
                  </motion.div>
                ) : (
                  <form onSubmit={handleSubmit} className="space-y-5" noValidate>
                    <h2 className="text-xl font-bold mb-4">{t('form.title')}</h2>
                    <FormError message={error} />
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                      <FloatingField
                        label={t('form.name')} required autoComplete="name"
                        value={form.name} error={errors.name}
                        onChange={e => update('name', e.target.value)}
                      />
                      <FloatingField
                        label={t('form.email')} required type="email" autoComplete="email"
                        value={form.email} error={errors.email}
                        onChange={e => update('email', e.target.value)}
                      />
                    </div>
                    <FloatingField
                      label={t('form.subject')} autoComplete="off"
                      value={form.subject}
                      onChange={e => update('subject', e.target.value)}
                    />
                    <FloatingField
                      label={t('form.message')} required multiline
                      style={{ minHeight: 140, borderRadius: 20 }}
                      value={form.message} error={errors.message}
                      onChange={e => update('message', e.target.value)}
                    />
                    <button type="submit" disabled={loading}
                      className="w-full py-3.5 rounded-[100px] font-semibold text-sm transition-all duration-200 flex items-center justify-center gap-2"
                      style={{ background: 'var(--color-accent)', color: '#fff' }}>
                      {loading ? (
                        <div style={{ width: 16, height: 16, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'white', borderRadius: '50%', animation: 'spin .6s linear infinite' }} />
                      ) : (
                        <Send size={16} />
                      )}
                      {loading ? t('form.sending') : t('form.submit')}
                    </button>
                  </form>
                )}
              </div>
            </motion.div>
          </div>
        </div>
      </section>
    </>
  )
}
