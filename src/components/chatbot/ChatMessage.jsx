import { useState } from 'react'
import { motion } from 'framer-motion'
import { Bot, User, Copy, Check } from 'lucide-react'

function formatTime() {
  return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

function splitContent(text) {
  const parts = []
  const lines = text.split('\n')
  let inList = false
  let listItems = []

  for (const line of lines) {
    if (/^[-*]\s/.test(line)) {
      inList = true
      listItems.push(line.replace(/^[-*]\s/, ''))
    } else {
      if (inList) {
        parts.push({ type: 'list', items: [...listItems] })
        listItems = []
        inList = false
      }
      if (line.trim() === '') {
        parts.push({ type: 'break' })
      } else {
        parts.push({ type: 'text', content: line })
      }
    }
  }

  if (inList) {
    parts.push({ type: 'list', items: [...listItems] })
  }

  return parts
}

export default function ChatMessage({ role, content }) {
  const [copied, setCopied] = useState(false)
  const isUser = role === 'user'

  const handleCopy = () => {
    navigator.clipboard.writeText(content)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className={`flex gap-3 ${isUser ? 'flex-row-reverse' : ''}`}
    >
      <div
        className="flex-shrink-0 w-8 h-8 rounded-xl flex items-center justify-center"
        style={{
          background: isUser ? 'var(--color-accent)' : 'var(--color-bg-alt)',
          color: isUser ? '#fff' : 'var(--color-text-muted)',
        }}
      >
        {isUser ? <User size={14} /> : <Bot size={14} />}
      </div>

      <div className={`flex flex-col max-w-[80%] group ${isUser ? 'items-end' : 'items-start'}`}>
        <div
          className="px-4 py-2.5 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap break-words"
          style={{
            background: isUser ? 'var(--color-accent)' : 'var(--color-bg-alt)',
            color: isUser ? '#fff' : 'var(--color-text)',
            borderRadius: isUser ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
          }}
        >
          {splitContent(content).map((part, i) => {
            if (part.type === 'break') return <br key={i} />
            if (part.type === 'list') {
              return (
                <ul key={i} className="list-disc list-inside space-y-1 my-1">
                  {part.items.map((item, j) => (
                    <li key={j}>{item}</li>
                  ))}
                </ul>
              )
            }
            return <p key={i}>{part.content}</p>
          })}
        </div>

        <div className="flex items-center gap-2 mt-1 px-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <span className="text-[10px]" style={{ color: 'var(--color-text-muted)' }}>{formatTime()}</span>
          {!isUser && (
            <button
              onClick={handleCopy}
              className="p-0.5 rounded hover:opacity-70 transition-opacity"
              style={{ color: 'var(--color-text-muted)' }}
              title="Copy"
            >
              {copied ? <Check size={10} /> : <Copy size={10} />}
            </button>
          )}
        </div>
      </div>
    </motion.div>
  )
}
