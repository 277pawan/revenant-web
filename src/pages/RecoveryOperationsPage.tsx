import { Fragment, useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Activity, Database, RefreshCw, ShieldCheck } from "lucide-react";
import { AppShell } from "../components/AppShell";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { api } from "../lib/api";
import type { AwsSourceStatus, DatabaseResource, JobDetailResource } from "../types/api";

type DatabasePolicy = {
  enabled: boolean;
  lifetime: number;
  expireResources: boolean;
  cleanupCustomerSnapshots: boolean;
  saving: boolean;
};

function sourceLabel(status: AwsSourceStatus | undefined): string {
  if (!status) return "Not checked";
  if (status.state === "available") return "Source available";
  if (status.state === "missing") {
    return status.availableSnapshotCount
      ? `Source missing · ${status.availableSnapshotCount} snapshots available`
      : "Source missing · no available snapshots";
  }
  if (status.state === "unavailable") return `Source ${status.rdsStatus ?? "unavailable"}`;
  return status.message ?? "AWS status unknown";
}

function sourceClass(status: AwsSourceStatus | undefined): string {
  if (status?.state === "available") return "text-emerald-700";
  if (status?.state === "missing" || status?.state === "unavailable") return "text-amber-700";
  return "text-slate-500";
}

export function RecoveryOperationsPage() {
  const [databases, setDatabases] = useState<DatabaseResource[]>([]);
  const [sourceStatuses, setSourceStatuses] = useState<Record<string, AwsSourceStatus>>({});
  const [latestJobs, setLatestJobs] = useState<Record<string, JobDetailResource>>({});
  const [policies, setPolicies] = useState<Record<string, DatabasePolicy>>({});
  const [snapshotCleanupConfirmation, setSnapshotCleanupConfirmation] =
    useState<DatabaseResource | null>(null);
  const [search, setSearch] = useState("");
  const [expandedDatabaseId, setExpandedDatabaseId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async (silent = false) => {
    if (silent) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const all: DatabaseResource[] = [];
      let page = 1;
      let totalPages = 1;
      do {
        const response = await api.listDatabases(page, 100);
        all.push(...response.data);
        totalPages = response.pagination.totalPages;
        page += 1;
      } while (page <= totalPages);

      const awsDatabases = all.filter((database) => database.recoveryMode === "aws-rds");
      const [statuses, jobs] = await Promise.all([
        Promise.all(
          awsDatabases.map(async (database) => {
            try {
              const response = await api.getAwsSourceStatus(database.id);
              return [database.id, response.status] as const;
            } catch (statusError) {
              return [
                database.id,
                {
                  state: "unknown",
                  rdsStatus: null,
                  availableSnapshotCount: null,
                  latestSnapshotIdentifier: null,
                  latestSnapshotCreatedAt: null,
                  checkedAt: new Date().toISOString(),
                  message: statusError instanceof Error ? statusError.message : "AWS status check failed",
                } satisfies AwsSourceStatus,
              ] as const;
            }
          })
        ),
        api.listJobs(1, 100),
      ]);

      const byId = new Map<string, (typeof jobs.data)[number]>();
      for (const job of jobs.data) {
        if (!byId.has(job.databaseId)) byId.set(job.databaseId, job);
      }
      const latestDetails = await Promise.all(
        [...byId.values()].map(async (job) => {
          try {
            const response = await api.getJob(job.id);
            return [job.databaseId, response.job] as const;
          } catch (detailError) {
            console.warn(
              `[recovery-operations] could not load details for run=${job.id}:`,
              detailError instanceof Error ? detailError.message : detailError
            );
            return null;
          }
        })
      );
      setDatabases(awsDatabases);
      setSourceStatuses(Object.fromEntries(statuses));
      setLatestJobs(
        Object.fromEntries(latestDetails.filter((entry): entry is NonNullable<typeof entry> => entry !== null))
      );
      setPolicies(
        Object.fromEntries(
          awsDatabases.map((database) => [
            database.id,
            {
              enabled: database.recoveryDrillsEnabled,
              lifetime: database.recoveryMaxLifetimeMinutes ?? 60,
              expireResources: database.recoveryMaxLifetimeMinutes !== null,
              cleanupCustomerSnapshots: database.recoveryCleanupCustomerSnapshots,
              saving: false,
            },
          ])
        )
      );
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Could not load recovery operations.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function updatePolicy(databaseId: string, patch: Partial<DatabasePolicy>) {
    setPolicies((current) => ({
      ...current,
      [databaseId]: { ...current[databaseId], ...patch },
    }));
  }

  async function save(database: DatabaseResource) {
    const policy = policies[database.id];
    if (!policy) return;
    if (
      policy.cleanupCustomerSnapshots &&
      !database.recoveryCleanupCustomerSnapshots &&
      snapshotCleanupConfirmation?.id !== database.id
    ) {
      setSnapshotCleanupConfirmation(database);
      return;
    }
    await persistPolicy(database);
  }

  async function persistPolicy(database: DatabaseResource) {
    const policy = policies[database.id];
    if (!policy) return;
    updatePolicy(database.id, { saving: true });
    setError(null);
    setNotice(null);
    try {
      const { database: updated } = await api.updateDatabase(database.id, {
        recoveryDrillsEnabled: policy.enabled,
        recoveryMaxLifetimeMinutes: policy.expireResources ? policy.lifetime : null,
        recoveryCleanupCustomerSnapshots:
          policy.expireResources && policy.cleanupCustomerSnapshots,
      });
      setDatabases((current) => current.map((item) => item.id === updated.id ? updated : item));
      updatePolicy(database.id, {
        enabled: updated.recoveryDrillsEnabled,
        lifetime: updated.recoveryMaxLifetimeMinutes ?? 60,
        expireResources: updated.recoveryMaxLifetimeMinutes !== null,
        cleanupCustomerSnapshots: updated.recoveryCleanupCustomerSnapshots,
        saving: false,
      });
      setNotice(`Recovery policy saved for ${database.name}.`);
      setSnapshotCleanupConfirmation(null);
    } catch (saveError) {
      updatePolicy(database.id, { saving: false });
      setSnapshotCleanupConfirmation(null);
      setError(saveError instanceof Error ? saveError.message : "Could not save recovery policy.");
    }
  }

  const enabledCount = databases.filter((database) => policies[database.id]?.enabled).length;
  const filteredDatabases = databases.filter((database) =>
    `${database.name} ${database.rdsSourceIdentifier ?? ""} ${database.region ?? ""}`
      .toLowerCase()
      .includes(search.trim().toLowerCase())
  );

  return (
    <AppShell>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Recovery operations</h1>
          <p className="mt-1 max-w-3xl text-sm text-slate-600">
            Control which AWS databases may run restore-validation drills and how long temporary recovery instances may live.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void load(true)}
          disabled={refreshing}
          className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
        >
          <RefreshCw size={15} className={refreshing ? "animate-spin" : ""} />
          Refresh
        </button>
      </div>

      <div className="mb-5 grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">AWS databases</p>
          <p className="mt-1 text-2xl font-semibold text-slate-900">{databases.length}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Drills enabled</p>
          <p className="mt-1 text-2xl font-semibold text-slate-900">{enabledCount}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-slate-500">
            <ShieldCheck size={14} /> Cleanup protection
          </p>
          <p className="mt-1 text-sm font-semibold text-emerald-700">Per-database retention · owned resources only</p>
        </div>
      </div>

      {error && <div role="alert" className="mb-4 border-l-2 border-red-500 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</div>}
      {notice && <div role="status" className="mb-4 border-l-2 border-emerald-500 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{notice}</div>}

      {loading ? (
        <div className="rounded-xl border border-slate-200 bg-white px-4 py-12 text-center text-sm text-slate-500">
          Loading AWS recovery configuration…
        </div>
      ) : databases.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white px-4 py-12 text-center">
          <Database size={28} className="mx-auto mb-3 text-slate-300" />
          <p className="font-medium text-slate-800">No AWS RDS databases configured</p>
          <p className="mt-1 text-sm text-slate-500">AWS restore validation policies appear here after an AWS database is added.</p>
          <Link to="/databases" className="mt-3 inline-flex text-sm font-medium text-brand hover:underline">View databases</Link>
        </div>
      ) : (
        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 p-3">
            <label className="relative block">
              <span className="sr-only">Search AWS databases</span>
              <input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search by database, source identifier, or region"
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400"
              />
            </label>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3">Database</th>
                  <th className="px-4 py-3">AWS source status</th>
                  <th className="px-4 py-3">Drills</th>
                  <th className="px-4 py-3">Resource retention</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
          {filteredDatabases.map((database) => {
            const policy = policies[database.id];
            const status = sourceStatuses[database.id];
            const lastJob = latestJobs[database.id];
            const cleanupResults = lastJob?.results.filter((result) => result.checkType === "cleanup") ?? [];
            const dirty = policy &&
              (policy.enabled !== database.recoveryDrillsEnabled ||
                policy.expireResources !== (database.recoveryMaxLifetimeMinutes !== null) ||
                (policy.expireResources &&
                  policy.lifetime !== (database.recoveryMaxLifetimeMinutes ?? 60)) ||
                policy.cleanupCustomerSnapshots !== database.recoveryCleanupCustomerSnapshots);
            return (
              <Fragment key={database.id}>
                <tr key={`${database.id}-row`} className="hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      aria-expanded={expandedDatabaseId === database.id}
                      onClick={() => setExpandedDatabaseId((current) => current === database.id ? null : database.id)}
                      className="text-left"
                    >
                      <span className="block font-medium text-slate-900">{database.name}</span>
                      <span className="mt-0.5 block text-xs text-slate-500">
                        {database.rdsSourceIdentifier ?? "Source identifier not set"} · {database.region ?? "Region not set"}
                      </span>
                    </button>
                  </td>
                  <td className={`px-4 py-3 ${sourceClass(status)}`} title={status?.message ?? undefined}>
                    {status ? sourceLabel(status) : "Checking…"}
                  </td>
                  <td className="px-4 py-3">{policy?.enabled ? "Enabled" : "Disabled"}</td>
                  <td className="px-4 py-3">
                    {policy?.expireResources ? `${policy.lifetime} minutes` : "Indefinite"}
                  </td>
                </tr>
                {expandedDatabaseId === database.id && (
                  <tr key={`${database.id}-settings`}>
                    <td colSpan={4} className="bg-slate-50 px-4 py-4">
                      <div className="grid gap-5 lg:grid-cols-[1fr_auto]">
                        <div className="space-y-3">
                          {lastJob && (
                            <div className="space-y-1 text-xs text-slate-600">
                              <p className="flex items-center gap-1.5">
                                <Activity size={13} />
                                Latest drill: {lastJob.status} · {new Date(lastJob.createdAt).toLocaleString()}
                              </p>
                              {cleanupResults.length > 0 ? cleanupResults.map((result) => (
                                <p key={result.id} className={result.status === "fail" ? "text-red-700" : result.status === "pass" ? "text-emerald-700" : ""}>
                                  {result.message ?? `${result.checkName}: ${result.status}`}
                                </p>
                              )) : (
                                <p>{lastJob.status === "running" ? "Recovery run active; cleanup will follow the configured retention." : "No cleanup result recorded for this run."}</p>
                              )}
                            </div>
                          )}
                          {status?.state === "missing" && (
                            <p className="text-xs text-amber-800">
                              Full drills are blocked while the source is missing. Existing snapshots can still be verified from Recovery Points.
                            </p>
                          )}
                          <p className="text-xs text-slate-500">
                            Automatic deletion is off by default. While it is off, reconciliation keeps existing tagged resources too; if re-enabled, their original expiry dates apply. The source database and AWS automated snapshots are never deleted.
                          </p>
                        </div>

                        <div className="grid min-w-72 gap-3 sm:grid-cols-[auto_auto] sm:items-end">
                          <label className="flex items-center gap-2 text-sm text-slate-700">
                            <input
                              type="checkbox"
                              checked={policy?.enabled ?? false}
                              onChange={(event) => updatePolicy(database.id, { enabled: event.target.checked })}
                              className="size-4 rounded border-slate-300 text-brand focus:ring-brand"
                            />
                            Allow drills
                          </label>
                          <div className="space-y-2">
                            <label className="flex items-start gap-2 text-sm text-slate-700">
                              <input
                                type="checkbox"
                                checked={policy?.expireResources ?? false}
                                onChange={(event) => updatePolicy(database.id, {
                                  expireResources: event.target.checked,
                                  cleanupCustomerSnapshots: event.target.checked && (policy?.cleanupCustomerSnapshots ?? false),
                                })}
                                className="mt-0.5 size-4 rounded border-slate-300 text-brand focus:ring-brand"
                              />
                              Automatically delete Revenant-created restores and full-drill snapshots
                            </label>
                            {policy?.expireResources && (
                              <>
                                <label className="block text-xs font-medium text-slate-600">
                                  Retain for (minutes)
                                  <input
                                    type="number"
                                    min={10}
                                    max={2147483647}
                                    value={policy.lifetime}
                                    onChange={(event) => updatePolicy(database.id, { lifetime: Number(event.target.value) })}
                                    className="mt-1 block w-36 rounded-md border border-slate-300 px-2 py-1.5 text-sm text-slate-900"
                                  />
                                </label>
                                <label className="flex items-start gap-2 text-sm text-amber-900">
                                  <input
                                    type="checkbox"
                                    checked={policy.cleanupCustomerSnapshots}
                                    onChange={(event) => updatePolicy(database.id, { cleanupCustomerSnapshots: event.target.checked })}
                                    className="mt-0.5 size-4 rounded border-amber-400 text-amber-700 focus:ring-amber-600"
                                  />
                                  Also delete non-Revenant manual snapshots for this source
                                </label>
                                {policy.cleanupCustomerSnapshots && (
                                  <p className="max-w-lg text-xs text-amber-800">
                                    This allows deletion of existing customer-created manual snapshots once they exceed this retention. Deletion only runs when an external scheduler calls the API&apos;s authenticated <code>/api/v1/internal/recovery/reconcile</code> endpoint; configure Cloud Scheduler (or equivalent) to call it every five minutes. Without that schedule, snapshots will not be deleted. AWS automated snapshots and the source database are excluded.
                                  </p>
                                )}
                              </>
                            )}
                          </div>
                          <button
                            type="button"
                            onClick={() => void save(database)}
                            disabled={!dirty || policy?.saving || (policy?.expireResources && (!Number.isInteger(policy?.lifetime) || policy.lifetime < 10 || policy.lifetime > 2147483647))}
                            className="rounded-md bg-brand px-3 py-2 text-sm font-medium text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {policy?.saving ? "Saving…" : "Save settings"}
                          </button>
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}
              {filteredDatabases.length === 0 && (
                <tr><td colSpan={4} className="px-4 py-10 text-center text-sm text-slate-500">No AWS databases match your search.</td></tr>
              )}
              </tbody>
            </table>
          </div>
        </section>
      )}
      <ConfirmDialog
        open={snapshotCleanupConfirmation !== null}
        title="Enable deletion of customer snapshots?"
        description={
          snapshotCleanupConfirmation
            ? `This will allow Revenant to delete non-Revenant manual RDS snapshots for source "${snapshotCleanupConfirmation.rdsSourceIdentifier}" that are older than the selected ${policies[snapshotCleanupConfirmation.id]?.lifetime ?? 60}-minute retention. Deletion only runs when an external scheduler calls the API's authenticated /api/v1/internal/recovery/reconcile endpoint; configure Cloud Scheduler or equivalent to call it every five minutes. Without that schedule, snapshots will not be deleted. The source database and AWS automated snapshots will not be deleted.`
            : ""
        }
        confirmLabel="Enable snapshot deletion"
        cancelLabel="Keep snapshots"
        danger
        loading={
          snapshotCleanupConfirmation
            ? policies[snapshotCleanupConfirmation.id]?.saving
            : false
        }
        onConfirm={() => {
          if (snapshotCleanupConfirmation) {
            void persistPolicy(snapshotCleanupConfirmation);
          }
        }}
        onCancel={() => {
          if (!snapshotCleanupConfirmation) return;
          updatePolicy(snapshotCleanupConfirmation.id, {
            cleanupCustomerSnapshots:
              snapshotCleanupConfirmation.recoveryCleanupCustomerSnapshots,
          });
          setSnapshotCleanupConfirmation(null);
        }}
      />
    </AppShell>
  );
}
