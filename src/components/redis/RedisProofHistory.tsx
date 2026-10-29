import { useState } from "react";
import { Link } from "react-router-dom";
import {
  CheckCircle2,
  CircleHelp,
  Clock,
  HardDrive,
  Loader2,
  RefreshCw,
  Trash2,
  XCircle,
} from "lucide-react";

import { DateTimeText } from "../DateTimeText";
import {
  PROOF_STATUS_LABEL,
  PROOF_STATUS_TONE,
  SNAPSHOT_STATUS_LABEL,
  SNAPSHOT_STATUS_TONE,
  formatBytes,
  formatDuration,
  formatNumber,
  proofExecutorLabel,
  proofWaitingNote,
  timeUntil,
} from "../../lib/redis-format";
import type {
  RedisProofResource,
  RedisResource,
  RedisSnapshotResource,
} from "../../types/api";

const PROOF_TONE = PROOF_STATUS_TONE;

/**
 * Proof history and stored snapshots.
 *
 * The snapshots table is the visible half of the TTL promise: every row shows
 * its own countdown, and expired rows are greyed out rather than hidden, so a
 * customer can see that "deleted" is a normal outcome and not a failure.
 */
export function RedisProofHistory({
  resource,
  proofs,
  snapshots,
  loading,
  canDelete,
  onDeleteSnapshot,
  onRefresh,
}: {
  resource: RedisResource;
  proofs: RedisProofResource[];
  snapshots: RedisSnapshotResource[];
  loading: boolean;
  canDelete: boolean;
  onDeleteSnapshot: (snapshotId: string) => void;
  onRefresh: () => void;
}) {
  const [tab, setTab] = useState<"proofs" | "snapshots">("proofs");

  const liveSnapshots = snapshots.filter(
    (s) => s.status === "stored" || s.status === "capturing"
  );
  const recentProofs = proofs.slice(0, 3);
  const recentSnapshots = snapshots.slice(0, 3);

  return (
    <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
      <header className="flex items-center justify-between gap-2 border-b border-slate-100 px-5 py-3">
        <div className="flex gap-1">
          <button
            type="button"
            onClick={() => setTab("proofs")}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
              tab === "proofs"
                ? "bg-slate-900 text-white"
                : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            Recent proofs
          </button>
          <button
            type="button"
            onClick={() => setTab("snapshots")}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
              tab === "snapshots"
                ? "bg-slate-900 text-white"
                : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            Recent snapshots
          </button>
        </div>
        <button
          type="button"
          onClick={onRefresh}
          className="rounded p-1.5 text-slate-500 hover:bg-slate-100"
          aria-label="Refresh"
        >
          <RefreshCw size={14} className={loading ? "animate-spin" : undefined} />
        </button>
      </header>

      {tab === "proofs" && proofs.some((proof) => proof.status === "pending") && (
        <p className="border-b border-amber-100 bg-amber-50 px-5 py-3 text-xs leading-relaxed text-amber-900">
          Proof queued — the RDB has not been captured yet.{" "}
          {proofWaitingNote(
            proofs.find((proof) => proof.status === "pending") as RedisProofResource
          ) ?? "Revenant's cloud runner picks this up automatically, usually within a few seconds."}{" "}
          <Link to="/redis/guide" className="font-medium underline">
            How this works
          </Link>
        </p>
      )}

      {loading && proofs.length === 0 && snapshots.length === 0 ? (
        <p className="flex items-center justify-center gap-2 px-4 py-10 text-sm text-slate-500">
          <Loader2 size={14} className="animate-spin" />
          Loading…
        </p>
      ) : tab === "proofs" ? (
        proofs.length === 0 ? (
          <>
            <p className="px-4 py-10 text-center text-sm text-slate-500">
              No proofs yet. Run one to find out whether the backup actually loads.
            </p>
            <div className="border-t border-slate-100 px-4 py-3">
              <Link
                to={`/redis/${resource.id}/proofs`}
                className="text-sm font-medium text-brand underline"
              >
                Search all proofs
              </Link>
            </div>
          </>
        ) : (
          <>
            <ul className="divide-y divide-slate-100">
            {recentProofs.map((p) => (
              <li key={p.id} className="min-w-0 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <DateTimeText value={p.createdAt} />
                  <span
                    className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                      PROOF_TONE[p.status] ?? "bg-slate-100 text-slate-600"
                    }`}
                  >
                    {PROOF_STATUS_LABEL[p.status] ?? p.status}
                  </span>
                </div>
                {proofExecutorLabel(p.claimedBy) && (
                  <p className="mt-1 text-xs text-slate-500">
                    Run by {proofExecutorLabel(p.claimedBy)}
                  </p>
                )}
                {p.status === "pending" && p.lastError && (
                  <p className="mt-2 break-words text-xs text-amber-700">
                    {p.lastError}
                  </p>
                )}
                {p.errorMessage && (
                  <p className="mt-2 break-words text-xs text-red-700">
                    {p.errorMessage}
                  </p>
                )}
                <dl className="mt-3 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
                  <div>
                    <dt className="text-slate-500">Restored keys</dt>
                    <dd className="font-medium text-slate-700">
                      {p.restoredKeyCount == null
                        ? "—"
                        : `${formatNumber(p.restoredKeyCount)}${
                            p.sourceKeyCount != null
                              ? ` / ${formatNumber(p.sourceKeyCount)}`
                              : ""
                          }`}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">Restore time (RTO)</dt>
                    <dd className="font-medium text-slate-700">
                      {formatDuration(p.restoreSeconds)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">Observed recovery point (RPO)</dt>
                    <dd className="font-medium text-slate-700">
                      {formatDuration(p.rpoObservedSeconds)}
                    </dd>
                  </div>
                </dl>
                {p.checks.length > 0 && (
                  <ul className="mt-3 space-y-1.5 border-t border-slate-100 pt-3">
                    {p.checks.map((check) => {
                      const Icon =
                        check.status === "pass"
                          ? CheckCircle2
                          : check.status === "fail"
                            ? XCircle
                            : CircleHelp;
                      return (
                        <li
                          key={`${check.name}-${check.status}`}
                          className="flex min-w-0 items-start gap-1.5 text-xs text-slate-600"
                        >
                          <Icon
                            size={13}
                            className={`mt-0.5 shrink-0 ${
                              check.status === "pass"
                                ? "text-emerald-600"
                                : check.status === "fail"
                                  ? "text-red-600"
                                  : "text-slate-400"
                            }`}
                          />
                          <span className="min-w-0 break-words">
                            <span className="font-medium">{check.name}:</span>{" "}
                            {check.message}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </li>
            ))}
          </ul>
            <div className="border-t border-slate-100 px-4 py-3">
              <Link
                to={`/redis/${resource.id}/proofs`}
                className="text-sm font-medium text-brand underline"
              >
                Search and view all proofs
              </Link>
            </div>
          </>
        )
      ) : (
        <>
          {!resource.snapshotEnabled ? (
            <p className="px-4 py-10 text-center text-sm text-slate-500">
              Snapshot storage is off for this Redis.
              <br />
              <span className="text-xs">
                Proofs still run — nothing is uploaded or kept.
              </span>
            </p>
          ) : snapshots.length === 0 ? (
            <p className="px-4 py-10 text-center text-sm text-slate-500">
              No snapshots yet. Run a proof to capture one.
            </p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {recentSnapshots.map((s) => {
                const expired =
                  s.status === "expired" || s.status === "deleted" || !!s.deletedAt;
                return (
                  <li
                    key={s.id}
                    className={`flex min-w-0 items-start justify-between gap-3 p-4 ${
                      expired ? "text-slate-400" : ""
                    }`}
                  >
                    <div className="min-w-0">
                      <p className="text-sm text-slate-600">
                        <DateTimeText value={s.createdAt} />
                      </p>
                      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                        <span>{formatBytes(s.byteSize)}</span>
                        <span
                          className={`inline-flex rounded-full px-2 py-0.5 font-medium ${
                            SNAPSHOT_STATUS_TONE[s.status]
                          }`}
                        >
                          {SNAPSHOT_STATUS_LABEL[s.status]}
                        </span>
                        {!expired && s.expiresAt && (
                          <span className="inline-flex items-center gap-1 text-slate-600">
                            <Clock size={12} />
                            Expires in {timeUntil(s.expiresAt)}
                          </span>
                        )}
                      </div>
                    </div>
                    {canDelete && !expired && (
                      <button
                        type="button"
                        onClick={() => onDeleteSnapshot(s.id)}
                        title="Delete this snapshot now"
                        aria-label="Delete snapshot"
                        className="shrink-0 rounded p-1.5 text-red-600 hover:bg-red-50"
                      >
                        <Trash2 size={15} />
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}

          <div className="border-t border-slate-100 px-4 py-3">
            <Link
              to={`/redis/${resource.id}/snapshots`}
              className="text-sm font-medium text-brand underline"
            >
              Search and view all snapshots
            </Link>
          </div>

          {resource.snapshotEnabled && liveSnapshots.length > 0 && (
            <p className="flex items-start gap-2 border-t border-slate-100 px-4 py-3 text-[11px] leading-relaxed text-slate-500">
              <HardDrive size={13} className="mt-0.5 shrink-0" />
              <span>
                Snapshots are hard-deleted at their deadline by the API. The RDB lives
                in object storage; the database keeps metadata.
              </span>
            </p>
          )}
        </>
      )}
    </section>
  );
}