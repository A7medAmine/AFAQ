import { useState, useMemo, memo } from "react";
import { motion } from "framer-motion";
import { User, Copy, Check } from "lucide-react";
import ReactMarkdown from "react-markdown";
import AfaqMascot from "./AfaqMascot";

// Profile URL for a bare @handle, keyed by the platform named on the same line.
const HANDLE_URLS = {
  instagram: (h) => `https://www.instagram.com/${h}/`,
  tiktok: (h) => `https://www.tiktok.com/@${h}`,
  youtube: (h) => `https://www.youtube.com/@${h}`,
  github: (h) => `https://github.com/${h}`,
  twitter: (h) => `https://x.com/${h}`,
};

// Existing Markdown links, <autolinks> and `code` are left as they are.
const PROTECTED = /(\[[^\]]*\]\([^)]*\)|<[^>\s]+>|`[^`]*`)/;
const URL_RE = /\bhttps?:\/\/[^\s<>()]+[^\s<>().,;:!?]/g;
const EMAIL_RE = /\b[\w.+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}\b/g;
const HANDLE_RE = /(^|[\s(:])@([A-Za-z0-9_.]*[A-Za-z0-9_])/g;
// Public site pages the assistant points to, written bare like "/join".
const PAGE_RE = /(^|[\s(:«"'])(\/(?:events|projects|join|contact|about|gallery|announcements|links|register)(?:\/[\w-]+)*)(?=$|[\s).,;:!?»"'])/g;
const PLATFORM_RE = {
  instagram: /instagram/i,
  tiktok: /tik\s?tok/i,
  youtube: /youtube/i,
  github: /github/i,
  twitter: /twitter|\bx\b/i,
};

function linkHandles(line) {
  const platforms = Object.keys(HANDLE_URLS).filter((p) => PLATFORM_RE[p].test(line));
  // Only link when the line names exactly one platform, so a handle is never
  // pointed at the wrong site.
  if (platforms.length !== 1) return line;
  const toUrl = HANDLE_URLS[platforms[0]];
  return line.replace(HANDLE_RE, (_, lead, h) => `${lead}[@${h}](${toUrl(h)})`);
}

// The assistant is told to send Markdown links, but some replies still carry a
// bare URL, email, @handle or site path; make those clickable too.
function autoLink(text) {
  return text
    .split(PROTECTED)
    .map((part, i) => {
      if (i % 2) return part;
      return part
        .replace(URL_RE, (url) => `<${url}>`)
        .replace(EMAIL_RE, (email) => `[${email}](mailto:${email})`)
        .replace(PAGE_RE, (_, lead, path) => `${lead}[${path}](${path})`)
        .split("\n")
        .map(linkHandles)
        .join("\n");
    })
    .join("");
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
    <ul className="list-disc ps-4 space-y-0.5 my-1">{children}</ul>
  ),
  ol: ({ children }) => (
    <ol className="list-decimal ps-4 space-y-0.5 my-1">{children}</ol>
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
      style={{ color: "var(--color-accent)", overflowWrap: "anywhere" }}
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
      className={`flex gap-2 md:gap-3 ${isUser ? "flex-row-reverse" : ""}`}
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
        className={`flex flex-col min-w-0 max-w-[calc(100%-2.75rem)] md:max-w-[80%] group ${
          isUser ? "items-end" : "items-start"
        }`}
      >
        <div
          className="px-3 md:px-4 py-2.5 rounded-2xl text-sm leading-relaxed prose prose-sm max-w-none"
          style={{
            background: isUser ? "var(--color-accent)" : "var(--color-bg-alt)",
            color: isUser ? "#fff" : "var(--color-text)",
            borderRadius: isUser ? "16px 16px 4px 16px" : "16px 16px 16px 4px",
            overflowWrap: "anywhere",
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
