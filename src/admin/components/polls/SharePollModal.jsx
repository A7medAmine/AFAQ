import { useEffect, useState } from 'react'
import QRCode from 'qrcode'
import { Copy, Download, ExternalLink, Share2 } from 'lucide-react'
import useAdminStore from '../../store/adminStore'
import { downloadDataUrl } from '../../lib/format'
import { pollUrl } from '../../lib/polls'
import Modal from '../ui/Modal'
import Button from '../ui/Button'

/**
 * Each network gets the link with its own ?src= tag, so the results tab can
 * say where answers came from.
 */
const NETWORKS = [
  { id: 'whatsapp', label: 'WhatsApp', href: (url, text) => `https://wa.me/?text=${encodeURIComponent(`${text} ${url}`)}` },
  { id: 'telegram', label: 'Telegram', href: (url, text) => `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}` },
  { id: 'facebook', label: 'Facebook', href: url => `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}` },
  { id: 'x', label: 'X', href: (url, text) => `https://twitter.com/intent/tweet?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}` },
  { id: 'linkedin', label: 'LinkedIn', href: url => `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}` },
  { id: 'email', label: 'Email', href: (url, text) => `mailto:?subject=${encodeURIComponent(text)}&body=${encodeURIComponent(`${text}\n\n${url}`)}` },
]

export default function SharePollModal({ open, poll, state, onClose }) {
  const addToast = useAdminStore(s => s.addToast)
  const [qrUrl, setQrUrl] = useState(null)
  const url = poll ? pollUrl(poll.slug) : ''
  const live = state && state !== 'draft'

  useEffect(() => {
    if (!open || !poll) return
    // Printed codes say where the answer came from too.
    QRCode.toDataURL(pollUrl(poll.slug, 'qr'), { width: 640, margin: 2, errorCorrectionLevel: 'M' })
      .then(setQrUrl)
      .catch(() => setQrUrl(null))
  }, [open, poll])

  const copy = async value => {
    try {
      await navigator.clipboard.writeText(value)
      addToast('Link copied.')
    } catch {
      addToast('Copy failed. Select the link and copy it by hand.', 'error')
    }
  }

  const nativeShare = async () => {
    try {
      await navigator.share({ title: poll.title, text: poll.title, url: pollUrl(poll.slug, 'share') })
    } catch { /* closed the sheet */ }
  }

  if (!poll) return null
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Share this poll"
      description={live
        ? 'Anyone with the link can open the poll. Members-only polls still ask for a member code.'
        : 'This poll is still a draft: the link shows “not found” until you publish it.'}
      size="lg"
      footer={<Button onClick={onClose} data-dialog-dismiss="true">Close</Button>}
    >
      <div className="grid sm:grid-cols-[1fr_220px] gap-6">
        <div className="space-y-5 min-w-0">
          <div>
            <span className="adm-label">Link</span>
            <div className="flex gap-2">
              <input className="adm-input adm-data text-[12px] flex-1 min-w-0" readOnly value={url} onFocus={e => e.target.select()} aria-label="Poll link" />
              <Button icon={Copy} onClick={() => copy(url)}>Copy</Button>
            </div>
            <a href={url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs mt-2" style={{ color: 'var(--adm-signal)' }}>
              <ExternalLink size={12} /> Open the public page
            </a>
          </div>

          <div>
            <span className="adm-label">Post it</span>
            <div className="flex flex-wrap gap-2">
              {NETWORKS.map(n => (
                <a key={n.id} className="adm-btn adm-btn-sm" href={n.href(pollUrl(poll.slug, n.id), poll.title)} target="_blank" rel="noreferrer">
                  {n.label}
                </a>
              ))}
              {typeof navigator !== 'undefined' && navigator.share && (
                <Button size="sm" icon={Share2} onClick={nativeShare}>More…</Button>
              )}
            </div>
            <p className="text-xs mt-2" style={{ color: 'var(--adm-silk-faint)' }}>
              Each button adds a tag to the link, so Results can show how many answers came from each place.
            </p>
          </div>
        </div>

        <div className="flex flex-col items-center gap-3">
          {qrUrl ? (
            <img src={qrUrl} alt={`QR code for ${poll.title}`} className="rounded-lg" style={{ width: 200, height: 200, background: '#fff' }} />
          ) : (
            <div className="rounded-lg" style={{ width: 200, height: 200, background: 'var(--adm-board-sunk)' }} />
          )}
          <Button size="sm" icon={Download} disabled={!qrUrl} onClick={() => downloadDataUrl(qrUrl, `poll-${poll.slug}-qr.png`)}>Download QR</Button>
        </div>
      </div>
    </Modal>
  )
}
