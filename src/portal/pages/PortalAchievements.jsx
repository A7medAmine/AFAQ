import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { BADGE_ICONS, EMBLEMS, PxLock, PxTrophy } from '../lib/pixelIcons'
import { usePortal } from '../lib/portal'
import {
  BADGES, CARDS, FRAMES, TIERS, badgeState, isUnlocked, monthLabel, resolveLook, saveLook, unlockedKeys, useLook,
  useMemberOfMonth, useProgress,
} from '../lib/achievements'
import { FramedAvatar, PlayerCard } from '../Collectibles'
import ShareStatus from '../ShareStatus'

const METALS = ['bronze', 'silver', 'gold']

const XP_BLOCKS = 20

/** Text saying what opens a locked card or frame. */
function useLockText() {
  const { t } = useTranslation('portal')
  return item => (item.role ? t(`achievements.unlockRole.${item.role}`) : t('achievements.unlockXp', { count: item.xp }))
}

function Section({ title, note, children }) {
  return (
    <section className="portal-card">
      <h2 className="font-bold">{title}</h2>
      {note && <p className="text-sm portal-muted mt-1 mb-4">{note}</p>}
      {children}
    </section>
  )
}

function Badge({ badge, stats }) {
  const { t } = useTranslation('portal')
  const Icon = BADGE_ICONS[badge.key]
  const state = badgeState(badge, stats)
  const single = state.total === 1
  const level = state.done === 0 ? 'lvl-0' : single ? 'lvl-gold' : `lvl-${METALS[state.done - 1]}`
  const goalText = state.goal == null
    ? t('achievements.badgeDone')
    : t(`achievements.badges.${badge.key}.goal`, { count: state.goal })

  return (
    <div className={`ach-badge ${level}`}>
      <span className="ach-badge-icon">{state.done ? <Icon size={24} /> : <PxLock size={24} />}</span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <p className="font-bold text-sm truncate">{t(`achievements.badges.${badge.key}.name`)}</p>
          {!single && (
            <span className="ach-pips" aria-label={t('achievements.levelOf', { done: state.done, total: state.total })}>
              {badge.levels.map((_, i) => <i key={i} className={i < state.done ? 'on' : ''} />)}
            </span>
          )}
        </div>
        <p className="text-xs portal-muted mb-1.5">{goalText}</p>
        {state.goal != null && (
          <div className="ach-badge-bar"><span style={{ width: `${Math.round(state.share * 100)}%` }} /></div>
        )}
      </div>
    </div>
  )
}

export default function PortalAchievements() {
  const { t, i18n } = useTranslation('portal')
  const { me } = usePortal()
  const progress = useProgress(me, { fresh: true })
  const look = useLook(me.id)
  const lockText = useLockText()
  const { card, frame } = resolveLook(look, progress)

  // Items unlocked since the last visit get a "new" flag for this visit.
  const [fresh, setFresh] = useState(() => new Set())
  const unlocked = useMemo(() => unlockedKeys(progress), [progress])
  useEffect(() => {
    if (!progress.loaded) return
    const seen = new Set(look.seen || [])
    const added = unlocked.filter(key => !seen.has(key))
    if (!added.length) return
    // On a first visit everything would be new, so nothing is flagged.
    if (look.seen) setFresh(prev => new Set([...prev, ...added]))
    saveLook(me.id, { ...look, seen: unlocked })
  }, [progress.loaded, unlocked, look, me.id])

  const equip = patch => saveLook(me.id, { ...look, ...patch })

  const { tier, next, xp, toNext, stats } = progress
  const TierIcon = EMBLEMS[tier.key]
  const badgesDone = BADGES.filter(b => badgeState(b, stats).done > 0).length
  const badgeCount = useMemo(() => ({ done: badgesDone, total: BADGES.length }), [badgesDone])
  const motm = useMemberOfMonth(me.id)
  const collected = CARDS.filter(c => isUnlocked(c, progress)).length + FRAMES.filter(f => isUnlocked(f, progress)).length

  return (
    <div className="space-y-6">
      <div className="ach-hero">
        <div className="ach-hero-card">
          <PlayerCard me={me} card={card} frame={frame.key} progress={progress} />
        </div>

        <div className="min-w-0">
          <span className={`ach-chip ach-c-${tier.rarity} mb-2`}>
            <TierIcon size={12} /> {t(`achievements.rarity.${tier.rarity}`)}
          </span>
          {motm && (
            <p className="mb-3">
              <span className="ach-motm-chip"><PxTrophy size={12} /> {t('achievements.share.motmChip', { month: monthLabel(motm.month, i18n.language) })}</span>
            </p>
          )}
          <p className="ach-tier-name">{t(`achievements.tiers.${tier.key}`)}</p>
          <p className="text-sm portal-muted mt-1 mb-5">{t(`achievements.tierLines.${tier.key}`)}</p>

          <div className="flex items-baseline justify-between gap-3 mb-2">
            <p><span className="portal-stat">{xp}</span> <span className="text-sm font-bold portal-muted">{t('achievements.xp')}</span></p>
            <p className="text-sm portal-muted text-end">
              {next
                ? t('achievements.toNext', { count: next.min - xp, tier: t(`achievements.tiers.${next.key}`) })
                : t('achievements.maxTier')}
            </p>
          </div>
          {/* Block bar: one block per 5% of the way to the next tier. */}
          <div
            className="ach-xp-bar mb-7"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(toNext * 100)}
          >
            {Array.from({ length: XP_BLOCKS }, (_, i) => (
              <i key={i} className={i < Math.round(toNext * XP_BLOCKS) ? 'on' : ''} />
            ))}
          </div>

          <ol className="ach-road mb-6">
            {TIERS.map((step, i) => (
              <li
                key={step.key}
                className={`ach-road-step ${i <= progress.tierIndex ? 'done' : ''} ${i === progress.tierIndex ? 'current' : ''}`}
                aria-current={i === progress.tierIndex ? 'step' : undefined}
              >
                <span className="ach-road-node" aria-hidden="true" />
                <span className="ach-road-name">{t(`achievements.tiers.${step.key}`)}</span>
                <span className="ach-road-min">{step.min}</span>
              </li>
            ))}
          </ol>

          <p className="ach-tally mb-5">
            <span><b>{badgesDone}/{BADGES.length}</b> {t('achievements.tallyBadges')}</span>
            <span><b>{collected}/{CARDS.length + FRAMES.length}</b> {t('achievements.tallyItems')}</span>
          </p>
          <div className="ach-hero-share">
            <ShareStatus me={me} progress={progress} card={card.key} frame={frame.key} badgeCount={badgeCount} motm={motm} />
          </div>
          <p className="text-xs portal-muted mt-4">{t('achievements.xpNote')}</p>
        </div>
      </div>

      <Section title={t('achievements.cards')} note={t('achievements.cardsNote')}>
        <div className="ach-grid-cards">
          {CARDS.map(item => {
            const open = isUnlocked(item, progress)
            const active = item.key === card.key
            return (
              <button
                key={item.key}
                type="button"
                className={`ach-pick ${active ? 'active' : ''} ${open ? '' : 'locked'}`}
                disabled={!open}
                aria-pressed={active}
                onClick={() => equip({ card: item.key })}
              >
                <span className="ach-pick-flag">
                  {active
                    ? <span className="ach-chip ach-c-rare">{t('achievements.equipped')}</span>
                    : fresh.has(`card:${item.key}`) && <span className="ach-chip ach-chip-new">{t('achievements.new')}</span>}
                </span>
                <PlayerCard me={me} card={item} frame={frame.key} progress={progress} size="sm" locked={!open} lockText={lockText(item)} />
                <span className={`ach-chip ach-c-${item.rarity}`}>{t(`achievements.rarity.${item.rarity}`)}</span>
              </button>
            )
          })}
        </div>
      </Section>

      <Section title={t('achievements.frames')} note={t('achievements.framesNote')}>
        <div className="ach-grid-frames">
          {FRAMES.map(item => {
            const open = isUnlocked(item, progress)
            const active = item.key === frame.key
            return (
              <button
                key={item.key}
                type="button"
                className={`ach-pick ach-frame-cell ${active ? 'active' : ''} ${open ? '' : 'locked'}`}
                disabled={!open}
                aria-pressed={active}
                onClick={() => equip({ frame: item.key })}
                title={open ? undefined : lockText(item)}
              >
                {fresh.has(`frame:${item.key}`) && !active && (
                  <span className="ach-pick-flag"><span className="ach-chip ach-chip-new">{t('achievements.new')}</span></span>
                )}
                <FramedAvatar me={me} frame={item.key} size={56} />
                <span className="text-sm font-semibold mt-1">{t(`achievements.frameNames.${item.key}`)}</span>
                {open
                  ? <span className={`ach-chip ach-c-${item.rarity}`}>{active ? t('achievements.equipped') : t(`achievements.rarity.${item.rarity}`)}</span>
                  : <span className="text-xs portal-muted inline-flex items-center gap-1"><PxLock size={12} /> {lockText(item)}</span>}
              </button>
            )
          })}
        </div>
      </Section>

      <Section title={t('achievements.badgesTitle')} note={t('achievements.badgesNote')}>
        <div className="ach-grid-badges">
          {BADGES.map(badge => <Badge key={badge.key} badge={badge} stats={stats} />)}
        </div>
      </Section>

      <p className="text-xs portal-muted">{t('achievements.privateNote')}</p>
    </div>
  )
}
