import { Link } from "react-router-dom";
import { AppShell } from "../components/AppShell";
import { useAuth } from "../lib/auth";
import { roleHasPermission } from "../types/api";

export function DashboardPage() {
  const { user } = useAuth();
  const canWrite = user ? roleHasPermission(user.role, "databases:write") : false;

  return (
    <AppShell>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Dashboard</h1>
          <p className="mt-1 text-sm text-slate-600">
            Fleet restore posture for {user?.organizationName ?? "your organization"}.
          </p>
        </div>
        {canWrite && (
          <Link
            to="/databases/new"
            className="rounded-md bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            Add database
          </Link>
        )}
      </div>

      <div className="mb-4 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">
        Phase 1: databases registry is live. Next — validation plans, then jobs & runners.
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[
          { label: "Databases", value: "—", hint: "Open Databases to manage" },
          { label: "7d pass rate", value: "—", hint: "After first jobs" },
          { label: "Average RTO", value: "—", hint: "After restore drills" },
          { label: "24h failures", value: "—", hint: "After jobs run" },
        ].map((card) => (
          <div
            key={card.label}
            className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm"
          >
            <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
              {card.label}
            </div>
            <div className="mt-2 text-3xl font-semibold tabular-nums text-slate-900">
              {card.value}
            </div>
            <div className="mt-1 text-xs text-slate-500">{card.hint}</div>
          </div>
        ))}
      </div>
    </AppShell>
  );
}
