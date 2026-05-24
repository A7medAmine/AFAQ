import { motion, AnimatePresence } from 'framer-motion'
import { MessageCircle, X } from 'lucide-react'

export default function ChatbotButton({ open, onClick }) {
  return (
    <div className="fixed bottom-6 right-6 z-[99]">
      <AnimatePresence>
        {!open && (
          <motion.button
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={onClick}
            className="w-14 h-14 rounded-2xl shadow-lg flex items-center justify-center cursor-pointer"
            style={{ background: 'var(--color-accent)', color: '#fff' }}
            title="Open AI Assistant"
          >
            <MessageCircle size={24} />
          </motion.button>
        )}
      </AnimatePresence>

      {open && (
        <motion.button
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          className="w-10 h-10 rounded-xl shadow-md flex items-center justify-center cursor-pointer"
          style={{ background: 'var(--color-bg-alt)', color: 'var(--color-text-muted)' }}
          onClick={onClick}
        >
          <X size={16} />
        </motion.button>
      )}
    </div>
  )
}
