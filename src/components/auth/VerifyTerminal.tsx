import { useEffect, useState } from "react";

const LINES = [
  { text: "$ revenant verify --config revenant.yaml", tone: "cmd" as const },
  { text: "→ snapshot restore  ·  sandbox RDS", tone: "dim" as const },
  { text: "→ 12 checks  ·  golden queries", tone: "dim" as const },
  { text: "PASS  RTO 3m 41s  ·  evidence signed", tone: "ok" as const },
];

/** Fixed-height CLI promo — never grows as lines appear */
export function VerifyTerminal() {
  const [visibleCount, setVisibleCount] = useState(1);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setVisibleCount((n) => (n >= LINES.length ? 1 : n + 1));
    }, 1500);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <div className="flex h-full min-h-[168px] w-full flex-col overflow-hidden rounded-2xl border border-cyan-400/15 bg-[#061018]/90 font-mono text-[11px] leading-6 shadow-[inset_0_1px_0_rgba(56,189,248,0.08)]">
      <div className="flex h-8 shrink-0 items-center gap-1.5 border-b border-white/10 px-3">
        <span className="h-1.5 w-1.5 rounded-full bg-red-400/80" />
        <span className="h-1.5 w-1.5 rounded-full bg-amber-400/80" />
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400/80" />
        <span className="ml-2 text-[10px] tracking-wide text-slate-400">terminal</span>
        <span className="ml-auto text-[10px] font-medium text-cyan-400/80">revenant verify</span>
      </div>
      <div className="grid flex-1 grid-rows-4 px-3 py-2.5">
        {LINES.map((line, i) => {
          const shown = i < visibleCount;
          const isLatest = i === visibleCount - 1;
          return (
            <div
              key={line.text}
              className={`flex items-center truncate transition-opacity duration-300 ${
                shown ? "opacity-100" : "opacity-0"
              } ${
                line.tone === "dim"
                  ? "text-slate-400"
                  : line.tone === "ok"
                    ? "text-emerald-400"
                    : "text-cyan-100"
              }`}
            >
              <span className="truncate">{line.text}</span>
              {isLatest && shown && (
                <span className="auth-caret ml-1 inline-block h-3 w-1.5 shrink-0 bg-cyan-300" />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
