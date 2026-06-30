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

  const navItems = ["about", "projects", "events", "gallery", "contact"];

  const footerLinks = [
    {
      title: t("footer.quickLinks"),
      links: navItems.map((k) => ({
        label: t(`nav.${k}`),
        href: `/${k === "about" ? "about" : k}`,
      })),
    },
  ];

  const contactInfo = [
    {
      icon: <Mail size={18} className="text-[#3ca2fa]" />,
      text: "afaqclub.bouira@gmail.com",
      href: "mailto:afaqclub.bouira@gmail.com",
    },
    {
      icon: <MapPin size={18} className="text-[#3ca2fa]" />,
      text: "Bouira, Algeria",
    },
  ];

  return (
    <footer className="bg-[#0F0F11]/10 relative h-fit rounded-none">
      <div className="max-w-7xl mx-auto p-8 md:p-14 z-40 relative">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12 md:gap-8 lg:gap-16 pb-12">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-30px" }}
            transition={spring}
            className="flex flex-col space-y-4"
          >
            <Link to="/" className="flex items-center space-x-2 group">
              <Logo size={40} />
              <span className="text-3xl font-bold">AFAQ</span>
            </Link>
            <p className="text-sm leading-relaxed">{t("footer.description")}</p>
            <SocialIcons />
          </motion.div>

          {footerLinks.map((section) => (
            <motion.div
              key={section.title}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-30px" }}
              transition={{ ...spring, delay: 0.1 }}
            >
              <h4 className="text-lg font-semibold mb-6">{section.title}</h4>
              <ul className="space-y-3">
                {section.links.map((link) => (
                  <li key={link.label}>
                    <Link
                      to={link.href}
                      className="hover:text-[#3ca2fa] transition-colors"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </motion.div>
          ))}

          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-30px" }}
            transition={{ ...spring, delay: 0.2 }}
          >
            <h4 className="text-lg font-semibold mb-6">
              {t("footer.connect")}
            </h4>
            <ul className="space-y-4">
              {contactInfo.map((item, i) => (
                <li key={i} className="flex items-center space-x-3">
                  {item.icon}
                  {item.href ? (
                    <a
                      href={item.href}
                      className="hover:text-[#3ca2fa] transition-colors"
                    >
                      {item.text}
                    </a>
                  ) : (
                    <span className="hover:text-[#3ca2fa] transition-colors">
                      {item.text}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </motion.div>
        </div>

        <motion.hr
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="border-t border-gray-700 my-8"
        />

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-30px" }}
          transition={{ ...spring, delay: 0.3 }}
          className="flex flex-col md:flex-row justify-between items-center text-sm space-y-4 md:space-y-0"
        >
          <p className="text-center md:text-left">
            &copy; {new Date().getFullYear()} AFAQ Scientific Club.{" "}
            {t("footer.rights")}
          </p>
          <p>{t("footer.university")}</p>
        </motion.div>

        <div className="flex w-full h-[8rem] sm:h-[12rem] md:h-[16rem] lg:h-[28rem] mt-4 sm:mt-6 md:mt-8 lg:mt-12">
          <TextHoverEffect text="AFAQ" />
        </div>
      </div>

      <FooterBackgroundGradient />
    </footer>
  );
}
