import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";

export default function ChatbotButton({ open, onClick }) {
  return (
    <div className="fixed bottom-6 right-6 z-[99]">
      <AnimatePresence>
        {!open && (
          <motion.button
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.95 }}
            onClick={onClick}
            className="flex items-center justify-center cursor-pointer bg-transparent border-none p-0"
            title="Open AI Assistant"
          >
            <img
              src="/images/ai/pfp.png"
              alt="AI"
              className="w-16 h-16 md:w-20 md:h-20 object-contain drop-shadow-lg"
            />
          </motion.button>
        )}
      </AnimatePresence>

      {open && (
        <motion.button
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          className="w-8 h-8 md:w-10 md:h-10 rounded-xl shadow-md flex items-center justify-center cursor-pointer"
          style={{
            background: "var(--color-bg-alt)",
            color: "var(--color-text-muted)",
          }}
          onClick={onClick}
        >
          <X size={14} />
        </motion.button>
      )}
    </div>
  );
}
