import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Send, Trash2, RefreshCw, StopCircle } from "lucide-react";
import ChatMessage from "./ChatMessage";
import SuggestedQuestions from "./SuggestedQuestions";

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
    localStorage.setItem(STORAGE_KEY, JSON.stringify(messages.slice(-MAX_HISTORY)));
  } catch { /* ignore */ }
}

export default function ChatbotModal({ open, onClose }) {
  const [messages, setMessages] = useState(loadHistory);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [streamingId, setStreamingId] = useState(null);
  const listRef = useRef(null);
  const inputRef = useRef(null);
  const abortRef = useRef(null);

  const lang = document.documentElement.lang || "en";

  useEffect(() => {
    if (open && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open]);

  const scrollToBottom = useCallback(() => {
    if (listRef.current) {
      requestAnimationFrame(() => {
        listRef.current.scrollTop = listRef.current.scrollHeight;
      });
    }
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading, scrollToBottom]);

  const clearHistory = () => {
    if (abortRef.current) abortRef.current.abort();
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

      setInput("");
      setError(null);

      const userMessage = { role: "user", content: msg, id: Date.now() };
      const updated = [...messages, userMessage];
      setMessages(updated);
      saveHistory(updated);
      setLoading(true);

      const botId = Date.now() + 1;
      const botMessage = { role: "assistant", content: "", id: botId };
      setMessages((prev) => [...prev, botMessage]);
      setStreamingId(botId);

      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const res = await fetch("/api/ai/chat/stream", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: msg }),
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
              if (parsed.error) { streamError = parsed.error; break; }
              if (parsed.text) {
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === botId ? { ...m, content: m.content + parsed.text } : m
                  )
                );
              }
            } catch { /* skip malformed */ }
          }
          if (streamError) break;
        }

        if (streamError) throw new Error(streamError);

        setMessages((prev) => {
          const bot = prev.find(m => m.id === botId);
          if (bot && !bot.content) {
            return prev.filter(m => m.id !== botId);
          }
          saveHistory(prev);
          return prev;
        });
      } catch (err) {
        if (err.name === "AbortError") {
          setMessages((prev) => {
            const aborted = prev.map((m) =>
              m.id === botId && !m.content ? { ...m, content: "..." } : m
            );
            saveHistory(aborted);
            return aborted;
          });
        } else {
          setError(err.message);
          setMessages((prev) => prev.filter((m) => m.id !== botId || m.content));
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
            className="fixed z-[101] bottom-0 right-0 md:bottom-24 md:right-6 w-full md:w-96 max-h-[85dvh] md:max-h-[600px] md:h-[600px] flex flex-col rounded-t-2xl md:rounded-2xl overflow-hidden shadow-2xl border"
            style={{
              background: "var(--color-card)",
              borderColor: "var(--color-border-light)",
            }}
          >
            {/* Header */}
            <div
              className="flex items-center justify-between px-3 md:px-4 py-3 border-b flex-shrink-0"
              style={{ borderColor: "var(--color-border-light)", background: "var(--color-card)" }}
            >
              <div className="flex items-center gap-2.5">
                <div
                  className="w-9 h-9 md:w-10 md:h-10 rounded-xl flex items-center justify-center overflow-hidden"
                  style={{ background: "var(--color-accent)" }}
                >
                  <img
                    src="/images/ai/pfp.png"
                    alt="AI"
                    className="w-full h-full object-cover"
                  />
                </div>
                <div>
                  <span
                    className="text-sm font-semibold"
                    style={{ color: "var(--color-text)" }}
                  >
                    AFAQ Assistant
                  </span>
                  <p
                    className="text-[10px]"
                    style={{ color: "var(--color-text-muted)" }}
                  >
                    {lang === "ar"
                      ? "مدعوم بالذكاء الاصطناعي"
                      : lang === "fr"
                      ? "Alimenté par l'IA"
                      : "AI-powered"}
                  </p>
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
                        ? "مسح المحادثة"
                        : lang === "fr"
                        ? "Effacer la conversation"
                        : "Clear conversation"
                    }
                  >
                    <Trash2 size={14} />
                  </button>
                )}
                <button
                  onClick={onClose}
                  className="p-2 rounded-xl hover:opacity-70 transition-opacity cursor-pointer"
                  style={{ color: "var(--color-text-muted)" }}
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            {/* Messages */}
            <div
              ref={listRef}
              className="flex-1 overflow-y-auto px-3 md:px-4 py-3 md:py-4 space-y-3 md:space-y-4 scroll-smooth"
              style={{ background: "var(--color-bg)" }}
            >
              {messages.length === 0 && (
                <div className="flex flex-col items-center justify-center h-full text-center px-6">
                  <div
                    className="w-12 h-12 md:w-14 md:h-14 rounded-2xl flex items-center justify-center mb-3 overflow-hidden"
                    style={{ background: "var(--color-accent-soft)" }}
                  >
                    <img
                      src="/images/ai/pfp.png"
                      alt="AI"
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <p
                    className="text-sm font-medium mb-1"
                    style={{ color: "var(--color-text)" }}
                  >
                    {lang === "ar"
                      ? "مرحباً! كيف يمكنني مساعدتك؟"
                      : lang === "fr"
                      ? "Bonjour! Comment puis-je vous aider?"
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
              )}

              {messages.map((m) => (
                <ChatMessage
                  key={m.id}
                  role={m.role}
                  content={m.content}
                  streaming={m.id === streamingId}
                />
              ))}

              {loading && !streamingId && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex items-center gap-2 px-1"
                >
                  <div className="flex gap-1">
                    <span
                      className="w-1.5 h-1.5 rounded-full animate-bounce"
                      style={{ background: "var(--color-text-muted)", animationDelay: "0ms" }}
                    />
                    <span
                      className="w-1.5 h-1.5 rounded-full animate-bounce"
                      style={{ background: "var(--color-text-muted)", animationDelay: "150ms" }}
                    />
                    <span
                      className="w-1.5 h-1.5 rounded-full animate-bounce"
                      style={{ background: "var(--color-text-muted)", animationDelay: "300ms" }}
                    />
                  </div>
                </motion.div>
              )}

              {error && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex flex-col items-center gap-2 py-3 px-4 rounded-xl"
                  style={{ background: "#fef2f2" }}
                >
                  <p className="text-xs text-center" style={{ color: "#dc2626" }}>
                    {error}
                  </p>
                  <button
                    onClick={retry}
                    className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg font-medium transition-all hover:opacity-80"
                    style={{ background: "#dc2626", color: "#fff" }}
                  >
                    <RefreshCw size={12} /> Retry
                  </button>
                </motion.div>
              )}
            </div>

            {/* Suggested */}
            {messages.length === 0 && !loading && (
              <SuggestedQuestions
                onSelect={(q) => {
                  setInput(q);
                  setTimeout(() => sendMessage(q), 50);
                }}
                lang={lang}
              />
            )}

            {/* Input */}
            <div
              className="px-3 md:px-4 py-3 border-t flex-shrink-0"
              style={{ borderColor: "var(--color-border-light)", background: "var(--color-card)" }}
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
                  rows={1}
                  placeholder={
                    lang === "ar"
                      ? "اكتب رسالتك..."
                      : lang === "fr"
                      ? "Tapez votre message..."
                      : "Type your message..."
                  }
                  className="flex-1 resize-none px-3 md:px-4 py-2.5 rounded-xl border text-sm outline-none"
                  style={{
                    background: "var(--color-bg)",
                    borderColor: "var(--color-border-light)",
                    color: "var(--color-text)",
                    maxHeight: 120,
                  }}
                  disabled={loading}
                />
                {loading && streamingId ? (
                  <button
                    onClick={stopStreaming}
                    className="w-9 h-9 md:w-10 md:h-10 rounded-xl flex items-center justify-center flex-shrink-0 cursor-pointer"
                    style={{ background: "#dc2626", color: "#fff" }}
                    title="Stop"
                  >
                    <StopCircle size={16} />
                  </button>
                ) : (
                  <button
                    onClick={() => sendMessage()}
                    disabled={!input.trim() || loading}
                    className="w-9 h-9 md:w-10 md:h-10 rounded-xl flex items-center justify-center flex-shrink-0 transition-opacity cursor-pointer"
                    style={{
                      background:
                        input.trim() && !loading
                          ? "var(--color-accent)"
                          : "var(--color-bg-alt)",
                      color:
                        input.trim() && !loading
                          ? "#fff"
                          : "var(--color-text-muted)",
                    }}
                  >
                    <Send size={16} />
                  </button>
                )}
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
