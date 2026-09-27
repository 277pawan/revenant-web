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
import { FleetPostureSummary } from "../components/dashboard/FleetPostureSummary";
import { NextStepCard } from "../components/dashboard/NextStepCard";
import { ProductGuideLauncher } from "../components/guide/ProductGuideWizard";
import { SubscriptionBanner } from "../components/SubscriptionBanner";
import { RecoveryReadinessCard } from "../components/RecoveryReadinessCard";
import { RpoTrendChart } from "../components/RpoTrendChart";
import { RtoTrendChart } from "../components/RtoTrendChart";
import { DateTimeText } from "../components/DateTimeText";
import { useAuth } from "../lib/auth";
import { api } from "../lib/api";
import { getPlanDefinition } from "../lib/plans";
import { marketingLink, site } from "../lib/site";
import { redirectToWebsiteBilling } from "../lib/subscription-access";
import { formatRelativeTime } from "../lib/datetime";
import type {
  DashboardFleetRow,
  DashboardOverview,
  DashboardRpoTrendPoint,
  DashboardRtoTrendPoint,
  FleetHealthStatus,
  RecoveryReadinessResource,
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
  const [rpoDays, setRpoDays] = useState<DashboardRpoTrendPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [trendsLoading, setTrendsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [readiness, setReadiness] = useState<RecoveryReadinessResource | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setTrendsLoading(true);
    setError(null);
    setReadiness(null);
    try {
      const [{ overview: data }, rtoRes, rpoRes] = await Promise.all([
        api.getDashboardOverview(),
        api.getDashboardRtoTrends().catch(() => ({ trends: { days: [] } })),
        api.getDashboardRpoTrends().catch(() => ({ trends: { days: [] } })),
      ]);
      setOverview(data);
      setRtoDays(rtoRes.trends.days);
      setRpoDays(rpoRes.trends.days);

      const primary = data.fleet[0];
      if (primary) {
        try {
          const { readiness: readinessData } = await api.getDatabaseReadiness(
            primary.databaseId
          );
          setReadiness(readinessData);
        } catch {
          // Readiness is additive — don't block the dashboard if API is behind.
        }
      }
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
      <section className="mb-5 overflow-hidden rounded-xl border border-slate-200 bg-gradient-to-br from-slate-900 via-slate-800 to-blue-900 px-5 py-6 text-white shadow-sm sm:px-6">
        <div className="flex flex-wrap items-start justify-between gap-6">
          <div className="max-w-2xl">
            <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-blue-100">
              <Shield size={14} />
              DR proof · {user?.organizationName}
            </div>
            <h1 data-tour="dashboard-hero" className="text-2xl font-bold tracking-tight sm:text-3xl">{heroHeadline}</h1>
            <p className="mt-3 text-sm leading-relaxed text-slate-300">
              See which databases would actually come back after an outage, how fast recovery would
              be, and download signed proof for your team or auditors.
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              <div data-tour="dashboard-guide-launcher">
                <ProductGuideLauncher compact />
              </div>
              {canRun && (
                <Link
                  to="/workflows"
                  data-tour="dashboard-run-drill"
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
              <a
                href={site.pricingUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 inline-block text-[10px] uppercase tracking-wide text-slate-400 hover:text-white"
              >
                Billing on marketing site →
              </a>
            )}
          </div>
        </div>
      </section>

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {overview && !allOnboarded && <NextStepCard steps={overview.onboarding} />}

      {overview && (
        <FleetPostureSummary summary={overview.summary} loading={loading} />
      )}

      {readiness && <RecoveryReadinessCard data={readiness} compact />}

      <div data-tour="dashboard-metrics" className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          {
            label: "Drills passed (7 days)",
            value:
              overview?.summary.passRate7d != null
                ? `${overview.summary.passRate7d}%`
                : "—",
            hint: "Share of restore drills that succeeded",
            icon: TrendingUp,
          },
          {
            label: "Avg recovery time",
            value: formatRto(overview?.summary.avgRtoSeconds7d ?? null),
            hint: "How long successful restores took",
            icon: Clock,
          },
          {
            label: "Failed drills (24h)",
            value: overview?.summary.failures24h ?? "—",
            hint: "Needs investigation if above zero",
            icon: AlertTriangle,
          },
          {
            label: "Evidence reports",
            value: overview?.summary.evidenceCount ?? "—",
            hint: "Signed proof ready to download",
            icon: FileCheck,
          },
        ].map((card) => (
          <div
            key={card.label}
            data-tour={card.label === "Drills passed (7 days)" ? "dashboard-metrics" : undefined}
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

      <div className="mb-5">
        <div className="mb-3">
          <h2 className="text-sm font-semibold text-slate-900">Recovery trends</h2>
          <p className="text-xs text-slate-500">
            Left: time to restore · Right: how stale backup data was (RPO)
          </p>
        </div>
        <div className="grid gap-4 xl:grid-cols-2">
          <RtoTrendChart days={rtoDays} loading={trendsLoading} />
          <RpoTrendChart days={rpoDays} loading={trendsLoading} />
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        {/* Fleet table */}
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 px-4 py-3">
            <div>
              <h2 className="font-semibold text-slate-900">Your protected databases</h2>
              <p className="text-xs text-slate-500">
                Green = last drill passed · Red = action needed
                {(overview?.summary.agentsOnline ?? 0) > 0
                  ? ` · ${overview?.summary.agentsOnline} agent online`
                  : ""}
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
                  <th className="px-4 py-3 font-medium">Posture</th>
                  <th className="px-4 py-3 font-medium">Last drill</th>
                  <th className="px-4 py-3 font-medium">Recovery time</th>
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
                    <td colSpan={6} className="px-4 py-14 text-center">
                      <p className="font-medium text-slate-800">No workflows in your fleet yet</p>
                      <p className="mx-auto mt-1 max-w-sm text-sm text-slate-500">
                        Import the AWS free-tier sample or register your own database to see restore
                        posture here.
                      </p>
                      <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
                        <Link
                          to="/databases/new?sample=aws-freetier"
                          className="inline-flex items-center gap-1 rounded-lg bg-brand px-3 py-2 text-sm font-medium text-white hover:bg-blue-700"
                        >
                          Quick start sample
                        </Link>
                        <Link
                          to="/databases/new"
                          className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50"
                        >
                          Add database
                        </Link>
                      </div>
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
              {!overview.onboarding.find((step) => step.id === "database")?.done && (
                <Link
                  to="/databases/new?sample=aws-freetier"
                  className="mt-3 inline-flex w-full items-center justify-center rounded-lg border border-blue-300 bg-white px-3 py-2 text-sm font-medium text-blue-900 hover:bg-blue-100/60"
                >
                  Quick start: import AWS sample workflow
                </Link>
              )}
              <ul className="mt-4 space-y-2">
                {overview.onboarding.map((step) => (
                  <li key={step.id}>
                    <div
                      className={`flex items-center gap-2 rounded-lg px-2 py-2 text-sm transition-colors ${
                        step.done
                          ? "text-emerald-800"
                          : "bg-white text-slate-800"
                      }`}
                    >
                      {step.done ? (
                        <CheckCircle2 size={16} className="shrink-0 text-emerald-600" />
                      ) : (
                        <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 border-slate-300" />
                      )}
                      <Link
                        to={step.href}
                        className={`flex min-w-0 flex-1 items-center gap-2 ${
                          step.done ? "" : "hover:text-brand"
                        }`}
                      >
                        <span className="flex-1">{step.label}</span>
                        {!step.done && <ChevronRight size={14} className="text-slate-400" />}
                      </Link>
                      {step.docsHref && (
                        <a
                          href={marketingLink(step.docsHref)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="shrink-0 text-[11px] font-medium text-blue-700 hover:underline"
                        >
                          Docs
                        </a>
                      )}
                    </div>
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
            {plan.id === "starter" && user?.role === "admin" && (
              <button
                type="button"
                onClick={() => redirectToWebsiteBilling({ plan: "pro", upgrade: true })}
                className="mt-4 w-full rounded-md bg-slate-50 px-3 py-2 text-left text-xs text-slate-600 hover:bg-slate-100"
              >
                Upgrade to <strong>Pro</strong> for more workflows, parallel drills, and longer
                evidence retention →
              </button>
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
