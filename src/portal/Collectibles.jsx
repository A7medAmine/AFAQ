import { useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { Compass, Crown, Flame, Gem, Lock, Rocket, Shield, Sparkles, Swords, Wrench } from 'lucide-react'
import { currentPositions } from './lib/achievements'
import { displayName, initials } from './lib/portal'
import { FrameArt, PHOTO_CLIP } from './PixelFrames'
import './achievements.css'

export const EMBLEMS = {
  rookie: Sparkles,
  explorer: Compass,
  builder: Wrench,
  innovator: Rocket,
  visionary: Gem,
  luminary: Flame,
  council: Shield,
  vanguard: Swords,
  sovereign: Crown,
}

/**
 * A member's photo (or initials) inside a pixel-art frame, like the profile
 * decorations of chat apps. `size` is the photo's width in pixels; the frame
 * art reaches up to 40% of that past each side, so leave room around it.
 */
export function FramedAvatar({ me, frame = 'none', size = 96, className = '' }) {
  const clip = { clipPath: PHOTO_CLIP }
  return (
    <span className={`ach-avatar ach-frame-${frame} ${className}`} style={{ '--s': `${size}px` }}>
      {me.photo_url
        ? <img src={me.photo_url} alt="" className="ach-avatar-photo" style={clip} />
        : <span className="ach-avatar-photo ach-avatar-initials" style={clip}>{initials(me.full_name)}</span>}
      <FrameArt frame={frame} />
    </span>
  )
}

/** Title under the name on a card: the office for role cards, else the tier. */
export function cardTitle(card, me, t) {
  if (card.rarity !== 'role') return t(`achievements.tiers.${card.key}`)
  const office = { sovereign: 'president', vanguard: 'vice_president' }[card.key]
  if (office) return t(`positions.${office}`)
  const held = currentPositions(me)[0]
  if (held) return t(`positions.${held.title}`, { defaultValue: held.title })
  return me.admin_role?.label || t('achievements.cardNames.council')
}

/**
 * A collectible member card. `size` "lg" is the showcase card, which tilts
 * with the pointer; "sm" is the collection thumbnail. A locked card shows what
 * opens it instead of the member's details.
 */
export function PlayerCard({ me, card, frame, progress, size = 'lg', locked = false, lockText }) {
  const { t } = useTranslation('portal')
  const ref = useRef(null)
  const Emblem = EMBLEMS[card.key] || Sparkles
  const tilt = size === 'lg' && !locked

  const move = e => {
    const el = ref.current
    if (!el || e.pointerType === 'touch') return
    const box = el.getBoundingClientRect()
    const x = (e.clientX - box.left) / box.width
    const y = (e.clientY - box.top) / box.height
    el.style.setProperty('--mx', `${x * 100}%`)
    el.style.setProperty('--my', `${y * 100}%`)
    el.style.setProperty('--rx', `${(0.5 - y) * 14}deg`)
    el.style.setProperty('--ry', `${(x - 0.5) * 18}deg`)
    el.classList.add('is-hover')
  }
  const leave = () => {
    const el = ref.current
    if (!el) return
    el.style.removeProperty('--rx')
    el.style.removeProperty('--ry')
    el.classList.remove('is-hover')
  }

  const since = me.joined_at ? String(me.joined_at).slice(0, 4) : '—'
  const rarity = t(`achievements.rarity.${card.rarity}`)

  return (
    <div
      ref={ref}
      className={`ach-card ach-card-${card.key} ach-rarity-${card.rarity} ach-card-${size} ${locked ? 'is-locked' : ''}`}
      onPointerMove={tilt ? move : undefined}
      onPointerLeave={tilt ? leave : undefined}
    >
      <div className="ach-card-body">
        <div className="ach-card-pattern" aria-hidden="true" />
        <div className="ach-card-top">
          <span className="ach-card-emblem"><Emblem /></span>
          <span className="ach-card-rarity">{rarity}</span>
        </div>

        <div className="ach-card-art">
          {locked
            ? <span className="ach-card-lock"><Lock /></span>
            : <FramedAvatar me={me} frame={frame} size={size === 'lg' ? 104 : 58} />}
        </div>

        <div className="ach-card-text">
          <p className="ach-card-name">{locked ? cardTitle(card, me, t) : displayName(me) || me.full_name}</p>
          <p className="ach-card-title">{locked ? lockText : cardTitle(card, me, t)}</p>
        </div>

        {!locked && (
          <div className="ach-card-stats">
            <div><b>{progress.xp}</b><small>{t('achievements.xp')}</small></div>
            <div><b>{me.rank ? `#${me.rank}` : '—'}</b><small>{t('achievements.rank')}</small></div>
            <div><b>{since}</b><small>{t('achievements.since')}</small></div>
          </div>
        )}
        {size === 'lg' && !locked && <p className="ach-card-code">AFAQ · {me.member_code}</p>}
        <div className="ach-card-shine" aria-hidden="true" />
      </div>
    </div>
  )
}
