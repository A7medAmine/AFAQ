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
        className={`flex items-center justify-center bg-blue-100 border-2 border-blue-200 text-blue-400 text-sm rounded-2xl ${className || ""}`}
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
      className={`absolute bg-white rounded-full shadow-lg flex items-center gap-2 px-4 py-2 text-sm font-semibold text-slate-800 z-20 ${className}`}
    >
      {icon}
      <span>{label}</span>
    </div>
  );
}

function HeroLeft() {
  const { t, i18n } = useTranslation("home");
  const isRTL = i18n.language === 'ar';
  const lines = t("hero.slogan1").split("\n");

  return (
    <div className={`flex-1 text-center ${isRTL ? 'lg:text-right' : 'lg:text-left'} relative`}>
      <div
        className="absolute inset-0 z-0 md:hidden animate-glow"
        style={{
          background: 'radial-gradient(ellipse at center, rgba(59,130,246,0.35) 0%, transparent 70%)',
          borderRadius: 'inherit',
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

      <p className={`relative z-10 hero-fade-up-d3 text-slate-500 text-base sm:text-lg leading-relaxed max-w-lg mb-4 mx-auto ${isRTL ? 'lg:mr-0 lg:ml-auto' : 'lg:mx-0'}`}>
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
  const isRTL = i18n.language === 'ar';
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

  const ringParticles = (count, radius) =>
    Array.from({ length: count }, (_, i) => {
      const angle = (360 / count) * i;
      return (
        <div
          key={i}
          style={{
            position: "absolute",
            left: "50%",
            top: "50%",
            transform: `rotateY(${angle}deg) translateZ(${radius}px)`,
          }}
        >
          <div
            className="rounded-full"
            style={{
              width: i % 3 === 0 ? 3 : 2,
              height: i % 3 === 0 ? 3 : 2,
              background:
                i % 2 === 0 ? "rgba(59,130,246,0.7)" : "rgba(147,197,253,0.5)",
              boxShadow: i % 3 === 0 ? "0 0 8px rgba(59,130,246,0.5)" : "none",
              marginLeft: i % 3 === 0 ? -1.5 : -1,
              marginTop: i % 3 === 0 ? -1.5 : -1,
            }}
          />
        </div>
      );
    });

  return (
    <div className="hidden lg:block flex-1 relative w-full max-w-[280px] sm:max-w-sm lg:max-w-none h-[320px] sm:h-[400px] lg:h-[520px] xl:h-[600px]">
      <Img
        src="/images/hero/bolt.png"
        alt="Bolt"
        fetchPriority="high"
        className="absolute inset-0 w-full h-full z-0 object-contain"
        style={{
          transform: "scale(1.35)",
          filter:
            "drop-shadow(0 40px 100px rgba(59,130,246,0.45)) drop-shadow(0 0 60px rgba(59,130,246,0.15))",
        }}
      />

      <div
        className="hidden md:block absolute inset-0 z-[1]"
        style={{ perspective: 1200, transformStyle: "preserve-3d" }}
      >
        <div
          className="orbit-ring"
          style={{ position: "absolute", inset: 0, "--speed": "22s" }}
        >
          <div style={{ ...ringStyle(65, 260) }} />
          {ringParticles(10, 260)}
        </div>

        <div
          className="orbit-ring-reverse"
          style={{ position: "absolute", inset: 0, "--speed": "28s" }}
        >
          <div style={{ ...ringStyle(-40, 220) }} />
          {ringParticles(8, 220)}
        </div>

        <div
          className="orbit-ring"
          style={{ position: "absolute", inset: 0, "--speed": "35s" }}
        >
          <div style={{ ...ringStyle(80, 300) }} />
          {ringParticles(12, 300)}
        </div>

        <div
          className="orbit-particle"
          style={{ position: "absolute", inset: 0, "--p-speed": "9s" }}
        >
          <div style={{ ...ringStyle(-55, 180) }} />
          {ringParticles(6, 180)}
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
          {ringParticles(14, 220)}
        </div>

        <div
          className="orbit-ring"
          style={{ position: "absolute", inset: 0, "--speed": "35s" }}
        >
          <div
            style={{
              ...ringStyle(80, 300, {
                border: "1px solid rgba(59,130,246,0.12)",
              }),
            }}
          />
          {ringParticles(22, 300)}
        </div>

        <div
          className="orbit-particle"
          style={{ position: "absolute", inset: 0, "--p-speed": "9s" }}
        >
          <div
            style={{
              ...ringStyle(-55, 180, {
                border: "1px solid rgba(59,130,246,0.15)",
              }),
            }}
          />
          {ringParticles(12, 180)}
        </div>
      </div>

      <Badge
        icon={<Code size={16} className="text-blue-500" />}
        label="Arduino"
        className={`hidden sm:flex top-[3%] ${isRTL ? 'left-[3%]' : 'right-[3%]'} z-20`}
      />
      <Badge
        icon={<Cpu size={16} className="text-blue-500" />}
        label="Robotics"
        className={`hidden sm:flex top-[44%] ${isRTL ? 'right-[-1%]' : 'left-[-1%]'} z-20`}
      />
      <Badge
        icon={<Zap size={16} className="text-blue-500" />}
        label="Electronics"
        className={`hidden sm:flex bottom-[3%] ${isRTL ? 'left-[3%]' : 'right-[3%]'} z-20`}
      />

      <div className={`hidden sm:flex absolute top-[12%] ${isRTL ? 'right-[0%]' : 'left-[0%]'} z-20 w-10 h-10 rounded-full shadow-md bg-white items-center justify-center text-blue-500`}>
        <Lightbulb size={16} />
      </div>
      <div className={`hidden sm:flex absolute top-[2%] ${isRTL ? 'left-[20%]' : 'right-[20%]'} z-20 w-10 h-10 rounded-full shadow-md bg-white items-center justify-center text-blue-500`}>
        <Rocket size={16} />
      </div>
      <div className={`hidden sm:flex absolute bottom-[40%] ${isRTL ? 'right-[-1%]' : 'left-[-1%]'} z-20 w-10 h-10 rounded-full shadow-md bg-white items-center justify-center text-blue-500`}>
        <Users size={16} />
      </div>

      <Img
        src="/images/hero/uno.png"
        alt="Arduino"
        loading="lazy"
        className={`hidden sm:block absolute top-[5%] ${isRTL ? 'right-[15%]' : 'left-[15%]'} w-72 lg:w-80 -rotate-6 float-asset z-10`}
        style={{ filter: "drop-shadow(0 20px 40px rgba(59,130,246,0.4))" }}
      />
      <Img
        src="/images/hero/robocar.png"
        alt="Robocar"
        loading="lazy"
        className={`hidden sm:block absolute bottom-[22%] ${isRTL ? 'left-[-5%]' : 'right-[-5%]'} w-96 lg:w-[25rem] rotate-3 float-asset z-10`}
        style={{ filter: "drop-shadow(0 20px 40px rgba(59,130,246,0.4))" }}
      />
      <Img
        src="/images/hero/bord.png"
        alt="Breadboard"
        loading="lazy"
        className={`hidden sm:block absolute bottom-[5%] ${isRTL ? 'right-[5%]' : 'left-[5%]'} w-44 lg:w-52 -rotate-3 float-asset z-10`}
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
    fetch('/api/stats')
      .then(r => r.json())
      .then(data => {
        setEventCount(data.events)
        setProjectCount(data.projects)
        setMemberCount(data.members)
        setDataLoaded(true)
      })
      .catch(() => setDataLoaded(true))
  }, [])

  const stats = [
    {
      icon: <Users size={24} className="text-blue-500" />,
      number: memberCount !== null ? `${memberCount}+` : "94+",
      labelKey: "heroStats.members",
    },
    {
      icon: <Wrench size={24} className="text-blue-500" />,
      number: "7+",
      labelKey: "heroStats.workshops",
    },
    {
      icon: <Rocket size={24} className="text-blue-500" />,
      number: projectCount !== null ? `${projectCount}+` : "15+",
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
          setCounts((prev) => ({ ...prev, [idx]: current + (s.number.includes("+") ? "+" : "") }));
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
    <div ref={ref} className="w-full bg-[#F1F5F9] border-t border-slate-200 py-6 md:py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-8 lg:px-16 grid grid-cols-2 md:grid-cols-4 gap-4">
        {stats.map((s, i) => (
          <div key={i} className="flex flex-col items-center justify-center text-center bg-white rounded-2xl shadow-sm border border-slate-100 px-4 py-6 md:py-8">
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
    <section className="min-h-screen bg-[#EEF2FF] flex flex-col">
      <div className="flex flex-1 flex-col lg:flex-row px-6 sm:px-8 lg:px-16 gap-6 lg:gap-8 items-center max-w-7xl mx-auto w-full py-12 sm:py-20">
        <HeroLeft />
        <HeroRight />
      </div>
      <StatsBar />
    </section>
  );
}
