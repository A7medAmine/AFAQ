import { useState, useRef, useEffect } from "react";
import {
  motion,
  AnimatePresence,
  useMotionValue,
  animate,
} from "framer-motion";
import { X } from "lucide-react";
import AfaqMascot from "./AfaqMascot";
import { useCursorGaze } from "./useCursorGaze";
import { triggerHaptic } from "./haptics";

const HOVER_ANGRY_THRESHOLD = 6; // hovers beyond this make it angry
const DRAG_ANGRY_DISTANCE = 5000; // px of accumulated drag before it gets angry
const ANGRY_COOLDOWN_MS = 3000; // angry face holds this long, then cools down
const EDGE_MARGIN = 24; // gap from the viewport edge when docked

const SNAP_SPRING = { type: "spring", stiffness: 500, damping: 38 };

export default function ChatbotButton({ open, onClick }) {
  const [isHovered, setIsHovered] = useState(false);
  const [angry, setAngry] = useState(false);
  const [celebrating, setCelebrating] = useState(false);
  const [longPressActive, setLongPressActive] = useState(false);
  const [particles, setParticles] = useState([]);
  const [dragging, setDragging] = useState(false);
  const hoverCount = useRef(0);
  const dragAccum = useRef(0);
  const angryTimer = useRef(0);
  const celebrateTimer = useRef(0);
  const longPressTimer = useRef(0);
  const lastTapRef = useRef(0);
  const mascotRef = useRef(null);
  const dragRef = useRef(null);
  const constraintsRef = useRef(null);
  const hasDragged = useRef(false);

  // Drag offset from the anchored bottom-right corner.
  const x = useMotionValue(0);
  const y = useMotionValue(0);

  const spawnParticles = () => {
    const symbols = ["✨", "💖", "⭐", "🎉", "🔥"];
    const newItems = Array.from({ length: 6 }, (_, i) => ({
      id: Date.now() + i,
      symbol: symbols[i % symbols.length],
      x: (Math.random() - 0.5) * 60,
      y: -20 - Math.random() * 50,
      scale: 0.8 + Math.random() * 0.5,
    }));
    setParticles((prev) => [...prev.slice(-12), ...newItems]);
    setTimeout(() => {
      setParticles((prev) => prev.filter((p) => !newItems.some((n) => n.id === p.id)));
    }, 1200);
  };

  const handlePointerDown = () => {
    hasDragged.current = false;
    clearTimeout(longPressTimer.current);
    longPressTimer.current = setTimeout(() => {
      if (!hasDragged.current) {
        setLongPressActive(true);
        triggerHaptic("medium");
      }
    }, 450);
  };

  const handlePointerUpOrLeave = () => {
    clearTimeout(longPressTimer.current);
    if (longPressActive) {
      setTimeout(() => setLongPressActive(false), 800);
    }
  };

  const handleClick = (e) => {
    clearTimeout(longPressTimer.current);
    if (hasDragged.current || longPressActive) {
      hasDragged.current = false;
      setLongPressActive(false);
      return;
    }

    const now = Date.now();
    if (now - lastTapRef.current < 320) {
      // Double-tap reaction on mobile/desktop!
      lastTapRef.current = 0;
      setCelebrating(true);
      spawnParticles();
      triggerHaptic("celebrate");
      clearTimeout(celebrateTimer.current);
      celebrateTimer.current = setTimeout(() => setCelebrating(false), 2400);
      return;
    }
    lastTapRef.current = now;

    triggerHaptic("light");
    onClick?.(e);
  };

  // Latch the angry face, then cool down after a few seconds.
  const triggerAngry = () => {
    setAngry(true);
    hoverCount.current = 0;
    dragAccum.current = 0;
    triggerHaptic("heavy");
    clearTimeout(angryTimer.current);
    angryTimer.current = setTimeout(() => setAngry(false), ANGRY_COOLDOWN_MS);
  };

  useEffect(() => () => {
    clearTimeout(angryTimer.current);
    clearTimeout(celebrateTimer.current);
    clearTimeout(longPressTimer.current);
  }, []);

  // On release, dock to whichever side (left/right) it's closest to and clamp
  // it vertically inside the viewport.
  const snapToEdge = () => {
    const el = dragRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    const toLeft = r.left + r.width / 2 < vw / 2;
    const targetLeft = toLeft ? EDGE_MARGIN : vw - EDGE_MARGIN - r.width;
    animate(x, x.get() + (targetLeft - r.left), SNAP_SPRING);

    let dy = 0;
    if (r.top < EDGE_MARGIN) dy = EDGE_MARGIN - r.top;
    else if (r.bottom > vh - EDGE_MARGIN) dy = vh - EDGE_MARGIN - r.bottom;
    if (dy) animate(y, y.get() + dy, SNAP_SPRING);
    triggerHaptic("medium");
  };

  // Idle: head follows the cursor or phone tilt.
  const gaze = useCursorGaze(
    mascotRef,
    !open && !isHovered && !angry && !dragging && !celebrating && !longPressActive
  );

  const mascotProps = angry
    ? { expression: "angry-brows" }
    : celebrating
    ? { animation: "celebrate" }
    : longPressActive
    ? { animation: "shy" }
    : isHovered
    ? { animation: "playful" }
    : { expression: gaze };

  return (
    <>
      {/* Invisible viewport-sized box that keeps the dragged mascot on screen. */}
      <div
        ref={constraintsRef}
        aria-hidden
        className="fixed inset-2 z-[98] pointer-events-none"
      />

      <div className="fixed bottom-6 right-6 z-[99]">
        <AnimatePresence>
          {!open && (
            <motion.button
              ref={dragRef}
              style={{ x, y }}
              drag
              dragConstraints={constraintsRef}
              dragElastic={0.12}
              dragMomentum={false}
              onPointerDown={handlePointerDown}
              onPointerUp={handlePointerUpOrLeave}
              onPointerCancel={handlePointerUpOrLeave}
              onDragStart={() => {
                clearTimeout(longPressTimer.current);
                setLongPressActive(false);
                hasDragged.current = true;
                setDragging(true);
                dragAccum.current = 0;
                triggerHaptic("light");
              }}
              onDrag={(_e, info) => {
                if (Math.hypot(info.offset.x, info.offset.y) > 4) {
                  hasDragged.current = true;
                }
                dragAccum.current += Math.hypot(info.delta.x, info.delta.y);
                if (dragAccum.current > DRAG_ANGRY_DISTANCE) triggerAngry();
              }}
              onDragEnd={() => {
                setDragging(false);
                snapToEdge();
                setTimeout(() => {
                  hasDragged.current = false;
                }, 120);
              }}
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0, opacity: 0 }}
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.95 }}
              whileDrag={{ scale: 1.05, cursor: "grabbing" }}
              onHoverStart={() => {
                setIsHovered(true);
                hoverCount.current += 1;
                if (hoverCount.current > HOVER_ANGRY_THRESHOLD) triggerAngry();
              }}
              onHoverEnd={() => setIsHovered(false)}
              onClick={handleClick}
              className="relative flex items-center justify-center cursor-pointer bg-transparent border-none p-0 drop-shadow-xl touch-none select-none"
              title="Open AI Assistant (Double tap for cheer, Drag to move)"
              aria-label="Open AI assistant"
            >
              {/* Floating particles on double-tap */}
              <AnimatePresence>
                {particles.map((p) => (
                  <motion.span
                    key={p.id}
                    initial={{ opacity: 1, scale: 0.2, x: 0, y: 0 }}
                    animate={{
                      opacity: 0,
                      scale: p.scale,
                      x: p.x,
                      y: p.y,
                    }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 1, ease: "easeOut" }}
                    className="absolute pointer-events-none text-base select-none z-10"
                    style={{ left: "50%", top: "50%" }}
                  >
                    {p.symbol}
                  </motion.span>
                ))}
              </AnimatePresence>

              {/* Gentle breathing/float so it reads as alive at rest. */}
              <motion.div
                ref={mascotRef}
                animate={
                  longPressActive
                    ? { scale: [1, 0.9, 1.05], y: 0 }
                    : { y: [0, -6, 0] }
                }
                transition={{
                  duration: longPressActive ? 0.6 : 3.2,
                  repeat: Infinity,
                  ease: "easeInOut",
                }}
              >
                <AfaqMascot
                  size={76}
                  {...mascotProps}
                  className="drop-shadow-lg"
                />
              </motion.div>
            </motion.button>
          )}
        </AnimatePresence>
      </div>

      {open && (
        <div className="fixed bottom-6 right-6 z-[99]">
          <motion.button
            type="button"
            aria-label="Close chat"
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="w-8 h-8 md:w-10 md:h-10 rounded-xl shadow-md flex items-center justify-center cursor-pointer"
            style={{
              background: "var(--color-bg-alt)",
              color: "var(--color-text-muted)",
            }}
            onClick={() => {
              triggerHaptic("light");
              onClick();
            }}
          >
            <X size={14} />
          </motion.button>
        </div>
      )}
    </>
  );
}
