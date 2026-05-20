import { useRef } from "react"

const leftImages = [
  "/images/side/pi-removed-bg.png",
  "/images/side/led-removed-bg.png",
  "/images/side/screwdriver.png",
]
const rightImages = [
  "/images/side/robocar-removed-bg.png",
  "/images/side/esp32-removed-bg.png",
  "/images/side/breadbord.png",
]

const counters = { left: 0, right: 0 }

function pickForId(id, pool) {
  const limited = pool.filter((p) => !p.includes("robocar"))
  const poolSize = pool.length
  const limitedSize = limited.length

  if (id <= poolSize) return pool[id - 1]
  const idx = id - poolSize - 1
  if (idx < limitedSize) return limited[idx]
  return limited[(idx - limitedSize) % limitedSize]
}

export default function SideImage({
  side = "left",
  offsetY = 0,
  size = 380,
}) {
  const ref = useRef(0)
  if (ref.current === 0) ref.current = ++counters[side]

  const pool = side === "left" ? leftImages : rightImages
  const src = pickForId(ref.current, pool)
  const multiplier = src.includes("esp32") ? 1.35 : src.includes("robocar") ? 1.35 : src.includes("breadbord") ? 1.3 : src.includes("pi") ? 1.3 : 1
  const actualSize = Math.floor(size * multiplier)
  return (
    <img
      src={src}
      alt=""
      draggable={false}
      className="absolute pointer-events-none select-none -z-10 animate-float-slow"
      style={{
        top: "50%",
        [side]: `${-Math.floor(actualSize * 0.3)}px`,
        transform: `translateY(calc(-50% + ${offsetY}px))`,
        width: `${actualSize}px`,
        height: "auto",
        maxWidth: "none",
        filter: "drop-shadow(0 25px 35px rgba(36, 96, 231, 0.25))",
      }}
    />
  )
}
