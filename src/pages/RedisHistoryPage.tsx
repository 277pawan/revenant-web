import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import {
  CheckCircle2,
  ChevronDown,
  CircleHelp,
  Clock,
  Download,
  Eye,
  Loader2,
  RefreshCw,
  Search,
  Trash2,
  XCircle,
} from "lucide-react";

import { AppShell } from "../components/AppShell";
import { DateTimeText } from "../components/DateTimeText";
import { PageHeader } from "../components/layout/PageHeader";
import { RedisRestoreDialog } from "../components/redis/RedisRestoreDialog";
import { useDebouncedValue } from "../hooks/useDebouncedValue";
import { useToast } from "../components/toast/ToastProvider";
import { api } from "../lib/api";
import {
  PROOF_STATUS_LABEL,
  PROOF_STATUS_TONE,
  SNAPSHOT_STATUS_LABEL,
  SNAPSHOT_STATUS_TONE,
  formatBytes,
  formatDuration,
  formatNumber,
  proofExecutorLabel,
  timeUntil,
} from "../lib/redis-format";
import { roleHasPermission } from "../types/api";
import { useAuth } from "../lib/auth";
import type {
  RedisProofResource,
  RedisSnapshotPreview,
  RedisSnapshotResource,
} from "../types/api";

const PAGE_SIZE = 10;

/**
 * Proof and snapshot history.
 *
 * The list is a TABLE — one row per run, scannable at a glance — and the
 * detail is opt-in. Clicking a row expands it in place with every check, the
 * timings and the executor. The previous version dumped the entire check
 * list for every row, which made the page unreadable the moment there was
 * more than a handful of runs.
 */
export function RedisHistoryPage() {
  const { id = "" } = useParams<{ id: string }>();
  const location = useLocation();
  const { user } = useAuth();
  const toast = useToast();
  const snapshotsView = location.pathname.endsWith("/snapshots");
  const canDelete = user
    ? roleHasPermission(user.role, "credentials:write")
    : false;

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
  const [expanded, setExpanded] = useState<string | null>(null);
  const [busySnapshot, setBusySnapshot] = useState<string | null>(null);
  const [restoreFile, setRestoreFile] = useState<string | null>(null);
  const [previewSnapshotId, setPreviewSnapshotId] = useState<string | null>(
    null,
  );
  const [snapshotPreview, setSnapshotPreview] =
    useState<RedisSnapshotPreview | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const requestSequence = useRef(0);
  const previewSequence = useRef(0);

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
        error instanceof Error ? error.message : "Unexpected error",
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
        error instanceof Error ? error.message : "Unexpected error",
      );
    }
  }

  async function downloadSnapshot(snapshotId: string) {
    setBusySnapshot(snapshotId);
    try {
      const { fileName } = await api.downloadRedisSnapshotArtifact(snapshotId);
      toast.success(
        "Artifact downloaded",
        "This is a binary Redis dump. Restore instructions are open.",
      );
      setRestoreFile(fileName);
    } catch (error) {
      toast.error(
        "Could not download the artifact",
        error instanceof Error ? error.message : "Unexpected error",
      );
    } finally {
      setBusySnapshot(null);
    }
  }

  async function previewSnapshot(snapshotId: string) {
    const sequence = ++previewSequence.current;
    setPreviewSnapshotId(snapshotId);
    setSnapshotPreview(null);
    setPreviewError(null);
    setPreviewLoading(true);
    try {
      const { preview } = await api.previewRedisSnapshotArtifact(snapshotId);
      if (sequence === previewSequence.current) setSnapshotPreview(preview);
    } catch (error) {
      if (sequence === previewSequence.current) {
        setPreviewError(
          error instanceof Error ? error.message : "Unexpected error",
        );
      }
    } finally {
      if (sequence === previewSequence.current) setPreviewLoading(false);
    }
  }

  function closeSnapshotPreview() {
    previewSequence.current += 1;
    setPreviewSnapshotId(null);
    setSnapshotPreview(null);
    setPreviewError(null);
    setPreviewLoading(false);
  }

  function updateSearch(value: string) {
    setSearch(value);
    setOffset(0);
    setExpanded(null);
  }

  function changePage(nextOffset: number) {
    setExpanded(null);
    setOffset(nextOffset);
  }

  const title = snapshotsView ? "Redis snapshots" : "Redis restore proofs";

  return (
    <AppShell>
      <PageHeader
        title={title}
        description={
          resourceName
            ? `${resourceName} · ${total} ${snapshotsView ? "snapshot" : "proof"}${
                total === 1 ? "" : "s"
              }`
            : "Search and page through the full history."
        }
      ></PageHeader>

      <div className="mx-auto max-w-6xl">
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
              <RefreshCw
                size={14}
                className={loading ? "animate-spin" : undefined}
              />
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
              <div className="overflow-x-auto">
                <table className="w-full min-w-[720px] text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50/70 text-left text-xs uppercase tracking-wide text-slate-500">
                      <th className="px-4 py-2.5 font-medium">Status</th>
                      <th className="px-4 py-2.5 font-medium">Captured</th>
                      <th className="px-4 py-2.5 font-medium">Artifact</th>
                      <th className="px-4 py-2.5 font-medium">Expires</th>
                      <th className="px-4 py-2.5 font-medium">Checksum</th>
                      <th className="px-4 py-2.5 text-right font-medium">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {snapshots.map((snapshot) => {
                      const expired =
                        snapshot.status === "expired" ||
                        snapshot.status === "deleted" ||
                        !!snapshot.deletedAt;
                      const downloadable =
                        snapshot.status === "stored" && !!snapshot.storageKey;
                      return (
                        <tr
                          key={snapshot.id}
                          className="align-top hover:bg-slate-50/70"
                        >
                          <td className="px-4 py-3">
                            <span
                              className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                                SNAPSHOT_STATUS_TONE[snapshot.status] ??
                                "bg-slate-100 text-slate-600"
                              }`}
                            >
                              {SNAPSHOT_STATUS_LABEL[snapshot.status] ??
                                snapshot.status}
                            </span>
                            {snapshot.status === "failed" &&
                              snapshot.errorMessage && (
                                <p className="mt-1.5 max-w-xs break-words text-xs text-red-700">
                                  {snapshot.errorMessage}
                                </p>
                              )}
                          </td>
                          <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-600">
                            <DateTimeText value={snapshot.createdAt} />
                          </td>
                          <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-700">
                            {formatBytes(snapshot.byteSize)}
                          </td>
                          <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-600">
                            {!expired && snapshot.expiresAt ? (
                              <span className="inline-flex items-center gap-1">
                                <Clock size={12} />
                                {timeUntil(snapshot.expiresAt)}
                              </span>
                            ) : (
                              <span className="text-slate-400">—</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-xs">
                            {snapshot.checksumSha256 ? (
                              <span
                                className="font-mono text-[11px] text-slate-500"
                                title={snapshot.checksumSha256}
                              >
                                {snapshot.checksumSha256.slice(0, 12)}…
                              </span>
                            ) : (
                              <span className="text-slate-400">—</span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center justify-end gap-1">
                              {downloadable && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    void previewSnapshot(snapshot.id)
                                  }
                                  disabled={busySnapshot === snapshot.id}
                                  title="Inspect a limited sample of keys and values from this snapshot"
                                  aria-label="Preview snapshot data"
                                  className="inline-flex items-center gap-1 rounded-md border border-slate-300 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                                >
                                  <Eye size={12} />
                                  Preview data
                                </button>
                              )}
                              {downloadable && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    void downloadSnapshot(snapshot.id)
                                  }
                                  disabled={busySnapshot === snapshot.id}
                                  title="Download the stored RDB and open restore instructions"
                                  aria-label="Download and restore snapshot"
                                  className="inline-flex items-center gap-1 rounded-md border border-slate-300 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                                >
                                  {busySnapshot === snapshot.id ? (
                                    <Loader2
                                      size={12}
                                      className="animate-spin"
                                    />
                                  ) : (
                                    <Download size={12} />
                                  )}
                                  Download & restore
                                </button>
                              )}
                              {canDelete && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    void deleteSnapshot(snapshot.id)
                                  }
                                  aria-label="Delete snapshot now"
                                  title="Delete snapshot now"
                                  className="rounded p-1.5 text-red-600 hover:bg-red-50"
                                >
                                  <Trash2 size={14} />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )
          ) : proofs.length === 0 ? (
            <p className="px-4 py-12 text-center text-sm text-slate-500">
              {debouncedSearch
                ? "No proofs match your search."
                : "No restore proofs have been run yet."}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/70 text-left text-xs uppercase tracking-wide text-slate-500">
                    <th className="px-4 py-2.5 font-medium">Status</th>
                    <th className="px-4 py-2.5 font-medium">Run</th>
                    <th className="px-4 py-2.5 font-medium">Keys</th>
                    <th className="px-4 py-2.5 font-medium">RTO</th>
                    <th className="px-4 py-2.5 font-medium">RPO</th>
                    <th className="px-4 py-2.5 font-medium">Run by</th>
                    <th className="px-4 py-2.5 text-right font-medium">
                      Detail
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {proofs.map((proof) => {
                    const open = expanded === proof.id;
                    return (
                      <tr key={proof.id} className="align-top">
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                              PROOF_STATUS_TONE[proof.status] ??
                              "bg-slate-100 text-slate-600"
                            }`}
                          >
                            {PROOF_STATUS_LABEL[proof.status] ?? proof.status}
                          </span>
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-600">
                          <DateTimeText value={proof.createdAt} />
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-700">
                          {proof.restoredKeyCount == null
                            ? "—"
                            : `${formatNumber(proof.restoredKeyCount)} / ${
                                proof.sourceKeyCount == null
                                  ? "—"
                                  : formatNumber(proof.sourceKeyCount)
                              }`}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-700">
                          {formatDuration(proof.restoreSeconds)}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-700">
                          {formatDuration(proof.rpoObservedSeconds)}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-600">
                          {proofExecutorLabel(proof.claimedBy) ?? "—"}
                          {proof.attempts > 1 && (
                            <span className="text-slate-400">
                              {" · "}
                              {proof.attempts} attempts
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            type="button"
                            onClick={() => setExpanded(open ? null : proof.id)}
                            aria-expanded={open}
                            className="inline-flex items-center gap-1 rounded-md border border-slate-300 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
                          >
                            View
                            <Eye size={12} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-4 py-3">
            <p className="text-xs text-slate-500">
              Showing {visibleFrom}–{visibleTo} of {total}
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => changePage(Math.max(0, offset - PAGE_SIZE))}
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
                onClick={() => changePage(offset + PAGE_SIZE)}
                disabled={!hasMore || loading}
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </footer>
        </section>
      </div>

      {expanded && (
        <ProofDetailModal
          proof={proofs.find((p) => p.id === expanded) as RedisProofResource}
          onClose={() => setExpanded(null)}
        />
      )}
      {restoreFile && (
        <RedisRestoreDialog
          fileName={restoreFile}
          onClose={() => setRestoreFile(null)}
        />
      )}
      {previewSnapshotId && (
        <RedisSnapshotPreviewModal
          preview={snapshotPreview}
          loading={previewLoading}
          error={previewError}
          onClose={closeSnapshotPreview}
        />
      )}
    </AppShell>
  );
}

function RedisSnapshotPreviewModal({
  preview,
  loading,
  error,
  onClose,
}: {
  preview: RedisSnapshotPreview | null;
  loading: boolean;
  error: string | null;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/50 p-4 sm:p-8"
      role="dialog"
      aria-modal="true"
      aria-label="Redis snapshot data preview"
      onClick={onClose}
    >
      <div
        className="redis-panel-in w-full max-w-4xl rounded-xl bg-white shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">
              Snapshot data preview
            </h2>
            <p className="mt-1 max-w-2xl text-xs text-amber-800">
              This opt-in preview may contain sensitive values. It samples at
              most 20 keys and shows only a small excerpt; preview data is not
              stored.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close preview"
            className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100"
          >
            <XCircle size={18} />
          </button>
        </header>
        <div className="max-h-[70vh] overflow-y-auto p-5">
          {loading ? (
            <p className="flex items-center justify-center gap-2 py-12 text-sm text-slate-500">
              <Loader2 size={15} className="animate-spin" />
              Loading a limited sample from the isolated snapshot…
            </p>
          ) : error ? (
            <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
              {error}
            </div>
          ) : preview ? (
            <>
              <p className="mb-4 text-xs text-slate-600">
                {formatNumber(preview.totalKeys)} keys across{" "}
                {preview.databases.length} database
                {preview.databases.length === 1 ? "" : "s"} · showing{" "}
                {preview.sampledKeys} of at most {preview.sampleLimit}
                {preview.truncated ? " · sample is partial" : ""}
              </p>
              <div className="space-y-4">
                {preview.databases.map((database) => (
                  <section
                    key={database.database}
                    className="overflow-hidden rounded-lg border border-slate-200"
                  >
                    <h3 className="border-b border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-800">
                      Database {database.database} ·{" "}
                      {formatNumber(database.keyCount)} keys
                    </h3>
                    {database.keys.length === 0 ? (
                      <p className="p-3 text-xs text-slate-500">
                        No sample keys were found in this database.
                      </p>
                    ) : (
                      <div className="divide-y divide-slate-100">
                        {database.keys.map((key, index) => (
                          <article
                            key={`${database.database}-${index}`}
                            className="p-3"
                          >
                            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                              <code className="break-all font-semibold text-slate-900">
                                {key.key}
                              </code>
                              <span className="rounded bg-slate-100 px-1.5 py-0.5 text-slate-600">
                                {key.type}
                              </span>
                              <span className="text-slate-500">
                                {key.ttlSeconds === null
                                  ? "No expiry"
                                  : `TTL ${key.ttlSeconds}s`}
                              </span>
                            </div>
                            <pre className="mt-2 overflow-x-auto whitespace-pre-wrap break-all rounded bg-slate-50 p-2 text-xs text-slate-700">
                              {key.preview}
                              {key.previewEncoding === "base64" && (
                                <span className="block text-[10px] text-slate-500">
                                  Binary content shown as base64
                                </span>
                              )}
                              {key.truncated && (
                                <span className="block text-[10px] text-slate-500">
                                  Excerpt truncated
                                </span>
                              )}
                            </pre>
                          </article>
                        ))}
                      </div>
                    )}
                  </section>
                ))}
              </div>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}

/**
 * The full detail of one proof.
 *
 * Everything the row cannot show: why it failed, who ran it, how the data
 * was captured, and every individual check with its timing.
 */
function ProofDetailModal({
  proof,
  onClose,
}: {
  proof: RedisProofResource;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/50 p-4 sm:p-8"
      role="dialog"
      aria-modal="true"
      aria-label={`Restore proof ${proof.id}`}
      onClick={onClose}
    >
      <div
        className="redis-panel-in w-full max-w-3xl rounded-xl bg-white shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">
              Restore proof detail
            </h2>
            <p className="mt-0.5 text-xs text-slate-500">
              <DateTimeText value={proof.createdAt} />
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-md border border-slate-300 px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50"
          >
            Close
          </button>
        </header>
        <div className="px-5 py-4">
          <div className="grid gap-4 lg:grid-cols-3">
            <div className="lg:col-span-1">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Summary
              </h3>
              <dl className="mt-2 space-y-1.5 text-xs">
                <div className="flex justify-between gap-3">
                  <dt className="text-slate-500">Run by</dt>
                  <dd className="text-right font-medium text-slate-700">
                    {proofExecutorLabel(proof.claimedBy) ?? "—"}
                  </dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-slate-500">Attempts</dt>
                  <dd className="text-right font-medium text-slate-700">
                    {proof.attempts}
                  </dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-slate-500">Restored keys</dt>
                  <dd className="text-right font-medium text-slate-700">
                    {formatNumber(proof.restoredKeyCount)}
                  </dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-slate-500">Source keys</dt>
                  <dd className="text-right font-medium text-slate-700">
                    {formatNumber(proof.sourceKeyCount)}
                  </dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-slate-500">Restore time (RTO)</dt>
                  <dd className="text-right font-medium text-slate-700">
                    {formatDuration(proof.restoreSeconds)}
                  </dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-slate-500">Recovery point (RPO)</dt>
                  <dd className="text-right font-medium text-slate-700">
                    {formatDuration(proof.rpoObservedSeconds)}
                  </dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-slate-500">RDB bytes</dt>
                  <dd className="text-right font-medium text-slate-700">
                    {formatBytes(proof.rdbBytes)}
                  </dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-slate-500">Started</dt>
                  <dd className="text-right text-slate-700">
                    <DateTimeText value={proof.startedAt} />
                  </dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-slate-500">Finished</dt>
                  <dd className="text-right text-slate-700">
                    <DateTimeText value={proof.completedAt} />
                  </dd>
                </div>
                <div className="pt-1">
                  <dt className="text-slate-500">Proof ID</dt>
                  <dd className="mt-0.5 break-all font-mono text-[11px] text-slate-600">
                    {proof.id}
                  </dd>
                </div>
              </dl>
            </div>

            <div className="lg:col-span-2">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Restore checks
              </h3>
              {proof.errorMessage && (
                <p className="mt-2 break-words rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                  {proof.errorMessage}
                </p>
              )}
              {proof.status === "pending" && proof.lastError && (
                <p className="mt-2 break-words rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                  {proof.lastError}
                </p>
              )}
              {proof.checks.length === 0 ? (
                <p className="mt-2 text-xs text-slate-500">
                  No checks recorded yet.
                </p>
              ) : (
                <ul className="mt-2 space-y-1.5">
                  {proof.checks.map((check) => {
                    const Icon =
                      check.status === "pass"
                        ? CheckCircle2
                        : check.status === "fail"
                          ? XCircle
                          : CircleHelp;
                    return (
                      <li
                        key={`${proof.id}-${check.name}-${check.status}`}
                        className="flex min-w-0 items-start gap-2 rounded-md bg-white px-3 py-2 text-xs ring-1 ring-slate-200"
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
                        <span className="min-w-0 flex-1">
                          <span className="font-medium text-slate-800">
                            {check.name}
                          </span>
                          <span className="block break-words text-slate-600">
                            {check.message}
                          </span>
                        </span>
                        {check.durationMs > 0 && (
                          <span className="shrink-0 tabular-nums text-slate-400">
                            {formatDuration(check.durationMs / 1000)}
                          </span>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
