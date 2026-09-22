import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowDownRight, ArrowUpRight, Minus, TrendingUp } from "lucide-react";
import type { DashboardRtoTrendPoint } from "../types/api";

const CHART_HEIGHT_PX = 168;
const Y_AXIS_W = 40;
const TOOLTIP_SLOT_PX = 88;

function formatRto(seconds: number | null): string {
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

function formatLongDate(iso: string): string {
  const d = new Date(`${iso}T12:00:00`);
  return d.toLocaleDateString(undefined, {
    weekday: "long",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

type RtoTrendChartProps = {
  days: DashboardRtoTrendPoint[];
  loading?: boolean;
};

export function RtoTrendChart({ days, loading }: RtoTrendChartProps) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  const stats = useMemo(() => {
    const withRto = days.filter((d) => d.avgRtoSeconds != null && d.avgRtoSeconds > 0);
    const values = withRto.map((d) => d.avgRtoSeconds!);
    if (values.length === 0) {
      return {
        hasData: false,
        max: 1,
        avg: null as number | null,
        best: null as number | null,
        latest: null as DashboardRtoTrendPoint | null,
        totalRuns: 0,
        weekDelta: null as number | null,
      };
    }

    const max = Math.max(...values);
    const avg = Math.round(values.reduce((a, b) => a + b, 0) / values.length);
    const best = Math.min(...values);
    const latest = withRto[withRto.length - 1] ?? null;
    const totalRuns = days.reduce((n, d) => n + d.passCount, 0);

    const last7 = days.slice(-7).filter((d) => d.avgRtoSeconds != null);
    const prior7 = days.slice(-14, -7).filter((d) => d.avgRtoSeconds != null);
    const avgLast7 =
      last7.length > 0
        ? last7.reduce((s, d) => s + (d.avgRtoSeconds ?? 0), 0) / last7.length
        : null;
    const avgPrior7 =
      prior7.length > 0
        ? prior7.reduce((s, d) => s + (d.avgRtoSeconds ?? 0), 0) / prior7.length
        : null;
    const weekDelta =
      avgLast7 != null && avgPrior7 != null && avgPrior7 > 0
        ? Math.round(((avgLast7 - avgPrior7) / avgPrior7) * 100)
        : null;

    return {
      hasData: true,
      max,
      avg,
      best,
      latest,
      totalRuns,
      weekDelta,
    };
  }, [days]);

  const yTicks = useMemo(() => {
    if (!stats.hasData) return [0];
    const max = stats.max;
    const raw =
      max <= 10 ? [0, Math.ceil(max / 2), max] : [0, Math.round(max / 2), max];
    return [...new Set(raw)].sort((a, b) => a - b);
  }, [stats]);

  const xLabelIndices = useMemo(() => {
    if (days.length < 2) return [0];
    const indices = [0];
    for (let i = 7; i < days.length - 1; i += 7) indices.push(i);
    if (indices[indices.length - 1] !== days.length - 1) {
      indices.push(days.length - 1);
    }
    return indices;
  }, [days]);

  const hovered = hoveredIndex != null ? days[hoveredIndex] : null;
  const hoveredPct =
    hoveredIndex != null && days.length > 1
      ? (hoveredIndex / (days.length - 1)) * 100
      : 50;

  const insight = useMemo(() => {
    if (!stats.hasData) {
      return {
        text: "Run your first restore drill to measure how long recovery actually takes.",
        cta: "Run a drill",
        href: "/workflows",
      };
    }
    if (stats.weekDelta != null && stats.weekDelta <= -10) {
      return {
        text: `Recovery is ${Math.abs(stats.weekDelta)}% faster than the prior week — share this trend in your next DR review.`,
        cta: "View evidence",
        href: "/evidence",
      };
    }
    if (stats.weekDelta != null && stats.weekDelta >= 15) {
      return {
        text: `RTO crept up ${stats.weekDelta}% vs last week. Check failed workflows or schedule a drill.`,
        cta: "Review workflows",
        href: "/workflows",
      };
    }
    if (stats.totalRuns < 4) {
      return {
        text: "More weekly drills = a trustworthy RTO line your team can defend in audits.",
        cta: "Add a schedule",
        href: "/schedules",
      };
    }
    return {
      text: `30-day average ${formatRto(stats.avg)} across ${stats.totalRuns} successful drill${stats.totalRuns === 1 ? "" : "s"}.`,
      cta: "Run another drill",
      href: "/workflows",
    };
  }, [stats]);

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 text-brand">
            <TrendingUp size={18} />
          </div>
          <div>
            <h2 className="font-semibold text-slate-900">Restore speed (RTO)</h2>
            <p className="text-xs text-slate-500">
              How <span className="font-medium">long</span> each successful restore took · hover a day
            </p>
          </div>
        </div>
        {stats.hasData && !loading && stats.weekDelta != null && (
          <span
            className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ${
              stats.weekDelta < 0
                ? "bg-emerald-50 text-emerald-800"
                : stats.weekDelta > 0
                  ? "bg-amber-50 text-amber-800"
                  : "bg-slate-100 text-slate-600"
            }`}
          >
            {stats.weekDelta < 0 ? (
              <ArrowDownRight size={14} />
            ) : stats.weekDelta > 0 ? (
              <ArrowUpRight size={14} />
            ) : (
              <Minus size={14} />
            )}
            {stats.weekDelta === 0
              ? "Flat vs prior week"
              : `${Math.abs(stats.weekDelta)}% vs prior week`}
          </span>
        )}
      </div>

      {stats.hasData && !loading && (
        <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {[
            { label: "Latest", value: formatRto(stats.latest?.avgRtoSeconds ?? null) },
            { label: "30-day avg", value: formatRto(stats.avg) },
            { label: "Best (lowest)", value: formatRto(stats.best) },
            { label: "Drills passed", value: String(stats.totalRuns) },
          ].map((chip) => (
            <div
              key={chip.label}
              className="rounded-lg border border-slate-100 bg-slate-50/80 px-3 py-2"
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
      )}

      {loading ? (
        <div
          className="flex items-center justify-center text-sm text-slate-500"
          style={{ height: CHART_HEIGHT_PX + 28 }}
        >
          Loading recovery trends…
        </div>
      ) : !stats.hasData ? (
        <div
          className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-slate-200 bg-slate-50/50 text-center"
          style={{ height: CHART_HEIGHT_PX + 28 }}
        >
          <p className="text-sm font-medium text-slate-700">No RTO data yet</p>
          <p className="max-w-sm text-xs text-slate-500">
            Pass a restore drill and this chart shows daily recovery time — the number
            executives ask for in DR reviews.
          </p>
          <Link
            to="/workflows"
            className="mt-1 text-xs font-semibold text-brand hover:underline"
          >
            Run your first drill →
          </Link>
        </div>
      ) : (
        <div className="relative" style={{ paddingTop: TOOLTIP_SLOT_PX }}>
          <div
            className="pointer-events-none absolute inset-x-0 top-0 z-20"
            style={{ height: TOOLTIP_SLOT_PX }}
            aria-hidden={!hovered}
          >
            {hovered && (
              <div
                className="absolute -translate-x-1/2 rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-lg transition-opacity duration-150"
                style={{
                  left: `calc(${Y_AXIS_W}px + (100% - ${Y_AXIS_W}px) * ${hoveredPct / 100})`,
                  top: 0,
                }}
              >
                <p className="whitespace-nowrap text-xs font-semibold text-slate-900">
                  {formatLongDate(hovered.date)}
                </p>
                {hovered.avgRtoSeconds != null ? (
                  <>
                    <p className="mt-1 font-mono text-lg font-bold text-brand">
                      {formatRto(hovered.avgRtoSeconds)}
                      <span className="ml-1 text-xs font-normal text-slate-500">avg RTO</span>
                    </p>
                    <p className="text-[11px] text-slate-600">
                      {hovered.passCount} successful drill{hovered.passCount === 1 ? "" : "s"}
                    </p>
                    {stats.avg != null && hovered.avgRtoSeconds != null && (
                      <p className="mt-1 text-[10px] text-slate-500">
                        {hovered.avgRtoSeconds <= stats.avg
                          ? `${formatRto(stats.avg - hovered.avgRtoSeconds)} faster than 30d avg`
                          : `${formatRto(hovered.avgRtoSeconds - stats.avg)} slower than 30d avg`}
                      </p>
                    )}
                  </>
                ) : (
                  <p className="mt-1 text-xs text-slate-500">No drills this day</p>
                )}
              </div>
            )}
          </div>

          <div className="flex gap-2">
            <div
              className="flex shrink-0 flex-col justify-between text-right text-[10px] tabular-nums text-slate-400"
              style={{ width: Y_AXIS_W, height: CHART_HEIGHT_PX }}
            >
              {[...yTicks].reverse().map((tick) => (
                <span key={tick}>{formatRto(tick)}</span>
              ))}
            </div>

            <div className="relative min-w-0 flex-1">
              <div
                className="absolute inset-0 flex flex-col justify-between pointer-events-none"
                aria-hidden
              >
                {yTicks.map((tick) => (
                  <div key={tick} className="border-t border-slate-100" />
                ))}
              </div>

              <div
                className="relative flex items-end gap-px"
                style={{ height: CHART_HEIGHT_PX }}
              >
                {days.map((day, index) => {
                  const barPx =
                    day.avgRtoSeconds != null && day.avgRtoSeconds > 0
                      ? Math.max(
                          8,
                          Math.round(
                            (day.avgRtoSeconds / stats.max) * (CHART_HEIGHT_PX - 12)
                          )
                        )
                      : 0;
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
                        day.avgRtoSeconds != null
                          ? `${formatLongDate(day.date)}: ${formatRto(day.avgRtoSeconds)}`
                          : `${formatLongDate(day.date)}: no drills`
                      }
                    >
                      {active && (
                        <div
                          className="pointer-events-none absolute inset-y-0 -inset-x-0.5 rounded bg-brand/5"
                          aria-hidden
                        />
                      )}
                      {barPx > 0 ? (
                        <div
                          className={`relative z-10 w-full rounded-t transition-[background-color,box-shadow] duration-150 ${
                            active
                              ? "bg-brand shadow-[0_0_0_2px_rgba(37,99,235,0.25)]"
                              : "bg-brand/75 group-hover:bg-brand"
                          }`}
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

              <div className="relative mt-2 h-8">
                {xLabelIndices.map((index) => {
                  const pct = days.length > 1 ? (index / (days.length - 1)) * 100 : 0;
                  return (
                    <span
                      key={days[index]?.date ?? index}
                      className="absolute -translate-x-1/2 whitespace-nowrap text-[10px] text-slate-500"
                      style={{ left: `${pct}%` }}
                    >
                      {formatShortDate(days[index]!.date)}
                    </span>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {!loading && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-lg bg-slate-50 px-3 py-2.5 text-xs text-slate-600">
          <span>{insight.text}</span>
          <Link to={insight.href} className="shrink-0 font-semibold text-brand hover:underline">
            {insight.cta} →
          </Link>
        </div>
      )}
    </div>
  );
}
