import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, Database } from "lucide-react";
import type { DashboardRpoTrendPoint } from "../types/api";
import {
  formatStalenessSeconds,
  stalenessBarClass,
  stalenessSeverity,
} from "../lib/duration";

const CHART_HEIGHT = 168;
const Y_AXIS_W = 44;
const TOOLTIP_SLOT = 88;

function formatShortDate(iso: string): string {
  const d = new Date(`${iso}T12:00:00`);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function formatLongDate(iso: string): string {
  const d = new Date(`${iso}T12:00:00`);
  return d.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function yAxisLabel(seconds: number): string {
  if (seconds >= 86400) return `${Math.round(seconds / 86400)}d`;
  if (seconds >= 3600) return `${Math.round(seconds / 3600)}h`;
  if (seconds >= 60) return `${Math.round(seconds / 60)}m`;
  return `${seconds}s`;
}

type RpoTrendChartProps = {
  days: DashboardRpoTrendPoint[];
  loading?: boolean;
};

export function RpoTrendChart({ days, loading }: RpoTrendChartProps) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  const stats = useMemo(() => {
    const measured = days.filter((d) => d.maxRpoSeconds != null && d.maxRpoSeconds > 0);
    const values = measured.map((d) => d.maxRpoSeconds!);
    if (values.length === 0) {
      return {
        hasData: false,
        max: 1,
        latest: null as DashboardRpoTrendPoint | null,
        worst: null as number | null,
        goodDays: 0,
        badDays: 0,
      };
    }
    const worst = Math.max(...values);
    const latest = measured[measured.length - 1] ?? null;
    const goodDays = measured.filter((d) => stalenessSeverity(d.maxRpoSeconds!) === "good").length;
    const badDays = measured.filter((d) => stalenessSeverity(d.maxRpoSeconds!) === "bad").length;
    return {
      hasData: true,
      max: worst,
      latest,
      worst,
      goodDays,
      badDays,
    };
  }, [days]);

  const yTicks = useMemo(() => {
    if (!stats.hasData) return [0];
    const max = stats.max;
    if (max <= 120) return [0, Math.ceil(max / 2), max];
    if (max <= 86400) {
      const h = Math.ceil(max / 3600);
      return [0, Math.ceil(h / 2), h].map((x) => x * 3600);
    }
    const d = max / 86400;
    const top = Math.ceil(d) * 86400;
    return [0, Math.round(top / 2), top];
  }, [stats]);

  const hovered = hoveredIndex != null ? days[hoveredIndex] : null;
  const hoveredPct =
    hoveredIndex != null && days.length > 1
      ? (hoveredIndex / (days.length - 1)) * 100
      : 50;

  const headline =
    stats.latest?.maxRpoSeconds != null && stats.worst != null
      ? stats.latest.maxRpoSeconds <= 3600 && stats.worst >= 86400
        ? `Latest drill was fresh (${formatStalenessSeconds(stats.latest.maxRpoSeconds)}), but an earlier run proved ~${formatStalenessSeconds(stats.worst)} stale data.`
        : stats.worst >= 86400
          ? `Worst case this month: ${formatStalenessSeconds(stats.worst)} of data at risk.`
          : `Backup data was up to ${formatStalenessSeconds(stats.worst)} old on measured days.`
      : null;

  return (
    <div className="rounded-xl border-2 border-amber-200/80 bg-gradient-to-br from-amber-50/40 via-white to-white p-4 shadow-sm sm:p-5">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-100 text-amber-800 ring-1 ring-amber-200">
            <Database size={18} />
          </div>
          <div>
            <h2 className="font-semibold text-slate-900">Backup freshness (RPO)</h2>
            <p className="text-xs text-slate-600">
              How <span className="font-medium">old</span> recovered data was — not how long restore took
            </p>
          </div>
        </div>
        {stats.hasData && !loading && stats.badDays > 0 && (
          <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2.5 py-1 text-xs font-medium text-red-800">
            <AlertTriangle size={14} />
            {stats.badDays} day{stats.badDays === 1 ? "" : "s"} critical
          </span>
        )}
      </div>

      {stats.hasData && !loading && (
        <>
          <div className="mb-3 flex flex-wrap gap-2 text-[10px] font-medium uppercase tracking-wide">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-2 py-0.5 text-emerald-800">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              &lt; 1h fresh
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-2 py-0.5 text-amber-900">
              <span className="h-2 w-2 rounded-full bg-amber-500" />
              1h – 24h stale
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-red-100 px-2 py-0.5 text-red-800">
              <span className="h-2 w-2 rounded-full bg-red-500" />
              ≥ 1 day critical
            </span>
          </div>

          <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {[
              {
                label: "Latest",
                value: formatStalenessSeconds(stats.latest?.maxRpoSeconds ?? null),
                tone:
                  stats.latest?.maxRpoSeconds != null
                    ? stalenessSeverity(stats.latest.maxRpoSeconds)
                    : "neutral",
              },
              {
                label: "30-day worst",
                value: formatStalenessSeconds(stats.worst),
                tone: stats.worst != null ? stalenessSeverity(stats.worst) : "neutral",
              },
              {
                label: "Fresh days",
                value: String(stats.goodDays),
                tone: "neutral",
              },
              {
                label: "Critical days",
                value: String(stats.badDays),
                tone: stats.badDays > 0 ? "bad" : "good",
              },
            ].map((chip) => (
              <div
                key={chip.label}
                className={`rounded-lg border px-3 py-2 ${
                  chip.tone === "good"
                    ? "border-emerald-200 bg-emerald-50/80"
                    : chip.tone === "warn"
                      ? "border-amber-200 bg-amber-50/80"
                      : chip.tone === "bad"
                        ? "border-red-200 bg-red-50/80"
                        : "border-slate-100 bg-slate-50/80"
                }`}
              >
                <div className="text-[10px] font-medium uppercase tracking-wide text-slate-500">
                  {chip.label}
                </div>
                <div className="mt-0.5 font-mono text-sm font-semibold text-slate-900">
                  {chip.value}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {loading ? (
        <div
          className="flex items-center justify-center text-sm text-slate-500"
          style={{ height: CHART_HEIGHT + 28 }}
        >
          Loading freshness trends…
        </div>
      ) : !stats.hasData ? (
        <div
          className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-amber-200 bg-amber-50/30 text-center"
          style={{ height: CHART_HEIGHT + 28 }}
        >
          <p className="text-sm font-medium text-slate-700">No freshness measurements yet</p>
          <p className="max-w-sm text-xs text-slate-500">
            Add a freshness check to your validation plan — RPO is separate from restore speed (RTO).
          </p>
          <Link to="/workflows" className="text-xs font-semibold text-brand hover:underline">
            Open workflows →
          </Link>
        </div>
      ) : (
        <div className="relative" style={{ paddingTop: TOOLTIP_SLOT }}>
          <div
            className="pointer-events-none absolute inset-x-0 top-0 z-20"
            style={{ height: TOOLTIP_SLOT }}
            aria-hidden={!hovered}
          >
            {hovered?.maxRpoSeconds != null && (
              <div
                className="absolute -translate-x-1/2 rounded-lg border border-amber-200 bg-white px-3 py-2 shadow-lg"
                style={{
                  left: `calc(${Y_AXIS_W}px + (100% - ${Y_AXIS_W}px) * ${hoveredPct / 100})`,
                  top: 0,
                }}
              >
                <p className="whitespace-nowrap text-xs font-semibold text-slate-900">
                  {formatLongDate(hovered.date)}
                </p>
                <p className="mt-1 font-mono text-lg font-bold text-amber-800">
                  {formatStalenessSeconds(hovered.maxRpoSeconds)}
                  <span className="ml-1 text-xs font-normal text-slate-500">data age</span>
                </p>
                <p className="text-[11px] text-slate-600">
                  {hovered.sampleCount} drill{hovered.sampleCount === 1 ? "" : "s"} measured
                </p>
              </div>
            )}
          </div>

          <div className="flex gap-2">
            <div
              className="flex shrink-0 flex-col justify-between text-right text-[10px] tabular-nums text-slate-400"
              style={{ width: Y_AXIS_W, height: CHART_HEIGHT }}
            >
              {[...yTicks].reverse().map((tick) => (
                <span key={tick}>{yAxisLabel(tick)}</span>
              ))}
            </div>

            <div className="relative min-w-0 flex-1">
              <div
                className="absolute inset-0 flex flex-col justify-between pointer-events-none"
                aria-hidden
              >
                {yTicks.map((tick) => (
                  <div key={tick} className="border-t border-amber-100/80" />
                ))}
              </div>

              <div
                className="relative flex items-end gap-px"
                style={{ height: CHART_HEIGHT }}
              >
                {days.map((day, index) => {
                  const rpo = day.maxRpoSeconds;
                  const barPx =
                    rpo != null && rpo > 0
                      ? Math.max(8, Math.round((rpo / stats.max) * (CHART_HEIGHT - 12)))
                      : 0;
                  const severity = rpo != null ? stalenessSeverity(rpo) : null;
                  const active = hoveredIndex === index;

                  return (
                    <button
                      key={day.date}
                      type="button"
                      className="group relative flex h-full min-w-0 flex-1 flex-col justify-end focus:outline-none"
                      onMouseEnter={() => setHoveredIndex(index)}
                      onMouseLeave={() => setHoveredIndex(null)}
                      onFocus={() => setHoveredIndex(index)}
                      onBlur={() => setHoveredIndex(null)}
                      aria-label={
                        rpo != null
                          ? `${formatLongDate(day.date)}: data ${formatStalenessSeconds(rpo)} old`
                          : `${formatLongDate(day.date)}: no measurement`
                      }
                    >
                      {barPx > 0 && severity ? (
                        <div
                          className={`relative z-10 w-full rounded-t transition-all duration-150 ${stalenessBarClass(severity, active)}`}
                          style={{ height: barPx }}
                        />
                      ) : (
                        <div
                          className="mx-auto h-1 w-1 rounded-full bg-slate-200 group-hover:bg-slate-300"
                          aria-hidden
                        />
                      )}
                    </button>
                  );
                })}
              </div>

              <div className="mt-2 flex justify-between text-[10px] text-slate-500">
                <span>{formatShortDate(days[0]!.date)}</span>
                <span>{formatShortDate(days[days.length - 1]!.date)}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {!loading && headline && (
        <div className="mt-4 rounded-lg border border-amber-200/60 bg-amber-50/60 px-3 py-2.5 text-xs leading-relaxed text-slate-700">
          {headline}
        </div>
      )}
    </div>
  );
}
