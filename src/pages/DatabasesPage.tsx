import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  AlertTriangle,
  CheckCircle2,
  Database,
  FileCode2,
  Lock,
  Loader2,
  Pencil,
  Play,
  Plus,
  Search,
  Trash2,
} from "lucide-react";
import { AppShell } from "../components/AppShell";
import { PageHeader } from "../components/layout/PageHeader";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { PaginationBar } from "../components/PaginationBar";
import { useToast } from "../components/toast/ToastProvider";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import {
  roleHasPermission,
  type AwsSourceStatus,
  type DatabaseResource,
  type PaginationMeta,
} from "../types/api";

const emptyPagination: PaginationMeta = {
  page: 1,
  pageSize: 20,
  total: 0,
  totalPages: 1,
};

type AwsSourceDisplayStatus =
  | AwsSourceStatus
  | (Partial<Omit<AwsSourceStatus, "state">> & { state: "checking" });

export function DatabasesPage() {
  const { user } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const canWrite = user ? roleHasPermission(user.role, "databases:write") : false;
  const canRun = user ? roleHasPermission(user.role, "jobs:run") : false;

  const [databases, setDatabases] = useState<DatabaseResource[]>([]);
  const [pagination, setPagination] = useState<PaginationMeta>(emptyPagination);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<DatabaseResource | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [runningId, setRunningId] = useState<string | null>(null);
  const [awsSourceStatuses, setAwsSourceStatuses] = useState<
    Record<string, AwsSourceDisplayStatus>
  >({});

  const load = useCallback(async (nextPage: number) => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.listDatabases(nextPage, 20);
      setDatabases(res.data);
      setPagination(res.pagination);
      setPage(res.pagination.page);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load databases");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(page);
  }, [load, page]);

  useEffect(() => {
    const targets = databases.filter((db) => db.recoveryMode === "aws-rds");
    let nextIndex = 0;
    let cancelled = false;

    setAwsSourceStatuses(
      Object.fromEntries(targets.map((db) => [db.id, { state: "checking" as const }]))
    );

    async function checkNext() {
      while (!cancelled) {
        const database = targets[nextIndex++];
        if (!database) return;

        try {
          const { status } = await api.getAwsSourceStatus(database.id);
          if (!cancelled) {
            setAwsSourceStatuses((current) => ({ ...current, [database.id]: status }));
          }
        } catch (err) {
          if (!cancelled) {
            setAwsSourceStatuses((current) => ({
              ...current,
              [database.id]: {
                state: "unknown",
                rdsStatus: null,
                availableSnapshotCount: null,
                latestSnapshotIdentifier: null,
                latestSnapshotCreatedAt: null,
                checkedAt: new Date().toISOString(),
                message: err instanceof Error ? err.message : "Could not check AWS status.",
              },
            }));
          }
        }
      }
    }

    void Promise.all(
      Array.from({ length: Math.min(3, targets.length) }, () => checkNext())
    );
    return () => {
      cancelled = true;
    };
  }, [databases]);

  const filtered = databases.filter((db) => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return (
      db.name.toLowerCase().includes(q) ||
      (db.host ?? "").toLowerCase().includes(q) ||
      (db.region ?? "").toLowerCase().includes(q)
    );
  });

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.deleteDatabase(deleteTarget.id);
      toast.success("Database removed", `“${deleteTarget.name}” is no longer in this org.`);
      setDeleteTarget(null);
      await load(page);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to delete";
      setError(message);
      toast.error("Delete failed", message);
    } finally {
      setDeleting(false);
    }
  }

  async function runValidation(db: DatabaseResource) {
    if (!canRun) return;
    const awsStatus = awsSourceStatuses[db.id];
    if (db.recoveryMode === "aws-rds" && awsStatus?.state !== "available") {
      toast.error(
        "Full drill unavailable",
        awsStatus?.state === "missing" && awsStatus.availableSnapshotCount
          ? "The source RDS instance is missing. Verify or recover an existing snapshot from the workflow's Recovery Points tab."
          : awsStatus?.message ?? "Wait for the AWS source check to finish before starting a drill."
      );
      return;
    }
    setRunningId(db.id);
    setError(null);
    try {
      const { job } = await api.createJob({ databaseId: db.id, drillKind: "full" });
      toast.success("Full restore drill queued", `Job queued for ${db.name}.`);
      navigate(`/workflows/${job.databaseId}/runs/${job.id}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to start job";
      setError(message);
      toast.error("Could not start validation", message);
    } finally {
      setRunningId(null);
    }
  }

  return (
    <AppShell>
      <PageHeader
        title="Databases"
        description="Register the Postgres or AWS RDS connections you want to protect. Credentials stay encrypted — Revenant never shows passwords in the browser."
      >
        {canWrite && (
          <div className="flex flex-wrap gap-2">
            <Link
              to="/databases/new?sample=aws-freetier"
              className="inline-flex items-center gap-2 rounded-md border border-brand/30 bg-blue-50 px-4 py-2 text-sm font-medium text-brand hover:bg-blue-100"
            >
              <Database size={16} />
              Import AWS sample
            </Link>
            <Link
              to="/databases/new"
              className="inline-flex items-center gap-2 rounded-md bg-brand px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700"
            >
              <Plus size={16} />
              Add database
            </Link>
          </div>
        )}
      </PageHeader>

      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: "Total", value: pagination.total },
          {
            label: "With credentials",
            value: databases.filter((d) => d.hasCredentials).length,
          },
          {
            label: "With validation plan",
            value: databases.filter((d) => d.hasValidationPlan).length,
          },
          { label: "Engine", value: "Postgres" },
        ].map((stat) => (
          <div
            key={stat.label}
            className="rounded-lg border border-slate-200 bg-white px-4 py-3 shadow-sm"
          >
            <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
              {stat.label}
            </div>
            <div className="mt-1 text-2xl font-semibold tabular-nums text-slate-900">
              {stat.value}
            </div>
          </div>
        ))}
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      )}

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-center gap-3 border-b border-slate-200 px-4 py-3">
          <div className="relative min-w-[220px] flex-1">
            <Search
              size={16}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Filter this page by name, host, or region…"
              className="w-full rounded-md border border-slate-300 py-2 pl-9 pr-3 text-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
            />
          </div>
        </div>

        {loading ? (
          <div className="space-y-3 p-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-12 animate-pulse rounded bg-slate-100" />
            ))}
          </div>
        ) : pagination.total === 0 ? (
          <div className="flex flex-col items-center px-6 py-16 text-center">
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-blue-50 text-brand">
              <Database size={28} />
            </div>
            <h2 className="text-lg font-semibold text-slate-900">No databases yet</h2>
            <p className="mt-2 max-w-md text-sm text-slate-600">
              Register a Postgres connection, then attach a validation plan and invite your team.
            </p>
            {canWrite && (
              <div className="mt-6 flex flex-wrap justify-center gap-3">
                <Link
                  to="/databases/new?sample=aws-freetier"
                  className="inline-flex items-center gap-2 rounded-md bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
                >
                  <Database size={16} />
                  Quick start: AWS sample
                </Link>
                <Link
                  to="/databases/new"
                  className="inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50"
                >
                  <Plus size={16} />
                  Add your own database
                </Link>
              </div>
            )}
          </div>
        ) : filtered.length === 0 ? (
          <div className="px-6 py-12 text-center text-sm text-slate-500">
            No databases on this page match “{query}”.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-medium">Name</th>
                  <th className="px-4 py-3 font-medium">Target</th>
                  <th className="px-4 py-3 font-medium">Region</th>
                  <th className="px-4 py-3 font-medium">Credentials</th>
                  <th className="px-4 py-3 font-medium">Plan</th>
                  <th className="px-4 py-3 font-medium">Created</th>
                  <th className="px-4 py-3 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((db) => (
                  <tr key={db.id} className="hover:bg-slate-50/80">
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-900">{db.name}</div>
                      {db.databaseName && (
                        <div className="font-mono text-xs text-slate-500">{db.databaseName}</div>
                      )}
                      {db.recoveryMode === "aws-rds" && (
                        <div className="mt-1 flex flex-col items-start gap-1">
                          <span className="inline-block rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-blue-800">
                            AWS restore
                          </span>
                          {awsSourceStatuses[db.id]?.state === "checking" || !awsSourceStatuses[db.id] ? (
                            <span className="inline-flex items-center gap-1 text-xs text-slate-500">
                              <Loader2 size={13} className="animate-spin" />
                              Checking AWS source…
                            </span>
                          ) : awsSourceStatuses[db.id].state === "available" ? (
                            <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700">
                              <CheckCircle2 size={13} />
                              RDS available
                              {awsSourceStatuses[db.id].availableSnapshotCount != null &&
                                ` · ${awsSourceStatuses[db.id].availableSnapshotCount} snapshot(s)`}
                            </span>
                          ) : (
                            <div className="flex flex-col items-start gap-1">
                              <span
                                className={`inline-flex items-center gap-1 text-xs font-medium ${
                                  awsSourceStatuses[db.id].state === "missing"
                                    ? "text-red-700"
                                    : "text-amber-700"
                                }`}
                                title={awsSourceStatuses[db.id].message ?? undefined}
                              >
                                <AlertTriangle size={13} />
                                {awsSourceStatuses[db.id].state === "missing"
                                  ? "Source RDS not found"
                                  : awsSourceStatuses[db.id].state === "unavailable"
                                    ? `RDS ${awsSourceStatuses[db.id].rdsStatus ?? "unavailable"}`
                                    : awsSourceStatuses[db.id].state === "not_configured"
                                      ? "AWS setup incomplete"
                                      : "AWS status unknown"}
                              </span>
                              {awsSourceStatuses[db.id].availableSnapshotCount != null && (
                                <span className="text-xs text-slate-600">
                                  {awsSourceStatuses[db.id].availableSnapshotCount} available snapshot(s)
                                </span>
                              )}
                              {awsSourceStatuses[db.id].state === "missing" && (
                                <Link
                                  to={`/workflows/${db.id}?tab=recovery-points`}
                                  className="text-xs font-medium text-brand hover:underline"
                                >
                                  Open Recovery Points
                                </Link>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-700">
                      {db.recoveryMode === "aws-rds"
                        ? db.rdsSourceIdentifier ?? "—"
                        : db.host
                          ? `${db.host}:${db.port ?? 5432}`
                          : "—"}
                    </td>
                    <td className="px-4 py-3 text-slate-600">{db.region ?? "—"}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col gap-1">
                        {db.hasCredentials ? (
                          <span className="inline-flex w-fit items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-800">
                            <Lock size={12} />
                            DB
                          </span>
                        ) : (
                          <span className="w-fit rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-800">
                            No DB secret
                          </span>
                        )}
                        {db.recoveryMode === "aws-rds" &&
                          (db.hasAwsCredentials ? (
                            <span className="w-fit rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-800">
                              AWS keys
                            </span>
                          ) : (
                            <span className="w-fit rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-800">
                              No AWS keys
                            </span>
                          ))}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {db.hasValidationPlan ? (
                        <Link
                          to={`/settings/validation-plans?databaseId=${db.id}`}
                          className="inline-flex items-center gap-1 text-xs font-medium text-brand hover:underline"
                        >
                          <FileCode2 size={12} />
                          Configured
                        </Link>
                      ) : (
                        <Link
                          to={`/settings/validation-plans?databaseId=${db.id}`}
                          className="text-xs text-slate-500 hover:text-brand hover:underline"
                        >
                          Add plan
                        </Link>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-500">
                      {new Date(db.createdAt).toLocaleString()}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        {canRun && (
                          <button
                            type="button"
                            disabled={
                              runningId === db.id ||
                              (db.recoveryMode === "aws-rds" &&
                                awsSourceStatuses[db.id]?.state !== "available")
                            }
                            onClick={() => void runValidation(db)}
                            title={
                              db.recoveryMode === "aws-rds" &&
                              awsSourceStatuses[db.id]?.state !== "available"
                                ? "A full drill requires an AWS RDS source instance in available state."
                                : undefined
                            }
                            className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs text-brand hover:bg-blue-50 disabled:opacity-50"
                          >
                            <Play size={14} />
                            Run
                          </button>
                        )}
                        {canWrite && (
                          <>
                            <Link
                              to={`/databases/${db.id}/edit`}
                              className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs text-slate-700 hover:bg-slate-100"
                            >
                              <Pencil size={14} />
                              Edit
                            </Link>
                            <button
                              type="button"
                              onClick={() => setDeleteTarget(db)}
                              className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs text-red-600 hover:bg-red-50"
                            >
                              <Trash2 size={14} />
                              Delete
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {!loading && pagination.total > 0 && (
          <PaginationBar pagination={pagination} onPageChange={setPage} />
        )}
      </div>

      <ConfirmDialog
        open={!!deleteTarget}
        danger
        loading={deleting}
        title="Delete database?"
        description={
          deleteTarget
            ? `“${deleteTarget.name}” and its encrypted credentials / validation plan will be permanently removed. This cannot be undone.`
            : ""
        }
        confirmLabel="Delete database"
        onCancel={() => !deleting && setDeleteTarget(null)}
        onConfirm={() => void confirmDelete()}
      />
    </AppShell>
  );
}
