import { useState } from "react";
import { Link } from "react-router-dom";
import { Clock, HardDrive, RefreshCw, Trash2 } from "lucide-react";

import { DateTimeText } from "../DateTimeText";
import {
  PROOF_STATUS_LABEL,
  PROOF_STATUS_TONE,
  SNAPSHOT_STATUS_LABEL,
  SNAPSHOT_STATUS_TONE,
  formatBytes,
  formatNumber,
  timeUntil,
} from "../../lib/redis-format";
import type {
  RedisProofResource,
  RedisResource,
  RedisSnapshotResource,
} from "../../types/api";

/**
 * Recent activity for one Redis resource.
 *
 * This panel is deliberately SHORT. It answers one question — "is my backup
 * still good?" — in one line per row. Everything else (checks, timings,
 * digests, artifact download) lives on the history pages, which are built
 * for reading, not skimming.
 *
 * The previous version rendered the full check list and a four-column metric
 * grid inline, which pushed the rest of the Redis page off-screen and made
 * "recent activity" the least readable part of the product.
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

  const recentProofs = proofs.slice(0, 4);
  const recentSnapshots = snapshots.slice(0, 4);
  const liveSnapshots = snapshots.filter(
    (s) => s.status === "stored" || s.status === "capturing"
  );

  const proofHref = `/redis/${resource.id}/proofs`;
  const snapshotHref = `/redis/${resource.id}/snapshots`;

  return (
    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <header className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-3">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setTab("proofs")}
            className={`rounded-md px-2.5 py-1 text-xs font-medium ${
              tab === "proofs"
                ? "bg-slate-900 text-white"
                : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            Proofs
          </button>
          <button
            type="button"
            onClick={() => setTab("snapshots")}
            className={`rounded-md px-2.5 py-1 text-xs font-medium ${
              tab === "snapshots"
                ? "bg-slate-900 text-white"
                : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            Snapshots
          </button>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onRefresh}
            title="Refresh"
            aria-label="Refresh"
            className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          >
            <RefreshCw size={13} className={loading ? "animate-spin" : undefined} />
          </button>
          <Link
            to={tab === "proofs" ? proofHref : snapshotHref}
            className="text-xs font-medium text-brand hover:underline"
          >
            View all →
          </Link>
        </div>
      </header>

      {tab === "proofs" ? (
        recentProofs.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-slate-500">
            {loading ? "Loading proofs…" : "No proofs yet. Run one to find out whether the backup actually loads."}
          </p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {recentProofs.map((proof) => (
              <li key={proof.id}>
                <Link
                  to={proofHref}
                  className="flex min-w-0 items-center gap-3 px-4 py-2.5 hover:bg-slate-50"
                >
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${
                      PROOF_STATUS_TONE[proof.status] ??
                      "bg-slate-100 text-slate-600"
                    }`}
                  >
                    {PROOF_STATUS_LABEL[proof.status] ?? proof.status}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-xs text-slate-600">
                    <DateTimeText value={proof.createdAt} />
                    {proof.restoredKeyCount != null && (
                      <span className="text-slate-400">
                        {" · "}
                        {formatNumber(proof.restoredKeyCount)} keys restored
                      </span>
                    )}
                    {proof.status === "pending" && proof.lastError && (
                      <span className="text-amber-700"> · waiting on a runner</span>
                    )}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )
      ) : (
        <>
          {!resource.snapshotEnabled ? (
            <p className="px-4 py-8 text-center text-sm text-slate-500">
              Snapshot storage is off for this Redis.
              <span className="mt-1 block text-xs">
                Proofs still run — nothing is uploaded or kept.
              </span>
            </p>
          ) : recentSnapshots.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-slate-500">
              {loading ? "Loading snapshots…" : "No snapshots yet. Run a proof to capture one."}
            </p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {recentSnapshots.map((snapshot) => {
                const expired =
                  snapshot.status === "expired" ||
                  snapshot.status === "deleted" ||
                  !!snapshot.deletedAt;
                return (
                  <li
                    key={snapshot.id}
                    className={`flex min-w-0 items-center gap-3 px-4 py-2.5 ${
                      expired ? "text-slate-400" : ""
                    }`}
                  >
                    <span
                      className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${
                        SNAPSHOT_STATUS_TONE[snapshot.status] ??
                        "bg-slate-100 text-slate-600"
                      }`}
                    >
                      {SNAPSHOT_STATUS_LABEL[snapshot.status] ?? snapshot.status}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-xs text-slate-600">
                      <DateTimeText value={snapshot.createdAt} />
                      <span className="text-slate-400">
                        {" · "}
                        {formatBytes(snapshot.byteSize)}
                      </span>
                      {!expired && snapshot.expiresAt && (
                        <span className="inline-flex items-center gap-1 text-slate-500">
                          {" · "}
                          <Clock size={11} />
                          {timeUntil(snapshot.expiresAt)}
                        </span>
                      )}
                      {snapshot.status === "failed" && (
                        <span className="text-red-700"> · artifact failed</span>
                      )}
                    </span>
                    {canDelete && !expired && (
                      <button
                        type="button"
                        onClick={() => onDeleteSnapshot(snapshot.id)}
                        title="Delete this snapshot now"
                        aria-label="Delete snapshot"
                        className="shrink-0 rounded p-1 text-red-600 hover:bg-red-50"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}

          {resource.snapshotEnabled && liveSnapshots.length > 0 && (
            <p className="flex items-start gap-2 border-t border-slate-100 px-4 py-2.5 text-[11px] leading-relaxed text-slate-500">
              <HardDrive size={12} className="mt-0.5 shrink-0" />
              <span>
                Snapshots are hard-deleted at their deadline. The RDB lives in object
                storage; the database keeps metadata.
              </span>
            </p>
          )}
        </>
      )}
    </section>
  );
}
