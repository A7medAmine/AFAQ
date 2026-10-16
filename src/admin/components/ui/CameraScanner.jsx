import { useEffect, useId, useRef, useState } from 'react'

/**
 * Live camera QR reader. Calls `onScan(text)` for every code it reads; the
 * same code is reported again only after `repeatAfter` ms, so holding a card
 * in front of the camera counts once. Uses the back camera on phones.
 */
export default function CameraScanner({ onScan, repeatAfter = 3000 }) {
  const id = useId().replace(/:/g, '')
  const onScanRef = useRef(onScan)
  const [error, setError] = useState(null)

  useEffect(() => { onScanRef.current = onScan }, [onScan])

  useEffect(() => {
    let scanner
    let stopped = false
    const last = { text: '', at: 0 }

    import('html5-qrcode').then(({ Html5Qrcode }) => {
      if (stopped) return
      scanner = new Html5Qrcode(`scan-${id}`, { verbose: false })
      scanner.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 220, height: 220 } },
        text => {
          const now = Date.now()
          if (text === last.text && now - last.at < repeatAfter) return
          last.text = text
          last.at = now
          onScanRef.current(text)
        },
        () => {} // frames without a code
      ).catch(err => {
        setError(/permission|NotAllowed/i.test(String(err))
          ? 'Camera access was refused. Allow the camera for this site and try again.'
          : 'No camera could be opened on this device.')
      })
    })

    return () => {
      stopped = true
      if (scanner?.isScanning) scanner.stop().then(() => scanner.clear()).catch(() => {})
    }
  }, [id, repeatAfter])

  return (
    <div>
      <div id={`scan-${id}`} className="rounded-xl overflow-hidden" style={{ background: '#000', minHeight: error ? 0 : 240 }} />
      {error && <p className="text-sm mt-2" style={{ color: 'var(--adm-fault)' }}>{error}</p>}
    </div>
  )
}
