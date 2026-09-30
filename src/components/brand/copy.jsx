import { createContext, useCallback, useContext, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Check } from 'lucide-react'
import { useTranslation } from 'react-i18next'

const CopyContext = createContext(() => {})

export const useCopy = () => useContext(CopyContext)

async function writeClipboard(text) {
  try {
    await navigator.clipboard.writeText(text)
  } catch {
    // Clipboard API is blocked on plain http and in some embedded browsers.
    const ta = document.createElement('textarea')
    ta.value = text
    ta.style.position = 'fixed'
    ta.style.opacity = '0'
    document.body.appendChild(ta)
    ta.select()
    document.execCommand('copy')
    ta.remove()
  }
}

/** Wraps the page; `copy(text, swatch?)` copies and shows one shared toast. */
export function CopyProvider({ children }) {
  const { t } = useTranslation('brand')
  const [toast, setToast] = useState(null)
  const timer = useRef()

  const copy = useCallback(async (text, swatch) => {
    await writeClipboard(text)
    clearTimeout(timer.current)
    setToast({ text, swatch, id: Date.now() })
    timer.current = setTimeout(() => setToast(null), 1800)
  }, [])

  return (
    <CopyContext.Provider value={copy}>
      {children}
      <AnimatePresence>
        {toast && (
          <motion.div
            key={toast.id}
            className="bk-toast"
            role="status"
            initial={{ opacity: 0, y: 16, x: '-50%' }}
            animate={{ opacity: 1, y: 0, x: '-50%' }}
            exit={{ opacity: 0, y: 16, x: '-50%' }}
            transition={{ type: 'spring', damping: 26, stiffness: 320 }}
          >
            {toast.swatch ? <i style={{ background: toast.swatch }} /> : <Check size={16} />}
            <span>{t('colors.copied')}</span>
            <span className="bk-mono" style={{ opacity: 0.7, maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {toast.text.length > 40 ? toast.text.slice(0, 40) + '…' : toast.text}
            </span>
          </motion.div>
        )}
      </AnimatePresence>
    </CopyContext.Provider>
  )
}

export function Download({ href, children, className = 'bk-btn', ...props }) {
  return (
    <a href={href} download className={className} {...props}>
      {children}
    </a>
  )
}
