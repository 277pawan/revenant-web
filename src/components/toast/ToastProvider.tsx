import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { CheckCircle2, Info, AlertTriangle, XCircle, X } from "lucide-react";

export type ToastTone = "success" | "error" | "info" | "warning";

export type ToastInput = {
  title: string;
  description?: string;
  tone?: ToastTone;
  /** Auto-dismiss ms. 0 = sticky until closed. Default 5200. */
  durationMs?: number;
  action?: { label: string; onClick: () => void };
};

type ToastItem = ToastInput & {
  id: string;
  tone: ToastTone;
  durationMs: number;
  createdAt: number;
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

const toneMeta: Record<
  ToastTone,
  { icon: typeof CheckCircle2; accent: string; glow: string; label: string }
> = {
  success: {
    icon: CheckCircle2,
    accent: "#0f766e",
    glow: "rgba(15, 118, 110, 0.35)",
    label: "Success",
  },
  error: {
    icon: XCircle,
    accent: "#b91c1c",
    glow: "rgba(185, 28, 28, 0.3)",
    label: "Error",
  },
  info: {
    icon: Info,
    accent: "#1d4ed8",
    glow: "rgba(29, 78, 216, 0.3)",
    label: "Info",
  },
  warning: {
    icon: AlertTriangle,
    accent: "#b45309",
    glow: "rgba(180, 83, 9, 0.3)",
    label: "Notice",
  },
};

function ToastCard({
  item,
  onDismiss,
  index,
}: {
  item: ToastItem;
  onDismiss: (id: string) => void;
  index: number;
}) {
  const meta = toneMeta[item.tone];
  const Icon = meta.icon;
  const [hovered, setHovered] = useState(false);
  const [progress, setProgress] = useState(100);
  const remainingRef = useRef(item.durationMs);
  const startedRef = useRef(Date.now());
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (item.durationMs <= 0) return;

    const tick = () => {
      if (hovered) {
        remainingRef.current -= 0;
        startedRef.current = Date.now();
        rafRef.current = requestAnimationFrame(tick);
        return;
      }
      const elapsed = Date.now() - startedRef.current;
      const left = Math.max(0, remainingRef.current - elapsed);
      setProgress((left / item.durationMs) * 100);
      if (left <= 0) {
        onDismiss(item.id);
        return;
      }
      rafRef.current = requestAnimationFrame(tick);
    };

    startedRef.current = Date.now();
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      const elapsed = Date.now() - startedRef.current;
      if (!hovered) {
        remainingRef.current = Math.max(0, remainingRef.current - elapsed);
      }
    };
  }, [hovered, item.durationMs, item.id, onDismiss]);

  return (
    <div
      role="status"
      aria-live={item.tone === "error" ? "assertive" : "polite"}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="pointer-events-auto w-[min(100vw-2rem,380px)] origin-top overflow-hidden rounded-xl border border-slate-200/80 bg-white/95 shadow-[0_18px_50px_-24px_rgba(15,23,42,0.45)] backdrop-blur-md"
      style={{
        animation: "revenant-toast-in 420ms cubic-bezier(0.16, 1, 0.3, 1)",
        transform: `translateY(${index * 2}px)`,
        boxShadow: `0 18px 50px -24px rgba(15,23,42,0.45), 0 0 0 1px ${meta.glow}`,
      }}
    >
      <div className="flex gap-3 px-4 pb-3 pt-3.5">
        <div
          className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
          style={{
            background: `linear-gradient(145deg, ${meta.glow}, transparent)`,
            color: meta.accent,
          }}
        >
          <Icon size={18} strokeWidth={2.25} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                {meta.label}
              </p>
              <p className="mt-0.5 text-sm font-semibold tracking-tight text-slate-900">
                {item.title}
              </p>
            </div>
            <button
              type="button"
              aria-label="Dismiss"
              onClick={() => onDismiss(item.id)}
              className="rounded-md p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
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
              className="mt-2 text-xs font-semibold tracking-wide"
              style={{ color: meta.accent }}
            >
              {item.action.label} →
            </button>
          )}
        </div>
      </div>
      {item.durationMs > 0 && (
        <div className="h-[3px] w-full bg-slate-100">
          <div
            className="h-full transition-[width] duration-75 ease-linear"
            style={{
              width: `${progress}%`,
              background: `linear-gradient(90deg, ${meta.accent}, ${meta.glow})`,
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
    setItems((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const push = useCallback((input: ToastInput) => {
    const id = nextId();
    const item: ToastItem = {
      ...input,
      id,
      tone: input.tone ?? "info",
      durationMs: input.durationMs ?? 5200,
      createdAt: Date.now(),
    };
    setItems((prev) => [item, ...prev].slice(0, 4));
    return id;
  }, []);

  const api = useMemo<ToastApi>(
    () => ({
      push,
      success: (title, description) => push({ title, description, tone: "success" }),
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
        className="pointer-events-none fixed inset-x-0 top-0 z-[100] flex flex-col items-end gap-2 p-4 sm:p-6"
        aria-label="Notifications"
      >
        {items.map((item, index) => (
          <ToastCard key={item.id} item={item} index={index} onDismiss={dismiss} />
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
