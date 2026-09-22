import { useMemo } from "react";
import { Activity } from "lucide-react";
import type { ReadinessHistoryPoint } from "../types/api";

const CHART_HEIGHT = 140;

function formatShortDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

type ReadinessTrendChartProps = {
  history: ReadinessHistoryPoint[];
  loading?: boolean;
};

export function ReadinessTrendChart({ history, loading }: ReadinessTrendChartProps) {
  const stats = useMemo(() => {
    if (history.length === 0) return { hasData: false, latest: null as number | null };
    const latest = history[history.length - 1]?.score ?? null;
    return { hasData: true, latest };
  }, [history]);

  const maxScore = 100;

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-start gap-2.5">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-violet-50 text-violet-700">
          <Activity size={18} />
        </div>
        <div>
          <h2 className="font-semibold text-slate-900">Readiness history</h2>
          <p className="text-xs text-slate-500">
            Score after each passing drill · {history.length} snapshot
            {history.length === 1 ? "" : "s"}
          </p>
        </div>
      </div>

      {loading ? (
        <div className="flex h-32 items-center justify-center text-sm text-slate-500">
          Loading history…
        </div>
      ) : !stats.hasData ? (
        <div className="flex h-32 flex-col items-center justify-center rounded-lg border border-dashed border-slate-200 bg-slate-50/50 text-center">
          <p className="text-sm font-medium text-slate-700">No history yet</p>
          <p className="mt-1 max-w-sm text-xs text-slate-500">
            Pass a restore drill to record your first readiness snapshot.
          </p>
        </div>
      ) : (
        <>
          <div className="mb-2 text-2xl font-semibold tabular-nums text-slate-900">
            {stats.latest}
            <span className="ml-1 text-sm font-normal text-slate-500">/ 100 latest</span>
          </div>
          <div className="flex items-end gap-1" style={{ height: CHART_HEIGHT }}>
            {history.map((point) => {
              const h = Math.max(6, Math.round((point.score / maxScore) * (CHART_HEIGHT - 8)));
              const color =
                point.score >= 80
                  ? "bg-emerald-500"
                  : point.score >= 55
                    ? "bg-amber-500"
                    : "bg-red-500";
              return (
                <div
                  key={`${point.jobId}-${point.recordedAt}`}
                  className="group relative flex min-w-0 flex-1 flex-col justify-end"
                  title={`${formatShortDate(point.recordedAt)}: ${point.score}`}
                >
                  <div
                    className={`w-full rounded-t opacity-85 transition-opacity group-hover:opacity-100 ${color}`}
                    style={{ height: h }}
                  />
                </div>
              );
            })}
          </div>
          <div className="mt-2 flex justify-between text-[10px] text-slate-500">
            <span>{formatShortDate(history[0]!.recordedAt)}</span>
            <span>{formatShortDate(history[history.length - 1]!.recordedAt)}</span>
          </div>
        </>
      )}
    </section>
  );
}
