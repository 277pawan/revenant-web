import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ChevronRight, MoreVertical, Play, RefreshCw } from "lucide-react";
import { AppShell } from "../components/AppShell";
import { useToast } from "../components/toast/ToastProvider";
import { StatusBadge } from "../components/workflow/StatusBadge";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import {
  formatDuration,
  formatRelativeTime,
  runShortId,
  workflowSlug,
} from "../lib/workflow";
import { roleHasPermission, type PlanServiceResource } from "../types/api";

export function WorkflowDetailPage() {
  const { databaseId } = useParams<{ databaseId: string }>();
  const { user } = useAuth();
  const toast = useToast();
  const canRun = user ? roleHasPermission(user.role, "jobs:run") : false;

  const [service, setService] = useState<PlanServiceResource | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);

  const load = useCallback(async () => {
    if (!databaseId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await api.listPlanServices();
      const found = res.services.find((s) => s.databaseId === databaseId);
      if (!found) {
        setError("Workflow not found");
        setService(null);
      } else {
        setService(found);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load workflow");
    } finally {
      setLoading(false);
    }
  }, [databaseId]);

  useEffect(() => {
    void load();
  }, [load]);

  const hasBusy = service?.jobs.some(
    (j) => j.status === "pending" || j.status === "running"
  );

  useEffect(() => {
    if (!hasBusy) return;
    const t = setInterval(() => void load(), 4000);
    return () => clearInterval(t);
  }, [hasBusy, load]);

  async function runWorkflow() {
    if (!databaseId || !canRun) return;
    setRunning(true);
    try {
      await api.createJob({ databaseId });
      toast.success("Workflow started", "Run queued.");
      await load();
    } catch (err) {
      toast.error(
        "Could not start run",
        err instanceof Error ? err.message : "Request failed"
      );
    } finally {
      setRunning(false);
    }
  }

  if (loading && !service) {
    return (
      <AppShell>
        <div className="h-64 animate-pulse rounded-xl bg-slate-200" />
      </AppShell>
    );
  }

  if (error || !service) {
    return (
      <AppShell>
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error ?? "Workflow not found"}
        </div>
      </AppShell>
    );
  }

  const slug = workflowSlug(service);
  const last = service.jobs[0];
  const online =
    service.runner?.lastSeenAt &&
    Date.now() - new Date(service.runner.lastSeenAt).getTime() < 60_000;

  const passCount = service.jobs.filter((j) => j.status === "pass").length;
  const totalRuns = service.jobs.length;

  return (
    <AppShell>
      <nav className="mb-3 flex items-center gap-1 text-sm text-slate-500">
        <Link to="/workflows" className="hover:text-brand">Workflows</Link>
        <ChevronRight size={14} />
        <span className="text-slate-800">{slug}</span>
      </nav>

      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold text-slate-900">{slug}</h1>
          {last && <StatusBadge status={last.status} />}
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => void load()}
            className="rounded-md border border-slate-300 bg-white p-2 text-slate-600 hover:bg-slate-50"
          >
            <RefreshCw size={16} />
          </button>
          <button
            type="button"
            className="rounded-md border border-slate-300 bg-white p-2 text-slate-600"
            aria-label="More actions"
          >
            <MoreVertical size={16} />
          </button>
          {canRun && (
            <button
              type="button"
              disabled={running}
              onClick={() => void runWorkflow()}
              className="inline-flex items-center gap-2 rounded-md bg-brand px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              <Play size={16} />
              {running ? "Queuing…" : "Run workflow"}
            </button>
          )}
        </div>
      </div>

      <div className="mb-6 grid gap-4 md:grid-cols-2">
        <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            Configuration
          </h2>
          <dl className="mt-3 space-y-2 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-slate-500">Database</dt>
              <dd className="font-medium text-slate-900">{service.databaseName}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-slate-500">Plan</dt>
              <dd className="font-medium text-slate-900">{service.planName}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-slate-500">Schedule</dt>
              <dd className="text-slate-900">Manual</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-slate-500">Validation plan</dt>
              <dd>
                <Link
                  to={`/settings/validation-plans?databaseId=${service.databaseId}`}
                  className="text-brand hover:underline"
                >
                  revenant.yaml
                </Link>
              </dd>
            </div>
          </dl>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              Agent status
            </h2>
            <span
              className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                online
                  ? "bg-emerald-100 text-emerald-800"
                  : "bg-slate-100 text-slate-600"
              }`}
            >
              {online ? "Online" : "Offline"}
            </span>
          </div>
          <dl className="mt-3 space-y-2 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-slate-500">Runner</dt>
              <dd className="font-mono text-xs text-slate-900">
                {service.runner
                  ? `${service.runner.tokenPrefix}…`
                  : "Not connected"}
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-slate-500">Last heartbeat</dt>
              <dd className="text-slate-900">
                {service.runner?.lastSeenAt
                  ? formatRelativeTime(service.runner.lastSeenAt)
                  : "—"}
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-slate-500">Success rate</dt>
              <dd className="text-slate-900">
                {totalRuns > 0
                  ? `${Math.round((passCount / totalRuns) * 100)}%`
                  : "—"}
              </dd>
            </div>
          </dl>
          <Link
            to="/settings/runners"
            className="mt-3 inline-block text-xs text-brand hover:underline"
          >
            Agent setup →
          </Link>
        </section>
      </div>

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-4 py-3">
          <h2 className="font-semibold text-slate-900">Execution history</h2>
        </div>

        {service.jobs.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-slate-500">
            No runs yet. Click <strong>Run workflow</strong> to start.
          </p>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-100 bg-slate-50 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
              <tr>
                <th className="px-4 py-2">Run ID</th>
                <th className="px-4 py-2">Started</th>
                <th className="px-4 py-2">Duration</th>
                <th className="px-4 py-2">Status</th>
                <th className="px-4 py-2">Triggered by</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {service.jobs.map((job) => (
                <tr key={job.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-mono text-brand">
                    <Link to={`/workflows/${databaseId}/runs/${job.id}`}>
                      {runShortId(job.id)}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {new Date(job.createdAt).toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {formatDuration(job)}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={job.status} />
                  </td>
                  <td className="px-4 py-3 capitalize text-slate-600">
                    {job.trigger}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      to={`/workflows/${databaseId}/runs/${job.id}`}
                      className="text-slate-400 hover:text-brand"
                    >
                      <ChevronRight size={16} />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </AppShell>
  );
}
