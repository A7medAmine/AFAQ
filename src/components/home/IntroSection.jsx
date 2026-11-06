import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import { ArrowRight, GraduationCap, Cpu, Users } from "lucide-react";
import SideImage from "../shared/SideImage";

/*
  "Who we are": the club in one paragraph and three pillars, beside the
  homepage photo the media team sets in Admin > Gallery. The photo keeps its
  own 16:9 shape instead of being cropped into a banner, and a branded
  placeholder stands in until it loads (or when none is set).
*/

const spring = { type: "spring", damping: 28, stiffness: 120 };

const PILLARS = [
  { key: "learn", icon: GraduationCap },
  { key: "build", icon: Cpu },
  { key: "share", icon: Users },
];

const reveal = (delay = 0) => ({
  initial: { opacity: 0, y: 24 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: "-30px" },
  transition: { ...spring, delay },
});

export default function IntroSection() {
  const { t } = useTranslation("home");
  const [image, setImage] = useState(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/page-content/home_intro")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!cancelled && data?.image_url) setImage(data.image_url);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <section className="py-16 md:py-24 relative z-0 overflow-hidden">
      <SideImage side="left" />
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 grid gap-12 lg:gap-16 lg:grid-cols-[1fr_1.1fr] items-center">
        <div>
          <motion.div {...reveal()} className="eyebrow mb-4">
            {t("intro.eyebrow")}
          </motion.div>
          <motion.h2
            {...reveal(0.05)}
            className="text-3xl md:text-4xl lg:text-5xl font-bold leading-tight mb-5"
          >
            {t("intro.title")}
          </motion.h2>
          <motion.p
            {...reveal(0.1)}
            className="text-base md:text-lg leading-relaxed mb-8"
            style={{ color: "var(--color-text-muted)" }}
          >
            {t("intro.description")}
          </motion.p>

          <ul className="space-y-5 mb-9">
            {PILLARS.map(({ key, icon: Icon }, i) => (
              <motion.li key={key} {...reveal(0.15 + i * 0.07)} className="flex gap-4">
                <span
                  className="intro-pillar-icon shrink-0 flex items-center justify-center"
                  aria-hidden="true"
                >
                  <Icon size={20} />
                </span>
                <div>
                  <h3 className="font-bold text-base mb-1">{t(`intro.pillars.${key}.title`)}</h3>
                  <p className="text-sm leading-relaxed" style={{ color: "var(--color-text-muted)" }}>
                    {t(`intro.pillars.${key}.desc`)}
                  </p>
                </div>
              </motion.li>
            ))}
          </ul>

          <motion.div {...reveal(0.35)} className="flex flex-wrap items-center gap-x-6 gap-y-3">
            <Link
              to="/about"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-[100px] font-semibold text-sm text-white transition-transform hover:-translate-y-0.5"
              style={{ background: "var(--color-accent-dark)" }}
            >
              {t("intro.story")}
              <ArrowRight size={16} className="rtl:-scale-x-100" />
            </Link>
            <Link
              to="/projects"
              className="inline-flex items-center gap-1.5 text-sm font-semibold hover:underline underline-offset-4"
              style={{ color: "var(--color-accent)" }}
            >
              {t("intro.projects")}
              <ArrowRight size={15} className="rtl:-scale-x-100" />
            </Link>
          </motion.div>
        </div>

        <motion.figure {...reveal(0.15)} className="relative m-0">
          <div className="intro-frame relative overflow-hidden" style={{ aspectRatio: "16/9" }}>
            <div className="intro-placeholder absolute inset-0 flex items-center justify-center" aria-hidden="true">
              <span className="intro-placeholder-mark">AFAQ</span>
            </div>
            {image && (
              <img
                src={image}
                alt={t("intro.imageAlt")}
                loading="lazy"
                onLoad={() => setLoaded(true)}
                className="absolute inset-0 w-full h-full object-cover transition-opacity duration-500"
                style={{ opacity: loaded ? 1 : 0 }}
              />
            )}
          </div>
          <figcaption className="intro-name-chip">
            <span lang="ar" dir="rtl">آفاق</span>
            <span aria-hidden="true">·</span>
            <span>{t("intro.nameMeaning")}</span>
          </figcaption>
        </motion.figure>
      </div>
    </section>
  );
}
