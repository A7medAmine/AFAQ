import { useState, useEffect } from 'react'
import ChatbotButton from './ChatbotButton'
import ChatbotModal from './ChatbotModal'

export default function Chatbot() {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (typeof window !== 'undefined' && window.location.pathname.startsWith('/admin')) return
  }, [])

  if (typeof window !== 'undefined' && window.location.pathname.startsWith('/admin')) return null

  return (
    <>
      <ChatbotButton open={open} onClick={() => setOpen(!open)} />
      <ChatbotModal open={open} onClose={() => setOpen(false)} />
    </>
  )
}
