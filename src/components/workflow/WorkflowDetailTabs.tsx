import type { ReactNode } from "react";

export type WorkflowTabId = "overview" | "recovery-points" | "analysis" | "contract" | "history";

const TABS: { id: WorkflowTabId; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "recovery-points", label: "Recovery points" },
  { id: "analysis", label: "Analysis" },
  { id: "contract", label: "Contract & config" },
  { id: "history", label: "Run history" },
];

export function WorkflowDetailTabs({
  active,
  onChange,
}: {
  active: WorkflowTabId;
  onChange: (tab: WorkflowTabId) => void;
}) {
  return (
    <nav
      className="mb-6 flex gap-1 overflow-x-auto rounded-lg border border-slate-200 bg-slate-50 p-1"
      aria-label="Workflow sections"
    >
      {TABS.map((tab) => (
        <button
          key={tab.id}
          type="button"
          onClick={() => onChange(tab.id)}
          className={`shrink-0 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
            active === tab.id
              ? "bg-white text-slate-900 shadow-sm"
              : "text-slate-600 hover:text-slate-900"
          }`}
        >
          {tab.label}
        </button>
      ))}
    </nav>
  );
}

export function WorkflowTabPanel({
  active,
  id,
  children,
}: {
  active: WorkflowTabId;
  id: WorkflowTabId;
  children: ReactNode;
}) {
  if (active !== id) return null;
  return <div>{children}</div>;
}
