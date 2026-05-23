import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import LanguageDetector from 'i18next-browser-languagedetector'

import enCommon from '../locales/en/common.json'
import arCommon from '../locales/ar/common.json'
import frCommon from '../locales/fr/common.json'

import enHome from '../locales/en/home.json'
import arHome from '../locales/ar/home.json'
import frHome from '../locales/fr/home.json'

import enAbout from '../locales/en/about.json'
import arAbout from '../locales/ar/about.json'
import frAbout from '../locales/fr/about.json'

import enProjects from '../locales/en/projects.json'
import arProjects from '../locales/ar/projects.json'
import frProjects from '../locales/fr/projects.json'

import enEvents from '../locales/en/events.json'
import arEvents from '../locales/ar/events.json'
import frEvents from '../locales/fr/events.json'

import enGallery from '../locales/en/gallery.json'
import arGallery from '../locales/ar/gallery.json'
import frGallery from '../locales/fr/gallery.json'

import enRegister from '../locales/en/register.json'
import arRegister from '../locales/ar/register.json'
import frRegister from '../locales/fr/register.json'

import enJoin from '../locales/en/join.json'
import arJoin from '../locales/ar/join.json'
import frJoin from '../locales/fr/join.json'

import enContact from '../locales/en/contact.json'
import arContact from '../locales/ar/contact.json'
import frContact from '../locales/fr/contact.json'

const savedLang = localStorage.getItem('i18nextLng') || 'en'
document.documentElement.dir = savedLang === 'ar' ? 'rtl' : 'ltr'
document.documentElement.lang = savedLang

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en: {
        common: enCommon,
        home: enHome,
        about: enAbout,
        projects: enProjects,
        events: enEvents,
        gallery: enGallery,
        register: enRegister,
        join: enJoin,
        contact: enContact,
      },
      ar: {
        common: arCommon,
        home: arHome,
        about: arAbout,
        projects: arProjects,
        events: arEvents,
        gallery: arGallery,
        register: arRegister,
        join: arJoin,
        contact: arContact,
      },
      fr: {
        common: frCommon,
        home: frHome,
        about: frAbout,
        projects: frProjects,
        events: frEvents,
        gallery: frGallery,
        register: frRegister,
        join: frJoin,
        contact: frContact,
      },
    },
    fallbackLng: 'en',
    supportedLngs: ['en', 'ar', 'fr'],
    ns: ['common', 'home', 'about', 'projects', 'events', 'gallery', 'register', 'join', 'contact'],
    defaultNS: 'common',
    detection: {
      order: ['localStorage', 'navigator'],
      caches: ['localStorage'],
    },
  })

export default i18n
