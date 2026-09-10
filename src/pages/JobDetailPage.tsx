import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { AppShell } from "../components/AppShell";
import { api } from "../lib/api";
import type { JobDetailResource } from "../types/api";

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    pending: "bg-slate-100 text-slate-700",
    running: "bg-cyan-50 text-cyan-800",
    pass: "bg-emerald-50 text-emerald-800",
    fail: "bg-red-50 text-red-800",
    error: "bg-red-50 text-red-800",
    skip: "bg-slate-100 text-slate-500",
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

export function JobDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [job, setJob] = useState<JobDetailResource | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      const res = await api.getJob(id);
      setJob(res.job);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load job");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!job || (job.status !== "pending" && job.status !== "running")) return;
    const t = setInterval(() => void load(), 3000);
    return () => clearInterval(t);
  }, [job, load]);

  return (
    <AppShell>
      <Link
        to="/jobs"
        className="mb-3 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800"
      >
        <ArrowLeft size={14} />
        Jobs
      </Link>

      {loading && !job ? (
        <div className="h-40 animate-pulse rounded-lg bg-slate-200" />
      ) : error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      ) : job ? (
        <>
          <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
                  Job detail
                </h1>
                <StatusBadge status={job.status} />
                {job.executionMode === "stub" && (
                  <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-900">
                    Simulated — not a real DB check
                  </span>
                )}
                {job.executionMode && job.executionMode !== "stub" && (
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium uppercase text-slate-700">
                    {job.executionMode}
                  </span>
                )}
              </div>
              <p className="mt-1 font-mono text-xs text-slate-500">{job.id}</p>
            </div>
          </div>

          <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[
              ["Database", job.databaseName],
              ["Trigger", job.trigger],
              ["RTO", job.rtoSeconds != null ? `${job.rtoSeconds}s` : "—"],
              ["Created", new Date(job.createdAt).toLocaleString()],
            ].map(([k, v]) => (
              <div
                key={k}
                className="rounded-lg border border-slate-200 bg-white px-4 py-3 shadow-sm"
              >
                <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
                  {k}
                </div>
                <div className="mt-1 text-sm font-medium text-slate-900">{v}</div>
              </div>
            ))}
          </div>

          {job.errorMessage && (
            <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              {job.errorMessage}
            </div>
          )}

          <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 px-4 py-3 text-sm font-semibold text-slate-900">
              Check results
            </div>
            {job.results.length === 0 ? (
              <div className="px-4 py-10 text-center text-sm text-slate-500">
                {job.status === "pending" || job.status === "running"
                  ? "Waiting for runner…"
                  : "No check results recorded."}
              </div>
            ) : (
              <table className="w-full text-left text-sm">
                <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-4 py-3 font-medium">Check</th>
                    <th className="px-4 py-3 font-medium">Type</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="px-4 py-3 font-medium">Duration</th>
                    <th className="px-4 py-3 font-medium">Message</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {job.results.map((r) => (
                    <tr key={r.id}>
                      <td className="px-4 py-3 font-medium text-slate-900">{r.checkName}</td>
                      <td className="px-4 py-3 font-mono text-xs text-slate-600">{r.checkType}</td>
                      <td className="px-4 py-3">
                        <StatusBadge status={r.status} />
                      </td>
                      <td className="px-4 py-3 tabular-nums text-slate-600">
                        {r.durationMs != null ? `${r.durationMs}ms` : "—"}
                      </td>
                      <td className="px-4 py-3 text-slate-600">{r.message ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      ) : null}
    </AppShell>
  );
}
