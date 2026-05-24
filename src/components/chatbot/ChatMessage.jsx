import { useState } from "react";
import { motion } from "framer-motion";
import { User, Copy, Check } from "lucide-react";
import ReactMarkdown from "react-markdown";

function autoLink(text) {
  return text.replace(/\b(https?:\/\/[^\s<)>]+)/g, (match, offset, str) => {
    const before = str[offset - 1]
    if (before === '<' || before === '(' || before === '[') return match
    return `<${match}>`
  })
}

function formatTime() {
  return new Date().toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function ChatMessage({ role, content, streaming }) {
  const [copied, setCopied] = useState(false);
  const isUser = role === "user";

  const handleCopy = () => {
    navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <motion.div
      initial={streaming ? {} : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className={`flex gap-3 ${isUser ? "flex-row-reverse" : ""}`}
    >
      <div
        className="flex-shrink-0 w-9 h-9 rounded-xl flex items-center justify-center overflow-hidden"
        style={{
          background: isUser ? "var(--color-accent)" : "var(--color-bg-alt)",
          color: isUser ? "#fff" : "var(--color-text-muted)",
        }}
      >
        {isUser ? (
          <User size={14} />
        ) : (
          <img
            src="/images/ai/pfp.png"
            alt="AI"
            className="w-full h-full object-cover"
          />
        )}
      </div>

      <div
        className={`flex flex-col max-w-[85%] md:max-w-[80%] group ${
          isUser ? "items-end" : "items-start"
        }`}
      >
        <div
          className="px-4 py-2.5 rounded-2xl text-sm leading-relaxed prose prose-sm max-w-none"
          style={{
            background: isUser ? "var(--color-accent)" : "var(--color-bg-alt)",
            color: isUser ? "#fff" : "var(--color-text)",
            borderRadius: isUser ? "16px 16px 4px 16px" : "16px 16px 16px 4px",
            wordBreak: "break-word",
            overflowWrap: "break-word",
            hyphens: "auto",
          }}
        >
          {isUser ? (
            content
          ) : (
            <ReactMarkdown
              components={{
                p: ({ children }) => (
                  <p className="mb-1 last:mb-0">{children}</p>
                ),
                ul: ({ children }) => (
                  <ul className="list-disc list-inside space-y-0.5 my-1">
                    {children}
                  </ul>
                ),
                ol: ({ children }) => (
                  <ol className="list-decimal list-inside space-y-0.5 my-1">
                    {children}
                  </ol>
                ),
                li: ({ children }) => <li>{children}</li>,
                strong: ({ children }) => (
                  <strong className="font-semibold">{children}</strong>
                ),
                em: ({ children }) => <em>{children}</em>,
                code: ({ children }) => (
                  <code
                    className="text-xs px-1 py-0.5 rounded"
                    style={{ background: "var(--color-border-light)" }}
                  >
                    {children}
                  </code>
                ),
                a: ({ href, children }) => (
                  <a
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ color: "var(--color-accent)", wordBreak: "break-all" }}
                    className="underline hover:opacity-80"
                  >
                    {children}
                  </a>
                ),
              }}
            >
              {autoLink(content) || (streaming ? "" : "...")}
            </ReactMarkdown>
          )}
          {streaming && (
            <span
              className="inline-block w-1.5 h-4 ml-0.5 animate-pulse rounded-sm"
              style={{ background: "var(--color-text-muted)" }}
            />
          )}
        </div>

        {!streaming && (
          <div className="flex items-center gap-2 mt-1 px-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <span
              className="text-[10px]"
              style={{ color: "var(--color-text-muted)" }}
            >
              {formatTime()}
            </span>
            {!isUser && (
              <button
                onClick={handleCopy}
                className="p-0.5 rounded hover:opacity-70 transition-opacity"
                style={{ color: "var(--color-text-muted)" }}
                title="Copy"
              >
                {copied ? <Check size={10} /> : <Copy size={10} />}
              </button>
            )}
          </div>
        )}
      </div>
    </motion.div>
  );
}
