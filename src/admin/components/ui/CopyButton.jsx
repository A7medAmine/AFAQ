import { useEffect, useState } from 'react'
import { Check, Copy } from 'lucide-react'

/** Small icon button that copies `value` and shows a tick for a moment. */
export default function CopyButton({ value, label = 'Copy', size = 13 }) {
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!copied) return
    const t = setTimeout(() => setCopied(false), 1500)
    return () => clearTimeout(t)
  }, [copied])

  const copy = async e => {
    // Rows that open on click must not open when copying.
    e.stopPropagation()
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
    } catch { /* clipboard blocked; the value is on screen */ }
  }

  return (
    <button
      type="button"
      onClick={copy}
      title={copied ? 'Copied' : label}
      aria-label={copied ? 'Copied' : label}
      className="inline-flex items-center justify-center rounded p-1 shrink-0"
      style={{ color: copied ? 'var(--adm-ok)' : 'var(--adm-silk-faint)' }}
    >
      {copied ? <Check size={size} /> : <Copy size={size} />}
    </button>
  )
}
