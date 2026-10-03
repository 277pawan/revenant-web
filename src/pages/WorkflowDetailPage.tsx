import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { ChevronRight, RefreshCw } from "lucide-react";
import { AppShell } from "../components/AppShell";
import { PaginationBar } from "../components/PaginationBar";
import { RecoveryChallengesPanel } from "../components/RecoveryChallengesPanel";
import { RecoveryContractPanel } from "../components/RecoveryContractPanel";
import { RecoveryDriftPanel } from "../components/RecoveryDriftPanel";
import { RecoveryReadinessCard } from "../components/RecoveryReadinessCard";
import { ReadinessTrendChart } from "../components/ReadinessTrendChart";
import { DependencyGraphPanel } from "../components/workflow/DependencyGraphPanel";
import { RecoveryCostHint } from "../components/workflow/RecoveryCostHint";
import { RecoveryGatePanel } from "../components/workflow/RecoveryGatePanel";
import { RecoveryPointsPanel } from "../components/workflow/RecoveryPointsPanel";
import { QueuedDrillBanner } from "../components/workflow/QueuedDrillBanner";
import { WorkflowCommandCenter } from "../components/workflow/WorkflowCommandCenter";
import {
  WorkflowDetailTabs,
  WorkflowTabPanel,
  type WorkflowTabId,
} from "../components/workflow/WorkflowDetailTabs";
import { StatusBadge } from "../components/workflow/StatusBadge";
import { WorkflowExecutionInfo } from "../components/WorkflowExecutionInfo";
import { TableSearchBar } from "../components/TableSearchBar";
import { useToast } from "../components/toast/ToastProvider";
import { useDebouncedValue } from "../hooks/useDebouncedValue";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import type { OrganizationPlan } from "../types/api";
import {
  formatDuration,
  formatRelativeTime,
  runShortId,
  workflowSlug,
} from "../lib/workflow";
import {
  roleHasPermission,
  type AwsSourceStatus,
  type JobResource,
  type PaginationMeta,
  type PlanServiceResource,
  type ReadinessHistoryPoint,
  type RecoveryReadinessResource,
} from "../types/api";

const JOBS_PAGE_SIZE = 10;

type AwsSourceDisplayStatus =
  | AwsSourceStatus
  | (Partial<Omit<AwsSourceStatus, "state">> & { state: "checking" });

const VALID_TABS: WorkflowTabId[] = [
  "overview",
  "recovery-points",
  "analysis",
  "contract",
  "history",
];

function parseTab(value: string | null): WorkflowTabId {
  if (value && VALID_TABS.includes(value as WorkflowTabId)) {
    return value as WorkflowTabId;
  }
  return "overview";
}

export function WorkflowDetailPage() {
  const { databaseId } = useParams<{ databaseId: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = parseTab(searchParams.get("tab"));
  const { user } = useAuth();
  const toast = useToast();

  function setActiveTab(tab: WorkflowTabId) {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (tab === "overview") next.delete("tab");
        else next.set("tab", tab);
        return next;
      },
      { replace: true }
    );
  }
  const canRun = user ? roleHasPermission(user.role, "jobs:run") : false;
  const canDownload = user ? roleHasPermission(user.role, "evidence:read") : false;

  const [service, setService] = useState<PlanServiceResource | null>(null);
  const [jobs, setJobs] = useState<JobResource[]>([]);
  const [jobsPagination, setJobsPagination] = useState<PaginationMeta>({
    page: 1,
    pageSize: JOBS_PAGE_SIZE,
    total: 0,
    totalPages: 1,
  });
  const [jobsPage, setJobsPage] = useState(1);
  const [jobsSearch, setJobsSearch] = useState("");
  const debouncedJobsSearch = useDebouncedValue(jobsSearch, 300);
  const [loadingJobs, setLoadingJobs] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [readiness, setReadiness] = useState<RecoveryReadinessResource | null>(null);
  const [readinessHistory, setReadinessHistory] = useState<ReadinessHistoryPoint[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [refreshToken, setRefreshToken] = useState(0);
  const [deletedRecoveryPointIds, setDeletedRecoveryPointIds] = useState<string[]>([]);
  const [activeJobs, setActiveJobs] = useState<JobResource[]>([]);
  const [cancellingJobId, setCancellingJobId] = useState<string | null>(null);
  const [awsSourceStatus, setAwsSourceStatus] = useState<
    AwsSourceDisplayStatus | null
  >(null);

  const loadService = useCallback(async () => {
    if (!databaseId) return;
    setLoading(true);
    setError(null);
    try {
      const [servicesRes, databaseRes] = await Promise.all([
        api.listPlanServices(),
        api.getDatabase(databaseId),
      ]);
      const found = servicesRes.services.find((s) => s.databaseId === databaseId);
      if (found) {
        setService(found);
      } else {
        const { database } = databaseRes;
        let planName = database.validationPlanName ?? "default";
        let planVersion = database.validationPlanVersion ?? 0;
        let planUpdatedAt = database.updatedAt;
        if (database.hasValidationPlan) {
          try {
            const { plan } = await api.getValidationPlan(databaseId);
            planName = plan.name;
            planVersion = plan.version;
            planUpdatedAt = plan.updatedAt;
          } catch {
            // Use database summary fields when plan fetch fails.
          }
        }
        setService({
          databaseId: database.id,
          databaseName: database.name,
          planName,
          planVersion,
          planUpdatedAt,
          recoveryMode: database.recoveryMode,
          runner: null,
          jobs: [],
        });
      }
      try {
        const { readiness: readinessData } = await api.getDatabaseReadiness(databaseId);
        setReadiness(readinessData);
      } catch {
        setReadiness(null);
      }
      setHistoryLoading(true);
      try {
        const { history } = await api.getReadinessHistory(databaseId);
        setReadinessHistory(history);
      } catch {
        setReadinessHistory([]);
      } finally {
        setHistoryLoading(false);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load workflow");
      setService(null);
    } finally {
      setLoading(false);
    }
  }, [databaseId]);

  const loadJobs = useCallback(async () => {
    if (!databaseId) return;
    setLoadingJobs(true);
    try {
      const res = await api.listJobs(jobsPage, JOBS_PAGE_SIZE, {
        databaseId,
        search: debouncedJobsSearch.trim() || undefined,
      });
      setJobs(res.data);
      setJobsPagination(res.pagination);
    } catch {
      setJobs([]);
    } finally {
      setLoadingJobs(false);
    }
  }, [databaseId, jobsPage, debouncedJobsSearch]);

  useEffect(() => {
    void loadService();
  }, [loadService]);

  useEffect(() => {
    if (!service || service.recoveryMode !== "aws-rds") {
      setAwsSourceStatus(null);
      return;
    }

    let cancelled = false;
    setAwsSourceStatus({ state: "checking" });
    void api.getAwsSourceStatus(service.databaseId)
      .then(({ status }) => {
        if (!cancelled) setAwsSourceStatus(status);
      })
      .catch((err) => {
        if (!cancelled) {
          setAwsSourceStatus({
            state: "unknown",
            rdsStatus: null,
            availableSnapshotCount: null,
            latestSnapshotIdentifier: null,
            latestSnapshotCreatedAt: null,
            checkedAt: new Date().toISOString(),
            message: err instanceof Error ? err.message : "Could not check AWS source status.",
          });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [service?.databaseId, service?.recoveryMode]);

  useEffect(() => {
    setJobsPage(1);
  }, [debouncedJobsSearch]);

  useEffect(() => {
    void loadJobs();
  }, [loadJobs]);

  const loadActiveJobs = useCallback(async () => {
    try {
      const res = await api.listActiveJobs();
      setActiveJobs(res.jobs);
    } catch {
      setActiveJobs([]);
    }
  }, []);

  useEffect(() => {
    void loadActiveJobs();
  }, [loadActiveJobs, refreshToken, jobsPage]);

  const hasBusy =
    activeJobs.length > 0 ||
    jobs.some((j) => j.status === "pending" || j.status === "running");
  const wasBusy = useRef(false);

  useEffect(() => {
    if (!hasBusy) return;
    const t = setInterval(() => {
      void loadJobs();
      void loadService();
      void loadActiveJobs();
    }, 4000);
    return () => clearInterval(t);
  }, [hasBusy, loadJobs, loadService]);

  useEffect(() => {
    if (wasBusy.current && !hasBusy) {
      setRefreshToken((t) => t + 1);
      void loadService();
    }
    wasBusy.current = hasBusy;
  }, [hasBusy, loadService]);

  async function cancelQueuedJob(jobId: string) {
    setCancellingJobId(jobId);
    try {
      await api.cancelJob(jobId);
      toast.success("Cancelled", "Queued drill removed — you can start a new run.");
      await Promise.all([loadActiveJobs(), loadJobs(), loadService()]);
      setRefreshToken((t) => t + 1);
    } catch (err) {
      toast.error(
        "Cancel failed",
        err instanceof Error ? err.message : "Could not cancel drill"
      );
    } finally {
      setCancellingJobId(null);
    }
  }

  async function refreshAll() {
    try {
      await Promise.all([loadService(), loadJobs(), loadActiveJobs()]);
      setRefreshToken((t) => t + 1);
      toast.success("Refreshed", "Workflow, readiness, and drift updated.");
    } catch (err) {
      toast.error(
        "Refresh failed",
        err instanceof Error ? err.message : "Could not reload workflow"
      );
    }
  }

  async function runWorkflow() {
    if (!databaseId || !canRun) return;
    if (awsMode && awsSourceStatus?.state !== "available") {
      toast.error(
        "Full drill unavailable",
        awsSourceStatus?.message ?? "Wait for the AWS source check to finish."
      );
      return;
    }
    setRunning(true);
    try {
      await api.createJob({ databaseId, drillKind: "full" });
      const planHint = service?.planVersion
        ? `Using saved validation plan v${service.planVersion}.`
        : "Using the latest saved validation plan.";
      toast.success(
        "Full restore drill queued",
        `${planHint} Snapshot → restore → validate → cleanup.`
      );
      await Promise.all([loadJobs(), loadActiveJobs()]);
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
  const last = jobs[0] ?? service.jobs[0];
  const online =
    service.runner?.lastSeenAt &&
    Date.now() - new Date(service.runner.lastSeenAt).getTime() < 60_000;

  const awsMode = service.recoveryMode === "aws-rds";
  const canRunFullDrill =
    !awsMode || awsSourceStatus?.state === "available";
  const recentJobs = service.jobs;
  const passCount = recentJobs.filter((j) => j.status === "pass").length;
  const totalRuns = recentJobs.length;

  return (
    <AppShell>
      <nav className="mb-3 flex items-center gap-1 text-sm text-slate-500">
        <Link to="/workflows" className="hover:text-brand">Workflows</Link>
        <ChevronRight size={14} />
        <span className="text-slate-800">{slug}</span>
      </nav>

      <div className="mb-4 flex items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold text-slate-900">{slug}</h1>
        <button
          type="button"
          onClick={() => void refreshAll()}
          className="rounded-md border border-slate-300 bg-white p-2 text-slate-600 hover:bg-slate-50"
          aria-label="Refresh workflow"
        >
          <RefreshCw size={16} />
        </button>
      </div>

      <QueuedDrillBanner
        activeJobs={activeJobs}
        currentDatabaseId={service.databaseId}
        canCancel={canRun}
        cancellingId={cancellingJobId}
        onCancel={(id) => void cancelQueuedJob(id)}
      />

      <WorkflowCommandCenter
        service={service}
        readiness={readiness}
        lastJob={last}
        canRun={canRun}
        canRunFull={canRunFullDrill}
        sourceStatusMessage={
          awsSourceStatus?.state === "checking"
            ? "Checking the AWS source before enabling a full drill…"
            : awsSourceStatus?.message
        }
        canDownload={canDownload}
        running={running}
        awsMode={awsMode}
        onRunDrill={() => void runWorkflow()}
      />

      <WorkflowDetailTabs active={activeTab} onChange={setActiveTab} />

      <WorkflowTabPanel active={activeTab} id="overview">
        <div className="mb-6 grid gap-4 xl:grid-cols-2">
          {readiness ? (
            <RecoveryReadinessCard data={readiness} compact />
          ) : (
            <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-6 text-sm text-slate-600">
              Run a drill to calculate recovery readiness.
            </div>
          )}
          <RecoveryPointsPanel
            databaseId={service.databaseId}
            awsMode={awsMode}
            canRun={canRun}
            compact
            refreshToken={refreshToken}
            lastDrillStatus={last?.status}
            deletedRecoveryPointIds={deletedRecoveryPointIds}
            onRecoveryPointDeleted={(id) =>
              setDeletedRecoveryPointIds((current) => [...current, id])
            }
            onViewAll={() => setActiveTab("recovery-points")}
          />
        </div>
        {last?.status === "fail" && (
          <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
            Last drill failed.{" "}
            <Link
              to={`/workflows/${databaseId}/runs/${last.id}`}
              className="font-medium text-red-800 underline"
            >
              View run details
            </Link>{" "}
            for the snapshot restore or validation error.
          </div>
        )}
        <RecoveryCostHint awsMode={awsMode} />
      </WorkflowTabPanel>

      <WorkflowTabPanel active={activeTab} id="recovery-points">
        <div className="mb-6">
          <RecoveryPointsPanel
            databaseId={service.databaseId}
            awsMode={awsMode}
            canRun={canRun}
            refreshToken={refreshToken}
            lastDrillStatus={last?.status}
            deletedRecoveryPointIds={deletedRecoveryPointIds}
            onRecoveryPointDeleted={(id) =>
              setDeletedRecoveryPointIds((current) => [...current, id])
            }
          />
        </div>
      </WorkflowTabPanel>

      <WorkflowTabPanel active={activeTab} id="analysis">
        <div className="mb-6 grid gap-4 lg:grid-cols-2">
          <DependencyGraphPanel
            databaseId={service.databaseId}
            databaseName={service.databaseName}
            readiness={readiness}
          />
          <RecoveryGatePanel databaseId={service.databaseId} readiness={readiness} />
        </div>
        <div className="mb-6 grid gap-4 lg:grid-cols-2">
          <ReadinessTrendChart history={readinessHistory} loading={historyLoading} />
          <RecoveryChallengesPanel
            databaseId={service.databaseId}
            canRun={canRun}
            refreshToken={refreshToken}
          />
        </div>
        <div className="mb-6">
          <RecoveryDriftPanel
            databaseId={service.databaseId}
            onRunDrill={
              canRun && canRunFullDrill
                ? () => void runWorkflow()
                : undefined
            }
            runningDrill={running}
            refreshToken={refreshToken}
          />
        </div>
      </WorkflowTabPanel>

      <WorkflowTabPanel active={activeTab} id="contract">
        <div className="mb-6 space-y-4">
          <RecoveryContractPanel databaseId={service.databaseId} />
          <WorkflowExecutionInfo
            plan={(user?.organizationPlan ?? "starter") as OrganizationPlan}
            service={service}
          />
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
                <dd className="font-medium text-slate-900">
                  {service.planName}
                  {service.planVersion != null && (
                    <span className="ml-1 text-xs font-normal text-slate-500">
                      v{service.planVersion}
                    </span>
                  )}
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-slate-500">Drill</dt>
                <dd className="text-right text-slate-900">
                  {awsMode
                    ? "Full: snapshot → restore sandbox → validate → reap"
                    : "Direct Postgres validation"}
                </dd>
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
      </WorkflowTabPanel>

      <WorkflowTabPanel active={activeTab} id="history">
      <section
        id="workflow-execution-history"
        className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm scroll-mt-6"
      >
        <div className="border-b border-slate-100 px-4 py-3">
          <h2 className="font-semibold text-slate-900">Execution history</h2>
          <p className="mt-0.5 text-xs text-slate-500">
            {jobsPagination.total} run{jobsPagination.total === 1 ? "" : "s"} total
          </p>
        </div>

        <TableSearchBar
          value={jobsSearch}
          onChange={setJobsSearch}
          placeholder="Search by run ID, status, or trigger…"
          className="border-b border-slate-100 px-4 py-2"
        />

        {loadingJobs && jobs.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-slate-500">Loading runs…</p>
        ) : jobs.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-slate-500">
            {debouncedJobsSearch.trim()
              ? "No runs match your search."
              : "No runs yet. Click Run workflow to start."}
          </p>
        ) : (
          <>
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
                {jobs.map((job) => (
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
            {jobsPagination.total > 0 && (
              <PaginationBar pagination={jobsPagination} onPageChange={setJobsPage} />
            )}
          </>
        )}
      </section>
      </WorkflowTabPanel>
    </AppShell>
  );
}
