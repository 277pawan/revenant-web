import { useState } from "react";
import { Clock, HardDrive, Loader2, RefreshCw, Trash2 } from "lucide-react";

import { DateTimeText } from "../DateTimeText";
import {
  SNAPSHOT_STATUS_LABEL,
  SNAPSHOT_STATUS_TONE,
  formatBytes,
  formatDuration,
  formatNumber,
  timeUntil,
} from "../../lib/redis-format";
import type {
  RedisProofResource,
  RedisResource,
  RedisSnapshotResource,
} from "../../types/api";

const PROOF_TONE: Record<string, string> = {
  pass: "bg-emerald-100 text-emerald-800",
  fail: "bg-red-100 text-red-800",
  error: "bg-red-100 text-red-700",
  running: "bg-sky-100 text-sky-800",
  pending: "bg-slate-100 text-slate-600",
};

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
            Proofs ({proofs.length})
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
            Snapshots ({snapshots.length})
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

      {loading && proofs.length === 0 && snapshots.length === 0 ? (
        <p className="flex items-center justify-center gap-2 px-4 py-10 text-sm text-slate-500">
          <Loader2 size={14} className="animate-spin" />
          Loading…
        </p>
      ) : tab === "proofs" ? (
        proofs.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-slate-500">
            No proofs yet. Run one to find out whether the backup actually loads.
          </p>
        ) : (
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-left text-xs text-slate-600">
              <tr>
                <th className="px-4 py-2 font-medium">When</th>
                <th className="px-4 py-2 font-medium">Result</th>
                <th className="px-4 py-2 font-medium">Keys</th>
                <th className="px-4 py-2 font-medium">RTO</th>
                <th className="px-4 py-2 font-medium">RPO</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {proofs.map((p) => (
                <tr key={p.id} className="hover:bg-slate-50">
                  <td className="whitespace-nowrap px-4 py-2.5 text-slate-600">
                    <DateTimeText value={p.createdAt} />
                  </td>
                  <td className="px-4 py-2.5">
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                        PROOF_TONE[p.status] ?? "bg-slate-100 text-slate-600"
                      }`}
                    >
                      {p.status === "pass" ? "Restored" : p.status}
                    </span>
                    {p.errorMessage && (
                      <p className="mt-1 max-w-xs text-xs text-red-700">
                        {p.errorMessage}
                      </p>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-slate-600">
                    {p.restoredKeyCount == null
                      ? "—"
                      : `${formatNumber(p.restoredKeyCount)}${
                          p.sourceKeyCount != null ? ` / ${formatNumber(p.sourceKeyCount)}` : ""
                        }`}
                  </td>
                  <td className="px-4 py-2.5 text-slate-600">
                    {formatDuration(p.restoreSeconds)}
                  </td>
                  <td className="px-4 py-2.5 text-slate-600">
                    {formatDuration(p.rpoObservedSeconds)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
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
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 text-left text-xs text-slate-600">
                <tr>
                  <th className="px-4 py-2 font-medium">Captured</th>
                  <th className="px-4 py-2 font-medium">Size</th>
                  <th className="px-4 py-2 font-medium">Status</th>
                  <th className="px-4 py-2 font-medium">TTL</th>
                  {canDelete && <th className="px-4 py-2 font-medium" />}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {snapshots.map((s) => {
                  const expired =
                    s.status === "expired" || s.status === "deleted" || !!s.deletedAt;
                  return (
                    <tr
                      key={s.id}
                      className={`hover:bg-slate-50 ${expired ? "text-slate-400" : ""}`}
                    >
                      <td className="whitespace-nowrap px-4 py-2.5 text-slate-600">
                        <DateTimeText value={s.createdAt} />
                      </td>
                      <td className="px-4 py-2.5 text-slate-600">
                        {formatBytes(s.byteSize)}
                      </td>
                      <td className="px-4 py-2.5">
                        <span
                          className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                            SNAPSHOT_STATUS_TONE[s.status]
                          }`}
                        >
                          {SNAPSHOT_STATUS_LABEL[s.status]}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-4 py-2.5 text-xs">
                        {!expired && s.expiresAt ? (
                          <span className="inline-flex items-center gap-1 text-slate-600">
                            <Clock size={12} />
                            {timeUntil(s.expiresAt)}
                          </span>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      {canDelete && (
                        <td className="px-4 py-2.5 text-right">
                          {!expired && (
                            <button
                              type="button"
                              onClick={() => onDeleteSnapshot(s.id)}
                              title="Delete this snapshot now"
                              aria-label="Delete snapshot"
                              className="rounded p-1.5 text-red-600 hover:bg-red-50"
                            >
                              <Trash2 size={15} />
                            </button>
                          )}
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}

          {resource.snapshotEnabled && liveSnapshots.length > 0 && (
            <p className="flex items-start gap-2 border-t border-slate-100 px-4 py-3 text-[11px] leading-relaxed text-slate-500">
              <HardDrive size={13} className="mt-0.5 shrink-0" />
              <span>
                Every artifact here is hard-deleted at its deadline — enforced by the API
                on a 5-minute sweep, not just hidden in this table. Revenant stores
                metadata only; the RDB lives in object storage.
              </span>
            </p>
          )}
        </>
      )}
    </section>
  );
}