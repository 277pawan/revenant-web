import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Play, RefreshCw } from "lucide-react";
import { AppShell } from "../components/AppShell";
import { PaginationBar } from "../components/PaginationBar";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import {
  roleHasPermission,
  type DatabaseResource,
  type JobResource,
  type PaginationMeta,
} from "../types/api";

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    pending: "bg-slate-100 text-slate-700",
    running: "bg-cyan-50 text-cyan-800",
    pass: "bg-emerald-50 text-emerald-800",
    fail: "bg-red-50 text-red-800",
    error: "bg-red-50 text-red-800",
    cancelled: "bg-slate-100 text-slate-500",
  };
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-xs font-medium uppercase tracking-wide ${
        styles[status] ?? "bg-slate-100 text-slate-600"
      }`}
    >
      {status}
    </span>
  );
}

function ExecutionBadge({ mode }: { mode: string | null }) {
  if (!mode) return <span className="text-xs text-slate-400">—</span>;
  if (mode === "stub") {
    return (
      <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-900">
        Simulated
      </span>
    );
  }
  return (
    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium uppercase text-slate-700">
      {mode}
    </span>
  );
}

export function JobsPage() {
  const { user } = useAuth();
  const canRun = user ? roleHasPermission(user.role, "jobs:run") : false;

  const [jobs, setJobs] = useState<JobResource[]>([]);
  const [pagination, setPagination] = useState<PaginationMeta>({
    page: 1,
    pageSize: 20,
    total: 0,
    totalPages: 1,
  });
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [databases, setDatabases] = useState<DatabaseResource[]>([]);
  const [selectedDb, setSelectedDb] = useState("");
  const [running, setRunning] = useState(false);

  const load = useCallback(async (nextPage: number) => {
    setLoading(true);
    setError(null);
    try {
      const [jobsRes, dbsRes] = await Promise.all([
        api.listJobs(nextPage, 20),
        api.listDatabases(1, 100),
      ]);
      setJobs(jobsRes.data);
      setPagination(jobsRes.pagination);
      setPage(jobsRes.pagination.page);
      setDatabases(dbsRes.data);
      setSelectedDb((prev) => prev || dbsRes.data[0]?.id || "");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load jobs");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(page);
  }, [load, page]);

  // Auto-refresh while any job is pending/running
  useEffect(() => {
    const busy = jobs.some((j) => j.status === "pending" || j.status === "running");
    if (!busy) return;
    const t = setInterval(() => void load(page), 4000);
    return () => clearInterval(t);
  }, [jobs, load, page]);

  async function runJob() {
    if (!selectedDb || !canRun) return;
    setRunning(true);
    setError(null);
    try {
      await api.createJob({ databaseId: selectedDb });
      await load(1);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start job");
    } finally {
      setRunning(false);
    }
  }

  return (
    <AppShell>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Jobs</h1>
          <p className="mt-1 text-sm text-slate-600">
            Restore validation runs. Stub = simulated. Use Settings → Runners for real agent/CI
            tokens (see RUNNERS.md).
          </p>
        </div>
        <button
          type="button"
          onClick={() => void load(page)}
          className="inline-flex items-center gap-1 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
        >
          <RefreshCw size={14} />
          Refresh
        </button>
      </div>

      {canRun && (
        <div className="mb-6 flex flex-wrap items-end gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <label className="min-w-[220px] flex-1 text-sm">
            <span className="font-medium text-slate-700">Database</span>
            <select
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              value={selectedDb}
              onChange={(e) => setSelectedDb(e.target.value)}
            >
              {databases.length === 0 && <option value="">No databases</option>}
              {databases.map((db) => (
                <option key={db.id} value={db.id}>
                  {db.name}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            disabled={!selectedDb || running}
            onClick={() => void runJob()}
            className="inline-flex items-center gap-2 rounded-md bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            <Play size={14} />
            {running ? "Queuing…" : "Run validation"}
          </button>
        </div>
      )}

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      )}

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        {loading && jobs.length === 0 ? (
          <div className="space-y-3 p-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-10 animate-pulse rounded bg-slate-100" />
            ))}
          </div>
        ) : jobs.length === 0 ? (
          <div className="px-6 py-14 text-center text-sm text-slate-500">
            No jobs yet. Queue a validation run above, then start{" "}
            <code className="rounded bg-slate-100 px-1 text-xs">npm run runner:stub</code> in
            the API repo.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-medium">Job</th>
                  <th className="px-4 py-3 font-medium">Database</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Execution</th>
                  <th className="px-4 py-3 font-medium">Trigger</th>
                  <th className="px-4 py-3 font-medium">RTO</th>
                  <th className="px-4 py-3 font-medium">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {jobs.map((job) => (
                  <tr key={job.id} className="hover:bg-slate-50/80">
                    <td className="px-4 py-3">
                      <Link
                        to={`/jobs/${job.id}`}
                        className="font-mono text-xs text-brand hover:underline"
                      >
                        {job.id.slice(0, 8)}…
                      </Link>
                    </td>
                    <td className="px-4 py-3 font-medium text-slate-900">{job.databaseName}</td>
                    <td className="px-4 py-3">
                      <StatusBadge status={job.status} />
                    </td>
                    <td className="px-4 py-3">
                      <ExecutionBadge mode={job.executionMode} />
                    </td>
                    <td className="px-4 py-3 capitalize text-slate-600">{job.trigger}</td>
                    <td className="px-4 py-3 tabular-nums text-slate-600">
                      {job.rtoSeconds != null ? `${job.rtoSeconds}s` : "—"}
                    </td>
                    <td className="px-4 py-3 text-slate-500">
                      {new Date(job.createdAt).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {!loading && pagination.total > 0 && (
          <PaginationBar pagination={pagination} onPageChange={setPage} />
        )}
      </div>
    </AppShell>
  );
}
