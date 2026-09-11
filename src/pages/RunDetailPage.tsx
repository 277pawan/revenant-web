import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ChevronRight, Download, Loader2, RefreshCw } from "lucide-react";
import { AppShell } from "../components/AppShell";
import { RestorePipelineGraph } from "../components/workflow/RestorePipelineGraph";
import { StatusBadge } from "../components/workflow/StatusBadge";
import { isActiveJob, jobDurationSeconds } from "../components/workflow/jobStatus";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import { useToast } from "../components/toast/ToastProvider";
import { formatDuration, runShortId, workflowSlug } from "../lib/workflow";
import type { JobDetailResource, JobResultResource, PlanServiceResource } from "../types/api";
import { roleHasPermission } from "../types/api";

export function RunDetailPage() {
  const { databaseId, jobId } = useParams<{ databaseId: string; jobId: string }>();
  const { user } = useAuth();
  const toast = useToast();
  const canRun = user ? roleHasPermission(user.role, "jobs:run") : false;
  const canDownload = user ? roleHasPermission(user.role, "evidence:read") : false;
  const [downloading, setDownloading] = useState(false);

  const [job, setJob] = useState<JobDetailResource | null>(null);
  const [service, setService] = useState<PlanServiceResource | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedCheck, setSelectedCheck] = useState<JobResultResource | null>(
    null
  );

  const load = useCallback(async () => {
    if (!jobId) return;
    try {
      const [jobRes, servicesRes] = await Promise.all([
        api.getJob(jobId),
        api.listPlanServices(),
      ]);
      setJob(jobRes.job);
      const svc = servicesRes.services.find(
        (s) => s.databaseId === (databaseId ?? jobRes.job.databaseId)
      );
      setService(svc ?? null);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load run");
    } finally {
      setLoading(false);
    }
  }, [jobId, databaseId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!job || !isActiveJob(job.status)) return;
    const t = setInterval(() => void load(), 3000);
    return () => clearInterval(t);
  }, [job, load]);

  const slug = service ? workflowSlug(service) : job?.databaseName ?? "workflow";
  const passChecks = job?.results.filter((r) => r.status === "pass").length ?? 0;
  const totalChecks = job?.results.length ?? 0;
  const reportReady =
    job != null && ["pass", "fail", "error"].includes(job.status);

  async function downloadReport() {
    if (!job || !reportReady) return;
    setDownloading(true);
    try {
      await api.downloadJobReport(job.id);
      toast.success("Report downloaded", "JSON evidence file saved.");
    } catch (err) {
      toast.error(
        "Download failed",
        err instanceof Error ? err.message : "Could not download report"
      );
    } finally {
      setDownloading(false);
    }
  }

  return (
    <AppShell>
      <nav className="mb-3 flex flex-wrap items-center gap-1 text-sm text-slate-500">
        <Link to="/workflows" className="hover:text-brand">Workflows</Link>
        <ChevronRight size={14} />
        <Link
          to={`/workflows/${databaseId ?? job?.databaseId}`}
          className="hover:text-brand"
        >
          {slug}
        </Link>
        <ChevronRight size={14} />
        <span className="text-slate-800">{job ? runShortId(job.id) : "…"}</span>
      </nav>

      {loading && !job ? (
        <div className="h-64 animate-pulse rounded-xl bg-slate-200" />
      ) : error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      ) : job ? (
        <>
          <div className="mb-4 flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="font-mono text-2xl font-semibold text-slate-900">
                  {runShortId(job.id)}
                </h1>
                <StatusBadge status={job.status} />
              </div>
              <p className="mt-1 text-sm text-slate-500">
                {new Date(job.createdAt).toLocaleString()}
                {jobDurationSeconds(job) != null
                  ? ` · ${formatDuration(job)}`
                  : ""}
              </p>
            </div>
            <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
              <button
                type="button"
                onClick={() => void load()}
                className="rounded-md border border-slate-300 bg-white p-2"
                aria-label="Refresh"
              >
                <RefreshCw size={16} />
              </button>
              {canDownload && (
                <button
                  type="button"
                  disabled={!reportReady || downloading}
                  onClick={() => void downloadReport()}
                  title={
                    reportReady
                      ? "Download signed JSON report"
                      : "Available when the run finishes"
                  }
                  className="inline-flex flex-1 items-center justify-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 disabled:cursor-not-allowed disabled:text-slate-400 sm:flex-none hover:bg-slate-50 disabled:hover:bg-white"
                >
                  {downloading ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <Download size={14} />
                  )}
                  Download report
                </button>
              )}
              {canRun && (
                <button
                  type="button"
                  disabled={!canRun}
                  className="rounded-md bg-brand px-4 py-2 text-sm font-medium text-white opacity-50"
                  title="Re-run from workflow page"
                >
                  Re-run validation
                </button>
              )}
            </div>
          </div>

          <div className="mb-4 grid grid-cols-2 gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:grid-cols-4">
            <div>
              <p className="text-[10px] font-semibold uppercase text-slate-400">
                RTO achieved
              </p>
              <p className="mt-1 text-lg font-semibold text-slate-900">
                {job.rtoSeconds != null ? `${job.rtoSeconds}s` : "—"}
              </p>
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase text-slate-400">
                Validation
              </p>
              <p
                className={`mt-1 text-lg font-semibold ${
                  job.status === "fail" || job.status === "error"
                    ? "text-red-600"
                    : "text-slate-900"
                }`}
              >
                {totalChecks > 0
                  ? `${passChecks}/${totalChecks} passed`
                  : "—"}
              </p>
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase text-slate-400">
                Execution
              </p>
              <p className="mt-1 text-lg font-semibold capitalize text-slate-900">
                {job.executionMode ?? "—"}
              </p>
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase text-slate-400">
                Runner
              </p>
              <p className="mt-1 font-mono text-sm text-slate-900">
                {service?.runner?.tokenPrefix
                  ? `${service.runner.tokenPrefix}…`
                  : "—"}
              </p>
            </div>
          </div>

          <section className="mb-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="mb-3 text-sm font-semibold text-slate-900">
              Restore plan execution pipeline
            </h2>
            {job.status === "pending" && (
              <p className="mb-3 flex items-center gap-2 text-sm text-slate-500">
                <Loader2 size={14} className="animate-spin" />
                Waiting for agent…
              </p>
            )}
            <RestorePipelineGraph job={job} onSelectCheck={setSelectedCheck} />
          </section>

          {(selectedCheck || job.errorMessage) && (
            <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
              <div className="border-b border-slate-100 px-4 py-3">
                <h2 className="text-sm font-semibold text-slate-900">
                  {selectedCheck ? (
                    <>
                      Selected node diagnostics:{" "}
                      <span
                        className={
                          selectedCheck.status === "fail"
                            ? "text-red-600"
                            : "text-slate-800"
                        }
                      >
                        {selectedCheck.checkName}
                      </span>
                    </>
                  ) : (
                    "Run error"
                  )}
                </h2>
              </div>
              <div className="bg-slate-900 p-4 font-mono text-xs leading-relaxed text-slate-200">
                {selectedCheck ? (
                  <>
                    <p className="text-red-400">
                      [{selectedCheck.status.toUpperCase()}] {selectedCheck.checkName}
                    </p>
                    <p className="mt-2 text-slate-300">
                      {selectedCheck.message ?? "No message recorded."}
                    </p>
                    {selectedCheck.durationMs != null && (
                      <p className="mt-2 text-slate-500">
                        Duration: {selectedCheck.durationMs}ms
                      </p>
                    )}
                  </>
                ) : (
                  <p className="text-red-300">{job.errorMessage}</p>
                )}
              </div>
            </section>
          )}
        </>
      ) : null}
    </AppShell>
  );
}
