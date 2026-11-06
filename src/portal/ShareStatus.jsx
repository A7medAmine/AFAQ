import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Check, Copy, Download, Loader2, X } from 'lucide-react'
import { EMBLEMS, PxShare, PxTrophy } from './lib/pixelIcons'
import { save, toBlob } from './lib/idCard'
import { CARDS, isUnlocked, monthLabel } from './lib/achievements'
import { displayName, initials } from './lib/portal'
import { cardTitle } from './Collectibles'

const loadRenderer = () => import('./lib/statusImage')

const canShareFiles = () => {
  try {
    return typeof navigator !== 'undefined' && !!navigator.canShare
      && navigator.canShare({ files: [new File([new Blob()], 'x.png', { type: 'image/png' })] })
  } catch {
    return false
  }
}
const canCopy = () => typeof window !== 'undefined' && !!window.ClipboardItem && !!navigator.clipboard?.write

function Toggle({ label, value, options, onChange }) {
  return (
    <div>
      <p className="portal-label">{label}</p>
      <div className="grid gap-1 p-1 rounded-full" style={{ background: 'var(--color-bg-alt)', gridTemplateColumns: `repeat(${options.length}, 1fr)` }}
        role="radiogroup" aria-label={label}>
        {options.map(([key, text]) => (
          <button key={key} type="button" role="radio" aria-checked={value === key} onClick={() => onChange(key)}
            className="rounded-full py-1.5 text-sm font-semibold transition-colors"
            style={value === key ? { background: 'var(--color-card)', color: 'var(--color-accent)', boxShadow: '0 1px 3px rgba(0,0,0,.1)' } : { color: 'var(--color-text-muted)' }}>
            {text}
          </button>
        ))}
      </div>
    </div>
  )
}

/**
 * Buttons that open a dialog to share the member's card as an image: their
 * status, or the member-of-the-month edition when they hold that title.
 */
export default function ShareStatus({ me, progress, card, frame, badgeCount, motm }) {
  const { t } = useTranslation('portal')
  const [open, setOpen] = useState(null) // edition the dialog opened on
  return (
    <>
      <div className="flex flex-wrap gap-2">
        {motm && (
          <button type="button" className="portal-btn-primary ach-share-motm" onClick={() => setOpen('motm')}>
            <PxTrophy size={12} /> {t('achievements.share.motmButton')}
          </button>
        )}
        <button type="button" className={motm ? 'portal-btn' : 'portal-btn-primary'} onClick={() => setOpen('status')}>
          <PxShare size={12} /> {t('achievements.share.button')}
        </button>
      </div>
      {open && (
        <ShareDialog
          me={me} progress={progress} initialCard={card} frame={frame} badgeCount={badgeCount} motm={motm}
          initial={open} onClose={() => setOpen(null)}
        />
      )}
    </>
  )
}

function ShareDialog({ me, progress, initialCard, frame, badgeCount, motm, initial, onClose }) {
  const { t, i18n } = useTranslation('portal')
  const lang = i18n.language
  const owned = useMemo(() => CARDS.filter(c => isUnlocked(c, progress)), [progress])
  const [edition, setEdition] = useState(initial)
  const [format, setFormat] = useState('story')
  const [cardKey, setCardKey] = useState(initialCard)
  const [image, setImage] = useState(null) // { canvas, url }
  const [error, setError] = useState(false)
  const [busy, setBusy] = useState(null)
  const [copied, setCopied] = useState(false)

  const card = owned.find(c => c.key === cardKey) || owned[owned.length - 1] || CARDS[0]
  const month = motm ? monthLabel(motm.month, lang) : ''
  const { tier, next, xp } = progress
  const tierName = t(`achievements.tiers.${tier.key}`)
  const title = cardTitle(card, me, t)

  useEffect(() => {
    const onKey = e => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  useEffect(() => {
    let live = true
    setImage(null)
    setError(false)
    const rarity = t(`achievements.rarity.${card.rarity}`)
    const data = {
      name: displayName(me) || me.full_name,
      code: me.member_code,
      photo_url: me.photo_url,
      initials: initials(me.full_name),
      frame,
      card: card.key,
      xp,
      rank: me.rank,
      since: me.joined_at ? String(me.joined_at).slice(0, 4) : '—',
      share: next ? progress.toNext : 1,
      rtl: i18n.dir(lang) === 'rtl',
    }
    const labels = {
      kicker: t('achievements.share.cardKicker'),
      cardTitle: title,
      cardRarity: rarity,
      tier: tierName,
      nextTier: next ? t(`achievements.tiers.${next.key}`) : t('achievements.share.maxTier'),
      collectedLine: t('achievements.share.collectedLine', { rarity, done: owned.length, total: CARDS.length }),
      progress: `${xp} ${t('achievements.xp')} · ${next
        ? t('achievements.toNext', { count: next.min - xp, tier: t(`achievements.tiers.${next.key}`) })
        : t('achievements.share.maxTier')}`,
      factLines: [
        me.rank ? t('achievements.share.rankLine', { rank: me.rank, total: me.ranked }) : null,
        t('achievements.badgeCount', badgeCount),
        me.joined_at ? t('achievements.share.sinceLine', { year: data.since }) : null,
      ].filter(Boolean),
      xp: t('achievements.xp'),
      rank: t('achievements.rank'),
      since: t('achievements.since'),
      motmTitle: t('achievements.share.motmTitle'),
      month,
      pointsLine: t('achievements.share.pointsLine', { count: motm?.points ?? 0, month }),
    }
    loadRenderer()
      .then(({ renderStatusImage, RARITY_COLORS }) => renderStatusImage({
        edition,
        format,
        data: { ...data, rarityColor: RARITY_COLORS[card.rarity] },
        labels,
        emblem: EMBLEMS[card.key],
      }))
      .then(canvas => { if (live) setImage({ canvas, url: canvas.toDataURL('image/png') }) })
      .catch(() => { if (live) setError(true) })
    return () => { live = false }
  }, [edition, format, card, title, me, progress, owned, frame, badgeCount, motm, month, tierName, next, xp, lang, t, i18n])

  const filename = `AFAQ-${edition === 'motm' ? 'member-of-the-month' : card.key}-${me.member_code}-${format}.png`
  const text = edition === 'motm'
    ? t('achievements.share.motmShareText', { month })
    : t('achievements.share.shareText', { tier: tierName, xp })

  const act = async (kind, fn) => {
    if (!image) return
    setBusy(kind)
    try {
      await fn(await toBlob(image.canvas))
    } catch (e) {
      // Closing the share sheet is not an error.
      if (e?.name !== 'AbortError') setError(true)
    }
    setBusy(null)
  }

  const share = blob => navigator.share({
    files: [new File([blob], filename, { type: 'image/png' })],
    title: 'AFAQ Scientific Club',
    text: `${text} afaq.club`,
  })
  const copy = async blob => {
    await navigator.clipboard.write([new window.ClipboardItem({ 'image/png': blob })])
    setCopied(true)
    setTimeout(() => setCopied(false), 1800)
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-6" style={{ background: 'rgba(5,10,48,0.72)' }}
      role="dialog" aria-modal="true" aria-label={t('achievements.share.title')} onClick={onClose}>
      <div className="portal-card w-full max-w-3xl max-h-[94vh] overflow-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between gap-3 mb-4">
          <h2 className="font-bold">{t('achievements.share.title')}</h2>
          <button type="button" className="portal-btn !p-2" onClick={onClose} aria-label={t('achievements.share.close')}>
            <X size={16} />
          </button>
        </div>

        <div className="grid gap-5 md:grid-cols-[1fr_260px] items-start">
          <div className="ach-share-preview" style={{ aspectRatio: format === 'story' ? '9 / 16' : '4 / 5' }}>
            {image
              ? <img src={image.url} alt={text} />
              : !error && <Loader2 className="animate-spin" size={28} />}
          </div>

          <div className="space-y-4">
            {motm && (
              <Toggle label={t('achievements.share.edition')} value={edition} onChange={setEdition}
                options={['motm', 'status'].map(k => [k, t(`achievements.share.editions.${k}`)])} />
            )}
            <Toggle label={t('achievements.share.format')} value={format} onChange={setFormat}
              options={['story', 'post'].map(k => [k, t(`achievements.share.formats.${k}`)])} />

            {owned.length > 1 && (
              <div>
                <p className="portal-label">{t('achievements.share.card')}</p>
                <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label={t('achievements.share.card')}>
                  {owned.map(item => (
                    <button key={item.key} type="button" role="radio" aria-checked={item.key === card.key}
                      onClick={() => setCardKey(item.key)}
                      className={`ach-share-card ach-c-${item.rarity} ${item.key === card.key ? 'active' : ''}`}>
                      {cardTitle(item, me, t)}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {error && <div className="portal-alert error" role="alert">{t('achievements.share.error')}</div>}

            <div className="grid gap-2">
              {canShareFiles() && (
                <button type="button" className="portal-btn-primary" disabled={!image || !!busy} onClick={() => act('share', share)}>
                  {busy === 'share' ? <Loader2 size={15} className="animate-spin" /> : <PxShare size={12} />} {t('achievements.share.share')}
                </button>
              )}
              <button type="button" className={canShareFiles() ? 'portal-btn' : 'portal-btn-primary'} disabled={!image || !!busy}
                onClick={() => act('download', blob => save(blob, filename))}>
                <Download size={15} /> {t('achievements.share.download')}
              </button>
              {canCopy() && (
                <button type="button" className="portal-btn" disabled={!image || !!busy} onClick={() => act('copy', copy)}>
                  {copied ? <Check size={15} /> : <Copy size={15} />} {copied ? t('achievements.share.copied') : t('achievements.share.copy')}
                </button>
              )}
            </div>
            <p className="text-xs portal-muted">{t('achievements.share.note')}</p>
          </div>
        </div>
      </div>
    </div>
  )
}
