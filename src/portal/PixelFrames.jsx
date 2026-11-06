/**
 * Avatar frames drawn as pixel art in the club's style: navy outlines, AFAQ
 * blue and sky, hard offset shadows, square pixels. Everything is laid out on
 * a grid where the photo covers 0..20 in both directions, so one grid unit is
 * 5% of the photo, and the art may reach 8 units past it on every side.
 */

const N = '#050A30' // navy ink
const B = '#233DFF' // AFAQ blue
const S = '#5CBCF9' // sky accent
const W = '#FFFFFF'
const PINK = '#FF4F7B'
const CYAN = '#00B4D8'
const PURPLE = '#7C5CFF'
const GREEN = '#20C997'
const GOLD = '#FFC531'
const SILVER = '#C0CCDA'

/** Room around the photo, in grid units. Matches the CSS that places the art. */
const PAD = 8
export const VIEW = `${-PAD} ${-PAD} ${20 + PAD * 2} ${20 + PAD * 2}`

/**
 * Corners of the photo's square grown by `t` units, with pixel steps cut into
 * each corner (two steps for the photo, one more per unit of growth).
 */
function stepped(t) {
  const a = -t
  const b = 20 + t
  const n = 2 + t
  const k = Math.max(1, Math.round(n))
  const s = n / k
  const p = [[a + n, a], [b - n, a]]
  for (let i = 0; i < k; i++) p.push([b - n + i * s, a + (i + 1) * s], [b - n + (i + 1) * s, a + (i + 1) * s])
  p.push([b, b - n])
  for (let i = 0; i < k; i++) p.push([b - (i + 1) * s, b - n + i * s], [b - (i + 1) * s, b - n + (i + 1) * s])
  p.push([a + n, b])
  for (let i = 0; i < k; i++) p.push([a + n - i * s, b - (i + 1) * s], [a + n - (i + 1) * s, b - (i + 1) * s])
  p.push([a, a + n])
  for (let i = 0; i < k; i++) p.push([a + (i + 1) * s, a + n - i * s], [a + (i + 1) * s, a + n - (i + 1) * s])
  return p
}

const outline = t => `M${stepped(t).map(([x, y]) => `${+x.toFixed(3)} ${+y.toFixed(3)}`).join('L')}Z`

/** The photo's outline in grid units (0..20), and as a CSS clip-path. */
export const PHOTO_POINTS = stepped(0)
export const PHOTO_CLIP = `polygon(${stepped(0).map(([x, y]) => `${+(x * 5).toFixed(2)}% ${+(y * 5).toFixed(2)}%`).join(',')})`

// Bands start a little inside the photo so no hairline shows between them.
const IN = -0.2

/** A band around the photo, `to` units wide. Draw wider bands first. */
const Band = ({ to, fill, className }) => (
  <path d={outline(to) + outline(IN)} fill={fill} fillRule="evenodd" className={className} />
)

/** The hard offset shadow under a frame `t` units wide. */
const Drop = ({ t, fill, by }) => <path d={outline(t)} fill={fill} transform={`translate(${by} ${by})`} />

/** Pixels running round the frame along the line `t` units out. */
const March = ({ t, color, dash, className }) => (
  <path d={outline(t)} fill="none" stroke={color} strokeWidth="1" strokeDasharray={dash} className={className} />
)

/**
 * Pixel art from rows of letters; each letter is a colour from the palette and
 * a dot is empty. Runs of one colour become one rect.
 */
function Sprite({ rows, x = 0, y = 0, px = 1, colors, className, style }) {
  const palette = colors ? { ...PALETTE, ...colors } : PALETTE
  const rects = []
  rows.forEach((row, r) => {
    let c = 0
    while (c < row.length) {
      const fill = palette[row[c]]
      if (!fill) { c++; continue }
      let end = c + 1
      while (end < row.length && row[end] === row[c]) end++
      rects.push(<rect key={`${r}-${c}`} x={x + c * px} y={y + r * px} width={(end - c) * px} height={px} fill={fill} />)
      c = end
    }
  })
  return <g className={className} style={style}>{rects}</g>
}

const PALETTE = {
  n: N, b: B, s: S, w: W, p: PINK, l: SILVER, y: GOLD, h: '#FFF1B8', d: '#C98A00', g: GREEN,
}

const BOLT = [
  '.....nnn',
  '....nwwn',
  '...nwwn.',
  '..nwsn..',
  '.nwwwnnn',
  'nwwwwwwn',
  'nnnnwwn.',
  '...nwsn.',
  '..nwwn..',
  '..nwn...',
  '.nwn....',
  '.nn.....',
]

const CURSOR = [
  'n.........',
  'nn........',
  'nwn.......',
  'nwwn......',
  'nwwwn.....',
  'nwwwwn....',
  'nwwwwwn...',
  'nwwwwwwn..',
  'nwwwwwwwn.',
  'nwwwwnnnnn',
  'nwwnwn....',
  'nwn.nwn...',
  'nn..nwn...',
  'n....nwn..',
  '.....nwn..',
  '......nn..',
]

const SHIELD = [
  'nnnnnnnnnnn',
  'nsbbbbbbbbn',
  'nsbbbbbwwbn',
  'nsbbbbwwbbn',
  'nsbbbwwbbbn',
  'nsbbwwwwwbn',
  'nsbbbbwwbbn',
  '.nsbbwwbbn.',
  '.nsbbwbbbn.',
  '..nsbbbbn..',
  '...nsbbn...',
  '....nnn....',
]

const HALO = [
  '....nnnnnn....',
  '..nnwwwwwwnn..',
  '.nwwn....nwwn.',
  'nwln......nlwn',
  '.nlln....nlln.',
  '..nnllllllnn..',
  '....nnnnnn....',
]

const CROWN = [
  '.......n.......',
  '......nhn......',
  '.n...nhyyn...n.',
  'nhn..nyyyn..nhn',
  'nyyn.nyyyn.nyyn',
  'nyyynyyyyynyyyn',
  'nhyyyyyyyyyyyyn',
  'nyypyyysyyypyyn',
  'nyyyyyyyyyyyydn',
  'nnnnnnnnnnnnnnn',
]

const STAR = [
  '.....n.....',
  '....nyn....',
  '....nyn....',
  'nnnnyhynnnn',
  'nyyyyhyyyyn',
  '.nyyyyyyyn.',
  '..nyyyyyn..',
  '..nyyyyyn..',
  '.nyyn.nyyn.',
  '.nyn...nyn.',
  '.nn.....nn.',
]

export const TROPHY = [
  '..nnnnnnnnnnn..',
  'nnnhyyyyyyydnnn',
  'n.nhyyyyyyydn.n',
  'n.nhyyyyyyydn.n',
  'nnnhyyyyyyydnnn',
  '..nhyyyyyyydn..',
  '...nyyyyyydn...',
  '....nnyyydn....',
  '......nyn......',
  '......nyn......',
  '....nnnnnnn....',
  '....nhyyydn....',
  '....nnnnnnn....',
]

const SPARKLE = [
  '..x..',
  '..x..',
  'xx.xx',
  '..x..',
  '..x..',
]

const Twinkle = ({ x, y, delay = '0s', px = 0.5, color = W }) => (
  <Sprite rows={SPARKLE} x={x} y={y} px={px} colors={{ x: color }} className="pf-twinkle" style={{ animationDelay: delay }} />
)

/** A circuit pad: navy square with a gold light that blinks. */
const Pad = ({ x, y, delay }) => (
  <g>
    <rect x={x - 1} y={y - 1} width="3" height="3" fill={N} />
    <rect x={x} y={y} width="1" height="1" fill={GOLD} className="pf-blink" style={{ animationDelay: delay }} />
  </g>
)

const TRACES = [
  [[5, -5, 1, 3]],
  [[14, -5, 1, 3], [14, -5, 4, 1]],
  [[22, 6, 3, 1]],
  [[22, 14, 3, 1], [24, 14, 1, 4]],
  [[15, 22, 1, 3]],
  [[5, 22, 1, 3], [2, 24, 4, 1]],
  [[-5, 8, 3, 1]],
  [[-4, 13, 2, 1], [-4, 13, 1, 4]],
]
const PADS = [[5, -6], [18, -5], [25, 6], [24, 18], [15, 25], [2, 24], [-6, 8], [-4, 17]]

/** Marquee lights spaced round an arcade frame, in the middle of the gold band. */
const BULBS = [4, 7, 10, 13, 16].flatMap((v, i) => [
  [v - 0.5, -1.8, i], [v - 0.5, 20.8, i + 1], [-1.8, v - 0.5, i + 1], [20.8, v - 0.5, i],
])

const GLITCH_BITS = [
  [-6, 3, 2, 1, PINK, '0s'], [23, -3, 3, 1, CYAN, '0.3s'], [24, 12, 1, 2, PURPLE, '0.7s'],
  [-5, 17, 3, 1, CYAN, '1.1s'], [8, -6, 2, 1, PURPLE, '0.5s'], [11, 24, 3, 1, PINK, '0.9s'],
  [-7, 10, 1, 1, W, '1.3s'], [25, 20, 1, 1, W, '0.2s'],
]

/** Each frame: `back` sits under the photo, `front` on top of it. */
const ART = {
  pixel: {
    back: <><Drop t={1} fill={S} by={2} /><Drop t={1} fill={B} by={1} /></>,
    front: <Band to={1} fill={N} />,
  },

  window: {
    back: (
      <>
        <rect x={1} y={-3} width={22} height={26} fill={S} />
        <rect x={0} y={-4} width={22} height={26} fill={B} />
        <rect x={-1} y={-5} width={22} height={26} fill={N} />
      </>
    ),
    front: (
      <>
        <text x={0.4} y={-2.1} className="pf-title" fontFamily="Minecraft, monospace" fontSize="1.9" fill={W}>AFAQ.EXE</text>
        <rect x={12} y={-4} width={2} height={2} fill={PINK} />
        <rect x={15} y={-4} width={2} height={2} fill={GOLD} />
        <rect x={18} y={-4} width={2} height={2} fill={GREEN} />
        <Sprite rows={CURSOR} x={15} y={13} px={0.55} className="pf-cursor" />
      </>
    ),
  },

  circuit: {
    back: <Drop t={2} fill={S} by={1} />,
    front: (
      <>
        {TRACES.flat().map(([x, y, w, h], i) => <rect key={i} x={x} y={y} width={w} height={h} fill={GREEN} />)}
        <Band to={2} fill={N} />
        <Band to={1} fill={GREEN} />
        <March t={0.5} color="#B8FFE8" dash="1 3" className="pf-march4" />
        {PADS.map(([x, y], i) => <Pad key={i} x={x} y={y} delay={`${i * 0.25}s`} />)}
      </>
    ),
  },

  spark: {
    back: <><Drop t={3} fill={S} by={2} /><Drop t={3} fill={N} by={1} /></>,
    front: (
      <>
        <Band to={3} fill={N} />
        <Band to={2} fill={B} />
        <Band to={1} fill={S} />
        <March t={1.5} color={W} dash="1 2" className="pf-march3" />
        <Sprite rows={BOLT} x={16.5} y={-8} px={0.8} className="pf-flicker" />
        <Sprite rows={BOLT} x={-6.5} y={13} px={0.8} className="pf-flicker" style={{ animationDelay: '0.9s' }} />
      </>
    ),
  },

  arcade: {
    back: <><Drop t={3} fill={S} by={2} /><Drop t={3} fill={N} by={1} /></>,
    front: (
      <>
        <Band to={3} fill={N} />
        <Band to={2} fill={GOLD} />
        <Band to={0.6} fill="#C98A00" />
        {BULBS.map(([x, y, i]) => (
          <rect key={`${x}-${y}`} x={x} y={y} width="1" height="1" fill="#FFF6C2" className={`pf-bulb ${i % 2 ? 'pf-bulb-b' : ''}`} />
        ))}
        <Twinkle x={-6} y={-6} color={GOLD} />
        <Twinkle x={23.5} y={23.5} delay="0.8s" color={GOLD} />
      </>
    ),
  },

  glitch: {
    back: (
      <>
        <path d={outline(2)} fill={PINK} transform="translate(-1 0)" className="pf-glitch-a" />
        <path d={outline(2)} fill={CYAN} transform="translate(1 0)" className="pf-glitch-b" />
      </>
    ),
    front: (
      <>
        <Band to={2} fill={N} />
        <Band to={1} fill={W} />
        <Band to={0.5} fill={PURPLE} />
        {GLITCH_BITS.map(([x, y, w, h, fill, delay], i) => (
          <rect key={i} x={x} y={y} width={w} height={h} fill={fill} className="pf-bit" style={{ animationDelay: delay }} />
        ))}
      </>
    ),
  },

  shield: {
    back: <><Drop t={3} fill={S} by={2} /><Drop t={3} fill={B} by={1} /></>,
    front: (
      <>
        <Band to={3} fill={N} />
        <Band to={2} fill={S} className="pf-glow" />
        <Band to={1} fill={N} />
        {[[9.5, -2], [9.5, 21], [-2, 9.5], [21, 9.5]].map(([x, y]) => (
          <rect key={`${x}${y}`} x={x} y={y} width="1" height="1" fill={W} />
        ))}
        <Sprite rows={SHIELD} x={6.7} y={16.5} px={0.6} />
      </>
    ),
  },

  halo: {
    back: <><Drop t={3} fill={S} by={2} /><Drop t={3} fill={N} by={1} /></>,
    front: (
      <>
        <Band to={3} fill={N} />
        <Band to={2} fill={SILVER} />
        <rect x={3} y={-2} width={6} height={1} fill={W} />
        <rect x={-2} y={3} width={1} height={6} fill={W} />
        <rect x={11} y={20} width={6} height={1} fill="#8A97A8" />
        <rect x={20} y={11} width={1} height={6} fill="#8A97A8" />
        <Sprite rows={HALO} x={4.75} y={-8.4} px={0.75} className="pf-float" />
        <Twinkle x={-6.5} y={-1} color={S} />
        <Twinkle x={24} y={3} delay="0.7s" color={S} />
        <Twinkle x={23} y={22} delay="1.4s" color={S} />
      </>
    ),
  },

  crown: {
    back: <><Drop t={3} fill={S} by={2} /><Drop t={3} fill={N} by={1} /></>,
    front: (
      <>
        <Band to={3} fill={N} />
        <Band to={2} fill={GOLD} />
        <rect x={-1} y={3} width={1} height={14} fill="#FFF1B8" />
        <rect x={3} y={-1} width={4} height={1} fill="#FFF1B8" />
        <rect x={20} y={4} width={1} height={14} fill="#C98A00" />
        <rect x={4} y={20} width={14} height={1} fill="#C98A00" />
        {[[9.5, 20.5], [-1.5, 9.5], [20.5, 9.5]].map(([x, y]) => (
          <rect key={`${x}${y}`} x={x} y={y} width="1" height="1" fill={PINK} />
        ))}
        <Sprite rows={CROWN} x={4.4} y={-8.6} px={0.75} />
        <Twinkle x={18} y={-7} delay="0.4s" color={GOLD} />
        <Twinkle x={-6.5} y={21} delay="1.2s" color={GOLD} />
      </>
    ),
  },

  // Member of the month: not a pickable frame, it is drawn on the share image.
  motm: {
    back: <><Drop t={3} fill={S} by={2} /><Drop t={3} fill={B} by={1} /></>,
    front: (
      <>
        <Band to={3} fill={N} />
        <Band to={2} fill={GOLD} />
        <Band to={0.8} fill="#C98A00" />
        <rect x={-1.5} y={3} width={1} height={10} fill="#FFF1B8" />
        <rect x={3} y={-1.5} width={4} height={1} fill="#FFF1B8" />
        <Sprite rows={STAR} x={6.7} y={-8.6} px={0.6} />
        <Sprite rows={TROPHY} x={5.5} y={16.6} px={0.6} />
        <Twinkle x={-7} y={-6} color={GOLD} px={0.6} />
        <Twinkle x={24} y={-3} delay="0.6s" color={W} px={0.6} />
        <Twinkle x={24.5} y={20} delay="1.1s" color={GOLD} px={0.6} />
        <Twinkle x={-6.5} y={18} delay="1.6s" color={W} px={0.6} />
      </>
    ),
  },
}

/** The frame's pixel art around a photo; nothing for "none" or unknown keys. */
export function FrameArt({ frame }) {
  const art = ART[frame]
  if (!art) return null
  return (
    <>
      {art.back && <svg className="pf-svg pf-back" viewBox={VIEW} aria-hidden="true">{art.back}</svg>}
      {art.front && <svg className="pf-svg pf-front" viewBox={VIEW} aria-hidden="true">{art.front}</svg>}
    </>
  )
}

/** The raw art of a frame ({ back, front } elements) for drawing it elsewhere. */
export const frameArt = frame => ART[frame] || null
