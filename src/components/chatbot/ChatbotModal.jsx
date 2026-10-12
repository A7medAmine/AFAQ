import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Send, Trash2, RefreshCw, StopCircle } from "lucide-react";
import ChatMessage from "./ChatMessage";
import SuggestedQuestions from "./SuggestedQuestions";
import AfaqMascot from "./AfaqMascot";
import { useCursorGaze } from "./useCursorGaze";
import { triggerHaptic } from "./haptics";

const STORAGE_KEY = "afaq-chat-history";
const MAX_HISTORY = 50;

function loadHistory() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved) : [];
  } catch {
    return [];
  }
}

function saveHistory(messages) {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(messages.slice(-MAX_HISTORY))
    );
  } catch {
    /* ignore */
  }
}

// Pass `streaming` prop to ChatMessage so it can show the blinking cursor
// inside the bubble when content is actively streaming.

export default function ChatbotModal({ open, onClose }) {
  const [messages, setMessages] = useState(loadHistory);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [streamingId, setStreamingId] = useState(null);
  const [inputFocused, setInputFocused] = useState(false);
  const [emptyHovered, setEmptyHovered] = useState(false);
  const [emptyAngry, setEmptyAngry] = useState(false);
  const [emptyCheer, setEmptyCheer] = useState(false);
  const emptyHoverCount = useRef(0);
  const emptyAngryTimer = useRef(0);
  const emptyCheerTimer = useRef(0);
  const touchStartY = useRef(0);
  const [greeting, setGreeting] = useState(false);
  const listRef = useRef(null);
  const inputRef = useRef(null);
  const abortRef = useRef(null);
  const emptyRef = useRef(null);

  const lang = document.documentElement.lang || "en";

  // Idle empty-state mascot tracks the cursor via expression; active states
  // (hover/typing/greeting) use animations instead.
  const gaze = useCursorGaze(emptyRef, open && messages.length === 0);

  const getEmptyMascotProps = () => {
    if (emptyAngry) return { expression: "angry-brows" };
    if (emptyCheer) return { animation: "celebrate" };
    if (emptyHovered) return { animation: "playful" };
    if (input.trim().length > 0 || inputFocused) return { animation: "listening" };
    if (greeting) return { animation: "happy" };
    return { expression: gaze };
  };

  const handleEmptyTap = () => {
    setEmptyCheer(true);
    triggerHaptic("success");
    clearTimeout(emptyCheerTimer.current);
    emptyCheerTimer.current = setTimeout(() => setEmptyCheer(false), 2400);
  };

  // Pester it more than 3 times and it holds an angry stare, then cools down.
  const triggerEmptyAngry = () => {
    setEmptyAngry(true);
    emptyHoverCount.current = 0;
    triggerHaptic("heavy");
    clearTimeout(emptyAngryTimer.current);
    emptyAngryTimer.current = setTimeout(() => setEmptyAngry(false), 3000);
  };

  useEffect(() => () => {
    clearTimeout(emptyAngryTimer.current);
    clearTimeout(emptyCheerTimer.current);
  }, []);

  const handleTouchStart = (e) => {
    touchStartY.current = e.touches[0].clientY;
  };

  const handleTouchEnd = (e) => {
    const touchEndY = e.changedTouches[0].clientY;
    if (touchEndY - touchStartY.current > 70) {
      triggerHaptic("medium");
      onClose();
    }
  };

  useEffect(() => {
    if (open) {
      if (inputRef.current) {
        setTimeout(() => inputRef.current?.focus(), 100);
      }
      // Warm greeting wiggle when the panel opens, then settle to idle.
      setGreeting(true);
      const t = setTimeout(() => setGreeting(false), 2600);
      return () => clearTimeout(t);
    }
    setGreeting(false);
  }, [open]);

  const scrollToBottom = useCallback(() => {
    const el = listRef.current;
    if (!el) return;
    // Follow the stream only when the user is already near the bottom, so we
    // don't yank them back down while they scroll up to read.
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
    if (!nearBottom) return;
    requestAnimationFrame(() => {
      el.scrollTop = el.scrollHeight;
    });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading, scrollToBottom]);

  const clearHistory = () => {
    if (abortRef.current) abortRef.current.abort();
    triggerHaptic("medium");
    setMessages([]);
    saveHistory([]);
    setError(null);
    setStreamingId(null);
  };

  const stopStreaming = () => {
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
    triggerHaptic("medium");
    setLoading(false);
    setStreamingId(null);
  };

  const autoResize = (el) => {
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 120) + "px";
  };

  const sendMessage = useCallback(
    async (text) => {
      const msg = text || input.trim();
      if (!msg || loading) return;

      triggerHaptic("light");
      setInput("");
      if (inputRef.current) {
        inputRef.current.style.height = "auto";
      }
      setError(null);

      const userMessage = { role: "user", content: msg, id: Date.now() };
      const updated = [...messages, userMessage];
      setMessages(updated);
      saveHistory(updated);
      setLoading(true);

      const botId = Date.now() + 1;
      const botMessage = { role: "assistant", content: "", id: botId };
      setMessages((prev) => [...prev, botMessage]);

      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const res = await fetch("/api/ai/chat/stream", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: msg,
            // Earlier turns let the assistant follow up ("when is it?").
            history: messages
              .filter((m) => m.content && m.content !== "…")
              .slice(-8)
              .map(({ role, content }) => ({ role, content })),
          }),
          signal: controller.signal,
        });

        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || `Server error (${res.status})`);
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let streamError = null;

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            const payload = line.slice(6).trim();
            if (payload === "[DONE]") continue;

            try {
              const parsed = JSON.parse(payload);
              if (parsed.error) {
                streamError = parsed.error;
                break;
              }
              if (parsed.text) {
                setStreamingId((prev) => prev || botId);
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === botId
                      ? { ...m, content: m.content + parsed.text }
                      : m
                  )
                );
              }
            } catch {
              /* skip malformed */
            }
          }
          if (streamError) break;
        }

        if (streamError) throw new Error(streamError);

        setMessages((prev) => {
          const bot = prev.find((m) => m.id === botId);
          if (bot && !bot.content) return prev.filter((m) => m.id !== botId);
          saveHistory(prev);
          return prev;
        });
      } catch (err) {
        if (err.name === "AbortError") {
          setMessages((prev) => {
            const aborted = prev.map((m) =>
              m.id === botId && !m.content ? { ...m, content: "…" } : m
            );
            saveHistory(aborted);
            return aborted;
          });
        } else {
          setError(err.message);
          setMessages((prev) =>
            prev.filter((m) => m.id !== botId || m.content)
          );
        }
      } finally {
        setLoading(false);
        setStreamingId(null);
        abortRef.current = null;
      }
    },
    [input, loading, messages]
  );

  const retry = () => {
    if (error) {
      const lastUser = [...messages].reverse().find((m) => m.role === "user");
      if (lastUser) {
        setMessages((prev) => prev.slice(0, -1));
        sendMessage(lastUser.content);
      }
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black/30 md:bg-transparent md:pointer-events-none"
            onClick={onClose}
          />

          {/* Chat window */}
          <motion.div
            initial={{ opacity: 0, scale: 0.93, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.93, y: 16 }}
            transition={{ type: "spring", stiffness: 380, damping: 30 }}
            className="fixed z-[101] bottom-0 right-0 md:bottom-24 md:right-6 w-full md:w-96 h-[85dvh] max-h-[92dvh] md:max-h-[calc(100dvh-8rem)] md:h-[600px] flex flex-col rounded-t-2xl md:rounded-2xl overflow-hidden shadow-2xl border"
            style={{
              background: "var(--color-card)",
              borderColor: "var(--color-border-light)",
            }}
          >
            {/* Mobile pull-down drag indicator */}
            <div
              onTouchStart={handleTouchStart}
              onTouchEnd={handleTouchEnd}
              className="w-full pt-2 pb-1 flex justify-center items-center md:hidden cursor-grab active:cursor-grabbing select-none"
              style={{ background: "var(--color-card)" }}
            >
              <div
                className="w-10 h-1.5 rounded-full"
                style={{ background: "var(--color-border)" }}
              />
            </div>

            {/* ── Header ── */}
            <div
              onTouchStart={handleTouchStart}
              onTouchEnd={handleTouchEnd}
              className="flex items-center justify-between px-3 md:px-4 py-3 border-b flex-shrink-0 select-none"
              style={{
                borderColor: "var(--color-border-light)",
                background: "var(--color-card)",
              }}
            >
              <div className="flex items-center gap-2.5 select-none">
                <div
                  className="w-9 h-9 md:w-10 md:h-10 rounded-xl overflow-hidden flex-shrink-0 border"
                  style={{ borderColor: "var(--color-border-light)" }}
                >
                  <img
                    src="/cloudee-snapshot.png"
                    alt="AFAQ Assistant"
                    className="w-full h-full object-cover"
                    draggable={false}
                  />
                </div>
                <div>
                  <span
                    className="text-sm font-semibold block"
                    style={{ color: "var(--color-text)" }}
                  >
                    AFAQ Assistant
                  </span>
                  <span className="flex items-center gap-1.5">
                    {/* Pulsing status dot */}
                    <span
                      className="inline-block w-1.5 h-1.5 rounded-full"
                      style={{
                        background: loading ? "var(--color-accent)" : "#22c55e",
                        animation: "status-pulse 2s ease-in-out infinite",
                      }}
                    />
                    <span
                      className="text-[10px]"
                      style={{ color: "var(--color-text-muted)" }}
                    >
                      {loading
                        ? lang === "ar"
                          ? "يكتب…"
                          : lang === "fr"
                          ? "En train d'écrire…"
                          : "Typing…"
                        : lang === "ar"
                        ? "متصل"
                        : lang === "fr"
                        ? "En ligne"
                        : "Online"}
                    </span>
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-1">
                {messages.length > 0 && (
                  <button
                    onClick={clearHistory}
                    className="p-2 rounded-xl hover:opacity-70 transition-opacity cursor-pointer"
                    style={{ color: "var(--color-text-muted)" }}
                    title={
                      lang === "ar"
                        ? "مسح"
                        : lang === "fr"
                        ? "Effacer"
                        : "Clear"
                    }
                  >
                    <Trash2 size={14} />
                  </button>
                )}
                <button
                  onClick={() => {
                    triggerHaptic("light");
                    onClose();
                  }}
                  className="p-2 rounded-xl hover:opacity-70 transition-opacity cursor-pointer"
                  style={{ color: "var(--color-text-muted)" }}
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            {/* ── Messages ── */}
            <div
              ref={listRef}
              data-lenis-prevent
              className="flex-1 overflow-y-auto overscroll-contain px-3 md:px-4 py-3 md:py-4 space-y-3 md:space-y-4 scroll-smooth"
              style={{ background: "var(--color-bg)", overscrollBehavior: "contain" }}
            >
              {/* Empty state */}
              {messages.length === 0 && (
                <div className="flex flex-col items-center justify-center h-full text-center px-6 gap-3">
                  <div
                    ref={emptyRef}
                    className="w-20 h-20 md:w-24 md:h-24 flex items-center justify-center cursor-pointer transition-transform active:scale-95"
                    onClick={handleEmptyTap}
                    onMouseEnter={() => {
                      setEmptyHovered(true);
                      emptyHoverCount.current += 1;
                      if (emptyHoverCount.current > 3) triggerEmptyAngry();
                    }}
                    onMouseLeave={() => setEmptyHovered(false)}
                  >
                    <AfaqMascot size={86} {...getEmptyMascotProps()} />
                  </div>
                  <div>
                    <p
                      className="text-sm font-medium mb-1"
                      style={{ color: "var(--color-text)" }}
                    >
                      {lang === "ar"
                        ? "مرحباً! كيف يمكنني مساعدتك؟"
                        : lang === "fr"
                        ? "Bonjour ! Comment puis-je vous aider ?"
                        : "Hi! How can I help you?"}
                    </p>
                    <p
                      className="text-xs"
                      style={{ color: "var(--color-text-muted)" }}
                    >
                      {lang === "ar"
                        ? "اطرح سؤالاً عن النادي"
                        : lang === "fr"
                        ? "Posez une question sur le club"
                        : "Ask me anything about AFAQ Club"}
                    </p>
                  </div>
                </div>
              )}

              {/* Message list */}
              {messages.map((m) => (
                <motion.div
                  key={m.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
                >
                  <ChatMessage
                    role={m.role}
                    content={m.content}
                    streaming={m.id === streamingId}
                  />
                </motion.div>
              ))}

              {/* Typing indicator — only before first token arrives */}
              {loading && !streamingId && (
                <motion.div
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 6 }}
                  transition={{ duration: 0.18 }}
                  className="flex gap-3"
                >
                  <div
                    className="flex-shrink-0 w-9 h-9 rounded-xl flex items-center justify-center overflow-hidden"
                  >
                    <AfaqMascot
                      size={36}
                      animation="thinking"
                    />
                  </div>
                  <div className="flex flex-col items-start">
                    <div
                      className="flex items-center gap-[5px] px-3 py-2.5 rounded-2xl rounded-bl-sm"
                      style={{
                        background:
                          "var(--color-bg-alt, var(--color-border-light))",
                      }}
                    >
                      {[0, 1, 2].map((i) => (
                        <span
                          key={i}
                          style={{
                            display: "inline-block",
                            width: 7,
                            height: 7,
                            borderRadius: "50%",
                            background: "var(--color-text-muted)",
                            animation: `typing-bounce 1.2s ease-in-out ${
                              i * 0.15
                            }s infinite`,
                          }}
                        />
                      ))}
                    </div>
                  </div>
                </motion.div>
              )}

              {/* Error */}
              {error && (
                <motion.div
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex flex-col items-center gap-2 py-3 px-4 rounded-xl"
                  style={{ background: "#fef2f2" }}
                >
                  <p
                    className="text-xs text-center"
                    style={{ color: "#dc2626" }}
                  >
                    {error}
                  </p>
                  <button
                    onClick={retry}
                    className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg font-medium transition-all hover:opacity-80 active:scale-95"
                    style={{ background: "#dc2626", color: "#fff" }}
                  >
                    <RefreshCw size={11} /> Retry
                  </button>
                </motion.div>
              )}
            </div>

            {/* ── Suggested questions ── */}
            {messages.length === 0 && !loading && (
              <SuggestedQuestions
                onSelect={(q) => {
                  setInput(q);
                  setTimeout(() => sendMessage(q), 50);
                }}
                lang={lang}
              />
            )}

            {/* ── Input ── */}
            <div
              className="px-3 md:px-4 pt-3 border-t flex-shrink-0"
              style={{
                borderColor: "var(--color-border-light)",
                background: "var(--color-card)",
                // Clear the iPhone home indicator on the bottom sheet.
                paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))",
              }}
            >
              <div className="flex items-end gap-2">
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={(e) => {
                    setInput(e.target.value);
                    autoResize(e.target);
                  }}
                  onKeyDown={handleKeyDown}
                  onFocus={() => setInputFocused(true)}
                  onBlur={() => setInputFocused(false)}
                  rows={1}
                  placeholder={
                    lang === "ar"
                      ? "اكتب رسالتك…"
                      : lang === "fr"
                      ? "Tapez votre message…"
                      : "Type your message…"
                  }
                  className="flex-1 min-w-0 resize-none px-3 md:px-4 py-2 md:py-2.5 rounded-xl border text-base md:text-sm outline-none transition-colors"
                  style={{
                    background: "var(--color-bg)",
                    borderColor: inputFocused
                      ? "var(--color-accent)"
                      : "var(--color-border-light)",
                    color: "var(--color-text)",
                    maxHeight: 120,
                    boxShadow: inputFocused
                      ? "0 0 0 3px color-mix(in srgb, var(--color-accent) 12%, transparent)"
                      : "none",
                  }}
                  disabled={loading}
                />

                {loading && streamingId ? (
                  <motion.button
                    onClick={stopStreaming}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.93 }}
                    className="w-9 h-9 md:w-10 md:h-10 rounded-xl flex items-center justify-center flex-shrink-0 cursor-pointer"
                    style={{ background: "#dc2626", color: "#fff" }}
                    title="Stop"
                  >
                    <StopCircle size={16} />
                  </motion.button>
                ) : (
                  <motion.button
                    onClick={() => sendMessage()}
                    disabled={!input.trim() || loading}
                    whileHover={input.trim() && !loading ? { scale: 1.05 } : {}}
                    whileTap={input.trim() && !loading ? { scale: 0.93 } : {}}
                    className="w-9 h-9 md:w-10 md:h-10 rounded-xl flex items-center justify-center flex-shrink-0 cursor-pointer transition-colors"
                    style={{
                      background:
                        input.trim() && !loading
                          ? "var(--color-accent)"
                          : "var(--color-bg-alt, var(--color-border-light))",
                      color:
                        input.trim() && !loading
                          ? "#fff"
                          : "var(--color-text-muted)",
                    }}
                  >
                    <Send size={15} />
                  </motion.button>
                )}
              </div>
            </div>
          </motion.div>
        </>
      )}

      <style>{`
        @keyframes typing-bounce {
          0%, 60%, 100% { transform: translateY(0);   opacity: 0.4; }
          30%            { transform: translateY(-5px); opacity: 1;   }
        }
        @keyframes status-pulse {
          0%, 100% { opacity: 1;   transform: scale(1); }
          50%       { opacity: 0.5; transform: scale(0.75); }
        }
      `}</style>
    </AnimatePresence>
  );
}
