import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  CheckCircle2,
  Cloud,
  Database,
  Loader2,
  RotateCcw,
  Server,
  Shield,
  Trash2,
  X,
  XCircle,
} from "lucide-react";
import { useToast } from "../toast/ToastProvider";
import { api } from "../../lib/api";
import { runShortId } from "../../lib/workflow";
import { ConfirmDialog } from "../ConfirmDialog";

function formatSeconds(seconds: number | null): string {
  if (seconds == null) return "—";
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return s > 0 ? `${m}m ${s}s` : `${m}m`;
}
import type { RecoveryPointResource } from "../../types/api";

function originLabel(origin: RecoveryPointResource["snapshotOrigin"]): string {
  switch (origin) {
    case "revenant_managed":
      return "Created during drill";
    case "customer_existing":
      return "Your AWS snapshot";
    default:
      return "AWS snapshot";
  }
}

function verificationBadge(status: RecoveryPointResource["lastVerificationStatus"]) {
  if (status === "verified") {
    return {
      text: "Recovery verified",
      className: "bg-emerald-50 text-emerald-800 ring-emerald-200",
      icon: CheckCircle2,
    };
  }
  if (status === "failed") {
    return {
      text: "Last verification failed",
      className: "bg-red-50 text-red-800 ring-red-200",
      icon: XCircle,
    };
  }
  return {
    text: "Not verified yet",
    className: "bg-slate-100 text-slate-600 ring-slate-200",
    icon: Shield,
  };
}

export function RecoveryPointsPanel({
  databaseId,
  awsMode,
  canRun,
  compact = false,
  refreshToken = 0,
  lastDrillStatus,
  onActionComplete,
  onViewAll,
}: {
  databaseId: string;
  awsMode: boolean;
  canRun: boolean;
  compact?: boolean;
  refreshToken?: number;
  lastDrillStatus?: string | null;
  onActionComplete?: () => void;
  onViewAll?: () => void;
}) {
  const toast = useToast();
  const [points, setPoints] = useState<RecoveryPointResource[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [verifyingId, setVerifyingId] = useState<string | null>(null);
  const [recoveringPoint, setRecoveringPoint] = useState<RecoveryPointResource | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<RecoveryPointResource | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await api.listRecoveryPoints(databaseId);
      setPoints(res.recoveryPoints);
    } catch (err) {
      setPoints([]);
      setLoadError(err instanceof Error ? err.message : "Could not load recovery points.");
    } finally {
      setLoading(false);
    }
  }, [databaseId]);

  useEffect(() => {
    void load();
  }, [load, refreshToken]);

  async function verifyAgain(point: RecoveryPointResource) {
    setVerifyingId(point.id);
    try {
      const res = await api.verifyRecoveryPoint(point.id);
      toast.success(
        "Verification started",
        `Restoring ${point.snapshotIdentifier} in your AWS account to run checks.`
      );
      onActionComplete?.();
      window.location.href = `/workflows/${databaseId}/runs/${res.job.id}`;
    } catch (err) {
      toast.error(
        "Could not verify",
        err instanceof Error ? err.message : "Request failed"
      );
    } finally {
      setVerifyingId(null);
    }
  }

  async function deleteSnapshot() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const result = await api.deleteRecoveryPoint(deleteTarget.id);
      if (result.deletedFromAws) {
        toast.success("Snapshot deleted", `${deleteTarget.snapshotIdentifier} was removed from AWS and this list.`);
      } else {
        toast.warning(
          "Removed from recovery points",
          "AWS retains this automated snapshot until its retention policy expires."
        );
      }
      setDeleteTarget(null);
      await load();
      onActionComplete?.();
    } catch (err) {
      toast.error(
        "Could not delete snapshot",
        err instanceof Error ? err.message : "AWS snapshot deletion failed"
      );
    } finally {
      setDeleting(false);
    }
  }

  if (!awsMode) {
    return (
      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-900">Recovery points</h2>
        <p className="mt-2 text-sm text-slate-600">
          Recovery points track AWS RDS snapshots in <strong>your account</strong>. This workflow
          uses direct Postgres validation — switch to AWS RDS mode to verify snapshots.
        </p>
      </section>
    );
  }

  const visiblePoints = compact ? points.slice(0, 1) : points;

  return (
    <section
      className={`border border-slate-200 bg-white shadow-sm ${
        compact ? "h-full rounded-lg" : "rounded-xl"
      }`}
    >
      <div className={`border-b border-slate-100 ${compact ? "px-4 py-3" : "px-5 py-4"}`}>
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div
              className={`flex shrink-0 items-center justify-center rounded-lg bg-sky-100 text-sky-700 ${
                compact ? "h-8 w-8" : "h-9 w-9"
              }`}
            >
              <Cloud size={compact ? 16 : 18} />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-slate-900">Recovery points</h2>
              {!compact && (
                <p className="mt-1 text-sm text-slate-600">
                  AWS keeps snapshots. Revenant stores verification metadata and evidence only.
                </p>
              )}
            </div>
          </div>
          {compact && points.length > 1 && onViewAll && (
            <button
              type="button"
              onClick={onViewAll}
              className="shrink-0 text-xs font-medium text-brand hover:underline"
            >
              View all ({points.length})
            </button>
          )}
        </div>
      </div>

      <div className={compact ? "p-4" : "p-5"}>
        {loading ? (
          <p className="text-sm text-slate-500">Loading recovery points…</p>
        ) : loadError ? (
          <div role="alert" className="border-l-2 border-red-500 pl-3 text-sm text-red-800">
            <p>{loadError}</p>
            <button
              type="button"
              onClick={() => void load()}
              className="mt-2 font-medium underline underline-offset-2"
            >
              Retry loading recovery points
            </button>
          </div>
        ) : points.length === 0 ? (
          <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-4 py-5 text-sm text-slate-600">
            <p className="font-medium text-slate-800">No recovery points yet</p>
            {lastDrillStatus === "fail" ? (
              <p className="mt-2">
                Your last drill failed before a snapshot could be registered — usually restore or
                AWS permissions. Open the failed run for details, fix the issue, then run again.
              </p>
            ) : (
              <p className="mt-2">
                Run <strong>Verify snapshot</strong> or a full restore drill. Revenant records the
                AWS snapshot tested — even if validation checks fail.
              </p>
            )}
          </div>
        ) : (
          <ul className={compact ? "space-y-3" : "space-y-4"}>
            {visiblePoints.map((point) => {
              const badge = verificationBadge(point.lastVerificationStatus);
              const BadgeIcon = badge.icon;
              return (
                <li
                  key={point.id}
                  className="rounded-xl border border-slate-200 bg-slate-50/50 p-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-mono text-sm font-medium text-slate-900">
                        {point.snapshotIdentifier}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        {originLabel(point.snapshotOrigin)}
                        {point.sourceDbIdentifier && ` · Source: ${point.sourceDbIdentifier}`}
                        {point.region && ` · ${point.region}`}
                      </p>
                    </div>
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${badge.className}`}
                    >
                      <BadgeIcon size={12} />
                      {badge.text}
                    </span>
                  </div>

                  <dl className="mt-3 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
                    <div>
                      <dt className="text-[10px] font-medium uppercase text-slate-500">
                        Last verified
                      </dt>
                      <dd className="font-medium text-slate-900">
                        {point.lastVerifiedAt
                          ? new Date(point.lastVerifiedAt).toLocaleString(undefined, {
                              month: "short",
                              day: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            })
                          : "—"}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-[10px] font-medium uppercase text-slate-500">RTO</dt>
                      <dd className="font-mono font-medium text-slate-900">
                        {formatSeconds(point.lastRtoSeconds)}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-[10px] font-medium uppercase text-slate-500">
                        RPO lag
                      </dt>
                      <dd className="font-mono font-medium text-slate-900">
                        {formatSeconds(point.lastRpoObservedSeconds)}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-[10px] font-medium uppercase text-slate-500">Drill</dt>
                      <dd className="font-mono text-slate-900">
                        {point.lastVerificationJobId
                          ? runShortId(point.lastVerificationJobId)
                          : "—"}
                      </dd>
                    </div>
                  </dl>

                  {point.lastCleanupStatus && (
                    <div
                      role="status"
                      className={`mt-3 flex items-start gap-2 border-l-2 pl-3 text-xs ${
                        point.lastCleanupStatus === "failed"
                          ? "border-red-500 text-red-800"
                          : point.lastCleanupStatus === "retained"
                            ? "border-amber-500 text-amber-800"
                            : "border-emerald-500 text-emerald-800"
                      }`}
                    >
                      {point.lastCleanupStatus === "failed" ? (
                        <XCircle size={14} className="mt-0.5 shrink-0" />
                      ) : (
                        <CheckCircle2 size={14} className="mt-0.5 shrink-0" />
                      )}
                      <span>
                        {point.lastCleanupStatus === "failed"
                          ? "Verification result is separate: temporary RDS cleanup failed"
                          : point.lastCleanupStatus === "retained"
                            ? "Temporary RDS instance retained"
                            : point.lastCleanupStatus === "completed"
                              ? "Temporary RDS instance deleted"
                              : "Temporary RDS cleanup was not needed"}
                        {point.lastTemporaryInstanceIdentifier && (
                          <span className="ml-1 font-mono">
                            ({point.lastTemporaryInstanceIdentifier})
                          </span>
                        )}
                      </span>
                    </div>
                  )}

                  <div className="mt-4 flex flex-wrap gap-2">
                    {canRun && (
                      <button
                        type="button"
                        disabled={verifyingId === point.id}
                        onClick={() => void verifyAgain(point)}
                        className="inline-flex items-center gap-2 rounded-lg bg-brand px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                      >
                        {verifyingId === point.id ? (
                          <Loader2 size={14} className="animate-spin" />
                        ) : (
                          <RotateCcw size={14} />
                        )}
                        Verify again
                      </button>
                    )}
                    <button
                      type="button"
                      disabled={!canRun}
                      onClick={() => setRecoveringPoint(point)}
                      className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <Database size={14} />
                      Recover from this
                    </button>
                    {canRun && !point.snapshotIdentifier.startsWith("latest-verified-") && (
                      <button
                        type="button"
                        onClick={() => setDeleteTarget(point)}
                        className="inline-flex items-center gap-2 rounded-lg border border-red-200 bg-white px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-50"
                      >
                        <Trash2 size={14} />
                        Delete snapshot
                      </button>
                    )}
                    {point.lastVerificationJobId && (
                      <Link
                        to={`/workflows/${databaseId}/runs/${point.lastVerificationJobId}`}
                        className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                      >
                        View evidence →
                      </Link>
                    )}
                  </div>

                  {!compact && (
                    <p className="mt-3 text-xs text-slate-500">
                      <strong>Verify</strong> restores a temp RDS, runs checks, then deletes it.
                      The snapshot stays in AWS until you delete it.
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
      {recoveringPoint && (
        <RecoverFromPointDialog
          key={recoveringPoint.id}
          point={recoveringPoint}
          onClose={() => setRecoveringPoint(null)}
        />
      )}
      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete or remove recovery point?"
        description={`Revenant will delete ${deleteTarget?.snapshotIdentifier ?? "the snapshot"} from AWS when it is a manual snapshot. AWS-managed automated snapshots cannot be individually deleted; those will only be removed from this active list and remain in AWS until retention expires. Existing verification and restored-instance history is retained.`}
        confirmLabel="Continue"
        danger
        loading={deleting}
        onConfirm={() => void deleteSnapshot()}
        onCancel={() => setDeleteTarget(null)}
      />
    </section>
  );
}

function RecoverFromPointDialog({
  point,
  onClose,
}: {
  point: RecoveryPointResource;
  onClose: () => void;
}) {
  const toast = useToast();
  const [targetIdentifier, setTargetIdentifier] = useState(
    `revenant-restore-${point.id.slice(0, 8)}`
  );
  const [confirmTargetIdentifier, setConfirmTargetIdentifier] = useState("");
  const [instances, setInstances] = useState<import("../../types/api").RecoveryInstanceResource[]>([]);
  const [starting, setStarting] = useState(false);
  const [hasStartedRecovery, setHasStartedRecovery] = useState(false);
  const [activeRecoveryPointId, setActiveRecoveryPointId] = useState(point.id);
  const [snapshotIdentifier, setSnapshotIdentifier] = useState(point.snapshotIdentifier);
  const [snapshotReviewComplete, setSnapshotReviewComplete] = useState(
    !point.snapshotIdentifier.startsWith("latest-verified-")
  );

  useEffect(() => {
    void api.listRecoveryInstances(activeRecoveryPointId)
      .then((response) => setInstances(response.instances))
      .catch(() => undefined);
  }, [activeRecoveryPointId]);

  useEffect(() => {
    const hasPendingRestore = instances.some(
      (item) => !["available", "failed", "deleted"].includes(item.status)
    );
    if (!hasPendingRestore) return;
    const interval = window.setInterval(() => {
      void api.listRecoveryInstances(activeRecoveryPointId).then((response) => {
        setInstances(response.instances);
      }).catch(() => undefined);
    }, 12_000);
    return () => window.clearInterval(interval);
  }, [instances, activeRecoveryPointId]);

  const nameConfirmed = confirmTargetIdentifier === targetIdentifier;
  async function startRecovery(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!nameConfirmed) return;
    setStarting(true);
    try {
      const result = await api.recoverFromRecoveryPoint(activeRecoveryPointId, {
        targetIdentifier,
        confirmTargetIdentifier,
        ...(!snapshotReviewComplete ? { resolveOnly: true } : {}),
      });
      setActiveRecoveryPointId(result.recoveryPointId);
      setSnapshotIdentifier(result.snapshotIdentifier);
      if (result.resolvedOnly) {
        setSnapshotReviewComplete(true);
        toast.success("Snapshot identified", "Review the AWS snapshot ID before starting recovery.");
        return;
      }
      setInstances((current) => [
        result.instance,
        ...current.filter((item) => item.id !== result.instance.id),
      ]);
      window.dispatchEvent(new CustomEvent("revenant:recovery-started", {
        detail: {
          recoveryPointId: result.recoveryPointId,
          instanceId: result.instance.id,
          instanceIdentifier: result.instance.awsDbInstanceIdentifier,
          databaseName: point.databaseName,
        },
      }));
      setHasStartedRecovery(true);
      toast.success("Recovery restore started", `AWS is creating ${targetIdentifier}.`);
    } catch (err) {
      toast.error(
        "Could not start recovery",
        err instanceof Error ? err.message : "AWS restore request failed"
      );
    } finally {
      setStarting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4" role="presentation">
      <section
        aria-labelledby="recover-point-title"
        aria-modal="true"
        className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-lg bg-white shadow-2xl"
        role="dialog"
      >
        <header className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4">
          <div>
            <h2 id="recover-point-title" className="text-base font-semibold text-slate-900">
              Recover from snapshot
            </h2>
            <p className="mt-1 font-mono text-xs text-slate-500">{snapshotIdentifier}</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close recovery dialog" className="rounded p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-900">
            <X size={18} />
          </button>
        </header>

        <div className="space-y-4 px-5 py-4">
          <p className="border-l-2 border-amber-500 pl-3 text-sm text-slate-700">
            This creates a new, retained and billable RDS instance in your AWS account. It will not
            modify the source database or snapshot. Revenant reuses the source instance's subnet
            group and VPC security groups, and uses the configured recovery class or the source
            instance class.
          </p>

          {!snapshotReviewComplete && (
            <p role="alert" className="border-l-2 border-red-500 pl-3 text-sm text-red-800">
              This older point has no saved AWS snapshot ID. Find the newest available snapshot
              from the source database at the verification time first. No restore or billable
              instance will start until you review the matched ID and submit again.
            </p>
          )}
          {snapshotReviewComplete && point.snapshotIdentifier.startsWith("latest-verified-") && (
            <p role="status" className="border-l-2 border-emerald-500 pl-3 text-sm text-emerald-800">
              Matched AWS snapshot: <span className="font-mono">{snapshotIdentifier}</span>. Confirm
              this is the intended recovery point before continuing.
            </p>
          )}

          {instances.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-xs font-semibold uppercase text-slate-500">Retained instances</h3>
              {instances.map((item) => {
                const available = item.status === "available";
                const failed = item.status === "failed";
                return (
                  <div key={item.id} className="flex items-start gap-3 border border-slate-200 p-3">
                    {failed ? <XCircle size={16} className="mt-0.5 text-red-700" /> : available ? <CheckCircle2 size={16} className="mt-0.5 text-emerald-700" /> : <Loader2 size={16} className="mt-0.5 animate-spin text-sky-700" />}
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="font-mono text-sm text-slate-900">{item.awsDbInstanceIdentifier}</span>
                        <span className={`text-xs font-semibold ${failed ? "text-red-700" : available ? "text-emerald-700" : "text-sky-700"}`}>
                          {failed ? "Restore failed" : available ? "Available" : item.status}
                        </span>
                      </div>
                      {item.endpoint && <p className="mt-1 break-all font-mono text-xs text-slate-600">{item.endpoint}{item.port ? `:${item.port}` : ""}</p>}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {!hasStartedRecovery && (
            <form onSubmit={(event) => void startRecovery(event)} className="space-y-4">
              <label className="block text-sm font-medium text-slate-800">
                New RDS instance identifier
                <input
                  required
                  maxLength={63}
                  value={targetIdentifier}
                  onChange={(event) => setTargetIdentifier(event.target.value)}
                  className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 font-mono text-sm"
                />
              </label>
              <label className="block text-sm font-medium text-slate-800">
                Type <span className="font-mono">{targetIdentifier}</span> to confirm
                <input
                  required
                  value={confirmTargetIdentifier}
                  onChange={(event) => setConfirmTargetIdentifier(event.target.value)}
                  className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 font-mono text-sm"
                  autoComplete="off"
                />
              </label>
              <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
                <button type="button" onClick={onClose} className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={starting || !nameConfirmed}
                  className="inline-flex items-center gap-2 rounded-md bg-brand px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {starting && <Loader2 size={14} className="animate-spin" />}
                  {!snapshotReviewComplete
                    ? "Find snapshot to review"
                    : point.snapshotIdentifier.startsWith("latest-verified-")
                      ? "Confirm snapshot and start recovery"
                      : "Start recovery"}
                </button>
              </div>
            </form>
          )}

          {hasStartedRecovery && (
            <div className="space-y-4" aria-live="polite">
              <p className="flex items-center gap-2 text-xs text-slate-500">
                <Server size={14} /> AWS status refreshes every 12 seconds. Recovered instances remain in your account.
              </p>
              <div className="flex justify-end border-t border-slate-100 pt-4">
                <button type="button" onClick={onClose} className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
                  Close
                </button>
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
