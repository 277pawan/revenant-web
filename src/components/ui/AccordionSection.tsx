import type { ReactNode } from "react";
import { ChevronDown } from "lucide-react";

type AccordionSectionProps = {
  open: boolean;
  onToggle: () => void;
  title: string;
  subtitle?: string;
  badge?: ReactNode;
  icon?: ReactNode;
  /** Grow to fill remaining column height when open */
  fill?: boolean;
  variant?: "default" | "composer";
  children: ReactNode;
};

export function AccordionSection({
  open,
  onToggle,
  title,
  subtitle,
  badge,
  icon,
  fill = false,
  variant = "default",
  children,
}: AccordionSectionProps) {
  const shellClass =
    variant === "composer"
      ? "border-blue-100 bg-slate-50"
      : "border-slate-200 bg-white";

  return (
    <div
      className={`flex min-h-0 flex-col overflow-hidden rounded-xl border shadow-sm ${shellClass} ${
        fill && open ? "min-h-0 flex-1" : "shrink-0"
      }`}
    >
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className={`flex w-full items-center gap-2.5 px-3 py-2.5 text-left transition-colors ${
          variant === "composer" ? "hover:bg-white/70" : "hover:bg-slate-50/80"
        } ${open ? "border-b border-slate-200" : ""}`}
      >
        {icon ? (
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-blue-50 text-brand">
            {icon}
          </div>
        ) : null}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold text-slate-900">{title}</span>
            {badge}
          </div>
          {subtitle ? (
            <p className="truncate text-xs text-slate-500">{subtitle}</p>
          ) : null}
        </div>
        <ChevronDown
          size={16}
          className={`shrink-0 text-slate-400 transition-transform duration-300 ease-out ${
            open ? "rotate-180" : ""
          }`}
          aria-hidden
        />
      </button>

      <div
        className={`accordion-expand min-h-0 ${fill && open ? "flex-1" : ""}`}
        data-open={open ? "true" : "false"}
        aria-hidden={!open}
      >
        <div className="accordion-expand-inner flex min-h-0 flex-col">
          <div
            className={`min-h-0 flex-1 overflow-hidden ${
              open ? "" : "pointer-events-none"
            }`}
          >
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
