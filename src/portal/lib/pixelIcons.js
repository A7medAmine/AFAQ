import { createElement as h } from 'react'
import { Calendar } from 'pixelarticons/react/Calendar.js'
import { Camera } from 'pixelarticons/react/Camera.js'
import { CheckboxOn } from 'pixelarticons/react/CheckboxOn.js'
import { Compass } from 'pixelarticons/react/Compass.js'
import { Crown } from 'pixelarticons/react/Crown.js'
import { DiamondGem } from 'pixelarticons/react/DiamondGem.js'
import { Flag } from 'pixelarticons/react/Flag.js'
import { Heart } from 'pixelarticons/react/Heart.js'
import { Hourglass } from 'pixelarticons/react/Hourglass.js'
import { Leaf } from 'pixelarticons/react/Leaf.js'
import { Lightbulb } from 'pixelarticons/react/Lightbulb.js'
import { Lock } from 'pixelarticons/react/Lock.js'
import { Share } from 'pixelarticons/react/Share.js'
import { Shield } from 'pixelarticons/react/Shield.js'
import { Sparkles } from 'pixelarticons/react/Sparkles.js'
import { Star } from 'pixelarticons/react/Star.js'
import { Sun } from 'pixelarticons/react/Sun.js'
import { Sword } from 'pixelarticons/react/Sword.js'
import { Tools } from 'pixelarticons/react/Tools.js'
import { Trophy } from 'pixelarticons/react/Trophy.js'
import { Users } from 'pixelarticons/react/Users.js'
import { Zap } from 'pixelarticons/react/Zap.js'

/**
 * Pixel-art icons (pixelarticons, MIT) for the achievements pages, so the
 * icons match the club's pixel type. They are drawn on a 24-unit grid and
 * only stay sharp at multiples of 12 px, so pick sizes like 12, 24 or 48.
 * Each takes `size` like the line icons elsewhere; `color` sets the fill.
 */
const pixel = Icon => {
  const PixelIcon = ({ size = 24, width, height, strokeWidth: _ignored, ...props }) =>
    h(Icon, { width: width ?? size, height: height ?? size, shapeRendering: 'crispEdges', 'aria-hidden': true, focusable: 'false', ...props })
  PixelIcon.displayName = `Pixel${Icon.name || 'Icon'}`
  return PixelIcon
}

export const PxLock = pixel(Lock)
export const PxTrophy = pixel(Trophy)
export const PxShare = pixel(Share)
export const PxStar = pixel(Star)
export const PxCrown = pixel(Crown)
export const PxFlag = pixel(Flag)
export const PxShield = pixel(Shield)
export const PxSparkles = pixel(Sparkles)
export const PxZap = pixel(Zap)

/** One emblem per tier and role card, in prestige order. */
export const EMBLEMS = {
  rookie: pixel(Leaf),
  explorer: pixel(Compass),
  builder: pixel(Tools),
  innovator: pixel(Lightbulb),
  visionary: pixel(DiamondGem),
  luminary: pixel(Sun),
  council: PxShield,
  vanguard: pixel(Sword),
  sovereign: PxCrown,
}

export const BADGE_ICONS = {
  firstSpark: PxZap,
  eventGoer: pixel(Calendar),
  taskMaster: pixel(CheckboxOn),
  helper: pixel(Heart),
  topRank: PxTrophy,
  veteran: pixel(Hourglass),
  faceOfAfaq: pixel(Camera),
  teamPlayer: pixel(Users),
  board: PxCrown,
}
