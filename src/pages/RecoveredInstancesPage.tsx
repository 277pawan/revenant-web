import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowUpRight, Database, RefreshCw, Server } from "lucide-react";
import { AppShell } from "../components/AppShell";
import { api } from "../lib/api";
import type { DatabaseResource, RecoveryInstanceResource, RecoveryPointResource } from "../types/api";

type RetainedInstance = {
  database: DatabaseResource;
  point: RecoveryPointResource;
  instance: RecoveryInstanceResource;
};

function statusClass(status: string): string {
  if (status === "available") return "bg-emerald-100 text-emerald-800";
  if (status === "failed" || status === "cleanup_failed") return "bg-red-100 text-red-800";
  if (["deleted", "deleting"].includes(status)) return "bg-slate-100 text-slate-600";
  return "bg-cyan-100 text-cyan-800";
}

export function RecoveredInstancesPage() {
  const [instances, setInstances] = useState<RetainedInstance[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (silent = false) => {
    if (silent) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const databases: DatabaseResource[] = [];
      let page = 1;
      let totalPages = 1;
      do {
        const response = await api.listDatabases(page, 100);
        databases.push(...response.data);
        totalPages = response.pagination.totalPages;
        page += 1;
      } while (page <= totalPages);

      const awsDatabases = databases.filter(
        (database) => database.recoveryMode === "aws-rds" && database.hasAwsCredentials
      );
      const recovered = await Promise.all(
        awsDatabases.map(async (database) => {
          const { recoveryPoints } = await api.listRecoveryPoints(database.id, true);
          return Promise.all(
            recoveryPoints.map(async (point) => {
              const { instances: pointInstances } = await api.listRecoveryInstances(point.id);
              return pointInstances
                .filter((instance) => !instance.temporary)
                .map((instance) => ({ database, point, instance }));
            })
          );
        })
      );
      setInstances(recovered.flat(2).sort(
        (a, b) => Date.parse(b.instance.createdAt) - Date.parse(a.instance.createdAt)
      ));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load retained instances.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const activeCount = instances.filter(
    ({ instance }) => !["available", "failed", "deleted"].includes(instance.status)
  ).length;

  return (
    <AppShell>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Recovered instances</h1>
          <p className="mt-1 text-sm text-slate-600">
            Retained RDS restores across your AWS workflows. These instances remain in your AWS account and may incur charges.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void load(true)}
          disabled={refreshing}
          className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
        >
          <RefreshCw size={15} className={refreshing ? "animate-spin" : ""} />
          Refresh status
        </button>
      </div>

      {activeCount > 0 && (
        <div className="mb-4 flex items-center gap-2 border-l-2 border-cyan-500 bg-cyan-50 px-3 py-2 text-sm text-cyan-900">
          <RefreshCw size={15} className="animate-spin" />
          {activeCount} restore{activeCount === 1 ? " is" : "s are"} still provisioning. Status refreshes when you refresh this page.
        </div>
      )}
      {error && <div role="alert" className="mb-4 border-l-2 border-red-500 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</div>}

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">Restore history</h2>
            <p className="mt-0.5 text-xs text-slate-500">{instances.length} retained instance{instances.length === 1 ? "" : "s"}</p>
          </div>
          <Server size={17} className="text-slate-400" />
        </div>
        {loading ? (
          <p className="px-4 py-12 text-center text-sm text-slate-500">Loading recovery history…</p>
        ) : instances.length === 0 ? (
          <div className="px-4 py-14 text-center">
            <Database size={28} className="mx-auto mb-3 text-slate-300" />
            <p className="font-medium text-slate-800">No retained restores yet</p>
            <p className="mt-1 text-sm text-slate-500">Instances created with “Recover from this” will appear here.</p>
            <Link to="/workflows" className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-brand hover:underline">
              View restore drills <ArrowUpRight size={14} />
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 text-left text-xs font-medium uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3">Instance</th>
                  <th className="px-4 py-3">Workflow</th>
                  <th className="px-4 py-3">Source snapshot</th>
                  <th className="px-4 py-3">Region / class</th>
                  <th className="px-4 py-3">Created</th>
                  <th className="px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {instances.map(({ database, point, instance }) => (
                  <tr key={instance.id} className="align-top hover:bg-slate-50/70">
                    <td className="px-4 py-3">
                      <p className="font-mono text-xs font-medium text-slate-900">{instance.awsDbInstanceIdentifier}</p>
                      {instance.endpoint && <p className="mt-1 max-w-xs truncate font-mono text-[11px] text-slate-500">{instance.endpoint}{instance.port ? `:${instance.port}` : ""}</p>}
                    </td>
                    <td className="px-4 py-3">
                      <Link to={`/workflows/${database.id}`} className="font-medium text-brand hover:underline">{database.name}</Link>
                    </td>
                    <td className="max-w-[240px] px-4 py-3 font-mono text-xs text-slate-600">{point.snapshotIdentifier}</td>
                    <td className="px-4 py-3 text-xs text-slate-600">{instance.region ?? database.region ?? "—"}<br />{instance.instanceClass ?? "—"}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-600">{new Date(instance.createdAt).toLocaleString()}</td>
                    <td className="px-4 py-3"><span className={`inline-flex rounded-full px-2 py-1 text-[11px] font-medium ${statusClass(instance.status)}`}>{instance.status}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </AppShell>
  );
}
