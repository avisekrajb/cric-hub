import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, Info, X } from "lucide-react";

const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const remove = useCallback((id) => {
    setToasts((rows) => rows.filter((row) => row.id !== id));
  }, []);

  const push = useCallback(
    (message, type = "info", ttl = 4200) => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      setToasts((rows) => [...rows.slice(-4), { id, message, type }]);
      if (ttl > 0) setTimeout(() => remove(id), ttl);
      return id;
    },
    [remove]
  );

  const value = useMemo(
    () => ({
      push,
      success: (message, ttl) => push(message, "success", ttl),
      error: (message, ttl) => push(message, "error", ttl),
      info: (message, ttl) => push(message, "info", ttl),
      remove,
    }),
    [push, remove]
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed bottom-4 right-4 z-[80] flex w-[min(360px,calc(100vw-2rem))] flex-col gap-2">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className="pointer-events-auto flex animate-riseIn items-start gap-3 rounded-xl border border-white/10 bg-ink-850/95 p-3.5 shadow-card backdrop-blur-xl"
          >
            <span
              className={
                toast.type === "success"
                  ? "text-mint"
                  : toast.type === "error"
                    ? "text-coral"
                    : "text-sky"
              }
            >
              {toast.type === "success" ? (
                <CheckCircle2 size={18} />
              ) : toast.type === "error" ? (
                <AlertTriangle size={18} />
              ) : (
                <Info size={18} />
              )}
            </span>
            <p className="flex-1 text-sm leading-snug text-white/85">{toast.message}</p>
            <button onClick={() => remove(toast.id)} className="text-white/35 hover:text-white" aria-label="Dismiss">
              <X size={15} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export const useToast = () => {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used inside ToastProvider");
  return ctx;
};
