import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import Logo from "../shared/Logo";
import SocialIcons from "../shared/SocialIcons";
import { Mail, MapPin } from "lucide-react";
import {
  TextHoverEffect,
  FooterBackgroundGradient,
} from "@/components/ui/hover-footer";

const spring = { type: "spring", damping: 28, stiffness: 120 };

export default function Footer() {
  const { t } = useTranslation();

  /* Four columns for four children. The grid asked for `lg:grid-cols-4` but
     only ever had three, so the last track sat empty and the brand column was
     squeezed into a quarter of the row. The missing column is the one that
     matters most — the two pages that turn a visitor into a member. */
  const columns = [
    {
      title: t("footer.quickLinks"),
      links: [
        { label: t("nav.about"), to: "/about" },
        { label: t("nav.projects"), to: "/projects" },
        { label: t("nav.events"), to: "/events" },
        { label: t("nav.gallery"), to: "/gallery" },
        { label: t("nav.brand"), to: "/brand" },
      ],
    },
    {
      title: t("footer.connect"),
      links: [
        { label: t("nav.join"), to: "/join" },
        { label: t("nav.register"), to: "/register" },
        { label: t("nav.announcements"), to: "/announcements" },
        { label: t("nav.contact"), to: "/contact" },
      ],
    },
  ];

  const contactInfo = [
    {
      icon: <Mail size={17} className="footer-icon" />,
      text: "afaqclub.bouira@gmail.com",
      href: "mailto:afaqclub.bouira@gmail.com",
    },
    {
      icon: <MapPin size={17} className="footer-icon" />,
      text: "Bouira, Algeria",
    },
  ];

  return (
    <footer className="site-footer relative h-fit rounded-none">
      <div className="max-w-7xl mx-auto p-8 md:p-14 z-40 relative">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-10 md:gap-8 lg:gap-12 pb-12">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-30px" }}
            transition={spring}
            className="flex flex-col gap-4 sm:col-span-2 lg:col-span-1"
          >
            <Link to="/" className="flex items-center gap-2.5 w-fit">
              {/* Pinned white: the footer is dark in both themes, and the
                  default logo only swaps to white on prefers-color-scheme:
                  dark — which would leave a black mark on a black band for
                  every light-mode visitor. */}
              <Logo size={38} variant="white" />
              <span className="text-2xl font-bold">AFAQ</span>
            </Link>
            <p className="footer-muted text-sm leading-relaxed max-w-xs">
              {t("footer.description")}
            </p>
            <SocialIcons />
          </motion.div>

          {columns.map((section, i) => (
            <motion.nav
              key={section.title}
              aria-label={section.title}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-30px" }}
              transition={{ ...spring, delay: 0.1 * (i + 1) }}
            >
              <h4 className="footer-heading">{section.title}</h4>
              <ul className="space-y-2.5">
                {section.links.map((link) => (
                  <li key={link.to}>
                    <Link to={link.to} className="footer-link">
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </motion.nav>
          ))}

          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-30px" }}
            transition={{ ...spring, delay: 0.3 }}
          >
            <h4 className="footer-heading">{t("footer.contactUs")}</h4>
            <ul className="space-y-3.5">
              {contactInfo.map((item) => (
                <li key={item.text} className="flex items-center gap-3">
                  {item.icon}
                  {item.href ? (
                    <a href={item.href} className="footer-link break-all">
                      {item.text}
                    </a>
                  ) : (
                    /* Not a link — it was styled with a hover colour that
                       promised a click that never happened. */
                    <span className="footer-muted text-sm">{item.text}</span>
                  )}
                </li>
              ))}
            </ul>
          </motion.div>
        </div>

        <hr className="footer-rule" />

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-30px" }}
          transition={{ ...spring, delay: 0.3 }}
          className="flex flex-col md:flex-row justify-between items-center gap-3 text-sm footer-muted"
        >
          <p className="text-center md:text-start">
            &copy; {new Date().getFullYear()} AFAQ Scientific Club.{" "}
            {t("footer.rights")}
          </p>
          <p className="text-center md:text-end">{t("footer.university")}</p>
        </motion.div>

        <div className="flex w-full h-[8rem] sm:h-[12rem] md:h-[16rem] lg:h-[28rem] mt-4 sm:mt-6 md:mt-8 lg:mt-12">
          <TextHoverEffect text="AFAQ" />
        </div>
      </div>

      <FooterBackgroundGradient />
    </footer>
  );
}
