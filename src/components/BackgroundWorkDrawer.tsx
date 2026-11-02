import { useCallback, useEffect, useState } from "react";
import { Check, ChevronDown, ChevronRight, Clock3, LoaderCircle, PanelRightClose, PanelRightOpen, X, XCircle } from "lucide-react";
import { Link } from "react-router-dom";
import { api } from "../lib/api";
import { isActiveJob, statusLabel } from "./workflow/jobStatus";
import type {
  JobDetailResource,
  JobResource,
  RedisProofCheck,
  RedisProofResource,
} from "../types/api";

const DRAWER_KEY = "revenant-background-work-open";
const RECOVERY_TASKS_KEY = "revenant-background-recovery-tasks";
const TRACKED_JOBS_KEY = "revenant-background-job-ids";
const REDIS_TASKS_KEY = "revenant-background-redis-proof-ids";
const RECENT_DONE_MS = 5 * 60 * 1000;

type RecoveryTask = {
  recoveryPointId: string;
  instanceId: string;
  instanceIdentifier: string;
  databaseName: string;
  status: string;
  updatedAt: string;
};

type RedisProofTask = {
  proofId: string;
  redisResourceId: string;
  resourceName: string;
  status: string;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
  lastError: string | null;
  lastErrorKind: string | null;
  errorMessage: string | null;
  sourceKeyCount: number | null;
  restoredKeyCount: number | null;
  restoreSeconds: number | null;
  checks: RedisProofCheck[];
};

function readRecoveryTasks(): RecoveryTask[] {
  try {
    return JSON.parse(sessionStorage.getItem(RECOVERY_TASKS_KEY) ?? "[]") as RecoveryTask[];
  } catch {
    return [];
  }
}

function readRedisProofTasks(): RedisProofTask[] {
  try {
    const tasks = JSON.parse(sessionStorage.getItem(REDIS_TASKS_KEY) ?? "[]") as RedisProofTask[];
    return Array.isArray(tasks)
      ? tasks.filter((task) => task.proofId && task.redisResourceId)
      : [];
  } catch {
    return [];
  }
}

function redisProofPhase(task: RedisProofTask): string {
  if (task.status === "pending") {
    return task.lastErrorKind === "unreachable"
      ? task.lastError ?? "Waiting for a runner on your Redis network."
      : "Waiting for an available runner.";
  }
  if (task.status === "running") return "Capturing and restoring Redis data in an isolated worker.";
  if (task.status === "pass") return "Restore proof passed.";
  if (task.status === "fail") return "Restore proof finished with failed checks.";
  if (task.status === "error") return "Proof could not run.";
  return statusLabel(task.status);
}

function isActiveRedisProof(task: RedisProofTask): boolean {
  return task.status === "pending" || task.status === "running";
}

function redisProofFromResource(proof: RedisProofResource): RedisProofTask {
  return {
    proofId: proof.id,
    redisResourceId: proof.redisResourceId,
    resourceName: "",
    status: proof.status,
    createdAt: proof.createdAt,
    startedAt: proof.startedAt,
    completedAt: proof.completedAt,
    lastError: proof.lastError,
    lastErrorKind: proof.lastErrorKind,
    errorMessage: proof.errorMessage,
    sourceKeyCount: proof.sourceKeyCount,
    restoredKeyCount: proof.restoredKeyCount,
    restoreSeconds: proof.restoreSeconds,
    checks: proof.checks,
  };
}

function phaseLabel(job: JobDetailResource | JobResource): string {
  if (job.status === "pending") return "Waiting for an available runner";
  if (job.status === "running") {
    const cleanupStarted = "results" in job && job.results.some((result) => result.checkType === "cleanup");
    if (cleanupStarted) return "Cleaning up temporary resources";
    return job.runnerProgress?.message ?? "Runner is preparing the validation run.";
  }
  if (job.status === "pass") return "Verification complete";
  if (job.status === "fail") return "Verification finished with failed checks";
  if (job.status === "error") return "Run ended with an error";
  if (job.status === "cancelled") return "Run cancelled";
  return statusLabel(job.status);
}

type BackgroundCheck = {
  id: string;
  checkName: string;
  checkType: string;
  status: string;
  message: string | null;
};

function backgroundCheckLabel(checkName: string): string {
  switch (checkName) {
    case "snapshot":
      return "Create recovery snapshot";
    case "drill_snapshot_cleanup":
      return "Recovery snapshot retention";
    case "recovery_snapshot":
      return "Restore from recovery snapshot";
    case "temp_instance_cleanup":
      return "Temporary database cleanup";
    default:
      return checkName;
  }
}

function backgroundChecks(job: JobDetailResource): BackgroundCheck[] {
  const checks = new Map<string, BackgroundCheck>();
  for (const check of job.runnerProgress?.checks ?? []) {
    const keyName =
      check.checkType === "source_validation"
        ? check.message ?? check.checkName
        : check.checkName;
    checks.set(`${check.checkType}:${keyName}`, {
      id: `progress-${check.checkType}-${check.checkName}`,
      checkName: check.checkName,
      checkType: check.checkType,
      status: check.status,
      message: check.message,
    });
  }
  for (const check of job.results) {
    const keyName =
      check.checkType === "source_validation"
        ? check.message ?? check.checkName
        : check.checkName;
    checks.set(`${check.checkType}:${keyName}`, {
      id: check.id,
      checkName: check.checkName,
      checkType: check.checkType,
      status: check.status,
      message: check.message,
    });
  }
  return [...checks.values()];
}

function checkStatusLabel(check: BackgroundCheck): string {
  if (check.status !== "skip" || check.checkType !== "cleanup") return check.status;
  if (/scheduled|pending/i.test(check.message ?? "")) return "pending";
  if (/retained/i.test(check.message ?? "")) return "retained";
  return "skipped";
}

function elapsedLabel(startedAt: string | null, now: number): string {
  if (!startedAt) return "Elapsed time unavailable";
  const elapsedSeconds = Math.max(0, Math.floor((now - Date.parse(startedAt)) / 1000));
  const minutes = Math.floor(elapsedSeconds / 60);
  const seconds = elapsedSeconds % 60;
  return minutes > 0 ? `Elapsed ${minutes}m ${seconds}s` : `Elapsed ${seconds}s`;
}

export function BackgroundWorkDrawer() {
  const [jobs, setJobs] = useState<JobDetailResource[]>([]);
  const [recoveryTasks, setRecoveryTasks] = useState<RecoveryTask[]>(readRecoveryTasks);
  const [redisProofTasks, setRedisProofTasks] = useState<RedisProofTask[]>(readRedisProofTasks);
  const [open, setOpen] = useState(() => sessionStorage.getItem(DRAWER_KEY) !== "false");
  const [expanded, setExpanded] = useState<string | null>(null);

  const load = useCallback(async () => {
    let trackedIds: string[] = [];
    try {
      trackedIds = JSON.parse(sessionStorage.getItem(TRACKED_JOBS_KEY) ?? "[]") as string[];
    } catch {
      trackedIds = [];
    }
    const [activeJobs, latestRecoveries, latestRedisProofs] = await Promise.all([
      api.listActiveJobs().catch(() => null),
      Promise.all(readRecoveryTasks().map(async (task) => {
        try {
          const response = await api.listRecoveryInstances(task.recoveryPointId);
          const instance = response.instances.find((candidate) => candidate.id === task.instanceId);
          return instance ? { ...task, status: instance.status, updatedAt: new Date().toISOString() } : task;
        } catch {
          return task;
        }
      })).catch(() => readRecoveryTasks()),
      Promise.all(readRedisProofTasks().map(async (task) => {
        try {
          const response = await api.listRedisProofHistory(task.redisResourceId, {
            offset: 0,
            limit: 10,
            search: task.proofId,
          });
          const proof = response.proofs.find((candidate) => candidate.id === task.proofId);
          if (!proof) return task;
          return {
            ...redisProofFromResource(proof),
            resourceName: task.resourceName,
          };
        } catch {
          return task;
        }
      })),
    ]);
    if (activeJobs) {
      const jobIds = [...new Set([...activeJobs.jobs.map((job) => job.id), ...trackedIds])];
      const details = await Promise.all(
        jobIds.map(async (id) => {
          try {
            return (await api.getJob(id)).job;
          } catch {
            return null;
          }
        })
      );
      const knownJobs = details.filter((job): job is JobDetailResource => job !== null);
      const retainedIds = knownJobs
        .filter((job) => isActiveJob(job.status) || (job.finishedAt && Date.now() - Date.parse(job.finishedAt) < RECENT_DONE_MS))
        .map((job) => job.id);
      sessionStorage.setItem(TRACKED_JOBS_KEY, JSON.stringify(retainedIds));
      setJobs((current) => {
        const byId = new Map(current.map((job) => [job.id, job]));
        for (const job of knownJobs) byId.set(job.id, job);
        const activeIds = new Set(retainedIds);
        return [...byId.values()]
          .filter((job) => activeIds.has(job.id) || (job.finishedAt && Date.now() - Date.parse(job.finishedAt) < RECENT_DONE_MS))
          .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
      });
    }
    const nextTasks = latestRecoveries.filter((task) =>
      (!["available", "failed", "deleted"].includes(task.status) ||
        Date.now() - Date.parse(task.updatedAt) < RECENT_DONE_MS)
    );
    setRecoveryTasks(nextTasks);
    sessionStorage.setItem(RECOVERY_TASKS_KEY, JSON.stringify(nextTasks));
    const nextRedisProofs = latestRedisProofs.filter((task) =>
      isActiveRedisProof(task) ||
      Date.now() - Date.parse(task.completedAt ?? task.createdAt) < RECENT_DONE_MS
    );
    setRedisProofTasks((current) => {
      const currentById = new Map(current.map((task) => [task.proofId, task]));
      for (const task of nextRedisProofs) {
        const previous = currentById.get(task.proofId);
        currentById.set(task.proofId, {
          ...task,
          resourceName: task.resourceName || previous?.resourceName || "Redis",
        });
      }
      const retained = [...currentById.values()].filter((task) =>
        isActiveRedisProof(task) ||
        Date.now() - Date.parse(task.completedAt ?? task.createdAt) < RECENT_DONE_MS
      );
      sessionStorage.setItem(REDIS_TASKS_KEY, JSON.stringify(retained));
      return retained;
    });
  }, []);

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => void load(), 4000);
    const onRecoveryStarted = (event: Event) => {
      const detail = (event as CustomEvent<Omit<RecoveryTask, "status" | "updatedAt">>).detail;
      const task: RecoveryTask = { ...detail, status: "creating", updatedAt: new Date().toISOString() };
      setRecoveryTasks((current) => {
        const next = [task, ...current.filter((item) => item.instanceId !== task.instanceId)];
        sessionStorage.setItem(RECOVERY_TASKS_KEY, JSON.stringify(next));
        return next;
      });
      setOpen(true);
      sessionStorage.setItem(DRAWER_KEY, "true");
    };
    const onRedisProofStarted = (event: Event) => {
      const detail = (event as CustomEvent<{
        proofId: string;
        redisResourceId: string;
        resourceName: string;
      }>).detail;
      const task: RedisProofTask = {
        ...detail,
        status: "pending",
        createdAt: new Date().toISOString(),
        startedAt: null,
        completedAt: null,
        lastError: null,
        lastErrorKind: null,
        errorMessage: null,
        sourceKeyCount: null,
        restoredKeyCount: null,
        restoreSeconds: null,
        checks: [],
      };
      setRedisProofTasks((current) => {
        const next = [task, ...current.filter((item) => item.proofId !== task.proofId)];
        sessionStorage.setItem(REDIS_TASKS_KEY, JSON.stringify(next));
        return next;
      });
      setOpen(true);
      sessionStorage.setItem(DRAWER_KEY, "true");
    };
    window.addEventListener("revenant:recovery-started", onRecoveryStarted);
    window.addEventListener("revenant:redis-proof-started", onRedisProofStarted);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("revenant:recovery-started", onRecoveryStarted);
      window.removeEventListener("revenant:redis-proof-started", onRedisProofStarted);
    };
  }, [load]);

  function toggleOpen() {
    setOpen((current) => {
      sessionStorage.setItem(DRAWER_KEY, String(!current));
      return !current;
    });
  }

  const activeCount =
    jobs.filter((job) => isActiveJob(job.status)).length +
    recoveryTasks.filter((task) => !["available", "failed", "deleted"].includes(task.status)).length +
    redisProofTasks.filter(isActiveRedisProof).length;

  if (activeCount === 0 && jobs.length === 0 && recoveryTasks.length === 0 && redisProofTasks.length === 0) return null;

  return (
    <>
      <aside
        aria-label="Background work"
        className={`fixed bottom-5 right-5 z-50 w-[min(26rem,calc(100vw-2.5rem))] overflow-hidden rounded-xl border border-slate-700 bg-[#101923] text-white shadow-2xl transition duration-300 ease-out ${open ? "translate-x-0 opacity-100" : "pointer-events-none translate-x-[calc(100%+2rem)] opacity-0"}`}
        aria-hidden={!open}
      >
        <header className="flex items-center justify-between border-b border-white/10 px-4 py-3">
          <div className="flex items-center gap-2">
            {activeCount > 0 ? <LoaderCircle size={16} className="animate-spin text-cyan-300" /> : <Check size={16} className="text-emerald-300" />}
            <div>
              <h2 className="text-sm font-semibold">Background work</h2>
              <p className="text-[11px] text-slate-400">
                {activeCount > 0
                  ? `${activeCount} run${activeCount === 1 ? "" : "s"} in progress`
                  : "Recent run results"}
              </p>
            </div>
          </div>
          <button type="button" onClick={toggleOpen} aria-label="Minimize background work" className="rounded p-1.5 text-slate-400 hover:bg-white/10 hover:text-white">
            <PanelRightClose size={17} />
          </button>
        </header>

        <div className="max-h-[65vh] space-y-3 overflow-y-auto p-3">
          {jobs.length === 0 ? (
            recoveryTasks.length === 0 && redisProofTasks.length === 0 && <p className="px-2 py-5 text-center text-sm text-slate-400">Your runs will appear here while they work.</p>
          ) : jobs.map((job) => {
            const active = isActiveJob(job.status);
            const isExpanded = expanded === job.id;
            const checks = backgroundChecks(job);
            const resultCount = checks.length;
            const now = Date.now();
            return (
              <article key={job.id} className="rounded-lg border border-white/10 bg-white/[0.04]">
                <button type="button" onClick={() => setExpanded(isExpanded ? null : job.id)} className="flex w-full items-start gap-3 p-3 text-left">
                  {active ? <LoaderCircle size={16} className="mt-0.5 shrink-0 animate-spin text-cyan-300" /> : <Check size={16} className={`mt-0.5 shrink-0 ${job.status === "pass" ? "text-emerald-300" : "text-amber-300"}`} />}
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center justify-between gap-2">
                      <span className="truncate text-sm font-medium">{job.databaseName} validation run</span>
                      {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                    </span>
                    <span className="mt-1 block text-xs text-slate-400">{phaseLabel(job)}</span>
                    <span className="mt-1 block text-[11px] text-slate-500">
                      {active
                        ? `${elapsedLabel(job.startedAt, now)} · This run continues in the background.`
                        : `${resultCount} recorded step${resultCount === 1 ? "" : "s"}`}
                    </span>
                  </span>
                </button>
                {isExpanded && (
                  <div className="border-t border-white/10 px-3 py-2.5">
                    <ol className="space-y-2">
                      {(job.status === "pending" || job.status === "running"
                        ? [
                            ...checks,
                            {
                              id: `${job.id}-current-stage`,
                              checkName: job.status === "pending" ? "Job queue" : "Current stage",
                              status: "running",
                              message:
                                job.status === "pending"
                                  ? "Waiting for a runner to claim this run."
                                  : job.runnerProgress?.message ?? "Runner is preparing the validation run.",
                            },
                          ]
                        : checks
                      ).map((result) => (
                        <li key={result.id} className="flex items-start gap-2 text-xs">
                          {result.status === "pass" ? <Check size={13} className="mt-0.5 text-emerald-300" /> : result.status === "fail" || result.status === "error" ? <XCircle size={13} className="mt-0.5 text-red-300" /> : result.status === "running" ? <LoaderCircle size={13} className="mt-0.5 animate-spin text-cyan-300" /> : <Clock3 size={13} className="mt-0.5 text-slate-500" />}
                          <span className="min-w-0 flex-1 text-slate-300">
                            <span className="font-medium">{backgroundCheckLabel(result.checkName)}</span>
                            {result.message && <span className="mt-0.5 block break-words text-slate-500">{result.message}</span>}
                          </span>
                          <span className="shrink-0 text-[10px] uppercase text-slate-500">
                            {"checkType" in result ? checkStatusLabel(result) : result.status}
                          </span>
                        </li>
                      ))}
                    </ol>
                    <Link to={`/workflows/${job.databaseId}/runs/${job.id}`} onClick={() => { sessionStorage.setItem(DRAWER_KEY, "false"); setOpen(false); }} className="mt-3 inline-flex text-xs font-medium text-cyan-300 hover:text-cyan-100">
                      Open run details
                    </Link>
                  </div>
                )}
              </article>
            );
          })}
          {recoveryTasks.map((task) => {
            const active = !["available", "failed", "deleted"].includes(task.status);
            return (
              <article key={task.instanceId} className="flex items-start gap-3 rounded-lg border border-white/10 bg-white/[0.04] p-3">
                {active ? <LoaderCircle size={16} className="mt-0.5 shrink-0 animate-spin text-cyan-300" /> : <Check size={16} className={`mt-0.5 shrink-0 ${task.status === "available" ? "text-emerald-300" : "text-amber-300"}`} />}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{task.databaseName} recovery restore</p>
                  <p className="mt-1 font-mono text-xs text-slate-300">{task.instanceIdentifier}</p>
                  <p className="mt-1 text-xs text-slate-400">{active ? `AWS is provisioning the instance (${task.status}).` : task.status === "available" ? "Instance is ready and retained in AWS." : `Restore ${task.status}.`}</p>
                  <Link to="/recovery-instances" onClick={() => { sessionStorage.setItem(DRAWER_KEY, "false"); setOpen(false); }} className="mt-2 inline-flex text-xs font-medium text-cyan-300 hover:text-cyan-100">Open recovery history</Link>
                </div>
              </article>
            );
          })}
          {redisProofTasks.map((task) => {
            const active = isActiveRedisProof(task);
            const isExpanded = expanded === task.proofId;
            const completedChecks = task.checks;
            const phase = redisProofPhase(task);
            return (
              <article key={task.proofId} className="rounded-lg border border-white/10 bg-white/[0.04]">
                <button
                  type="button"
                  onClick={() => setExpanded(isExpanded ? null : task.proofId)}
                  className="flex w-full items-start gap-3 p-3 text-left"
                >
                  {active ? (
                    <LoaderCircle size={16} className="mt-0.5 shrink-0 animate-spin text-cyan-300" />
                  ) : task.status === "pass" ? (
                    <Check size={16} className="mt-0.5 shrink-0 text-emerald-300" />
                  ) : (
                    <XCircle size={16} className="mt-0.5 shrink-0 text-amber-300" />
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center justify-between gap-2">
                      <span className="truncate text-sm font-medium">{task.resourceName} Redis restore proof</span>
                      {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                    </span>
                    <span className="mt-1 block text-xs text-slate-400">{phase}</span>
                    <span className="mt-1 block text-[11px] text-slate-500">
                      {active
                        ? `${elapsedLabel(task.startedAt ?? task.createdAt, Date.now())} · This proof continues in the background.`
                        : `${completedChecks.length} recorded check${completedChecks.length === 1 ? "" : "s"}`}
                    </span>
                  </span>
                </button>
                {isExpanded && (
                  <div className="border-t border-white/10 px-3 py-2.5">
                    <dl className="grid grid-cols-2 gap-2 text-xs text-slate-300">
                      <div><dt className="text-slate-500">Keys restored</dt><dd>{task.restoredKeyCount ?? "—"} / {task.sourceKeyCount ?? "—"}</dd></div>
                      <div><dt className="text-slate-500">Restore time</dt><dd>{task.restoreSeconds == null ? "—" : `${task.restoreSeconds}s`}</dd></div>
                    </dl>
                    {(task.errorMessage || task.lastError) && (
                      <p className="mt-2 break-words rounded-md bg-white/5 px-2.5 py-2 text-xs text-slate-300">
                        {task.errorMessage ?? task.lastError}
                      </p>
                    )}
                    {completedChecks.length > 0 && (
                      <ol className="mt-3 space-y-2">
                        {completedChecks.map((check) => (
                          <li key={`${task.proofId}-${check.name}`} className="flex items-start gap-2 text-xs">
                            {check.status === "pass" ? <Check size={13} className="mt-0.5 text-emerald-300" /> : check.status === "fail" ? <XCircle size={13} className="mt-0.5 text-red-300" /> : <Clock3 size={13} className="mt-0.5 text-slate-500" />}
                            <span className="min-w-0 flex-1 text-slate-300">
                              <span className="font-medium">{check.name}</span>
                              {check.message && <span className="mt-0.5 block break-words text-slate-500">{check.message}</span>}
                            </span>
                            <span className="shrink-0 text-[10px] uppercase text-slate-500">{check.status}</span>
                          </li>
                        ))}
                      </ol>
                    )}
                    <Link
                      to={`/redis/${task.redisResourceId}/proofs`}
                      onClick={() => { sessionStorage.setItem(DRAWER_KEY, "false"); setOpen(false); }}
                      className="mt-3 inline-flex text-xs font-medium text-cyan-300 hover:text-cyan-100"
                    >
                      Open proof history
                    </Link>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      </aside>

      {!open && (
        <button type="button" onClick={toggleOpen} className="fixed bottom-5 right-5 z-50 inline-flex items-center gap-2 rounded-full border border-slate-600 bg-[#101923] px-4 py-3 text-sm font-medium text-white shadow-xl transition hover:bg-slate-800">
          {activeCount > 0 ? <LoaderCircle size={16} className="animate-spin text-cyan-300" /> : <PanelRightOpen size={16} className="text-slate-300" />}
          Background work
          {activeCount > 0 && <span className="rounded-full bg-cyan-300 px-1.5 py-0.5 text-[10px] font-bold text-slate-900">{activeCount}</span>}
          <X size={13} className="ml-1 text-slate-500" />
        </button>
      )}
    </>
  );
}
