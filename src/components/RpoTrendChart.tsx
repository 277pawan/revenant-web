import { useMemo } from "react";
import { Link } from "react-router-dom";
import { Clock } from "lucide-react";
import type { DashboardRpoTrendPoint } from "../types/api";

const CHART_HEIGHT = 140;

function formatRpo(seconds: number | null): string {
  if (seconds == null) return "—";
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return s > 0 ? `${m}m ${s}s` : `${m}m`;
}

function formatShortDate(iso: string): string {
  const d = new Date(`${iso}T12:00:00`);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

type RpoTrendChartProps = {
  days: DashboardRpoTrendPoint[];
  loading?: boolean;
};

export function RpoTrendChart({ days, loading }: RpoTrendChartProps) {
  const stats = useMemo(() => {
    const withRpo = days.filter((d) => d.maxRpoSeconds != null && d.maxRpoSeconds > 0);
    const values = withRpo.map((d) => d.maxRpoSeconds!);
    if (values.length === 0) {
      return { hasData: false, max: 1, worst: null as number | null };
    }
    return {
      hasData: true,
      max: Math.max(...values),
      worst: Math.max(...values),
    };
  }, [days]);

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <div className="mb-4 flex items-start gap-2.5">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-50 text-amber-700">
          <Clock size={18} />
        </div>
        <div>
          <h2 className="font-semibold text-slate-900">Data loss window (RPO)</h2>
          <p className="text-xs text-slate-500">
            Worst observed RPO per day from freshness checks · last 30 days
          </p>
        </div>
      </div>

      {loading ? (
        <div
          className="flex items-center justify-center text-sm text-slate-500"
          style={{ height: CHART_HEIGHT + 24 }}
        >
          Loading RPO trends…
        </div>
      ) : !stats.hasData ? (
        <div
          className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-slate-200 bg-slate-50/50 text-center"
          style={{ height: CHART_HEIGHT + 24 }}
        >
          <p className="text-sm font-medium text-slate-700">No RPO measurements yet</p>
          <p className="max-w-sm text-xs text-slate-500">
            Add a freshness check to your validation plan so each drill records observed RPO.
          </p>
          <Link to="/workflows" className="text-xs font-semibold text-brand hover:underline">
            Open workflows →
          </Link>
        </div>
      ) : (
        <>
          <div className="mb-3 font-mono text-lg font-semibold text-slate-900">
            {formatRpo(stats.worst)}
            <span className="ml-1 text-xs font-normal text-slate-500">30-day peak</span>
          </div>
          <div className="flex items-end gap-px" style={{ height: CHART_HEIGHT }}>
            {days.map((day) => {
              const barPx =
                day.maxRpoSeconds != null && day.maxRpoSeconds > 0
                  ? Math.max(6, Math.round((day.maxRpoSeconds / stats.max) * (CHART_HEIGHT - 8)))
                  : 0;
              return (
                <div
                  key={day.date}
                  className="flex min-w-0 flex-1 flex-col justify-end"
                  title={
                    day.maxRpoSeconds != null
                      ? `${formatShortDate(day.date)}: ${formatRpo(day.maxRpoSeconds)}`
                      : formatShortDate(day.date)
                  }
                >
                  {barPx > 0 ? (
                    <div
                      className="w-full rounded-t bg-amber-500/80 hover:bg-amber-600"
                      style={{ height: barPx }}
                    />
                  ) : (
                    <div className="mx-auto h-1 w-1 rounded-full bg-slate-200" />
                  )}
                </div>
              );
            })}
          </div>
          <div className="mt-2 flex justify-between text-[10px] text-slate-500">
            <span>{formatShortDate(days[0]!.date)}</span>
            <span>{formatShortDate(days[days.length - 1]!.date)}</span>
          </div>
        </>
      )}
    </div>
  );
}
