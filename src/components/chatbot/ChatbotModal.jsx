import { useState, useRef, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Send, Trash2, Bot } from 'lucide-react'
import ChatMessage from './ChatMessage'
import SuggestedQuestions from './SuggestedQuestions'

const STORAGE_KEY = 'afaq-chat-history'
const MAX_HISTORY = 50

function loadHistory() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    return saved ? JSON.parse(saved) : []
  } catch {
    return []
  }
}

function saveHistory(messages) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(messages.slice(-MAX_HISTORY)))
  } catch { /* ignore */ }
}

export default function ChatbotModal({ open, onClose }) {
  const [messages, setMessages] = useState(loadHistory)
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const listRef = useRef(null)
  const inputRef = useRef(null)

  const lang = document.documentElement.lang || 'en'

  useEffect(() => {
    if (open && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }, [open])

  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight
    }
  }, [messages, loading])

  const clearHistory = () => {
    setMessages([])
    saveHistory([])
  }

  const sendMessage = useCallback(async (text) => {
    const msg = text || input.trim()
    if (!msg || loading) return

    setInput('')
    setError(null)

    const userMessage = { role: 'user', content: msg, id: Date.now() }
    const updated = [...messages, userMessage]
    setMessages(updated)
    saveHistory(updated)
    setLoading(true)

    try {
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: msg }),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || `Server error (${res.status})`)
      }

      const data = await res.json()
      const botMessage = { role: 'assistant', content: data.reply, id: Date.now() + 1 }
      const withReply = [...updated, botMessage]
      setMessages(withReply)
      saveHistory(withReply)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [input, loading, messages])

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black/30 md:bg-transparent md:pointer-events-none"
            onClick={onClose}
          />

          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="fixed z-[101] bottom-0 right-0 md:bottom-24 md:right-6 w-full md:w-96 h-[90vh] md:h-[600px] flex flex-col rounded-t-2xl md:rounded-2xl shadow-2xl border overflow-hidden"
            style={{
              background: 'var(--color-card)',
              borderColor: 'var(--color-border-light)',
              maxHeight: '100dvh',
            }}
          >
            {/* Header */}
            <div
              className="flex items-center justify-between px-4 py-3 border-b flex-shrink-0"
              style={{ borderColor: 'var(--color-border-light)' }}
            >
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: 'var(--color-accent)', color: '#fff' }}>
                  <Bot size={16} />
                </div>
                <div>
                  <span className="text-sm font-semibold" style={{ color: 'var(--color-text)' }}>AFAQ Assistant</span>
                  <p className="text-[10px]" style={{ color: 'var(--color-text-muted)' }}>
                    {lang === 'ar' ? 'مدعوم بالذكاء الاصطناعي' : lang === 'fr' ? 'Alimenté par l\'IA' : 'AI-powered'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                {messages.length > 0 && (
                  <button
                    onClick={clearHistory}
                    className="p-2 rounded-xl hover:opacity-70 transition-opacity cursor-pointer"
                    style={{ color: 'var(--color-text-muted)' }}
                    title={lang === 'ar' ? 'مسح المحادثة' : lang === 'fr' ? 'Effacer la conversation' : 'Clear conversation'}
                  >
                    <Trash2 size={14} />
                  </button>
                )}
                <button
                  onClick={onClose}
                  className="p-2 rounded-xl hover:opacity-70 transition-opacity cursor-pointer"
                  style={{ color: 'var(--color-text-muted)' }}
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            {/* Messages */}
            <div ref={listRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-4 scroll-smooth">
              {messages.length === 0 && (
                <div className="flex flex-col items-center justify-center h-full text-center px-6">
                  <div className="w-12 h-12 rounded-2xl flex items-center justify-center mb-3" style={{ background: 'var(--color-accent-soft)' }}>
                    <Bot size={24} style={{ color: 'var(--color-accent)' }} />
                  </div>
                  <p className="text-sm font-medium mb-1" style={{ color: 'var(--color-text)' }}>
                    {lang === 'ar' ? 'مرحباً! كيف يمكنني مساعدتك؟' : lang === 'fr' ? 'Bonjour! Comment puis-je vous aider?' : 'Hi! How can I help you?'}
                  </p>
                  <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                    {lang === 'ar' ? 'اطرح سؤالاً عن النادي' : lang === 'fr' ? 'Posez une question sur le club' : 'Ask me anything about AFAQ Club'}
                  </p>
                </div>
              )}

              {messages.map((m) => (
                <ChatMessage key={m.id} role={m.role} content={m.content} />
              ))}

              {loading && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex items-center gap-2 px-1"
                >
                  <div className="flex gap-1">
                    <span className="w-1.5 h-1.5 rounded-full animate-bounce" style={{ background: 'var(--color-text-muted)', animationDelay: '0ms' }} />
                    <span className="w-1.5 h-1.5 rounded-full animate-bounce" style={{ background: 'var(--color-text-muted)', animationDelay: '150ms' }} />
                    <span className="w-1.5 h-1.5 rounded-full animate-bounce" style={{ background: 'var(--color-text-muted)', animationDelay: '300ms' }} />
                  </div>
                </motion.div>
              )}

              {error && (
                <div className="text-xs text-center py-2 px-4 rounded-xl" style={{ background: '#fef2f2', color: '#dc2626' }}>
                  {error}
                </div>
              )}
            </div>

            {/* Suggested */}
            {messages.length === 0 && !loading && (
              <SuggestedQuestions
                onSelect={(q) => {
                  setInput(q)
                  setTimeout(() => sendMessage(q), 50)
                }}
                lang={lang}
              />
            )}

            {/* Input */}
            <div className="p-3 border-t flex-shrink-0" style={{ borderColor: 'var(--color-border-light)' }}>
              <div className="flex items-end gap-2">
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  rows={1}
                  placeholder={lang === 'ar' ? 'اكتب رسالتك...' : lang === 'fr' ? 'Tapez votre message...' : 'Type your message...'}
                  className="flex-1 resize-none px-4 py-2.5 rounded-xl border text-sm outline-none"
                  style={{
                    background: 'var(--color-bg)',
                    borderColor: 'var(--color-border-light)',
                    color: 'var(--color-text)',
                    maxHeight: 120,
                  }}
                  disabled={loading}
                />
                <button
                  onClick={() => sendMessage()}
                  disabled={!input.trim() || loading}
                  className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 transition-opacity cursor-pointer"
                  style={{
                    background: input.trim() && !loading ? 'var(--color-accent)' : 'var(--color-bg-alt)',
                    color: input.trim() && !loading ? '#fff' : 'var(--color-text-muted)',
                  }}
                >
                  <Send size={16} />
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
