import {
  Briefcase, ClipboardList, Code, Globe, Link2, Mail, MessageCircle,
  MessagesSquare, Phone, Play, Send,
} from 'lucide-react'
import { FacebookIcon, InstagramIcon, TikTokIcon } from '../components/shared/SocialIcons'

/**
 * Platforms a /links entry can be. The admin picks one; it only decides the
 * icon, so an account on a platform not listed here still works as "other".
 */
export const PLATFORMS = [
  { value: 'instagram', label: 'Instagram', icon: InstagramIcon },
  { value: 'facebook', label: 'Facebook', icon: FacebookIcon },
  { value: 'tiktok', label: 'TikTok', icon: TikTokIcon },
  { value: 'youtube', label: 'YouTube', icon: Play },
  { value: 'linkedin', label: 'LinkedIn', icon: Briefcase },
  { value: 'github', label: 'GitHub', icon: Code },
  { value: 'whatsapp', label: 'WhatsApp', icon: MessageCircle },
  { value: 'telegram', label: 'Telegram', icon: Send },
  { value: 'discord', label: 'Discord', icon: MessagesSquare },
  { value: 'form', label: 'Form / sign-up', icon: ClipboardList },
  { value: 'email', label: 'Email', icon: Mail },
  { value: 'phone', label: 'Phone', icon: Phone },
  { value: 'website', label: 'Website', icon: Globe },
  { value: 'other', label: 'Other', icon: Link2 },
]

const BY_VALUE = new Map(PLATFORMS.map(p => [p.value, p]))

export function PlatformIcon({ platform, size = 20 }) {
  const Icon = (BY_VALUE.get(platform) || BY_VALUE.get('other')).icon
  return <Icon size={size} aria-hidden="true" />
}

/** Where the poster QR codes point. */
export const LINKS_PATH = '/links'
export const LINKS_URL = `https://afaq.ahmedabd.me${LINKS_PATH}`

/**
 * Accept what admins actually paste: bare domains get https://, and
 * emails / phone numbers become mailto: / tel: links.
 */
export function normalizeLinkUrl(raw, platform) {
  const value = raw.trim()
  if (!value) return ''
  if (/^(https?:|mailto:|tel:)/i.test(value)) return value
  if (platform === 'email' || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return `mailto:${value}`
  if (platform === 'phone' || /^\+?[\d\s()-]{6,}$/.test(value)) return `tel:${value.replace(/[\s()-]/g, '')}`
  return `https://${value}`
}
