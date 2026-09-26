import { lazy, Suspense, useState } from 'react'
import ChatbotButton from './ChatbotButton'

// The modal pulls in markdown rendering and the mascot; fetch it only once a
// visitor actually opens the chat, then keep it mounted for the exit animation.
const ChatbotModal = lazy(() => import('./ChatbotModal'))

export default function Chatbot() {
  const [open, setOpen] = useState(false)
  const [loaded, setLoaded] = useState(false)

  if (typeof window !== 'undefined' && window.location.pathname.startsWith('/admin')) return null

  const toggle = () => {
    setLoaded(true)
    setOpen(!open)
  }

  return (
    <>
      <ChatbotButton open={open} onClick={toggle} />
      {loaded && (
        <Suspense fallback={null}>
          <ChatbotModal open={open} onClose={() => setOpen(false)} />
        </Suspense>
      )}
    </>
  )
}
