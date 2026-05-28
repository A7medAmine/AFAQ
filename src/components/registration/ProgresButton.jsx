// Progres MESRS auto-fill integration
import { useState, useEffect, useRef, useCallback } from "react";
import { useTranslation, Trans } from "react-i18next";
import useProgresAuth from "../../hooks/useProgresAuth";

const inputStyle = (focused) => ({
  width: "100%",
  padding: "12px 16px",
  fontSize: 14,
  borderRadius: 100,
  border: `1.5px solid ${
    focused ? "var(--color-accent)" : "var(--color-border-light)"
  }`,
  background: "var(--color-bg)",
  color: "var(--color-text)",
  outline: "none",
  boxSizing: "border-box",
  boxShadow: focused ? "0 0 0 3px rgba(36,96,231,0.15)" : "none",
  transition: "border-color 0.15s, box-shadow 0.15s",
});

export default function ProgresButton({ onSuccess }) {
  const { t } = useTranslation("common");
  const [modalOpen, setModalOpen] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [focusedField, setFocusedField] = useState(null); // 'username' | 'password' | null
  const { login, loading, error, reset } = useProgresAuth();
  const modalRef = useRef(null);
  const firstInputRef = useRef(null);
  const lastInputRef = useRef(null);

  const open = useCallback(() => {
    setModalOpen(true);
    setUsername("");
    setPassword("");
    setFocusedField(null);
    reset();
  }, [reset]);

  const close = useCallback(() => {
    setModalOpen(false);
    setFocusedField(null);
    reset();
  }, [reset]);

  useEffect(() => {
    if (!modalOpen) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        e.preventDefault();
        close();
        return;
      }
      if (e.key === "Tab") {
        const focusable = modalRef.current?.querySelectorAll(
          'button, input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        if (!focusable || focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey) {
          if (document.activeElement === first) {
            e.preventDefault();
            last.focus();
          }
        } else {
          if (document.activeElement === last) {
            e.preventDefault();
            first.focus();
          }
        }
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    const timer = setTimeout(() => firstInputRef.current?.focus(), 50);
    return () => {
      document.body.style.overflow = prevOverflow;
      document.removeEventListener("keydown", handleKeyDown);
      clearTimeout(timer);
    };
  }, [modalOpen, close]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const data = await login(username, password);
      onSuccess?.(data);
      close();
    } catch {
      /* error handled by hook state */
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={open}
        className="inline-flex items-center gap-2 px-5 py-2.5 rounded-[100px] font-semibold text-sm"
        style={{ background: "var(--color-accent)", color: "#fff" }}
      >
        <img src="/images/logo/progres.png" alt="" className="w-5 h-5 rounded-full" />
        {t("progres.button")}
      </button>

      {modalOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 9999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "rgba(0,0,0,0.5)",
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) close();
          }}
        >
          <div
            ref={modalRef}
            role="dialog"
            aria-modal="true"
            aria-label="Sign in with Progres"
            className="card-pro"
            style={{
              width: "100%",
              maxWidth: 420,
              margin: 16,
              padding: 32,
              position: "relative",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={close}
              style={{
                position: "absolute",
                top: 12,
                right: 16,
                background: "none",
                border: "none",
                fontSize: 22,
                cursor: "pointer",
                color: "var(--color-text-muted)",
                lineHeight: 1,
                padding: "4px 8px",
                borderRadius: 6,
              }}
              aria-label="Close"
            >
              ×
            </button>

            <h2 style={{ margin: "0 0 4px", fontSize: 18, fontWeight: 700 }}>
              {t("progres.title")}
            </h2>
            <p
              style={{
                margin: "0 0 24px",
                fontSize: 13,
                color: "var(--color-text-muted)",
              }}
            >
              <Trans
                i18nKey="progres.subtitle"
                ns="common"
                components={{
                  strong: <strong />,
                  red: <span style={{ color: "#EF4444", fontWeight: 600 }} />,
                }}
              />
            </p>

            <form
              onSubmit={handleSubmit}
              style={{ display: "flex", flexDirection: "column", gap: 16 }}
            >
              <div>
                <label
                  style={{
                    display: "block",
                    fontSize: 11,
                    fontWeight: 600,
                    marginBottom: 6,
                    color: "var(--color-text-muted)",
                    letterSpacing: "0.03em",
                    textTransform: "uppercase",
                  }}
                >
                  {t("progres.usernameLabel")}
                </label>
                <input
                  ref={firstInputRef}
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                  autoComplete="username"
                  style={inputStyle(focusedField === "username")}
                  onFocus={() => setFocusedField("username")}
                  onBlur={() => setFocusedField(null)}
                />
              </div>
              <div>
                <label
                  style={{
                    display: "block",
                    fontSize: 11,
                    fontWeight: 600,
                    marginBottom: 6,
                    color: "var(--color-text-muted)",
                    letterSpacing: "0.03em",
                    textTransform: "uppercase",
                  }}
                >
                  {t("progres.passwordLabel")}
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  style={inputStyle(focusedField === "password")}
                  onFocus={() => setFocusedField("password")}
                  onBlur={() => setFocusedField(null)}
                />
              </div>

              {error && (
                <p style={{ margin: 0, fontSize: 13, color: "#EF4444" }}>
                  {error}
                </p>
              )}

              <button
                ref={lastInputRef}
                type="submit"
                disabled={loading}
                className="inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-[100px] font-semibold text-sm transition-all duration-200"
                style={{
                  background: loading
                    ? "var(--color-accent-dark)"
                    : "var(--color-accent)",
                  color: "#fff",
                  opacity: loading ? 0.8 : 1,
                  border: "none",
                  cursor: loading ? "not-allowed" : "pointer",
                  marginTop: 8,
                }}
              >
                {loading && (
                  <span
                    style={{
                      display: "inline-block",
                      width: 14,
                      height: 14,
                      border: "2px solid rgba(255,255,255,0.3)",
                      borderTopColor: "white",
                      borderRadius: "50%",
                      animation: "progres-spinner 0.6s linear infinite",
                    }}
                  />
                )}
                {loading ? t("progres.submitting") : t("progres.submit")}
              </button>
            </form>
          </div>
        </div>
      )}

      <style>{`
        @keyframes progres-spinner {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </>
  );
}
