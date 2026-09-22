import { useEffect, useRef, useState } from 'react'
import { Html5Qrcode } from 'html5-qrcode'
import { X } from 'lucide-react'
import Modal from './Modal'

// html5-qrcode's stop() throws synchronously when the scanner never started
// (e.g. camera permission denied), so a plain .catch() is not enough.
function safeStop(scanner) {
  try {
    if (scanner.isScanning) return scanner.stop().catch(() => {})
  } catch {
    // not running — nothing to stop
  }
  return Promise.resolve()
}

function cameraErrorMessage(err) {
  const text = String(err?.name || err?.message || err || '')
  if (/NotAllowed|Permission/i.test(text)) return 'Camera access was blocked. Allow camera permission in your browser settings and try again.'
  if (/NotFound|Requested device not found/i.test(text)) return 'No camera was found on this device.'
  if (/NotReadable|in use/i.test(text)) return 'The camera is being used by another application.'
  return 'Could not start the camera.'
}

/**
 * Opens the device camera and hands back whatever a QR code decodes to.
 * Card/label QR codes are either a bare code (asset/member code) or a
 * `/verify/<code>` URL — the caller strips the URL shape if present.
 */
export default function QrScanner({ open, onClose, onResult, title = 'Scan a code' }) {
  const regionRef = useRef(null)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open) return
    const el = regionRef.current
    if (!el) return

    setError('')
    const scanner = new Html5Qrcode(el.id)
    let stopped = false

    scanner
      .start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: 220 },
        text => {
          if (stopped) return
          stopped = true
          const code = text.includes('/verify/') ? text.split('/verify/').pop() : text
          safeStop(scanner).finally(() => onResult(code.trim()))
        },
        () => {}
      )
      .then(() => {
        // Modal closed while the camera was still starting up.
        if (stopped) safeStop(scanner)
      })
      .catch(err => {
        if (!stopped) setError(cameraErrorMessage(err))
      })

    return () => {
      stopped = true
      safeStop(scanner)
    }
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Modal open={open} onClose={onClose} title={title}>
      <div className="flex flex-col items-center gap-3">
        <div id="adm-qr-scan-region" ref={regionRef} style={{ width: '100%', maxWidth: 320, borderRadius: 12, overflow: 'hidden' }} />
        {error && <p role="alert" className="text-sm text-center" style={{ color: 'var(--adm-danger, #ef4444)' }}>{error}</p>}
        <button type="button" onClick={onClose} className="adm-btn adm-btn-sm">
          <X size={14} /> Cancel
        </button>
      </div>
    </Modal>
  )
}
