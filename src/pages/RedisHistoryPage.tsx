import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import { Clock, Loader2, RefreshCw, Search, Trash2 } from "lucide-react";

import { AppShell } from "../components/AppShell";
import { DateTimeText } from "../components/DateTimeText";
import { PageHeader } from "../components/layout/PageHeader";
import { useDebouncedValue } from "../hooks/useDebouncedValue";
import { useToast } from "../components/toast/ToastProvider";
import { api } from "../lib/api";
import {
  PROOF_STATUS_LABEL,
  PROOF_STATUS_TONE,
  formatBytes,
  formatDuration,
  formatNumber,
  proofExecutorLabel,
  timeUntil,
} from "../lib/redis-format";
import { roleHasPermission } from "../types/api";
import { useAuth } from "../lib/auth";
import type { RedisProofResource, RedisSnapshotResource } from "../types/api";

const PAGE_SIZE = 10;

const PROOF_TONE = PROOF_STATUS_TONE;

const SNAPSHOT_TONE: Record<string, string> = {
  stored: "bg-emerald-100 text-emerald-800",
  capturing: "bg-sky-100 text-sky-800",
  expired: "bg-slate-100 text-slate-600",
  deleted: "bg-slate-100 text-slate-600",
  failed: "bg-red-100 text-red-700",
};

export function RedisHistoryPage() {
  const { id = "" } = useParams<{ id: string }>();
  const location = useLocation();
  const { user } = useAuth();
  const toast = useToast();
  const snapshotsView = location.pathname.endsWith("/snapshots");
  const canDelete = user ? roleHasPermission(user.role, "credentials:write") : false;

  const [resourceName, setResourceName] = useState("");
  const [proofs, setProofs] = useState<RedisProofResource[]>([]);
  const [snapshots, setSnapshots] = useState<RedisSnapshotResource[]>([]);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search, 250);
  const [offset, setOffset] = useState(0);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshVersion, setRefreshVersion] = useState(0);
  const requestSequence = useRef(0);

  const loadPage = useCallback(async () => {
    const sequence = ++requestSequence.current;
    setLoading(true);
    setError(null);
    try {
      if (snapshotsView) {
        const [resourceResponse, snapshotPage] = await Promise.all([
          api.getRedisResource(id),
          api.listRedisSnapshotHistory(id, {
            offset,
            limit: PAGE_SIZE,
            search: debouncedSearch,
          }),
        ]);
        if (sequence !== requestSequence.current) return;
        setResourceName(resourceResponse.resource.name);
        setSnapshots(snapshotPage.snapshots);
        setTotal(snapshotPage.total);
        setHasMore(snapshotPage.hasMore);
      } else {
        const [resourceResponse, proofPage] = await Promise.all([
          api.getRedisResource(id),
          api.listRedisProofHistory(id, {
            offset,
            limit: PAGE_SIZE,
            search: debouncedSearch,
          }),
        ]);
        if (sequence !== requestSequence.current) return;
        setResourceName(resourceResponse.resource.name);
        setProofs(proofPage.proofs);
        setTotal(proofPage.total);
        setHasMore(proofPage.hasMore);
      }
    } catch (error) {
      if (sequence !== requestSequence.current) return;
      setError(error instanceof Error ? error.message : "Unexpected error");
      toast.error(
        "Could not load Redis history",
        error instanceof Error ? error.message : "Unexpected error"
      );
    } finally {
      if (sequence === requestSequence.current) setLoading(false);
    }
  }, [debouncedSearch, id, offset, snapshotsView, toast, refreshVersion]);

  useEffect(() => {
    void loadPage();
  }, [loadPage]);

  const pageNumber = Math.floor(offset / PAGE_SIZE) + 1;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const visibleFrom = total === 0 ? 0 : offset + 1;
  const visibleTo = Math.min(offset + PAGE_SIZE, total);

  async function deleteSnapshot(snapshotId: string) {
    try {
      await api.deleteRedisSnapshot(snapshotId);
      toast.success("Snapshot deleted", "The stored artifact was removed.");
      if (snapshots.length === 1 && offset > 0) {
        setOffset((current) => Math.max(0, current - PAGE_SIZE));
      }
      setRefreshVersion((current) => current + 1);
    } catch (error) {
      toast.error(
        "Could not delete snapshot",
        error instanceof Error ? error.message : "Unexpected error"
      );
    }
  }

  function updateSearch(value: string) {
    setSearch(value);
    setOffset(0);
  }

  const title = snapshotsView ? "Redis snapshots" : "Redis restore proofs";

  return (
    <AppShell>
      <PageHeader
        title={title}
        description={
          resourceName
            ? `${resourceName} · Search and page through the full history.`
            : "Search and page through the full history."
        }
      >
        <Link
          to="/redis/guide"
          className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          Redis proof guide
        </Link>
        <Link
          to="/redis"
          className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          Back to Redis
        </Link>
      </PageHeader>

      <div className="mx-auto max-w-5xl">
        <nav className="mb-4 flex gap-2" aria-label="Redis history">
          <Link
            to={`/redis/${id}/proofs`}
            aria-current={!snapshotsView ? "page" : undefined}
            className={`rounded-lg px-4 py-2 text-sm font-medium ${
              !snapshotsView
                ? "bg-slate-900 text-white"
                : "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
            }`}
          >
            Proof history
          </Link>
          <Link
            to={`/redis/${id}/snapshots`}
            aria-current={snapshotsView ? "page" : undefined}
            className={`rounded-lg px-4 py-2 text-sm font-medium ${
              snapshotsView
                ? "bg-slate-900 text-white"
                : "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
            }`}
          >
            Snapshot history
          </Link>
        </nav>

        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 p-4">
            <label className="flex min-w-0 flex-1 items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 sm:max-w-xl">
              <Search size={16} className="shrink-0 text-slate-400" />
              <input
                type="search"
                value={search}
                onChange={(event) => updateSearch(event.target.value)}
                placeholder={
                  snapshotsView
                    ? "Search by snapshot status or ID"
                    : "Search by proof status, error, or ID"
                }
                aria-label={`Search ${snapshotsView ? "snapshots" : "proofs"}`}
                className="min-w-0 flex-1 text-sm outline-none placeholder:text-slate-400"
              />
            </label>
            <button
              type="button"
              onClick={() => setRefreshVersion((current) => current + 1)}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
              disabled={loading}
            >
              <RefreshCw size={14} className={loading ? "animate-spin" : undefined} />
              Refresh
            </button>
          </div>

          {error ? (
            <div className="flex flex-wrap items-center justify-between gap-3 p-5 text-sm text-red-700">
              <span>{error}</span>
              <button
                type="button"
                onClick={() => setRefreshVersion((current) => current + 1)}
                className="rounded-lg border border-red-300 bg-white px-3 py-1.5 font-medium text-red-800"
              >
                Retry
              </button>
            </div>
          ) : loading ? (
            <p className="flex items-center justify-center gap-2 px-4 py-12 text-sm text-slate-500">
              <Loader2 size={15} className="animate-spin" />
              Loading history…
            </p>
          ) : snapshotsView ? (
            snapshots.length === 0 ? (
              <p className="px-4 py-12 text-center text-sm text-slate-500">
                {debouncedSearch
                  ? "No snapshots match your search."
                  : "No snapshots have been captured yet."}
              </p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {snapshots.map((snapshot) => {
                  const expired =
                    snapshot.status === "expired" ||
                    snapshot.status === "deleted" ||
                    !!snapshot.deletedAt;
                  return (
                    <li
                      key={snapshot.id}
                      className="flex min-w-0 items-start justify-between gap-3 p-4"
                    >
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <DateTimeText value={snapshot.createdAt} />
                          <span
                            className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                              SNAPSHOT_TONE[snapshot.status] ??
                              "bg-slate-100 text-slate-600"
                            }`}
                          >
                            {snapshot.status}
                          </span>
                        </div>
                        <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-2 text-xs sm:grid-cols-3">
                          <div>
                            <dt className="text-slate-500">Artifact size</dt>
                            <dd className="font-medium text-slate-700">
                              {formatBytes(snapshot.byteSize)}
                            </dd>
                          </div>
                          <div>
                            <dt className="text-slate-500">Expires</dt>
                            <dd className="font-medium text-slate-700">
                              {!expired && snapshot.expiresAt ? (
                                <>
                                  <span className="inline-flex items-center gap-1">
                                    <Clock size={12} />
                                    {timeUntil(snapshot.expiresAt)}
                                  </span>
                                  <span className="mt-1 block text-slate-500">
                                    <DateTimeText value={snapshot.expiresAt} />
                                  </span>
                                </>
                              ) : (
                                "Expired or deleted"
                              )}
                            </dd>
                          </div>
                          <div className="col-span-2 min-w-0 sm:col-span-1">
                            <dt className="text-slate-500">Snapshot ID</dt>
                            <dd className="break-all font-mono text-slate-600">
                              {snapshot.id}
                            </dd>
                          </div>
                        </dl>
                      </div>
                      {canDelete && !expired && (
                        <button
                          type="button"
                          onClick={() => void deleteSnapshot(snapshot.id)}
                          aria-label="Delete snapshot now"
                          title="Delete snapshot now"
                          className="shrink-0 rounded p-2 text-red-600 hover:bg-red-50"
                        >
                          <Trash2 size={16} />
                        </button>
                      )}
                    </li>
                  );
                })}
              </ul>
            )
          ) : proofs.length === 0 ? (
            <p className="px-4 py-12 text-center text-sm text-slate-500">
              {debouncedSearch
                ? "No proofs match your search."
                : "No restore proofs have been run yet."}
            </p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {proofs.map((proof) => (
                <li key={proof.id} className="min-w-0 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <DateTimeText value={proof.createdAt} />
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        PROOF_TONE[proof.status] ?? "bg-slate-100 text-slate-600"
                      }`}
                    >
                      {PROOF_STATUS_LABEL[proof.status] ?? proof.status}
                    </span>
                  </div>
                  {proofExecutorLabel(proof.claimedBy) && (
                    <p className="mt-1 text-xs text-slate-500">
                      Run by {proofExecutorLabel(proof.claimedBy)}
                      {proof.attempts > 1 ? ` · ${proof.attempts} attempts` : ""}
                    </p>
                  )}
                  {proof.status === "pending" && proof.lastError && (
                    <p className="mt-2 break-words text-xs text-amber-700">
                      {proof.lastError}
                    </p>
                  )}
                  <dl className="mt-3 grid grid-cols-2 gap-3 text-xs sm:grid-cols-4">
                    <div>
                      <dt className="text-slate-500">Restored / source keys</dt>
                      <dd className="font-medium text-slate-700">
                        {proof.restoredKeyCount == null
                          ? "—"
                          : `${formatNumber(proof.restoredKeyCount)} / ${
                              proof.sourceKeyCount == null
                                ? "—"
                                : formatNumber(proof.sourceKeyCount)
                            }`}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-slate-500">Restore time (RTO)</dt>
                      <dd className="font-medium text-slate-700">
                        {formatDuration(proof.restoreSeconds)}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-slate-500">Observed recovery point (RPO)</dt>
                      <dd className="font-medium text-slate-700">
                        {formatDuration(proof.rpoObservedSeconds)}
                      </dd>
                    </div>
                    <div className="min-w-0">
                      <dt className="text-slate-500">Proof ID</dt>
                      <dd className="break-all font-mono text-slate-600">{proof.id}</dd>
                    </div>
                  </dl>
                  {proof.errorMessage && (
                    <p className="mt-3 break-words rounded-md bg-red-50 px-3 py-2 text-xs text-red-700">
                      {proof.errorMessage}
                    </p>
                  )}
                  {proof.checks.length > 0 && (
                    <details className="mt-3 border-t border-slate-100 pt-3">
                      <summary className="cursor-pointer text-xs font-medium text-slate-700">
                        View {proof.checks.length} restore checks
                      </summary>
                      <ul className="mt-2 space-y-2">
                        {proof.checks.map((check) => (
                          <li
                            key={`${proof.id}-${check.name}`}
                            className="flex min-w-0 justify-between gap-3 text-xs"
                          >
                            <span className="min-w-0 break-words text-slate-600">
                              <strong className="font-medium text-slate-800">
                                {check.name}:
                              </strong>{" "}
                              {check.message}
                            </span>
                            <span className="shrink-0 text-slate-500">
                              {formatDuration(check.durationMs / 1000)}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </details>
                  )}
                </li>
              ))}
            </ul>
          )}

          <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-4 py-3">
            <p className="text-xs text-slate-500">
              Showing {visibleFrom}–{visibleTo} of {total}
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setOffset((current) => Math.max(0, current - PAGE_SIZE))}
                disabled={offset === 0 || loading}
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Previous
              </button>
              <span className="text-xs tabular-nums text-slate-500">
                Page {pageNumber} of {pageCount}
              </span>
              <button
                type="button"
                onClick={() => setOffset((current) => current + PAGE_SIZE)}
                disabled={!hasMore || loading}
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </footer>
        </section>
      </div>
    </AppShell>
  );
}
