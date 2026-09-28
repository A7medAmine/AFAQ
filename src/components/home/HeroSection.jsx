import { useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import {
  Lightbulb,
  Rocket,
  Users,
  Code,
  Cpu,
  Zap,
  Trophy,
  Wrench,
} from "lucide-react";
import { Button } from "../shared/Button";

function Img({ src, alt, className, style, fetchPriority, loading }) {
  const [failed, setFailed] = useState(false);
  if (failed) {
    return (
      <div
        className={`flex items-center justify-center bg-blue-100 border-2 border-blue-200 text-blue-400 text-sm rounded-2xl ${
          className || ""
        }`}
        style={style}
      >
        {alt || "Image"}
      </div>
    );
  }
  return (
    <img
      src={src}
      alt={alt}
      className={className}
      style={style}
      onError={() => setFailed(true)}
      fetchPriority={fetchPriority}
      loading={loading}
    />
  );
}

function Badge({ icon, label, className }) {
  return (
    <div
      className={`absolute bg-white rounded-full shadow-lg flex items-center gap-1.5 sm:gap-2 px-2.5 py-1 sm:px-4 sm:py-2 text-[11px] sm:text-sm font-semibold text-slate-800 z-20 ${className}`}
    >
      {icon}
      <span>{label}</span>
    </div>
  );
}

function HeroLeft() {
  const { t, i18n } = useTranslation("home");
  const isRTL = i18n.language === "ar";
  const lines = t("hero.slogan1").split("\n");

  return (
    <div
      className={`flex-1 text-center ${
        isRTL ? "lg:text-right" : "lg:text-left"
      } relative`}
    >
      <div
        className="absolute inset-0 z-0 md:hidden animate-glow"
        style={{
          background:
            "radial-gradient(ellipse at center, rgba(59,130,246,0.35) 0%, transparent 70%)",
          borderRadius: "inherit",
        }}
      />
      <div className="relative z-10 hero-fade-up text-blue-500 text-sm font-semibold tracking-[0.15em] uppercase mb-5">
        {t("hero.badge")}
      </div>

      <h1 className="relative z-10 hero-fade-up-d2 font-ko-black font-black text-5xl sm:text-6xl lg:text-7xl leading-tight text-[#0F172A] mb-6">
        {lines.map((line, li) => (
          <div key={li}>
            {line.split(" ").map((word, i, arr) => {
              const clean = word
                .replace(/[^\w\u0600-\u06FF]/g, "")
                .toLowerCase();
              const isHighlight =
                clean.includes("joy") ||
                clean.includes("آفاق") ||
                clean.includes("avenir");
              return (
                <span key={i} className={isHighlight ? "text-blue-500" : ""}>
                  {word}
                  {i < arr.length - 1 ? " " : ""}
                </span>
              );
            })}
          </div>
        ))}
      </h1>

      <p
        className={`relative z-10 hero-fade-up-d3 text-slate-500 text-base sm:text-lg leading-relaxed max-w-lg mb-4 mx-auto ${
          isRTL ? "lg:mr-0 lg:ml-auto" : "lg:mx-0"
        }`}
      >
        {(() => {
          const words = t("hero.subtitle").split(" ");
          if (words.length < 2) return t("hero.subtitle");
          const lastTwo = words.slice(-2).join(" ");
          const rest = words.slice(0, -2).join(" ");
          return (
            <>
              {rest} <span className="text-blue-500">{lastTwo}</span>
            </>
          );
        })()}
      </p>

      <div className="relative z-10 hero-fade-up-d4 mt-8 flex gap-4 flex-wrap justify-center lg:justify-start">
        <Button to="/join" variant="primary" icon="arrow">
          {t("hero.cta1")}
        </Button>
        <Button to="/projects" variant="outline">
          {t("hero.cta2")}
        </Button>
      </div>
    </div>
  );
}

function HeroRight() {
  const { i18n } = useTranslation("home");
  const isRTL = i18n.language === "ar";
  const visualRef = useRef(null);

  /* The rings spin for as long as the page is open, so they were still
     compositing ~170 3D-transformed nodes while you read the footer. Pausing
     them once the hero leaves the viewport gives the rest of the page its
     frame budget back. */
  useEffect(() => {
    const el = visualRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(
      ([entry]) => el.classList.toggle("is-idle", !entry.isIntersecting),
      { rootMargin: "120px" }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  const ringStyle = (tilt, radius, opts = {}) => ({
    width: radius * 2,
    height: radius * 2,
    borderRadius: "50%",
    border: opts.border || "1.5px solid rgba(59,130,246,0.25)",
    position: "absolute",
    left: "50%",
    top: "50%",
    marginLeft: -radius,
    marginTop: -radius,
    transform: `rotateX(${tilt}deg)`,
    ...opts.extra,
  });

  /* One node per dot, not two. Each particle used to be a positioning wrapper
     around a styled child; inside a preserve-3d context that is two composited
     layers apiece for a 2px dot. This single element carries both the orbit
     transform and the dot itself, which is pixel-identical because the wrapper
     was always exactly the size of its child. */
  const ringParticles = (count, radius) =>
    Array.from({ length: count }, (_, i) => {
      const angle = (360 / count) * i;
      const bright = i % 3 === 0;
      const size = bright ? 3 : 2;
      return (
        <div
          key={i}
          className="orbit-dot rounded-full"
          style={{
            position: "absolute",
            left: "50%",
            top: "50%",
            width: size,
            height: size,
            marginLeft: -size / 2,
            marginTop: -size / 2,
            background:
              i % 2 === 0 ? "rgba(59,130,246,0.7)" : "rgba(147,197,253,0.5)",
            boxShadow: bright ? "0 0 8px rgba(59,130,246,0.5)" : "none",
            transform: `rotateY(${angle}deg) translateZ(${radius}px)`,
          }}
        />
      );
    });

  return (
    <div
      ref={visualRef}
      className="hidden lg:block hero-visual flex-1 relative w-full mx-auto lg:max-w-none h-[520px] xl:h-[600px]"
    >
      <Img
        src="/images/hero/bolt.webp"
        alt="Bolt"
        className="absolute inset-0 w-full h-full z-0 object-contain"
        style={{
          transform: "scale(var(--bolt-scale, 1.35))",
          filter:
            "drop-shadow(0 40px 100px rgba(59,130,246,0.45)) drop-shadow(0 0 60px rgba(59,130,246,0.15))",
        }}
      />

      {/* Radii are fixed pixels (180-300), so the rings cannot fit a phone-width
          box on their own. Scaling the stage as a unit keeps the composition
          exactly as designed instead of re-tuning every radius per breakpoint.

          Three of the seven containers used to be duplicates — 220, 300 and 180
          each had a second container with identical geometry and speed, adding
          only a fainter border and more dots. Merged, so the same rings and the
          same borders now cost four animated 3D contexts instead of seven. */}
      <div className="hero-orbits absolute inset-0 z-[1]">
        <div
          className="absolute inset-0"
          style={{ perspective: 1200, transformStyle: "preserve-3d" }}
        >
          <div
            className="orbit-ring"
            style={{ position: "absolute", inset: 0, "--speed": "22s" }}
          >
            <div style={{ ...ringStyle(65, 260) }} />
            {ringParticles(6, 260)}
          </div>

          <div
            className="orbit-ring-reverse"
            style={{ position: "absolute", inset: 0, "--speed": "28s" }}
          >
            <div style={{ ...ringStyle(-40, 220) }} />
            <div
              style={{
                ...ringStyle(-40, 226, {
                  border: "1px solid rgba(59,130,246,0.08)",
                }),
              }}
            />
            {ringParticles(12, 220)}
          </div>

          <div
            className="orbit-ring"
            style={{ position: "absolute", inset: 0, "--speed": "35s" }}
          >
            <div style={{ ...ringStyle(80, 300) }} />
            <div
              style={{
                ...ringStyle(80, 300, {
                  border: "1px solid rgba(59,130,246,0.12)",
                }),
              }}
            />
            {ringParticles(16, 300)}
          </div>

          <div
            className="orbit-particle"
            style={{ position: "absolute", inset: 0, "--p-speed": "9s" }}
          >
            <div style={{ ...ringStyle(-55, 180) }} />
            <div
              style={{
                ...ringStyle(-55, 180, {
                  border: "1px solid rgba(59,130,246,0.15)",
                }),
              }}
            />
            {ringParticles(10, 180)}
          </div>
        </div>
      </div>

      <Badge
        icon={<Code size={16} className="text-blue-500" />}
        label="Arduino"
        className={`top-[3%] ${
          isRTL ? "left-[3%]" : "right-[3%]"
        } z-20`}
      />
      <Badge
        icon={<Cpu size={16} className="text-blue-500" />}
        label="Robotics"
        className={`top-[44%] ${
          isRTL ? "right-[-1%]" : "left-[-1%]"
        } z-20`}
      />
      <Badge
        icon={<Zap size={16} className="text-blue-500" />}
        label="Electronics"
        className={`bottom-[3%] ${
          isRTL ? "left-[3%]" : "right-[3%]"
        } z-20`}
      />

      <div
        className={`flex absolute top-[12%] ${
          isRTL ? "right-[0%]" : "left-[0%]"
        } z-20 w-8 h-8 sm:w-10 sm:h-10 rounded-full shadow-md bg-white items-center justify-center text-blue-500`}
      >
        <Lightbulb size={16} />
      </div>
      <div
        className={`flex absolute top-[2%] ${
          isRTL ? "left-[20%]" : "right-[20%]"
        } z-20 w-8 h-8 sm:w-10 sm:h-10 rounded-full shadow-md bg-white items-center justify-center text-blue-500`}
      >
        <Rocket size={16} />
      </div>
      <div
        className={`flex absolute bottom-[28%] lg:bottom-[40%] ${
          isRTL ? "right-[-1%]" : "left-[-1%]"
        } z-20 w-8 h-8 sm:w-10 sm:h-10 rounded-full shadow-md bg-white items-center justify-center text-blue-500`}
      >
        <Users size={16} />
      </div>

      <Img
        src="/images/hero/uno.webp"
        alt="Arduino"
        loading="lazy"
        className={`absolute top-[5%] ${
          isRTL ? "right-[15%]" : "left-[15%]"
        } w-36 sm:w-72 lg:w-80 -rotate-6 float-asset z-10`}
        style={{ filter: "drop-shadow(0 20px 40px rgba(59,130,246,0.4))" }}
      />
      <Img
        src="/images/hero/robocar.webp"
        alt="Robocar"
        fetchPriority="high"
        className={`absolute bottom-[22%] ${
          isRTL ? "left-[-5%]" : "right-[-5%]"
        } w-52 sm:w-96 lg:w-[25rem] rotate-3 float-asset z-10`}
        style={{ filter: "drop-shadow(0 20px 40px rgba(59,130,246,0.4))" }}
      />
      <Img
        src="/images/hero/bord.webp"
        alt="Breadboard"
        loading="lazy"
        className={`absolute bottom-[5%] ${
          isRTL ? "right-[5%]" : "left-[5%]"
        } w-24 sm:w-44 lg:w-52 -rotate-3 float-asset z-10`}
        style={{ filter: "drop-shadow(0 20px 40px rgba(59,130,246,0.4))" }}
      />
    </div>
  );
}

function StatsBar() {
  const { t } = useTranslation("home");
  const [eventCount, setEventCount] = useState(null);
  const [projectCount, setProjectCount] = useState(null);
  const [memberCount, setMemberCount] = useState(null);
  const [counts, setCounts] = useState({});
  const [dataLoaded, setDataLoaded] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    fetch("/api/stats")
      .then((r) => r.json())
      .then((data) => {
        setEventCount(data.events);
        setProjectCount(data.projects);
        setMemberCount(data.members);
        setDataLoaded(true);
      })
      .catch(() => setDataLoaded(true));
  }, []);

  const stats = [
    {
      icon: <Users size={24} className="text-blue-500" />,
      number: memberCount ? `${memberCount}+` : "94+",
      labelKey: "heroStats.members",
    },
    {
      icon: <Wrench size={24} className="text-blue-500" />,
      number: "7+",
      labelKey: "heroStats.workshops",
    },
    {
      icon: <Rocket size={24} className="text-blue-500" />,
      number: projectCount ? `${projectCount}+` : "15+",
      labelKey: "heroStats.projects",
    },
    {
      icon: <Trophy size={24} className="text-blue-500" />,
      number: "10+",
      labelKey: "heroStats.competitions",
    },
  ];

  useEffect(() => {
    if (!dataLoaded) return;
    const el = ref.current;
    if (!el) return;

    const animate = () => {
      stats.forEach((s, idx) => {
        const val = parseInt(s.number);
        if (isNaN(val)) {
          setCounts((prev) => ({ ...prev, [idx]: s.number }));
          return;
        }
        let current = 0;
        const increment = Math.ceil(val / 30);
        const timer = setInterval(() => {
          current += increment;
          if (current >= val) {
            current = val;
            clearInterval(timer);
          }
          setCounts((prev) => ({
            ...prev,
            [idx]: current + (s.number.includes("+") ? "+" : ""),
          }));
        }, 40);
      });
    };

    if (el.getBoundingClientRect().top < window.innerHeight) {
      animate();
    } else {
      const observer = new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting) {
            animate();
            observer.disconnect();
          }
        },
        { threshold: 0.3 }
      );
      observer.observe(el);
      return () => observer.disconnect();
    }
  }, [dataLoaded]);

  return (
    <div
      ref={ref}
      className="w-full bg-[#F1F5F9] border-t border-slate-200 py-6 md:py-12"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-8 lg:px-16 grid grid-cols-2 md:grid-cols-4 gap-4">
        {stats.map((s, i) => (
          <div
            key={i}
            className="flex flex-col items-center justify-center text-center bg-white rounded-2xl shadow-sm border border-slate-100 px-4 py-6 md:py-8"
          >
            <span className="text-blue-500 mb-3">{s.icon}</span>
            <div className="text-2xl sm:text-3xl lg:text-4xl font-bold text-[#0F172A] mb-1">
              {counts[i] || "0"}
            </div>
            <div className="text-xs sm:text-sm text-slate-500">
              {t(s.labelKey)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function HeroSection() {
  return (
    /* The section starts at y=0 and the fixed bar overlays its first --nav-h
       pixels, so the padding is what actually pushes the content clear. Height
       stays a full viewport (border-box already counts that padding), and svh
       rather than vh keeps mobile browser chrome from clipping the stats bar. */
    <section
      className="bg-[#EEF2FF] flex flex-col justify-between"
      style={{ minHeight: "100svh", paddingTop: "var(--nav-h)" }}
    >
      <div className="flex flex-1 flex-col lg:flex-row px-6 sm:px-8 lg:px-16 gap-6 lg:gap-8 items-center justify-center max-w-7xl mx-auto w-full py-12 sm:py-16 lg:py-20">
        <HeroLeft />
        <HeroRight />
      </div>
      <StatsBar />
    </section>
  );
}
