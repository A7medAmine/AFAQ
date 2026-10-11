import { useState, useMemo, memo } from "react";
import { motion } from "framer-motion";
import { User, Copy, Check } from "lucide-react";
import ReactMarkdown from "react-markdown";
import AfaqMascot from "./AfaqMascot";

function autoLink(text) {
  return text.replace(/\b(https?:\/\/[^\s<)>]+)/g, (match, offset, str) => {
    const before = str[offset - 1];
    if (before === "<" || before === "(" || before === "[") return match;
    return `<${match}>`;
  });
}

function formatTime() {
  return new Date().toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

// Defined once, not recreated per render — cheaper markdown parsing while streaming.
const markdownComponents = {
  p: ({ children }) => <p className="mb-1 last:mb-0">{children}</p>,
  ul: ({ children }) => (
    <ul className="list-disc list-inside space-y-0.5 my-1">{children}</ul>
  ),
  ol: ({ children }) => (
    <ol className="list-decimal list-inside space-y-0.5 my-1">{children}</ol>
  ),
  li: ({ children }) => <li>{children}</li>,
  strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
  em: ({ children }) => <em>{children}</em>,
  code: ({ children }) => (
    <code
      className="text-xs px-1 py-0.5 rounded"
      style={{ background: "var(--color-border-light)" }}
    >
      {children}
    </code>
  ),
  // Site pages (/events, /join…) open in place; external links in a new tab.
  a: ({ href = "", children }) => (
    <a
      href={href}
      {...(href.startsWith("/") && !href.startsWith("//")
        ? {}
        : { target: "_blank", rel: "noopener noreferrer" })}
      style={{ color: "var(--color-accent)", wordBreak: "break-all" }}
      className="underline hover:opacity-80"
    >
      {children}
    </a>
  ),
};

function ChatMessage({ role, content, streaming }) {
  const [copied, setCopied] = useState(false);
  const [avatarHovered, setAvatarHovered] = useState(false);
  const [time] = useState(formatTime);
  const isUser = role === "user";

  const linked = useMemo(
    () => (isUser ? content : autoLink(content || "")),
    [content, isUser]
  );

  if (!isUser && !content && !streaming) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Only the live/interacted avatar runs an animation timeline; resting bot
  // avatars render a single static expression (no rAF loop) to avoid lag when
  // the conversation grows long.
  const botMascotProps = streaming
    ? { animation: "excited" }
    : copied
    ? { animation: "celebrate" }
    : avatarHovered
    ? { animation: "playful" }
    : { expression: "small-attentive" };

  return (
    <motion.div
      initial={streaming ? {} : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className={`flex gap-3 ${isUser ? "flex-row-reverse" : ""}`}
    >
      <div
        className="flex-shrink-0 w-9 h-9 rounded-xl flex items-center justify-center cursor-pointer"
        onMouseEnter={() => setAvatarHovered(true)}
        onMouseLeave={() => setAvatarHovered(false)}
        style={{
          background: isUser ? "var(--color-accent)" : "transparent",
          color: isUser ? "#fff" : "var(--color-text-muted)",
        }}
      >
        {isUser ? <User size={14} /> : <AfaqMascot size={34} {...botMascotProps} />}
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
            <ReactMarkdown components={markdownComponents}>{linked}</ReactMarkdown>
          )}
          {streaming && (
            <span
              style={{
                display: "inline-block",
                width: 2,
                height: "0.9em",
                background: "currentColor",
                borderRadius: 1,
                marginLeft: 2,
                verticalAlign: "middle",
                opacity: 0.7,
                animation: "cursor-blink 0.8s step-end infinite",
              }}
            />
          )}
        </div>

        {!streaming && (
          <div className="flex items-center gap-2 mt-1 px-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <span className="text-[10px]" style={{ color: "var(--color-text-muted)" }}>
              {time}
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

// Re-render only when the message's own data changes — keeps old messages (and
// their avatars) frozen while a new token streams into the latest bubble.
export default memo(
  ChatMessage,
  (a, b) =>
    a.role === b.role && a.content === b.content && a.streaming === b.streaming
);
