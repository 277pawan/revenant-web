import type { ReactNode } from "react";
import { ChevronRight } from "lucide-react";

type SidebarNavGroupProps = {
  label: string;
  open: boolean;
  onToggle: () => void;
  variant?: "primary" | "secondary";
  children: ReactNode;
};

export function SidebarNavGroup({
  label,
  open,
  onToggle,
  variant = "primary",
  children,
}: SidebarNavGroupProps) {
  const labelClass =
    variant === "primary"
      ? "text-[10px] font-semibold uppercase tracking-wide text-slate-500"
      : "text-[9px] font-medium uppercase tracking-wide text-slate-600";

  return (
    <div>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex w-full items-center justify-between rounded-md px-3 py-1.5 text-left transition-colors hover:bg-slate-800/50"
      >
        <span className={labelClass}>{label}</span>
        <ChevronRight
          size={14}
          className={`shrink-0 text-slate-500 transition-transform duration-200 ${
            open ? "rotate-90" : ""
          }`}
          aria-hidden
        />
      </button>
      {open ? <div className="mt-0.5 space-y-0.5">{children}</div> : null}
    </div>
  );
}
