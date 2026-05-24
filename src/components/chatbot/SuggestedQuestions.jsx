import { motion } from 'framer-motion'
import { Sparkles } from 'lucide-react'

const suggestions = [
  { en: 'What events are coming up?', ar: 'ما هي الفعاليات القادمة؟', fr: 'Quels sont les événements à venir?' },
  { en: 'Tell me about the club', ar: 'أخبرني عن النادي', fr: 'Parle-moi du club' },
  { en: 'How can I join?', ar: 'كيف يمكنني الانضمام؟', fr: 'Comment puis-je rejoindre?' },
  { en: 'What projects do you have?', ar: 'ما هي المشاريع التي لديكم؟', fr: 'Quels projets avez-vous?' },
  { en: 'What is our mission?', ar: 'ما هي مهمتنا؟', fr: 'Quelle est notre mission?' },
  { en: 'How do I register for an event?', ar: 'كيف أسجل في الفعالية؟', fr: 'Comment m\'inscrire à un événement?' },
]

export default function SuggestedQuestions({ onSelect, lang }) {
  return (
    <div className="px-3 md:px-4 py-2 md:py-3 border-t" style={{ borderColor: 'var(--color-border-light)' }}>
      <div className="flex items-center gap-1.5 mb-2">
        <Sparkles size={12} style={{ color: 'var(--color-accent)' }} />
        <span className="text-xs font-medium" style={{ color: 'var(--color-text-muted)' }}>
          {lang === 'ar' ? 'أسئلة مقترحة' : lang === 'fr' ? 'Questions suggérées' : 'Suggested questions'}
        </span>
      </div>
      <div className="flex flex-wrap gap-2">
        {suggestions.map((s, i) => (
          <motion.button
            key={i}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: i * 0.05 }}
            onClick={() => onSelect(s[lang] || s.en)}
            className="text-xs px-3 py-1.5 rounded-xl border transition-colors hover:opacity-80 cursor-pointer"
            style={{
              borderColor: 'var(--color-border-light)',
              background: 'var(--color-card)',
              color: 'var(--color-text-muted)',
            }}
          >
            {s[lang] || s.en}
          </motion.button>
        ))}
      </div>
    </div>
  )
}
