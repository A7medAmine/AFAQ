import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Check, Copy } from 'lucide-react'

/** The member code with a button that copies it. */
export default function CopyCode({ code }) {
  const { t } = useTranslation('portal')
  const [copied, setCopied] = useState(false)
  const timer = useRef()
  useEffect(() => () => clearTimeout(timer.current), [])

  const copy = async () => {
    try { await navigator.clipboard.writeText(code) } catch { return /* clipboard blocked; the code is on screen */ }
    setCopied(true)
    clearTimeout(timer.current)
    timer.current = setTimeout(() => setCopied(false), 1500)
  }

  return (
    <span className="inline-flex items-center gap-1.5 align-middle">
      <span className="portal-mono">{code}</span>
      <button type="button" onClick={copy} title={copied ? t('copied') : t('copy')} aria-label={copied ? t('copied') : t('copy')}
        className="inline-flex items-center justify-center rounded p-1 portal-muted hover:opacity-80"
        style={copied ? { color: 'var(--color-accent)' } : undefined}>
        {copied ? <Check size={13} /> : <Copy size={13} />}
      </button>
    </span>
  )
}
