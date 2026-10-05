import { useEffect, useMemo, useRef, useState } from 'react'
import { Copy, Download, RotateCcw } from 'lucide-react'
import QRCode from 'qrcode'
import useAdminStore from '../store/adminStore'
import PageHeader from '../components/ui/PageHeader'
import Panel, { PanelHead } from '../components/ui/Panel'
import Button from '../components/ui/Button'
import { CheckField, SelectField, TextArea, TextField } from '../components/ui/Field'

const LOGO_URL = '/brand/logo/afaq-mark-navy.svg'
const NAVY = '#050A30'

const TYPES = [
  { value: 'url', label: 'Link' },
  { value: 'text', label: 'Text' },
  { value: 'wifi', label: 'Wi-Fi' },
  { value: 'email', label: 'Email' },
  { value: 'phone', label: 'Phone' },
  { value: 'sms', label: 'SMS' },
  { value: 'vcard', label: 'Contact' },
]

const LEVELS = [
  { value: 'L', label: 'Low (7%)' },
  { value: 'M', label: 'Medium (15%)' },
  { value: 'Q', label: 'High (25%)' },
  { value: 'H', label: 'Highest (30%)' },
]

const EMPTY = {
  url: '', text: '',
  ssid: '', password: '', security: 'WPA', hidden: false,
  email: '', subject: '', body: '',
  phone: '', message: '',
  firstName: '', lastName: '', org: 'AFAQ Scientific Club', title: '', cardPhone: '', cardEmail: '', website: '',
}

const STYLE = { dark: NAVY, light: '#FFFFFF', level: 'M', margin: 2, logo: false }

// Wi-Fi and MECARD-style payloads treat these as separators.
const escWifi = s => s.replace(/([\\;,:"])/g, '\\$1')
const escVcard = s => s.replace(/([\\;,])/g, '\\$1').replace(/\n/g, '\\n')

/** What the code actually holds, built from the form for the chosen type. */
function payloadFor(type, f) {
  switch (type) {
    case 'url': {
      const url = f.url.trim()
      if (!url) return ''
      return /^[a-z][a-z0-9+.-]*:/i.test(url) ? url : `https://${url}`
    }
    case 'text':
      return f.text
    case 'wifi':
      if (!f.ssid) return ''
      return `WIFI:T:${f.security === 'nopass' ? 'nopass' : f.security};S:${escWifi(f.ssid)};${
        f.security === 'nopass' ? '' : `P:${escWifi(f.password)};`
      }${f.hidden ? 'H:true;' : ''};`
    case 'email': {
      if (!f.email.trim()) return ''
      const params = new URLSearchParams()
      if (f.subject) params.set('subject', f.subject)
      if (f.body) params.set('body', f.body)
      const query = params.toString().replace(/\+/g, '%20')
      return `mailto:${f.email.trim()}${query ? `?${query}` : ''}`
    }
    case 'phone':
      return f.phone.trim() ? `tel:${f.phone.replace(/[^\d+]/g, '')}` : ''
    case 'sms':
      return f.phone.trim() ? `SMSTO:${f.phone.replace(/[^\d+]/g, '')}:${f.message}` : ''
    case 'vcard': {
      if (!f.firstName.trim() && !f.lastName.trim()) return ''
      const lines = [
        'BEGIN:VCARD',
        'VERSION:3.0',
        `N:${escVcard(f.lastName.trim())};${escVcard(f.firstName.trim())};;;`,
        `FN:${escVcard(`${f.firstName} ${f.lastName}`.trim())}`,
        f.org && `ORG:${escVcard(f.org)}`,
        f.title && `TITLE:${escVcard(f.title)}`,
        f.cardPhone && `TEL;TYPE=CELL:${f.cardPhone.trim()}`,
        f.cardEmail && `EMAIL:${f.cardEmail.trim()}`,
        f.website && `URL:${f.website.trim()}`,
        'END:VCARD',
      ]
      return lines.filter(Boolean).join('\n')
    }
    default:
      return ''
  }
}

/** Relative luminance, for warning about codes scanners can't read. */
function luminance(hex) {
  const n = parseInt(hex.slice(1), 16)
  const [r, g, b] = [n >> 16, (n >> 8) & 255, n & 255].map(v => {
    const c = v / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

let logoCache = null
async function loadLogo() {
  if (!logoCache) {
    logoCache = fetch(LOGO_URL).then(r => r.text()).then(svg => {
      const dataUrl = `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svg)))}`
      return new Promise((resolve, reject) => {
        const img = new Image()
        img.onload = () => resolve({ img, dataUrl })
        img.onerror = reject
        img.src = dataUrl
      })
    })
    logoCache.catch(() => { logoCache = null })
  }
  return logoCache
}

/**
 * The logo sits on a white tile over the middle ~22% of the code. Error
 * correction is forced to H while it's on, so the covered modules are
 * recovered from the rest.
 */
const LOGO_SHARE = 0.22

/**
 * Free-standing QR generator for posters, slides and stickers. Nothing is
 * saved — the code is drawn in the browser and downloaded from here.
 */
export default function QrGeneratorPage() {
  const toast = useAdminStore(s => s.addToast)
  const [type, setType] = useState('url')
  const [form, setForm] = useState(EMPTY)
  const [style, setStyle] = useState(STYLE)
  const [error, setError] = useState(null)
  const canvasRef = useRef(null)

  const payload = useMemo(() => payloadFor(type, form), [type, form])
  const level = style.logo ? 'H' : style.level
  const contrast = (luminance(style.light) + 0.05) / (luminance(style.dark) + 0.05)
  const lowContrast = contrast < 3

  const set = key => e => {
    const value = e?.target ? (e.target.type === 'checkbox' ? e.target.checked : e.target.value) : e
    setForm(f => ({ ...f, [key]: value }))
  }
  const setOpt = key => e => {
    const value = e?.target ? e.target.value : e
    setStyle(s => ({ ...s, [key]: value }))
  }

  useEffect(() => {
    let cancelled = false
    const canvas = canvasRef.current
    if (!canvas) return
    if (!payload) {
      canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height)
      setError(null)
      return
    }
    ;(async () => {
      try {
        await QRCode.toCanvas(canvas, payload, {
          errorCorrectionLevel: level,
          margin: Number(style.margin),
          width: 1024,
          color: { dark: style.dark, light: style.light },
        })
        if (style.logo) {
          const { img } = await loadLogo()
          if (cancelled) return
          drawLogo(canvas.getContext('2d'), canvas.width, img, style.light)
        }
        if (!cancelled) setError(null)
      } catch (err) {
        if (!cancelled) setError(/too big|amount of data/i.test(err?.message || '')
          ? 'Too much content for one QR code. Shorten it or lower the error correction.'
          : 'The QR code could not be drawn.')
      }
    })()
    return () => { cancelled = true }
  }, [payload, level, style])

  const fileName = () => `afaq-qr-${type}-${new Date().toISOString().slice(0, 10)}`

  const download = async format => {
    if (!payload || error) return
    const a = document.createElement('a')
    if (format === 'png') {
      a.href = canvasRef.current.toDataURL('image/png')
    } else {
      let svg = await QRCode.toString(payload, {
        type: 'svg',
        errorCorrectionLevel: level,
        margin: Number(style.margin),
        color: { dark: style.dark, light: style.light },
      })
      if (style.logo) svg = await svgWithLogo(svg, style.light)
      a.href = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }))
      setTimeout(() => URL.revokeObjectURL(a.href), 1000)
    }
    a.download = `${fileName()}.${format}`
    a.click()
  }

  const copyImage = async () => {
    if (!payload || error) return
    try {
      const blob = await new Promise(resolve => canvasRef.current.toBlob(resolve, 'image/png'))
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })])
      toast('QR code copied.')
    } catch {
      toast('Copy failed. Download the PNG instead.', 'error')
    }
  }

  const reset = () => { setForm(EMPTY); setStyle(STYLE) }

  return (
    <div>
      <PageHeader
        eyebrow="Publish"
        title="QR codes"
        description="Make a QR code for a poster, slide or sticker. Nothing is saved — download it when it looks right."
        actions={<Button icon={RotateCcw} onClick={reset}>Start over</Button>}
      />

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px] items-start">
        <div className="space-y-5 min-w-0">
          <Panel>
            <PanelHead eyebrow="Content" title="What the code opens" />
            <div className="p-4 space-y-4">
              <div className="flex flex-wrap gap-2" role="tablist" aria-label="Content type">
                {TYPES.map(t => (
                  <Button
                    key={t.value}
                    size="sm"
                    role="tab"
                    aria-selected={type === t.value}
                    variant={type === t.value ? 'primary' : 'default'}
                    onClick={() => setType(t.value)}
                  >
                    {t.label}
                  </Button>
                ))}
              </div>
              <ContentFields type={type} form={form} set={set} />
            </div>
          </Panel>

          <Panel>
            <PanelHead eyebrow="Style" title="How it looks" />
            <div className="p-4 grid gap-4 sm:grid-cols-2">
              <ColorField label="Code color" value={style.dark} onChange={setOpt('dark')} />
              <ColorField label="Background" value={style.light} onChange={setOpt('light')} />
              <SelectField
                label="Error correction"
                value={level}
                disabled={style.logo}
                hint={style.logo ? 'Set to highest while the logo is on.' : 'Higher survives scratches and dirt, but packs less content.'}
                onChange={setOpt('level')}
              >
                {LEVELS.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}
              </SelectField>
              <SelectField
                label="Quiet zone"
                value={style.margin}
                hint="The empty border scanners need. Keep at least 2 for print."
                onChange={setOpt('margin')}
              >
                {[0, 1, 2, 4, 6].map(m => <option key={m} value={m}>{m} modules</option>)}
              </SelectField>
              <div className="sm:col-span-2">
                <CheckField
                  label="AFAQ logo in the middle"
                  description="Scan it once before printing — logos make small codes harder to read."
                  checked={style.logo}
                  onChange={logo => setStyle(s => ({ ...s, logo }))}
                />
              </div>
            </div>
          </Panel>
        </div>

        <Panel className="lg:sticky lg:top-4">
          <PanelHead eyebrow="Preview" title={payload ? 'Ready' : 'Fill in the content'} />
          <div className="p-4 flex flex-col items-center gap-3">
            <div
              className="grid place-items-center w-full"
              style={{ aspectRatio: '1', borderRadius: 10, background: payload ? style.light : 'var(--adm-trace)', overflow: 'hidden' }}
            >
              <canvas
                ref={canvasRef}
                aria-label="QR code preview"
                style={{ width: '100%', height: '100%', display: payload && !error ? 'block' : 'none' }}
              />
              {(!payload || error) && (
                <p className="text-xs text-center px-6" style={{ color: error ? 'var(--adm-fault)' : 'var(--adm-silk-faint)' }}>
                  {error || 'The code shows up here as you type.'}
                </p>
              )}
            </div>
            {lowContrast && payload && (
              <p className="text-xs text-center" style={{ color: 'var(--adm-fault)' }}>
                Low contrast — many phones won't scan this. Use a dark code on a light background.
              </p>
            )}
            {payload && (
              <p className="adm-data text-[11.5px] w-full break-all whitespace-pre-wrap" style={{ color: 'var(--adm-silk-faint)', maxHeight: 90, overflow: 'auto' }}>
                {payload}
              </p>
            )}
            <div className="flex flex-wrap justify-center gap-2">
              <Button size="sm" icon={Download} disabled={!payload || !!error} onClick={() => download('svg')}>SVG</Button>
              <Button size="sm" icon={Download} disabled={!payload || !!error} onClick={() => download('png')}>PNG</Button>
              <Button size="sm" icon={Copy} disabled={!payload || !!error} onClick={copyImage}>Copy</Button>
            </div>
            <p className="text-[11.5px] text-center" style={{ color: 'var(--adm-silk-faint)' }}>
              SVG for print — it stays sharp at any size. PNG is 1024 px.
            </p>
          </div>
        </Panel>
      </div>
    </div>
  )
}

function ContentFields({ type, form, set }) {
  switch (type) {
    case 'url':
      return <TextField label="Address" value={form.url} onChange={set('url')} placeholder="afaq-club.com/events" hint="https:// is added if you leave it off." />
    case 'text':
      return <TextArea label="Text" rows={4} value={form.text} onChange={set('text')} placeholder="Anything — it shows as plain text on the phone." />
    case 'wifi':
      return (
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField label="Network name" value={form.ssid} onChange={set('ssid')} placeholder="AFAQ-Lab" />
          <SelectField label="Security" value={form.security} onChange={set('security')}>
            <option value="WPA">WPA / WPA2 / WPA3</option>
            <option value="WEP">WEP</option>
            <option value="nopass">None</option>
          </SelectField>
          {form.security !== 'nopass' && <TextField label="Password" value={form.password} onChange={set('password')} />}
          <div className="sm:col-span-2">
            <CheckField label="Hidden network" checked={form.hidden} onChange={set('hidden')} />
          </div>
        </div>
      )
    case 'email':
      return (
        <div className="space-y-4">
          <TextField label="To" type="email" value={form.email} onChange={set('email')} placeholder="contact@afaq-club.com" />
          <TextField label="Subject" value={form.subject} onChange={set('subject')} />
          <TextArea label="Message" rows={3} value={form.body} onChange={set('body')} />
        </div>
      )
    case 'phone':
      return <TextField label="Phone number" type="tel" value={form.phone} onChange={set('phone')} placeholder="+213 555 00 00 00" />
    case 'sms':
      return (
        <div className="space-y-4">
          <TextField label="Phone number" type="tel" value={form.phone} onChange={set('phone')} placeholder="+213 555 00 00 00" />
          <TextArea label="Message" rows={3} value={form.message} onChange={set('message')} />
        </div>
      )
    case 'vcard':
      return (
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField label="First name" value={form.firstName} onChange={set('firstName')} />
          <TextField label="Last name" value={form.lastName} onChange={set('lastName')} />
          <TextField label="Organization" value={form.org} onChange={set('org')} />
          <TextField label="Role" value={form.title} onChange={set('title')} placeholder="President" />
          <TextField label="Phone" type="tel" value={form.cardPhone} onChange={set('cardPhone')} />
          <TextField label="Email" type="email" value={form.cardEmail} onChange={set('cardEmail')} />
          <TextField className="sm:col-span-2" label="Website" value={form.website} onChange={set('website')} />
        </div>
      )
    default:
      return null
  }
}

function ColorField({ label, value, onChange }) {
  return (
    <div>
      <span className="adm-label">{label}</span>
      <div className="flex items-center gap-2">
        <input
          type="color"
          aria-label={label}
          value={value}
          onChange={onChange}
          style={{ width: 40, height: 36, padding: 0, border: '1px solid var(--adm-trace)', borderRadius: 6, background: 'none', cursor: 'pointer' }}
        />
        <input
          className="adm-input adm-data"
          aria-label={`${label} hex`}
          value={value}
          maxLength={7}
          onChange={e => { if (/^#[0-9a-f]{6}$/i.test(e.target.value)) onChange(e) }}
        />
      </div>
    </div>
  )
}

function drawLogo(ctx, size, img, background) {
  const tile = size * LOGO_SHARE
  const x = (size - tile) / 2
  const pad = tile * 0.12
  ctx.fillStyle = background
  ctx.beginPath()
  ctx.roundRect(x, x, tile, tile, tile * 0.18)
  ctx.fill()
  ctx.drawImage(img, x + pad, x + pad, tile - pad * 2, tile - pad * 2)
}

/** Drops the logo tile into the SVG qrcode returns, using its own viewBox units. */
async function svgWithLogo(svg, background) {
  const { dataUrl } = await loadLogo()
  const box = Number(svg.match(/viewBox="0 0 (\d+) \d+"/)?.[1])
  if (!box) return svg
  const tile = box * LOGO_SHARE
  const x = (box - tile) / 2
  const pad = tile * 0.12
  const overlay =
    `<rect x="${x}" y="${x}" width="${tile}" height="${tile}" rx="${tile * 0.18}" fill="${background}"/>` +
    `<image href="${dataUrl}" x="${x + pad}" y="${x + pad}" width="${tile - pad * 2}" height="${tile - pad * 2}"/>`
  return svg.replace('</svg>', `${overlay}</svg>`)
}
