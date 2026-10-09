import { useEffect, useMemo, useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { CheckCircle2, Clock, Copy, Loader2, Lock, Share2, Star, XCircle } from 'lucide-react'

/**
 * The page behind a poll's link. No account needed for public polls; members
 * polls ask for a member code and email. Its wording follows the language the
 * admin picked for the poll, not the visitor's site setting, so a poll posted
 * in Arabic reads in Arabic for everyone.
 */
const T = {
  en: {
    club: 'AFAQ Scientific Club',
    poll: 'Poll',
    required: 'Required',
    optional: 'Optional',
    pickOne: 'Pick one',
    pickMany: 'Pick any',
    pickAtLeast: n => `Pick at least ${n}`,
    pickAtMost: n => `Pick up to ${n}`,
    pickBetween: (a, b) => `Pick ${a} to ${b}`,
    yourAnswer: 'Your answer',
    name: 'Your name',
    email: 'Your email',
    memberCode: 'Member code',
    memberEmail: 'Email the club has for you',
    membersOnly: 'For club members. Enter your member code (on your card) and email.',
    identityRequired: 'Your name and email are needed to answer.',
    identityOptional: 'Name and email are optional.',
    submit: 'Send my answers',
    sending: 'Sending…',
    thanks: 'Thank you!',
    thanksBody: 'Your answer has been recorded.',
    already: 'You already answered this poll.',
    results: 'Results',
    answers: n => `${n} ${n === 1 ? 'answer' : 'answers'}`,
    resultsLater: 'Results will be shown when the poll closes.',
    closed: 'This poll is closed.',
    full: 'This poll has all the answers it was taking.',
    scheduled: 'This poll is not open yet.',
    opensAt: d => `It opens on ${d}.`,
    closesAt: d => `Open until ${d}.`,
    notFound: 'Poll not available',
    offline: 'Could not reach the server. Check your connection and try again.',
    share: 'Share this poll',
    copied: 'Link copied',
    average: 'Average',
  },
  fr: {
    club: 'Club Scientifique AFAQ',
    poll: 'Sondage',
    required: 'Obligatoire',
    optional: 'Facultatif',
    pickOne: 'Un seul choix',
    pickMany: 'Plusieurs choix possibles',
    pickAtLeast: n => `Au moins ${n}`,
    pickAtMost: n => `Jusqu’à ${n}`,
    pickBetween: (a, b) => `De ${a} à ${b}`,
    yourAnswer: 'Votre réponse',
    name: 'Votre nom',
    email: 'Votre e-mail',
    memberCode: 'Code membre',
    memberEmail: 'E-mail enregistré au club',
    membersOnly: 'Réservé aux membres. Saisissez votre code membre (sur votre carte) et votre e-mail.',
    identityRequired: 'Votre nom et votre e-mail sont nécessaires pour répondre.',
    identityOptional: 'Nom et e-mail facultatifs.',
    submit: 'Envoyer mes réponses',
    sending: 'Envoi…',
    thanks: 'Merci !',
    thanksBody: 'Votre réponse a été enregistrée.',
    already: 'Vous avez déjà répondu à ce sondage.',
    results: 'Résultats',
    answers: n => `${n} réponse${n === 1 ? '' : 's'}`,
    resultsLater: 'Les résultats seront affichés à la clôture du sondage.',
    closed: 'Ce sondage est clos.',
    full: 'Ce sondage a reçu toutes les réponses prévues.',
    scheduled: 'Ce sondage n’est pas encore ouvert.',
    opensAt: d => `Il ouvre le ${d}.`,
    closesAt: d => `Ouvert jusqu’au ${d}.`,
    notFound: 'Sondage indisponible',
    offline: 'Impossible de joindre le serveur. Vérifiez votre connexion et réessayez.',
    share: 'Partager ce sondage',
    copied: 'Lien copié',
    average: 'Moyenne',
  },
  ar: {
    club: 'نادي آفاق العلمي',
    poll: 'استطلاع',
    required: 'إجباري',
    optional: 'اختياري',
    pickOne: 'اختر إجابة واحدة',
    pickMany: 'يمكنك اختيار أكثر من إجابة',
    pickAtLeast: n => `اختر ${n} على الأقل`,
    pickAtMost: n => `اختر ${n} كحد أقصى`,
    pickBetween: (a, b) => `اختر من ${a} إلى ${b}`,
    yourAnswer: 'إجابتك',
    name: 'اسمك',
    email: 'بريدك الإلكتروني',
    memberCode: 'رمز العضوية',
    memberEmail: 'بريدك المسجل في النادي',
    membersOnly: 'خاص بأعضاء النادي. أدخل رمز العضوية (الموجود على بطاقتك) وبريدك الإلكتروني.',
    identityRequired: 'يلزم إدخال اسمك وبريدك الإلكتروني للإجابة.',
    identityOptional: 'الاسم والبريد اختياريان.',
    submit: 'أرسل إجاباتي',
    sending: 'جارٍ الإرسال…',
    thanks: 'شكرًا لك!',
    thanksBody: 'تم تسجيل إجابتك.',
    already: 'لقد أجبت على هذا الاستطلاع من قبل.',
    results: 'النتائج',
    answers: n => `${n} إجابة`,
    resultsLater: 'ستظهر النتائج عند إغلاق الاستطلاع.',
    closed: 'هذا الاستطلاع مغلق.',
    full: 'اكتمل عدد الإجابات المطلوبة لهذا الاستطلاع.',
    scheduled: 'هذا الاستطلاع لم يُفتح بعد.',
    opensAt: d => `يُفتح يوم ${d}.`,
    closesAt: d => `مفتوح حتى ${d}.`,
    notFound: 'الاستطلاع غير متاح',
    offline: 'تعذّر الاتصال بالخادم. تحقق من اتصالك وحاول مجددًا.',
    share: 'شارك هذا الاستطلاع',
    copied: 'تم نسخ الرابط',
    average: 'المعدل',
  },
}

const LOCALE = { en: 'en-GB', fr: 'fr-FR', ar: 'ar-DZ' }

export default function Poll() {
  const { slug } = useParams()
  const [params] = useSearchParams()
  const source = params.get('src') || undefined
  const [state, setState] = useState({ loading: true, error: null })
  const [data, setData] = useState(null)
  const [answers, setAnswers] = useState({})
  const [who, setWho] = useState({ name: '', email: '', member_code: '', website: '' })
  const [submit, setSubmit] = useState({ busy: false, error: null, questionId: null, field: null })
  const [done, setDone] = useState(false)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    let cancelled = false
    fetch(`/api/polls/p/${encodeURIComponent(slug)}`, { credentials: 'same-origin' })
      .then(res => res.json().then(body => ({ ok: res.ok, body })))
      .then(({ ok, body }) => {
        if (cancelled) return
        if (!ok) { setState({ loading: false, error: body?.error || 'This poll does not exist.' }); return }
        setData(body)
        setState({ loading: false, error: null })
      })
      .catch(() => { if (!cancelled) setState({ loading: false, error: T.en.offline }) })
    return () => { cancelled = true }
  }, [slug])

  const lang = data?.poll?.language || 'en'
  const t = T[lang] || T.en
  const dir = lang === 'ar' ? 'rtl' : 'ltr'
  const poll = data?.poll
  const fmt = value => new Intl.DateTimeFormat(LOCALE[lang], { dateStyle: 'long', timeStyle: 'short' }).format(new Date(value))

  useEffect(() => {
    if (poll?.title) document.title = `${poll.title} · AFAQ`
  }, [poll?.title])

  const setAnswer = (id, value) => {
    setAnswers(a => ({ ...a, [id]: value }))
    if (submit.questionId === id) setSubmit(s => ({ ...s, error: null, questionId: null }))
  }

  const send = async e => {
    e.preventDefault()
    setSubmit({ busy: true, error: null, questionId: null, field: null })
    try {
      const res = await fetch(`/api/polls/p/${encodeURIComponent(slug)}/vote`, {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answers, ...who, source }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) {
        if (body.voted) { setData(d => ({ ...d, voted: true })); setDone(true) }
        setSubmit({ busy: false, error: body.error || t.offline, questionId: body.questionId || null, field: body.field || null })
        if (body.questionId) document.getElementById(`q-${body.questionId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
        return
      }
      setData(d => ({ ...d, voted: true, results: body.results }))
      setDone(true)
      setSubmit({ busy: false, error: null, questionId: null, field: null })
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch {
      setSubmit({ busy: false, error: t.offline, questionId: null, field: null })
    }
  }

  const share = async () => {
    const url = `${window.location.origin}/p/${slug}?src=share`
    try {
      if (navigator.share) { await navigator.share({ title: poll.title, url }); return }
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch { /* closed the share sheet */ }
  }

  const showForm = poll && poll.state === 'open' && !data.voted && !done

  return (
    <div className="afp" dir={dir} lang={lang}>
      <style>{CSS}</style>
      <div className="afp-wrap">
        <header className="afp-brand">
          <img src="/brand/logo/afaq-mark-white.svg" alt="" width="28" height="28" />
          <span>{t.club}</span>
        </header>

        {state.loading && <div className="afp-card afp-center"><Loader2 size={28} className="animate-spin" /></div>}

        {!state.loading && state.error && (
          <div className="afp-card afp-center">
            <XCircle size={40} color="#DC2626" />
            <h1 className="afp-h1" style={{ marginTop: 12 }}>{t.notFound}</h1>
            <p className="afp-muted">{state.error}</p>
          </div>
        )}

        {poll && (
          <>
            <div className="afp-card">
              <p className="afp-eyebrow">{t.poll}</p>
              <h1 className="afp-h1" dir="auto">{poll.title}</h1>
              {poll.description && <p className="afp-desc" dir="auto">{poll.description}</p>}
              {poll.state === 'open' && poll.closes_at && <p className="afp-note"><Clock size={14} /> {t.closesAt(fmt(poll.closes_at))}</p>}
            </div>

            {(done || data.voted) && (
              <div className="afp-card afp-center">
                <CheckCircle2 size={44} color="#16A34A" />
                <h2 className="afp-h2" style={{ marginTop: 10 }}>{done && !submit.error ? t.thanks : t.already}</h2>
                <p className="afp-muted" dir="auto">{done && !submit.error ? poll.thank_you_message || t.thanksBody : ''}</p>
                <button type="button" className="afp-btn-ghost" onClick={share}>
                  {copied ? <><Copy size={15} /> {t.copied}</> : <><Share2 size={15} /> {t.share}</>}
                </button>
              </div>
            )}

            {poll.state !== 'open' && (
              <div className="afp-card afp-center">
                {poll.state === 'scheduled' ? <Clock size={36} color="#2563EB" /> : <Lock size={36} color="#64748B" />}
                <h2 className="afp-h2" style={{ marginTop: 10 }}>{t[poll.state] || t.closed}</h2>
                {poll.state === 'scheduled' && poll.opens_at && <p className="afp-muted">{t.opensAt(fmt(poll.opens_at))}</p>}
              </div>
            )}

            {showForm && (
              <form onSubmit={send} noValidate>
                {data.questions.map((q, i) => (
                  <Question key={q.id} q={q} index={i} t={t} value={answers[q.id]} onChange={v => setAnswer(q.id, v)}
                    error={submit.questionId === q.id ? submit.error : null} />
                ))}

                {poll.audience === 'members' ? (
                  <fieldset className={`afp-card ${submit.field === 'member' ? 'afp-invalid' : ''}`}>
                    <p className="afp-muted" style={{ marginBottom: 12 }}>{t.membersOnly}</p>
                    <div className="afp-grid">
                      <label className="afp-field"><span>{t.memberCode}</span>
                        <input className="afp-input" dir="ltr" autoComplete="off" required value={who.member_code} onChange={e => setWho(w => ({ ...w, member_code: e.target.value }))} />
                      </label>
                      <label className="afp-field"><span>{t.memberEmail}</span>
                        <input className="afp-input" dir="ltr" type="email" autoComplete="email" required value={who.email} onChange={e => setWho(w => ({ ...w, email: e.target.value }))} />
                      </label>
                    </div>
                  </fieldset>
                ) : poll.collect_identity !== 'none' && (
                  <fieldset className={`afp-card ${submit.field === 'identity' ? 'afp-invalid' : ''}`}>
                    <p className="afp-muted" style={{ marginBottom: 12 }}>{poll.collect_identity === 'required' ? t.identityRequired : t.identityOptional}</p>
                    <div className="afp-grid">
                      <label className="afp-field"><span>{t.name}</span>
                        <input className="afp-input" dir="auto" autoComplete="name" required={poll.collect_identity === 'required'} value={who.name} onChange={e => setWho(w => ({ ...w, name: e.target.value }))} />
                      </label>
                      <label className="afp-field"><span>{t.email}</span>
                        <input className="afp-input" dir="ltr" type="email" autoComplete="email" required={poll.collect_identity === 'required'} value={who.email} onChange={e => setWho(w => ({ ...w, email: e.target.value }))} />
                      </label>
                    </div>
                  </fieldset>
                )}

                {/* Left empty by people; bots that fill every field are dropped. */}
                <input className="afp-hp" tabIndex={-1} autoComplete="off" aria-hidden="true" name="website"
                  value={who.website} onChange={e => setWho(w => ({ ...w, website: e.target.value }))} />

                {submit.error && !submit.questionId && <p className="afp-error" role="alert">{submit.error}</p>}
                <button type="submit" className="afp-btn" disabled={submit.busy}>
                  {submit.busy ? <><Loader2 size={16} className="animate-spin" /> {t.sending}</> : t.submit}
                </button>
              </form>
            )}

            {data.results ? (
              <Results results={data.results} questions={data.questions} t={t} />
            ) : (done || data.voted) && poll.results_visibility === 'after_close' ? (
              <p className="afp-muted afp-center" style={{ padding: 12 }}>{t.resultsLater}</p>
            ) : null}
          </>
        )}
      </div>
    </div>
  )
}

function Question({ q, index, t, value, onChange, error }) {
  const hint = useMemo(() => {
    if (q.type === 'single') return t.pickOne
    if (q.type !== 'multiple') return null
    if (q.min_choices && q.max_choices) return q.min_choices === q.max_choices ? t.pickAtMost(q.max_choices) : t.pickBetween(q.min_choices, q.max_choices)
    if (q.min_choices) return t.pickAtLeast(q.min_choices)
    if (q.max_choices) return t.pickAtMost(q.max_choices)
    return t.pickMany
  }, [q, t])
  const picked = Array.isArray(value) ? value : []
  const atMax = q.type === 'multiple' && q.max_choices && picked.length >= q.max_choices

  return (
    <fieldset id={`q-${q.id}`} className={`afp-card ${error ? 'afp-invalid' : ''}`}>
      <legend className="afp-qhead">
        <span className="afp-qnum">{index + 1}</span>
        <span dir="auto" className="afp-qtext">{q.prompt}</span>
      </legend>
      <p className="afp-qmeta">
        {q.help && <span dir="auto">{q.help} · </span>}
        {hint && <span>{hint} · </span>}
        <span>{q.required ? t.required : t.optional}</span>
      </p>

      {q.type === 'single' && (
        <div className="afp-options" role="radiogroup">
          {q.options.map(o => (
            <label key={o.id} className="afp-option" data-checked={value === o.id || undefined}>
              <input type="radio" name={`q${q.id}`} checked={value === o.id} onChange={() => onChange(o.id)} />
              <span dir="auto">{o.label}</span>
            </label>
          ))}
        </div>
      )}

      {q.type === 'multiple' && (
        <div className="afp-options">
          {q.options.map(o => {
            const checked = picked.includes(o.id)
            return (
              <label key={o.id} className="afp-option" data-checked={checked || undefined} data-disabled={(!checked && atMax) || undefined}>
                <input type="checkbox" checked={checked} disabled={!checked && atMax}
                  onChange={() => onChange(checked ? picked.filter(id => id !== o.id) : [...picked, o.id])} />
                <span dir="auto">{o.label}</span>
              </label>
            )
          })}
        </div>
      )}

      {q.type === 'rating' && (
        <div className="afp-rating" role="radiogroup" dir="ltr">
          {Array.from({ length: q.scale_max || 5 }, (_, i) => i + 1).map(n => (
            (q.scale_max || 5) <= 5 ? (
              <button key={n} type="button" role="radio" aria-checked={value === n} aria-label={`${n} / ${q.scale_max || 5}`}
                className="afp-star" data-on={value >= n || undefined} onClick={() => onChange(n)}>
                <Star size={30} />
              </button>
            ) : (
              <button key={n} type="button" role="radio" aria-checked={value === n}
                className="afp-num" data-on={value === n || undefined} onClick={() => onChange(n)}>{n}</button>
            )
          ))}
        </div>
      )}

      {q.type === 'text' && (
        <textarea className="afp-input" dir="auto" rows={3} maxLength={2000} placeholder={t.yourAnswer}
          value={value || ''} onChange={e => onChange(e.target.value)} />
      )}

      {error && <p className="afp-error" role="alert">{error}</p>}
    </fieldset>
  )
}

function Results({ results, questions, t }) {
  const byId = new Map(questions.map(q => [q.id, q]))
  return (
    <section className="afp-card">
      <div className="afp-reshead">
        <h2 className="afp-h2">{t.results}</h2>
        <span className="afp-muted">{t.answers(results.total)}</span>
      </div>
      {results.questions.map(r => {
        const q = byId.get(r.id)
        if (!q) return null
        const rows = r.type === 'rating'
          ? r.counts.map((count, i) => ({ key: i, label: `${i + 1}`, count }))
          : r.options.map(o => ({ key: o.id, label: q.options.find(x => x.id === o.id)?.label || '', count: o.count }))
        const total = r.type === 'multiple' ? r.answered : rows.reduce((s, x) => s + x.count, 0)
        const top = Math.max(0, ...rows.map(x => x.count))
        return (
          <div key={r.id} className="afp-resq">
            <p className="afp-restitle" dir="auto">{q.prompt}</p>
            {r.type === 'rating' ? (
              <>
                {r.average !== null && (
                  <p className="afp-avg"><Star size={15} /> {t.average}: <strong>{r.average.toFixed(1)}</strong> / {q.scale_max || 5}</p>
                )}
                <div className="afp-cols" dir="ltr">
                  {rows.map(x => (
                    <div key={x.key} className="afp-col" title={`${x.label}: ${x.count}`}>
                      <div className="afp-coltrack">
                        <div className="afp-colfill" data-top={(x.count === top && top > 0) || undefined} style={{ height: `${top ? Math.round((x.count / top) * 100) : 0}%` }} />
                      </div>
                      <span>{x.label}</span>
                    </div>
                  ))}
                </div>
              </>
            ) : rows.map(x => {
              const pct = total ? Math.round((x.count / total) * 100) : 0
              return (
                <div key={x.key} className="afp-bar">
                  <div className="afp-barlabel"><span dir="auto">{x.label}</span><span>{pct}%</span></div>
                  <div className="afp-bartrack"><div className="afp-barfill" data-top={(x.count === top && top > 0) || undefined} style={{ width: `${pct}%` }} /></div>
                </div>
              )
            })}
          </div>
        )
      })}
    </section>
  )
}

const CSS = `
.afp { min-height: 100vh; background: linear-gradient(180deg, #050A30 0, #12229D 260px, #F4F6FC 260px); color: #0F172A; padding: 20px 16px 48px;
  font-family: system-ui, -apple-system, "Segoe UI", Roboto, Tahoma, "Noto Sans Arabic", sans-serif; line-height: 1.5; }
.afp * { box-sizing: border-box; }
.afp-wrap { max-width: 640px; margin: 0 auto; }
.afp-brand { display: flex; align-items: center; gap: 10px; color: #CAE8FF; font-weight: 600; font-size: 14px; margin-bottom: 18px; }
.afp-card { background: #fff; border: 1px solid #E2E8F0; border-radius: 16px; padding: 20px; margin: 0 0 14px; box-shadow: 0 1px 2px rgba(5,10,48,.06); min-width: 0; }
.afp-center { display: flex; flex-direction: column; align-items: center; text-align: center; padding: 28px 20px; }
.afp-eyebrow { font-size: 12px; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; color: #233DFF; margin: 0 0 6px; }
.afp-h1 { font-size: 24px; font-weight: 800; margin: 0; line-height: 1.25; overflow-wrap: anywhere; }
.afp-h2 { font-size: 18px; font-weight: 700; margin: 0; }
.afp-desc { margin: 10px 0 0; color: #334155; white-space: pre-wrap; overflow-wrap: anywhere; }
.afp-note { display: flex; align-items: center; gap: 6px; margin: 12px 0 0; font-size: 13px; color: #64748B; }
.afp-muted { color: #64748B; font-size: 14px; margin: 4px 0 0; }
.afp-qhead { display: flex; gap: 10px; align-items: flex-start; padding: 0; float: left; width: 100%; }
.afp-qhead + * { clear: both; }
.afp-qnum { flex-shrink: 0; width: 26px; height: 26px; border-radius: 8px; background: #CAE8FF; color: #12229D; font-size: 13px; font-weight: 700; display: grid; place-items: center; }
.afp-qtext { font-size: 16px; font-weight: 650; overflow-wrap: anywhere; min-width: 0; }
.afp-qmeta { font-size: 12.5px; color: #64748B; margin: 6px 0 14px; }
.afp-options { display: grid; gap: 8px; }
.afp-option { display: flex; align-items: center; gap: 10px; padding: 12px 14px; border: 1.5px solid #E2E8F0; border-radius: 12px; cursor: pointer; transition: border-color .15s, background .15s; min-height: 48px; }
.afp-option:hover { border-color: #93A5FF; }
.afp-option[data-checked] { border-color: #233DFF; background: #EEF1FF; }
.afp-option[data-disabled] { opacity: .5; cursor: not-allowed; }
.afp-option input { width: 18px; height: 18px; accent-color: #233DFF; flex-shrink: 0; margin: 0; }
.afp-option span { overflow-wrap: anywhere; min-width: 0; }
.afp-rating { display: flex; flex-wrap: wrap; gap: 6px; }
.afp-star { background: none; border: 0; padding: 4px; cursor: pointer; color: #CBD5E1; border-radius: 8px; }
.afp-star[data-on] { color: #F59E0B; }
.afp-star[data-on] svg { fill: #F59E0B; }
.afp-num { width: 44px; height: 44px; border-radius: 10px; border: 1.5px solid #E2E8F0; background: #fff; font-weight: 700; font-size: 15px; cursor: pointer; color: #0F172A; }
.afp-num[data-on] { background: #233DFF; border-color: #233DFF; color: #fff; }
.afp-star:focus-visible, .afp-num:focus-visible, .afp-btn:focus-visible, .afp-btn-ghost:focus-visible { outline: 3px solid #5CBCF9; outline-offset: 2px; }
.afp-input { width: 100%; border: 1.5px solid #E2E8F0; border-radius: 10px; padding: 10px 12px; font: inherit; color: inherit; background: #fff; }
.afp-input:focus { outline: none; border-color: #233DFF; box-shadow: 0 0 0 3px rgba(35,61,255,.15); }
.afp-grid { display: grid; gap: 12px; }
@media (min-width: 560px) { .afp-grid { grid-template-columns: 1fr 1fr; } }
.afp-field { display: grid; gap: 6px; font-size: 13px; font-weight: 600; color: #334155; }
.afp-invalid { border-color: #FCA5A5; box-shadow: 0 0 0 3px rgba(220,38,38,.08); }
.afp-error { color: #DC2626; font-size: 13.5px; font-weight: 500; margin: 10px 0 0; }
.afp-btn { width: 100%; display: flex; align-items: center; justify-content: center; gap: 8px; min-height: 52px; border: 0; border-radius: 14px; background: #233DFF; color: #fff; font: inherit; font-weight: 700; font-size: 16px; cursor: pointer; margin-top: 6px; }
.afp-btn:hover { background: #12229D; }
.afp-btn:disabled { opacity: .7; cursor: wait; }
.afp-btn-ghost { display: inline-flex; align-items: center; gap: 6px; margin-top: 16px; border: 1.5px solid #E2E8F0; background: #fff; border-radius: 10px; padding: 8px 14px; font: inherit; font-size: 14px; font-weight: 600; color: #12229D; cursor: pointer; }
.afp-hp { position: absolute; left: -9999px; width: 1px; height: 1px; opacity: 0; }
.afp-reshead { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; margin-bottom: 8px; }
.afp-resq { padding-top: 14px; margin-top: 14px; border-top: 1px solid #F1F5F9; }
.afp-restitle { font-weight: 650; margin: 0 0 8px; overflow-wrap: anywhere; }
.afp-bar { margin-bottom: 10px; }
.afp-barlabel { display: flex; justify-content: space-between; gap: 12px; font-size: 13.5px; margin-bottom: 4px; }
.afp-barlabel span:first-child { overflow-wrap: anywhere; min-width: 0; }
.afp-bartrack { height: 10px; border-radius: 999px; background: #EEF2F7; overflow: hidden; }
.afp-barfill { height: 100%; background: #93A5FF; border-radius: 999px; transition: width .4s; }
.afp-barfill[data-top] { background: #233DFF; }
fieldset.afp-card { min-inline-size: 0; }
.afp-avg { display: flex; align-items: center; gap: 6px; font-size: 14px; color: #334155; margin: 0 0 10px; }
.afp-avg svg { color: #F59E0B; fill: #F59E0B; }
.afp-cols { display: flex; gap: 6px; align-items: flex-end; }
.afp-col { flex: 1; display: flex; flex-direction: column; align-items: center; gap: 4px; font-size: 12px; color: #64748B; min-width: 0; }
.afp-coltrack { width: 100%; height: 72px; background: #EEF2F7; border-radius: 6px; display: flex; align-items: flex-end; overflow: hidden; }
.afp-colfill { width: 100%; background: #93A5FF; transition: height .4s; }
.afp-colfill[data-top] { background: #233DFF; }
`
