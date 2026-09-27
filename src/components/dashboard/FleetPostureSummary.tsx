import type { DashboardOverview } from "../../types/api";

type FleetPostureSummaryProps = {
  summary: DashboardOverview["summary"];
  loading?: boolean;
};

type TileColor = "emerald" | "amber" | "red";

const tiles: Array<{
  key: "healthy" | "warning" | "critical";
  label: string;
  hint: string;
  color: TileColor;
}> = [
  { key: "healthy", label: "Healthy", hint: "Last drill passed", color: "emerald" },
  { key: "warning", label: "Needs attention", hint: "Stale or manual only", color: "amber" },
  { key: "critical", label: "At risk", hint: "Failed or not configured", color: "red" },
];

const colorMap: Record<TileColor, { bg: string; border: string; text: string; dot: string }> = {
  emerald: {
    bg: "bg-emerald-50",
    border: "border-emerald-200",
    text: "text-emerald-800",
    dot: "bg-emerald-500",
  },
  amber: {
    bg: "bg-amber-50",
    border: "border-amber-200",
    text: "text-amber-900",
    dot: "bg-amber-500",
  },
  red: {
    bg: "bg-red-50",
    border: "border-red-200",
    text: "text-red-800",
    dot: "bg-red-500",
  },
};

export function FleetPostureSummary({ summary, loading }: FleetPostureSummaryProps) {
  const unknown =
    summary.totalDatabases -
    summary.healthyCount -
    summary.warningCount -
    summary.criticalCount;

  return (
    <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {tiles.map((tile) => {
        const c = colorMap[tile.color];
        const value =
          tile.key === "healthy"
            ? summary.healthyCount
            : tile.key === "warning"
              ? summary.warningCount
              : summary.criticalCount;

        return (
          <div
            key={tile.key}
            className={`rounded-xl border ${c.border} ${c.bg} px-4 py-3 shadow-sm`}
          >
            <div className="flex items-center gap-2">
              <span className={`h-2 w-2 rounded-full ${c.dot}`} />
              <span className={`text-xs font-semibold uppercase tracking-wide ${c.text}`}>
                {tile.label}
              </span>
            </div>
            <div className={`mt-2 text-3xl font-bold tabular-nums ${c.text}`}>
              {loading ? "…" : value}
            </div>
            <p className="mt-1 text-xs text-slate-600">{tile.hint}</p>
          </div>
        );
      })}
      <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-slate-400" />
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Not tested
          </span>
        </div>
        <div className="mt-2 text-3xl font-bold tabular-nums text-slate-800">
          {loading ? "…" : Math.max(0, unknown)}
        </div>
        <p className="mt-1 text-xs text-slate-600">
          {summary.totalDatabases} workflow{summary.totalDatabases === 1 ? "" : "s"} total
        </p>
      </div>
    </div>
  );
}
