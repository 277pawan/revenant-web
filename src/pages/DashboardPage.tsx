import { AppShell } from "../components/AppShell";

export function DashboardPage() {
  return (
    <AppShell>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <p className="text-slate-600">Fleet restore posture — foundation shell (no live data yet).</p>
      </div>

      <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
        Phase 0 foundation only. Databases, jobs, and runners are not wired to the API yet.
      </div>

      <div className="grid grid-cols-4 gap-4">
        {[
          { label: "Databases", value: "—" },
          { label: "7d pass rate", value: "—" },
          { label: "Average RTO", value: "—" },
          { label: "24h failures", value: "—" },
        ].map((card) => (
          <div key={card.label} className="rounded-lg border border-slate-200 bg-white p-4">
            <div className="text-sm text-slate-500">{card.label}</div>
            <div className="mt-2 text-3xl font-semibold">{card.value}</div>
          </div>
        ))}
      </div>
    </AppShell>
  );
}
