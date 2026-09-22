import { useEffect, useRef } from 'react'
import { Html5Qrcode } from 'html5-qrcode'
import { X } from 'lucide-react'
import Modal from './Modal'

/**
 * Opens the device camera and hands back whatever a QR code decodes to.
 * Card/label QR codes are either a bare code (asset/member code) or a
 * `/verify/<code>` URL — the caller strips the URL shape if present.
 */
export default function QrScanner({ open, onClose, onResult, title = 'Scan a code' }) {
  const regionRef = useRef(null)
  const scannerRef = useRef(null)

  useEffect(() => {
    if (!open) return
    const el = regionRef.current
    if (!el) return

    const scanner = new Html5Qrcode(el.id)
    scannerRef.current = scanner
    let stopped = false

    scanner
      .start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: 220 },
        text => {
          if (stopped) return
          stopped = true
          const code = text.includes('/verify/') ? text.split('/verify/').pop() : text
          scanner.stop().catch(() => {}).finally(() => onResult(code.trim()))
        },
        () => {}
      )
      .catch(() => {})

    return () => {
      stopped = true
      scanner.stop().catch(() => {})
    }
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Modal open={open} onClose={onClose} title={title}>
      <div className="flex flex-col items-center gap-3">
        <div id="adm-qr-scan-region" ref={regionRef} style={{ width: '100%', maxWidth: 320, borderRadius: 12, overflow: 'hidden' }} />
        <button type="button" onClick={onClose} className="adm-btn adm-btn-sm">
          <X size={14} /> Cancel
        </button>
      </div>
    </Modal>
  )
}
