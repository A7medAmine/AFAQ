import { useState } from 'react'
import { motion } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import { Mail, MapPin, Send } from 'lucide-react'
import SocialIcons from '../components/shared/SocialIcons'
import SideImage from '../components/shared/SideImage'
import { supabase } from '../lib/supabase'

const spring = { type: 'spring', damping: 28, stiffness: 120 }

export default function Contact() {
  const { t } = useTranslation('contact')
  const [form, setForm] = useState({ name: '', email: '', subject: '', message: '' })
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    const { error: err } = await supabase.from('contact_messages').insert([form])
    if (err) {
      setError(err.message)
      setLoading(false)
      return
    }
    setLoading(false)
    setDone(true)
    setForm({ name: '', email: '', subject: '', message: '' })
  }

  return (
    <>
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
                    <h3 className="text-2xl font-bold mb-3">{t('form.success')}</h3>
                  </motion.div>
                ) : (
                  <form onSubmit={handleSubmit} className="space-y-5">
                    <h2 className="text-xl font-bold mb-4">{t('form.title')}</h2>
                    {error && (
                      <div className="p-3 rounded-xl text-sm" style={{ background: '#fef2f2', color: '#dc2626' }}>{error}</div>
                    )}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                      <div className="floating-label">
                        <input className="form-input" placeholder=" " required value={form.name} onChange={e => setForm({...form, name: e.target.value})} />
                        <label>{t('form.name')} *</label>
                      </div>
                      <div className="floating-label">
                        <input className="form-input" type="email" placeholder=" " required value={form.email} onChange={e => setForm({...form, email: e.target.value})} />
                        <label>{t('form.email')} *</label>
                      </div>
                    </div>
                    <div className="floating-label">
                      <input className="form-input" placeholder=" " value={form.subject} onChange={e => setForm({...form, subject: e.target.value})} />
                      <label>{t('form.subject')}</label>
                    </div>
                    <div className="floating-label">
                      <textarea className="form-input" placeholder=" " style={{ minHeight: 140, borderRadius: 20 }} required value={form.message} onChange={e => setForm({...form, message: e.target.value})} />
                      <label>{t('form.message')} *</label>
                    </div>
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
