import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  Clock,
  FileCheck,
  Play,
  Shield,
  TrendingUp,
  Zap,
} from "lucide-react";
import { AppShell } from "../components/AppShell";
import { SubscriptionBanner } from "../components/SubscriptionBanner";
import { RtoTrendChart } from "../components/RtoTrendChart";
import { DateTimeText } from "../components/DateTimeText";
import { useAuth } from "../lib/auth";
import { api } from "../lib/api";
import { getPlanDefinition } from "../lib/plans";
import { formatRelativeTime } from "../lib/datetime";
import type {
  DashboardFleetRow,
  DashboardOverview,
  DashboardRtoTrendPoint,
  FleetHealthStatus,
} from "../types/api";
import { roleHasPermission } from "../types/api";

function formatRto(seconds: number | null): string {
  if (seconds == null) return "—";
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return s > 0 ? `${m}m ${s}s` : `${m}m`;
}

function healthStyles(health: FleetHealthStatus) {
  switch (health) {
    case "healthy":
      return {
        dot: "bg-emerald-500",
        badge: "bg-emerald-100 text-emerald-800",
        label: "Healthy",
      };
    case "warning":
      return {
        dot: "bg-amber-500",
        badge: "bg-amber-100 text-amber-800",
        label: "Needs attention",
      };
    case "critical":
      return {
        dot: "bg-red-500",
        badge: "bg-red-100 text-red-800",
        label: "At risk",
      };
    default:
      return {
        dot: "bg-slate-400",
        badge: "bg-slate-100 text-slate-600",
        label: "Not tested",
      };
  }
}

function FleetRow({ row }: { row: DashboardFleetRow }) {
  const h = healthStyles(row.health);
  return (
    <tr className="hover:bg-slate-50">
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${h.dot}`} />
          <div>
            <div className="font-medium text-slate-900">{row.databaseName}</div>
            <div className="text-xs text-slate-500">
              {row.recoveryMode === "aws-rds" ? "AWS restore drill" : "Direct Postgres"}
            </div>
          </div>
        </div>
      </td>
      <td className="px-4 py-3">
        <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${h.badge}`}>
          {h.label}
        </span>
        <div className="mt-0.5 text-xs text-slate-500">{row.healthReason}</div>
      </td>
      <td className="px-4 py-3 text-slate-700">
        {row.lastJobStatus ? (
          <span
            className={
              row.lastJobStatus === "pass"
                ? "text-emerald-700"
                : row.lastJobStatus === "fail" || row.lastJobStatus === "error"
                  ? "text-red-700"
                  : "text-slate-600"
            }
          >
            {row.lastJobStatus}
          </span>
        ) : (
          "—"
        )}
      </td>
      <td className="px-4 py-3 font-mono text-sm text-slate-800">
        {formatRto(row.lastRtoSeconds)}
      </td>
      <td className="whitespace-nowrap px-4 py-3 text-sm text-slate-600">
        {row.lastJobFinishedAt ? (
          <DateTimeText value={row.lastJobFinishedAt} />
        ) : (
          "—"
        )}
      </td>
      <td className="px-4 py-3 text-right">
        {row.lastJobId ? (
          <Link
            to={`/workflows/${row.databaseId}/runs/${row.lastJobId}`}
            className="text-xs font-medium text-brand hover:underline"
          >
            View run
          </Link>
        ) : (
          <Link
            to={`/workflows/${row.databaseId}`}
            className="text-xs font-medium text-brand hover:underline"
          >
            Run drill
          </Link>
        )}
      </td>
    </tr>
  );
}

export function DashboardPage() {
  const { user } = useAuth();
  const canRun = user ? roleHasPermission(user.role, "jobs:run") : false;
  const [overview, setOverview] = useState<DashboardOverview | null>(null);
  const [rtoDays, setRtoDays] = useState<DashboardRtoTrendPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [trendsLoading, setTrendsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setTrendsLoading(true);
    setError(null);
    try {
      const [{ overview: data }, { trends }] = await Promise.all([
        api.getDashboardOverview(),
        api.getDashboardRtoTrends(),
      ]);
      setOverview(data);
      setRtoDays(trends.days);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load dashboard");
    } finally {
      setLoading(false);
      setTrendsLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const plan = getPlanDefinition(
    overview?.organizationPlan ?? user?.organizationPlan ?? "starter"
  );
  const onboardingDone = overview?.onboarding.filter((s) => s.done).length ?? 0;
  const onboardingTotal = overview?.onboarding.length ?? 0;
  const allOnboarded = onboardingDone === onboardingTotal && onboardingTotal > 0;

  const heroHeadline =
    overview && overview.summary.criticalCount > 0
      ? `${overview.summary.criticalCount} workflow${overview.summary.criticalCount > 1 ? "s" : ""} need immediate attention`
      : overview && overview.summary.healthyCount > 0
        ? `${overview.summary.healthyCount} workflow${overview.summary.healthyCount > 1 ? "s" : ""} passed the last restore drill`
        : "Prove your backups actually recover — not just exist";

  const trialDays =
    user?.trialEndsAt != null
      ? Math.max(
          0,
          Math.ceil(
            (new Date(user.trialEndsAt).getTime() - Date.now()) / (24 * 60 * 60 * 1000)
          )
        )
      : null;

  return (
    <AppShell>
      {user && <SubscriptionBanner user={user} />}
      {/* Hero */}
      <section className="mb-8 overflow-hidden rounded-2xl border border-slate-200 bg-gradient-to-br from-slate-900 via-slate-800 to-blue-900 px-6 py-8 text-white shadow-lg sm:px-8">
        <div className="flex flex-wrap items-start justify-between gap-6">
          <div className="max-w-2xl">
            <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-blue-100">
              <Shield size={14} />
              DR proof · {user?.organizationName}
            </div>
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{heroHeadline}</h1>
            <p className="mt-3 text-sm leading-relaxed text-slate-300">
              This is your Tuesday-morning view: did last night&apos;s snapshot restore, how long
              did recovery take, and where is the signed evidence? Run drills, schedule them, and
              alert the team when something breaks.
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              {canRun && (
                <Link
                  to="/workflows"
                  className="inline-flex items-center gap-2 rounded-lg bg-white px-4 py-2.5 text-sm font-semibold text-slate-900 hover:bg-blue-50"
                >
                  <Play size={16} fill="currentColor" />
                  Run full restore drill
                </Link>
              )}
              <Link
                to="/evidence"
                className="inline-flex items-center gap-2 rounded-lg border border-white/30 px-4 py-2.5 text-sm font-medium text-white hover:bg-white/10"
              >
                <FileCheck size={16} />
                Evidence vault
              </Link>
            </div>
          </div>
          <div className="rounded-xl border border-white/20 bg-white/10 px-5 py-4 backdrop-blur-sm">
            <div className="text-xs font-medium uppercase tracking-wide text-blue-200">
              Your plan
            </div>
            <div className="mt-1 text-xl font-bold">{plan.name}</div>
            <div className="text-sm text-slate-300">{plan.priceLabel}</div>
            <p className="mt-2 max-w-[220px] text-xs text-slate-400">{plan.tagline}</p>
            {user?.subscriptionStatus === "trialing" && trialDays != null ? (
              <div className="mt-3 rounded-md bg-white/10 px-2 py-1 text-xs text-blue-100">
                Trial · {trialDays} day{trialDays === 1 ? "" : "s"} left
              </div>
            ) : user?.subscriptionActive === false ? (
              <div className="mt-3 rounded-md bg-red-500/20 px-2 py-1 text-xs text-red-100">
                Subscribe to continue
              </div>
            ) : (
              <div className="mt-3 text-[10px] uppercase tracking-wide text-slate-500">
                Razorpay billing on marketing site
              </div>
            )}
          </div>
        </div>
      </section>

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* KPI cards */}
      <div className="mb-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[
          {
            label: "7-day pass rate",
            value:
              overview?.summary.passRate7d != null
                ? `${overview.summary.passRate7d}%`
                : "—",
            hint: "Restore drills that passed",
            icon: TrendingUp,
          },
          {
            label: "Avg recovery (RTO)",
            value: formatRto(overview?.summary.avgRtoSeconds7d ?? null),
            hint: "Last 7 days · successful runs",
            icon: Clock,
          },
          {
            label: "Failures (24h)",
            value: overview?.summary.failures24h ?? "—",
            hint: "Failed or errored drills",
            icon: AlertTriangle,
          },
          {
            label: "Evidence reports",
            value: overview?.summary.evidenceCount ?? "—",
            hint: "Signed JSON in vault",
            icon: FileCheck,
          },
        ].map((card) => (
          <div
            key={card.label}
            className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
          >
            <div className="flex items-center justify-between">
              <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
                {card.label}
              </div>
              <card.icon size={16} className="text-slate-400" />
            </div>
            <div className="mt-2 text-3xl font-semibold tabular-nums text-slate-900">
              {loading ? "…" : card.value}
            </div>
            <div className="mt-1 text-xs text-slate-500">{card.hint}</div>
          </div>
        ))}
      </div>

      <div className="mb-8">
        <RtoTrendChart days={rtoDays} loading={trendsLoading} />
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        {/* Fleet table */}
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 px-4 py-3">
            <div>
              <h2 className="font-semibold text-slate-900">Fleet restore posture</h2>
              <p className="text-xs text-slate-500">
                {overview?.summary.agentsOnline ?? 0} agent
                {(overview?.summary.agentsOnline ?? 0) === 1 ? "" : "s"} online now
              </p>
            </div>
            <Link to="/databases" className="text-xs font-medium text-brand hover:underline">
              Manage databases
            </Link>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-[720px] w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-medium">Workflow</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Last run</th>
                  <th className="px-4 py-3 font-medium">RTO</th>
                  <th className="px-4 py-3 font-medium">Finished</th>
                  <th className="px-4 py-3 font-medium text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-10 text-center text-slate-500">
                      Loading fleet…
                    </td>
                  </tr>
                ) : !overview?.fleet.length ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-12 text-center">
                      <p className="text-slate-600">No databases yet.</p>
                      <Link
                        to="/databases/new"
                        className="mt-2 inline-block text-sm font-medium text-brand hover:underline"
                      >
                        Add your first workflow →
                      </Link>
                    </td>
                  </tr>
                ) : (
                  overview.fleet.map((row) => <FleetRow key={row.databaseId} row={row} />)
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Onboarding + plan */}
        <aside className="space-y-4">
          {!allOnboarded && overview && (
            <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 shadow-sm">
              <div className="flex items-center gap-2 text-sm font-semibold text-blue-900">
                <Zap size={16} />
                First drill in {onboardingTotal - onboardingDone} steps
              </div>
              <p className="mt-1 text-xs text-blue-800/80">
                Complete setup so your first restore proof is inevitable.
              </p>
              <ul className="mt-4 space-y-2">
                {overview.onboarding.map((step) => (
                  <li key={step.id}>
                    <Link
                      to={step.href}
                      className={`flex items-center gap-2 rounded-lg px-2 py-2 text-sm transition-colors ${
                        step.done
                          ? "text-emerald-800"
                          : "bg-white text-slate-800 hover:bg-blue-100/50"
                      }`}
                    >
                      {step.done ? (
                        <CheckCircle2 size={16} className="shrink-0 text-emerald-600" />
                      ) : (
                        <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 border-slate-300" />
                      )}
                      <span className="flex-1">{step.label}</span>
                      {!step.done && <ChevronRight size={14} className="text-slate-400" />}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <h3 className="text-sm font-semibold text-slate-900">What {plan.name} includes</h3>
            <ul className="mt-3 space-y-2">
              {plan.highlights.map((h) => (
                <li key={h} className="flex items-start gap-2 text-xs text-slate-600">
                  <CheckCircle2 size={14} className="mt-0.5 shrink-0 text-emerald-600" />
                  {h}
                </li>
              ))}
            </ul>
            {plan.id === "starter" && (
              <p className="mt-4 rounded-md bg-slate-50 px-3 py-2 text-xs text-slate-500">
                Upgrade to <strong>Pro</strong> for more workflows, AWS fleet drills, and longer
                evidence retention — when billing goes live.
              </p>
            )}
          </div>

          {overview?.fleet.some((f) => f.nextRunAt) && (
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <h3 className="text-sm font-semibold text-slate-900">Upcoming scheduled drills</h3>
              <ul className="mt-2 space-y-2 text-xs text-slate-600">
                {overview.fleet
                  .filter((f) => f.nextRunAt && f.scheduleEnabled)
                  .slice(0, 3)
                  .map((f) => (
                    <li key={f.databaseId} className="flex justify-between gap-2">
                      <span className="font-medium text-slate-800">{f.databaseName}</span>
                      <span>{formatRelativeTime(f.nextRunAt!)}</span>
                    </li>
                  ))}
              </ul>
              <Link
                to="/schedules"
                className="mt-3 inline-block text-xs font-medium text-brand hover:underline"
              >
                Manage schedules
              </Link>
            </div>
          )}
        </aside>
      </div>
    </AppShell>
  );
}
