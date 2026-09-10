import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Database, FileCode2, Lock, Pencil, Play, Plus, Search, Trash2 } from "lucide-react";
import { AppShell } from "../components/AppShell";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { PaginationBar } from "../components/PaginationBar";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import {
  roleHasPermission,
  type DatabaseResource,
  type PaginationMeta,
} from "../types/api";

const emptyPagination: PaginationMeta = {
  page: 1,
  pageSize: 20,
  total: 0,
  totalPages: 1,
};

export function DatabasesPage() {
  const { user } = useAuth();
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
      setDeleteTarget(null);
      await load(page);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete");
    } finally {
      setDeleting(false);
    }
  }

  async function runValidation(db: DatabaseResource) {
    if (!canRun) return;
    setRunningId(db.id);
    setError(null);
    try {
      const { job } = await api.createJob({ databaseId: db.id });
      navigate(`/jobs/${job.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start job");
    } finally {
      setRunningId(null);
    }
  }

  return (
    <AppShell>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Databases</h1>
          <p className="mt-1 text-sm text-slate-600">
            Fleet connection registry. Passwords are AES-encrypted and never returned to the browser.
          </p>
        </div>
        {canWrite && (
          <Link
            to="/databases/new"
            className="inline-flex items-center gap-2 rounded-md bg-brand px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700"
          >
            <Plus size={16} />
            Add database
          </Link>
        )}
      </div>

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
              <Link
                to="/databases/new"
                className="mt-6 inline-flex items-center gap-2 rounded-md bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
              >
                <Plus size={16} />
                Add your first database
              </Link>
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
                  <th className="px-4 py-3 font-medium">Host</th>
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
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-700">
                      {db.host ? `${db.host}:${db.port ?? 5432}` : "—"}
                    </td>
                    <td className="px-4 py-3 text-slate-600">{db.region ?? "—"}</td>
                    <td className="px-4 py-3">
                      {db.hasCredentials ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-800">
                          <Lock size={12} />
                          Encrypted
                        </span>
                      ) : (
                        <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-800">
                          Missing
                        </span>
                      )}
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
                            disabled={runningId === db.id}
                            onClick={() => void runValidation(db)}
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
