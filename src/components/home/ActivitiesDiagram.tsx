import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { motion, useReducedMotion } from "framer-motion";
import { useTranslation } from "react-i18next";
import {
  Cpu,
  Bot,
  RadioTower,
  Timer,
  Trophy,
  Code2,
  GraduationCap,
} from "lucide-react";
import Logo from "../shared/Logo";

/*
  AFAQ.brd — the club rendered as a circuit board.

  Every activity is a component soldered to the board and routed back to the
  core (U1, the MCU). Reference designators are not decoration: each activity
  carries the designator of the component class whose function it mirrors —
  hackathons are the crystal that sets the clock, training is the regulator
  that supplies everyone else, competitions are the LED the outside world reads.

  Traces are measured from the live DOM and routed orthogonally with 45° elbows,
  so the board reflows instead of colliding the way fixed percentages did.
*/

// ─── Parts list ─────────────────────────────────────────────────────────────

type Side = "L" | "R" | "B";

type Part = {
  id: string;
  /** i18n key under `activities` (differs from id for software dev) */
  key: string;
  designator: string;
  icon: React.ReactNode;
  /** which edge of the core this part is routed from */
  side: Side;
  /** pin index along that edge: 0 = top/left, 1 = middle, 2 = bottom/right */
  pin: 0 | 1 | 2;
  /** desktop grid area */
  area: string;
};

const PARTS: Part[] = [
  { id: "workshops",    key: "workshops",    designator: "U2",    icon: <Cpu />,           side: "L", pin: 0, area: "a" },
  { id: "iot",          key: "iot",          designator: "ANT1",  icon: <RadioTower />,    side: "L", pin: 1, area: "b" },
  { id: "competitions", key: "competitions", designator: "LED1",  icon: <Trophy />,        side: "L", pin: 2, area: "c" },
  { id: "robotics",     key: "robotics",     designator: "M1",    icon: <Bot />,           side: "R", pin: 0, area: "d" },
  { id: "hackathons",   key: "hackathons",   designator: "X1",    icon: <Timer />,         side: "R", pin: 1, area: "e" },
  { id: "softwaredev",  key: "software",     designator: "ROM1",  icon: <Code2 />,         side: "R", pin: 2, area: "f" },
  { id: "training",     key: "training",     designator: "VREG1", icon: <GraduationCap />, side: "B", pin: 1, area: "g" },
];

// ─── Trace routing ──────────────────────────────────────────────────────────

type Pt = { x: number; y: number };
type Route = { id: string; d: string; vias: Pt[] };

const STUB = 14; // escape length before a trace is allowed to turn

/**
 * Routes A → B the way an autorouter would: a straight escape, one 45° elbow,
 * then a straight run into the pad. Returns the path plus its via points.
 */
function route(a: Pt, b: Pt, outA: Pt, outB: Pt): { d: string; vias: Pt[] } {
  const p0 = a;
  const p1 = { x: a.x + outA.x * STUB, y: a.y + outA.y * STUB };
  const p4 = b;
  const p3 = { x: b.x + outB.x * STUB, y: b.y + outB.y * STUB };

  const dx = p3.x - p1.x;
  const dy = p3.y - p1.y;
  const sx = Math.sign(dx) || 1;
  const sy = Math.sign(dy) || 1;
  const adx = Math.abs(dx);
  const ady = Math.abs(dy);

  // Nearly collinear — no elbow needed, run it straight.
  if (adx < 1 || ady < 1) {
    return {
      d: `M ${p0.x} ${p0.y} L ${p1.x} ${p1.y} L ${p3.x} ${p3.y} L ${p4.x} ${p4.y}`,
      vias: [],
    };
  }

  let e1: Pt;
  let e2: Pt;
  if (adx >= ady) {
    const run = (adx - ady) / 2;
    e1 = { x: p1.x + sx * run, y: p1.y };
    e2 = { x: e1.x + sx * ady, y: p1.y + sy * ady };
  } else {
    const run = (ady - adx) / 2;
    e1 = { x: p1.x, y: p1.y + sy * run };
    e2 = { x: p1.x + sx * adx, y: e1.y + sy * adx };
  }

  return {
    d:
      `M ${p0.x} ${p0.y} L ${p1.x} ${p1.y} ` +
      `L ${e1.x} ${e1.y} L ${e2.x} ${e2.y} ` +
      `L ${p3.x} ${p3.y} L ${p4.x} ${p4.y}`,
    vias: [e1, e2],
  };
}

/** Where a trace leaves the core, and which way it escapes. */
function corePort(box: DOMRect, side: Side, pin: 0 | 1 | 2) {
  const at = [0.24, 0.5, 0.76][pin];
  if (side === "L")
    return { p: { x: box.left, y: box.top + box.height * at }, out: { x: -1, y: 0 } };
  if (side === "R")
    return { p: { x: box.right, y: box.top + box.height * at }, out: { x: 1, y: 0 } };
  return { p: { x: box.left + box.width * 0.5, y: box.bottom }, out: { x: 0, y: 1 } };
}

/** Where a trace lands on a part, and which way it escapes. */
function partPad(box: DOMRect, side: Side) {
  if (side === "L")
    return { p: { x: box.right, y: box.top + box.height * 0.5 }, out: { x: 1, y: 0 } };
  if (side === "R")
    return { p: { x: box.left, y: box.top + box.height * 0.5 }, out: { x: -1, y: 0 } };
  return { p: { x: box.left + box.width * 0.5, y: box.top }, out: { x: 0, y: -1 } };
}

// ─── Board traces (desktop) ─────────────────────────────────────────────────

function Traces({
  routes,
  size,
  active,
  drawn,
}: {
  routes: Route[];
  size: { w: number; h: number };
  active: string | null;
  drawn: boolean;
}) {
  const reduced = useReducedMotion();
  if (!size.w || !size.h) return null;

  return (
    <svg
      className="absolute inset-0 pointer-events-none"
      width={size.w}
      height={size.h}
      viewBox={`0 0 ${size.w} ${size.h}`}
      aria-hidden="true"
      style={{ overflow: "visible" }}
    >
      {routes.map((r, i) => {
        const isActive = active === r.id;
        return (
          <g key={r.id}>
            <motion.path
              d={r.d}
              fill="none"
              stroke="var(--color-accent)"
              strokeWidth={isActive ? 2 : 1.25}
              strokeLinecap="square"
              strokeLinejoin="miter"
              style={{ opacity: isActive ? 0.95 : 0.34 }}
              initial={reduced ? false : { pathLength: 0 }}
              animate={reduced ? false : { pathLength: drawn ? 1 : 0 }}
              transition={
                reduced
                  ? undefined
                  : { duration: 0.7, delay: i * 0.09, ease: [0.22, 1, 0.36, 1] }
              }
            />

            {/* Vias at each elbow — the board's own punctuation */}
            {r.vias.map((v, vi) => (
              <circle
                key={vi}
                cx={v.x}
                cy={v.y}
                r={isActive ? 3 : 2.5}
                fill="var(--color-bg)"
                stroke="var(--color-accent)"
                strokeWidth={1.25}
                style={{
                  opacity: drawn ? (isActive ? 1 : 0.42) : 0,
                  transition: "opacity 0.3s ease",
                }}
              />
            ))}

            {/* Current pulse — the one animated moment on the board */}
            {isActive && !reduced && (
              <motion.path
                d={r.d}
                fill="none"
                stroke="var(--color-accent)"
                strokeWidth={3.5}
                strokeLinecap="round"
                pathLength={1}
                strokeDasharray="0.08 0.92"
                initial={{ strokeDashoffset: 1 }}
                animate={{ strokeDashoffset: 0 }}
                transition={{ duration: 1.1, repeat: Infinity, ease: "linear" }}
              />
            )}
          </g>
        );
      })}
    </svg>
  );
}

// ─── Core (U1) ──────────────────────────────────────────────────────────────

const PIN_ROWS = [0.24, 0.5, 0.76];

function Core({ innerRef }: { innerRef: React.Ref<HTMLDivElement> }) {
  return (
    <div
      ref={innerRef}
      className="relative flex flex-col items-center justify-center"
      style={{
        width: "100%",
        maxWidth: 210,
        aspectRatio: "1 / 1",
        margin: "0 auto",
        background: "var(--color-card)",
        border: "1.5px solid var(--color-accent)",
        borderRadius: 16,
        boxShadow: "0 10px 34px rgba(36,96,231,0.14)",
      }}
    >
      {/* Chip pins */}
      {PIN_ROWS.map((at) => (
        <React.Fragment key={at}>
          <span className="afaq-pin" style={{ left: -7, top: `calc(${at * 100}% - 4px)` }} />
          <span className="afaq-pin" style={{ right: -7, top: `calc(${at * 100}% - 4px)` }} />
        </React.Fragment>
      ))}
      <span
        className="afaq-pin"
        style={{ bottom: -7, left: "calc(50% - 4px)", width: 8, height: 7 }}
      />

      {/* Pin-1 indicator, exactly as it is silkscreened on a real package */}
      <span
        className="absolute rounded-full"
        style={{
          top: 12,
          insetInlineStart: 12,
          width: 7,
          height: 7,
          border: "1.5px solid var(--color-accent)",
        }}
      />

      <Logo size={54} />
      <div className="label-text mt-3" style={{ color: "var(--color-text)" }}>
        AFAQ
      </div>
    </div>
  );
}

// ─── Component block ────────────────────────────────────────────────────────

function PartBlock({
  part,
  label,
  caption,
  selected,
  active,
  onSelect,
  onActivate,
  onDeactivate,
  innerRef,
  index,
}: {
  part: Part;
  label: string;
  caption: string;
  selected: boolean;
  active: boolean;
  onSelect: () => void;
  onActivate: () => void;
  onDeactivate: () => void;
  innerRef: (el: HTMLButtonElement | null) => void;
  index: number;
}) {
  const reduced = useReducedMotion();

  return (
    <motion.button
      ref={innerRef}
      type="button"
      aria-pressed={selected}
      onClick={onSelect}
      onMouseEnter={onActivate}
      onMouseLeave={onDeactivate}
      onFocus={onActivate}
      onBlur={onDeactivate}
      className={`afaq-part ${active ? "is-active" : ""} ${selected ? "is-selected" : ""}`}
      initial={reduced ? false : { opacity: 0, y: 12 }}
      whileInView={reduced ? undefined : { opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={
        reduced
          ? undefined
          : { duration: 0.5, delay: 0.15 + index * 0.06, ease: [0.22, 1, 0.36, 1] }
      }
    >
      <span className="afaq-part-head">
        <span className="afaq-part-icon" aria-hidden="true">
          {React.cloneElement(part.icon as React.ReactElement, { size: 18 })}
        </span>
      </span>
      <span className="afaq-part-label">{label}</span>
      <span className="afaq-part-caption">{caption}</span>
    </motion.button>
  );
}

// ─── Board (desktop) ────────────────────────────────────────────────────────

function Board({
  parts,
  labels,
  captions,
  selected,
  hovered,
  setHovered,
  onSelect,
}: {
  parts: Part[];
  labels: Record<string, string>;
  captions: Record<string, string>;
  selected: string | null;
  hovered: string | null;
  setHovered: (id: string | null) => void;
  onSelect: (id: string) => void;
}) {
  const boardRef = useRef<HTMLDivElement | null>(null);
  const coreRef = useRef<HTMLDivElement | null>(null);
  const partRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const [routes, setRoutes] = useState<Route[]>([]);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [drawn, setDrawn] = useState(false);

  const measure = useCallback(() => {
    const board = boardRef.current;
    const core = coreRef.current;
    if (!board || !core) return;

    const b = board.getBoundingClientRect();
    if (!b.width) return;
    const rel = (r: DOMRect) =>
      new DOMRect(r.left - b.left, r.top - b.top, r.width, r.height);
    const coreBox = rel(core.getBoundingClientRect());

    const next: Route[] = [];
    for (const part of parts) {
      const el = partRefs.current[part.id];
      if (!el) continue;
      const box = rel(el.getBoundingClientRect());
      const from = corePort(coreBox, part.side, part.pin);
      const to = partPad(box, part.side);
      const { d, vias } = route(from.p, to.p, from.out, to.out);
      next.push({ id: part.id, d, vias });
    }

    setSize({ w: b.width, h: b.height });
    setRoutes(next);
  }, [parts]);

  useLayoutEffect(() => {
    measure();
    const board = boardRef.current;
    if (!board || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(measure);
    ro.observe(board);
    return () => ro.disconnect();
  }, [measure]);

  // Labels change length across locales; re-route once webfonts settle.
  useEffect(() => {
    const fonts = (document as Document & { fonts?: FontFaceSet }).fonts;
    fonts?.ready.then(measure).catch(() => {});
  }, [measure]);

  useEffect(() => {
    const board = boardRef.current;
    if (!board || typeof IntersectionObserver === "undefined") {
      setDrawn(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setDrawn(true);
          io.disconnect();
        }
      },
      { threshold: 0.15 }
    );
    io.observe(board);
    return () => io.disconnect();
  }, []);

  const active = hovered ?? selected;

  return (
    <div className="afaq-board hidden md:block" ref={boardRef}>
      <span className="afaq-drill" style={{ top: 14, left: 14 }} />
      <span className="afaq-drill" style={{ top: 14, right: 14 }} />
      <span className="afaq-drill" style={{ bottom: 14, left: 14 }} />
      <span className="afaq-drill" style={{ bottom: 14, right: 14 }} />

      <Traces routes={routes} size={size} active={active} drawn={drawn} />

      <div className="afaq-grid" onMouseLeave={() => setHovered(null)}>
        {parts.map((part, i) => (
          <div
            key={part.id}
            data-side={part.side}
            style={{ gridArea: part.area, minWidth: 0 }}
          >
            <PartBlock
              part={part}
              index={i}
              label={labels[part.id]}
              caption={captions[part.id]}
              selected={selected === part.id}
              active={active === part.id}
              onSelect={() => onSelect(part.id)}
              onActivate={() => setHovered(part.id)}
              onDeactivate={() => setHovered(null)}
              innerRef={(el) => {
                partRefs.current[part.id] = el;
              }}
            />
          </div>
        ))}
        <div style={{ gridArea: "core", alignSelf: "center" }}>
          <Core innerRef={coreRef} />
        </div>
      </div>

      <div className="afaq-silk">
        <span>AFAQ.BRD</span>
        <span className="afaq-silk-sep" aria-hidden="true" />
        <span>{parts.length} MODULES · 1 CORE</span>
      </div>
    </div>
  );
}

// ─── Bus (mobile) ───────────────────────────────────────────────────────────

function Bus({
  parts,
  labels,
  captions,
  selected,
  onSelect,
}: {
  parts: Part[];
  labels: Record<string, string>;
  captions: Record<string, string>;
  selected: string | null;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="afaq-bus md:hidden">
      <div className="afaq-bus-line" aria-hidden="true" />

      <div className="afaq-bus-core">
        <div className="afaq-bus-branch afaq-bus-branch--core" aria-hidden="true">
          <svg viewBox="0 0 20 20" width="20" height="20">
            <path
              d="M 1 1 L 1 10 L 20 10"
              fill="none"
              stroke="var(--color-accent)"
              strokeWidth={1.5}
              opacity={0.5}
            />
          </svg>
        </div>
        <Logo size={30} />
        <div>
          <div className="afaq-part-label">AFAQ</div>
        </div>
      </div>

      {parts.map((part) => (
        <button
          key={part.id}
          type="button"
          aria-pressed={selected === part.id}
          onClick={() => onSelect(part.id)}
          className={`afaq-part afaq-bus-part ${selected === part.id ? "is-selected" : ""}`}
        >
          <span className="afaq-bus-branch" aria-hidden="true">
            <svg viewBox="0 0 20 20" width="20" height="20">
              <path
                d="M 1 1 L 10 10 L 20 10"
                fill="none"
                stroke="var(--color-accent)"
                strokeWidth={1.5}
                opacity={0.5}
              />
            </svg>
          </span>
          <span className="afaq-part-head">
            <span className="afaq-part-icon" aria-hidden="true">
              {React.cloneElement(part.icon as React.ReactElement, { size: 17 })}
            </span>
          </span>
          <span className="afaq-part-label">{labels[part.id]}</span>
          <span className="afaq-part-caption">{captions[part.id]}</span>
        </button>
      ))}
    </div>
  );
}

// ─── Section ────────────────────────────────────────────────────────────────

export default function ActivitiesDiagram() {
  const { t } = useTranslation("home");
  const [selected, setSelected] = useState<string | null>(null);
  const [hovered, setHovered] = useState<string | null>(null);

  const labels = useMemo(
    () =>
      Object.fromEntries(
        PARTS.map((p) => [p.id, t(`activities.${p.key}.title`)])
      ) as Record<string, string>,
    [t]
  );
  const captions = useMemo(
    () =>
      Object.fromEntries(
        PARTS.map((p) => [p.id, t(`activities.${p.key}.desc`)])
      ) as Record<string, string>,
    [t]
  );

  /* Selecting a part lights its trace back to the core and nothing more.
     There is no expanding write-up any longer — the caption on the block is
     the whole explanation. */
  const toggle = useCallback(
    (id: string) => setSelected((cur) => (cur === id ? null : id)),
    []
  );

  return (
    <section className="py-16 md:py-20 relative z-0">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-30px" }}
          transition={{ type: "spring", damping: 28, stiffness: 120 }}
          className="text-center mb-12 md:mb-16"
        >
          <div className="eyebrow eyebrow-center mb-4">AFAQ.BRD</div>
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold leading-tight">
            {t("activities.title")}
          </h2>
          <p
            className="mt-4 text-base md:text-lg max-w-2xl mx-auto leading-relaxed"
            style={{ color: "var(--color-text-muted)" }}
          >
            {t("activities.sub")}
          </p>
        </motion.div>

        <Board
          parts={PARTS}
          labels={labels}
          captions={captions}
          selected={selected}
          hovered={hovered}
          setHovered={setHovered}
          onSelect={toggle}
        />

        <Bus
          parts={PARTS}
          labels={labels}
          captions={captions}
          selected={selected}
          onSelect={toggle}
        />
      </div>
    </section>
  );
}
