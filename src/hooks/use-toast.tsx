"use client";

import { createContext, useCallback, useContext, useState, useRef, type ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";
import { AlertTriangle, CheckCircle, Info, X, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

type ToastVariant = "info" | "success" | "warning" | "error" | "loading";

interface Toast {
  id: string;
  message: string;
  variant: ToastVariant;
  durationMs: number | null;
}

interface ToastContext {
  toast: (message: string, opts?: { variant?: ToastVariant; durationMs?: number | null }) => string;
  dismiss: (id: string) => void;
  update: (
    id: string,
    message: string,
    opts?: { variant?: ToastVariant; durationMs?: number | null },
  ) => void;
}

const ToastCtx = createContext<ToastContext | null>(null);

export function useToast() {
  const ctx = useContext(ToastCtx);
  if (!ctx) throw new Error("useToast must be used within a ToastProvider");
  return ctx;
}

let nextId = 0;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const scheduleRemoval = useCallback((id: string, ms: number) => {
    const existing = timers.current.get(id);
    if (existing) clearTimeout(existing);
    const timer = setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
      timers.current.delete(id);
    }, ms);
    timers.current.set(id, timer);
  }, []);

  const toast = useCallback(
    (message: string, opts?: { variant?: ToastVariant; durationMs?: number | null }) => {
      const id = `toast-${++nextId}`;
      const variant = opts?.variant ?? "info";
      const durationMs = opts?.durationMs === undefined ? 4000 : opts.durationMs;
      setToasts((prev) => [...prev, { id, message, variant, durationMs }]);
      if (durationMs !== null) scheduleRemoval(id, durationMs);
      return id;
    },
    [scheduleRemoval],
  );

  const dismiss = useCallback((id: string) => {
    const existing = timers.current.get(id);
    if (existing) {
      clearTimeout(existing);
      timers.current.delete(id);
    }
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const update = useCallback(
    (
      id: string,
      message: string,
      opts?: { variant?: ToastVariant; durationMs?: number | null },
    ) => {
      setToasts((prev) =>
        prev.map((t) => {
          if (t.id !== id) return t;
          const variant = opts?.variant ?? t.variant;
          const durationMs = opts?.durationMs === undefined ? t.durationMs : opts.durationMs;
          if (durationMs !== null) scheduleRemoval(id, durationMs);
          return { ...t, message, variant, durationMs };
        }),
      );
    },
    [scheduleRemoval],
  );

  return (
    <ToastCtx.Provider value={{ toast, dismiss, update }}>
      {children}
      <Toaster toasts={toasts} onDismiss={dismiss} />
    </ToastCtx.Provider>
  );
}

const ICON: Record<ToastVariant, ReactNode> = {
  info: <Info className="h-4 w-4 shrink-0 text-blue-500" />,
  success: <CheckCircle className="h-4 w-4 shrink-0 text-green-500" />,
  warning: <AlertTriangle className="h-4 w-4 shrink-0 text-amber-500" />,
  error: <AlertTriangle className="h-4 w-4 shrink-0 text-white" />,
  loading: <Loader2 className="h-4 w-4 shrink-0 animate-spin text-white" />,
};

function Toaster({ toasts, onDismiss }: { toasts: Toast[]; onDismiss: (id: string) => void }) {
  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-[100] flex flex-col-reverse gap-2">
      <AnimatePresence mode="popLayout">
        {toasts.map((t) => (
          <motion.div
            key={t.id}
            layout
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className={cn(
              "pointer-events-auto flex items-center gap-2 rounded-lg border px-4 py-3 text-sm shadow-lg",
              t.variant === "error"
                ? "border-red-600 bg-red-600 text-white"
                : t.variant === "loading"
                  ? "border-amber-500 bg-amber-500 text-white"
                  : t.variant === "warning"
                    ? "border-amber-500/30 bg-popover"
                    : "bg-popover",
            )}
          >
            {ICON[t.variant]}
            <span className="mr-2">{t.message}</span>
            <button
              type="button"
              onClick={() => onDismiss(t.id)}
              className={cn(
                "ml-auto rounded p-0.5",
                t.variant === "error" || t.variant === "loading"
                  ? "text-white/70 hover:text-white"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
