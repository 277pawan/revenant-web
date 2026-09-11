import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { CheckCircle2, Info, AlertTriangle, XCircle, X } from "lucide-react";

export type ToastTone = "success" | "error" | "info" | "warning";

export type ToastInput = {
  title: string;
  description?: string;
  tone?: ToastTone;
  durationMs?: number;
  action?: { label: string; onClick: () => void };
};

type ToastItem = ToastInput & {
  id: string;
  tone: ToastTone;
  durationMs: number;
  exiting: boolean;
};

type ToastApi = {
  push: (input: ToastInput) => string;
  success: (title: string, description?: string) => string;
  error: (title: string, description?: string) => string;
  info: (title: string, description?: string) => string;
  warning: (title: string, description?: string) => string;
  dismiss: (id: string) => void;
  clear: () => void;
};

const ToastContext = createContext<ToastApi | null>(null);

let idSeq = 0;
function nextId() {
  idSeq += 1;
  return `toast-${Date.now()}-${idSeq}`;
}

const EXIT_MS = 280;

const toneMeta: Record<
  ToastTone,
  { icon: typeof CheckCircle2; accent: string; border: string; bg: string }
> = {
  success: {
    icon: CheckCircle2,
    accent: "#0d9488",
    border: "border-teal-200",
    bg: "bg-teal-50/90",
  },
  error: {
    icon: XCircle,
    accent: "#dc2626",
    border: "border-red-200",
    bg: "bg-red-50/90",
  },
  info: {
    icon: Info,
    accent: "#2563eb",
    border: "border-blue-200",
    bg: "bg-blue-50/90",
  },
  warning: {
    icon: AlertTriangle,
    accent: "#d97706",
    border: "border-amber-200",
    bg: "bg-amber-50/90",
  },
};

function ToastCard({
  item,
  onDismiss,
}: {
  item: ToastItem;
  onDismiss: (id: string) => void;
}) {
  const meta = toneMeta[item.tone];
  const Icon = meta.icon;

  return (
    <div
      role="status"
      aria-live={item.tone === "error" ? "assertive" : "polite"}
      className={`toast-card pointer-events-auto w-[min(100vw-2rem,400px)] overflow-hidden rounded-xl border backdrop-blur-md ${meta.border} ${meta.bg} ${
        item.exiting ? "toast-exit" : "toast-enter"
      }`}
      style={{
        boxShadow:
          "0 20px 40px -20px rgba(15, 23, 42, 0.35), 0 0 0 1px rgba(255,255,255,0.6) inset",
      }}
    >
      <div className="flex gap-3 px-4 py-3.5">
        <div
          className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/80"
          style={{ color: meta.accent }}
        >
          <Icon size={17} strokeWidth={2.25} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <p className="text-sm font-semibold leading-snug text-slate-900">
              {item.title}
            </p>
            <button
              type="button"
              aria-label="Dismiss"
              onClick={() => onDismiss(item.id)}
              className="shrink-0 rounded-md p-1 text-slate-400 transition-colors hover:bg-white/60 hover:text-slate-700"
            >
              <X size={14} />
            </button>
          </div>
          {item.description && (
            <p className="mt-1 text-[13px] leading-relaxed text-slate-600">
              {item.description}
            </p>
          )}
          {item.action && (
            <button
              type="button"
              onClick={() => {
                item.action?.onClick();
                onDismiss(item.id);
              }}
              className="mt-2 text-xs font-semibold"
              style={{ color: meta.accent }}
            >
              {item.action.label} →
            </button>
          )}
        </div>
      </div>
      {item.durationMs > 0 && (
        <div className="h-[3px] overflow-hidden bg-slate-200/60">
          <div
            className="toast-progress-fill h-full w-full"
            style={{
              ["--toast-duration" as string]: `${item.durationMs}ms`,
              backgroundColor: meta.accent,
            }}
          />
        </div>
      )}
    </div>
  );
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);

  const dismiss = useCallback((id: string) => {
    setItems((prev) =>
      prev.map((t) => (t.id === id ? { ...t, exiting: true } : t))
    );
    window.setTimeout(() => {
      setItems((prev) => prev.filter((t) => t.id !== id));
    }, EXIT_MS);
  }, []);

  const push = useCallback(
    (input: ToastInput) => {
      const id = nextId();
      const durationMs = input.durationMs ?? 5200;
      const item: ToastItem = {
        ...input,
        id,
        tone: input.tone ?? "info",
        durationMs,
        exiting: false,
      };
      setItems((prev) => [item, ...prev].slice(0, 4));
      if (durationMs > 0) {
        window.setTimeout(() => dismiss(id), durationMs);
      }
      return id;
    },
    [dismiss]
  );

  const api = useMemo<ToastApi>(
    () => ({
      push,
      success: (title, description) =>
        push({ title, description, tone: "success" }),
      error: (title, description) =>
        push({ title, description, tone: "error", durationMs: 7000 }),
      info: (title, description) => push({ title, description, tone: "info" }),
      warning: (title, description) =>
        push({ title, description, tone: "warning", durationMs: 6500 }),
      dismiss,
      clear: () => setItems([]),
    }),
    [dismiss, push]
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div
        className="pointer-events-none fixed inset-x-0 top-0 z-[100] flex flex-col items-end gap-3 p-4 sm:p-6"
        aria-label="Notifications"
      >
        {items.map((item) => (
          <ToastCard key={item.id} item={item} onDismiss={dismiss} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error("useToast must be used within ToastProvider");
  }
  return ctx;
}
