import { useCallback, useEffect, useState } from "react";
import { ArrowRight, Database, Globe, Layers } from "lucide-react";
import { Link } from "react-router-dom";
import { api } from "../../lib/api";
import type { RecoveryContractResource, RecoveryReadinessResource } from "../../types/api";

type NodeStatus = "pass" | "warn" | "fail" | "unknown" | "planned";

function statusStyles(status: NodeStatus) {
  switch (status) {
    case "pass":
      return "border-emerald-200 bg-emerald-50 text-emerald-900";
    case "warn":
      return "border-amber-200 bg-amber-50 text-amber-900";
    case "fail":
      return "border-red-200 bg-red-50 text-red-900";
    case "planned":
      return "border-slate-200 bg-slate-50 text-slate-500";
    default:
      return "border-slate-200 bg-white text-slate-700";
  }
}

export function DependencyGraphPanel({
  databaseId,
  databaseName,
  readiness,
}: {
  databaseId: string;
  databaseName: string;
  readiness: RecoveryReadinessResource | null;
}) {
  const [contract, setContract] = useState<RecoveryContractResource | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { contract: data } = await api.getRecoveryContract(databaseId);
      setContract(data);
    } catch {
      setContract(null);
    } finally {
      setLoading(false);
    }
  }, [databaseId]);

  useEffect(() => {
    void load();
  }, [load]);

  const deps = contract?.definition.recovery.dependencies ?? [];
  const endpoints = contract?.definition.recovery.application?.endpoints ?? [];
  const healthcheck = contract?.definition.recovery.application?.healthcheck;
  const depDim = readiness?.readiness.dimensions.find((d) => d.id === "dependencies");
  const appDim = readiness?.readiness.dimensions.find((d) => d.id === "application_health");

  const depNodeStatus: NodeStatus =
    deps.length === 0
      ? "unknown"
      : depDim?.status === "pass"
        ? "pass"
        : depDim?.status === "fail"
          ? "fail"
          : depDim?.status === "warn"
            ? "warn"
            : "unknown";

  const appNodeStatus: NodeStatus = !healthcheck && endpoints.length === 0
    ? "unknown"
    : appDim?.status === "pass"
      ? "pass"
      : appDim?.status === "fail"
        ? "fail"
        : appDim?.status === "warn"
          ? "warn"
          : "unknown";

  const dbStatus: NodeStatus =
    readiness?.readiness.status === "recovery_ready"
      ? "pass"
      : readiness?.readiness.status === "not_ready"
        ? "fail"
        : readiness?.readiness.status === "at_risk"
          ? "warn"
          : "unknown";

  if (loading) {
    return (
      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm text-sm text-slate-500">
        Loading dependency map…
      </section>
    );
  }

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            Recovery dependency map
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            What must come back with your database for a real recovery. HTTP deps are checked on
            each drill; Redis/S3 pings are on the roadmap.
          </p>
        </div>
        <Link
          to={`/workflows/${databaseId}?tab=contract#recovery-contract`}
          className="shrink-0 text-xs font-medium text-brand hover:underline"
        >
          Edit contract →
        </Link>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-center gap-2 py-2">
        <div
          className={`flex min-w-[120px] flex-col items-center rounded-lg border px-3 py-2 text-center ${statusStyles(dbStatus)}`}
        >
          <Database size={18} className="mb-1 opacity-70" />
          <span className="text-xs font-semibold">{databaseName}</span>
          <span className="text-[10px] opacity-80">Primary DB</span>
        </div>

        {(deps.length > 0 || endpoints.length > 0 || healthcheck) && (
          <ArrowRight size={16} className="text-slate-400" />
        )}

        {deps.length > 0 && (
          <>
            <div
              className={`flex min-w-[120px] flex-col items-center rounded-lg border px-3 py-2 text-center ${statusStyles(depNodeStatus)}`}
            >
              <Layers size={18} className="mb-1 opacity-70" />
              <span className="text-xs font-semibold">Dependencies</span>
              <span className="text-[10px] opacity-80">{deps.join(", ")}</span>
            </div>
            {(endpoints.length > 0 || healthcheck) && (
              <ArrowRight size={16} className="text-slate-400" />
            )}
          </>
        )}

        {(healthcheck || endpoints.length > 0) && (
          <div
            className={`flex min-w-[120px] flex-col items-center rounded-lg border px-3 py-2 text-center ${statusStyles(appNodeStatus)}`}
          >
            <Globe size={18} className="mb-1 opacity-70" />
            <span className="text-xs font-semibold">Application</span>
            <span className="truncate text-[10px] opacity-80 max-w-[140px]">
              {healthcheck ?? `${endpoints.length} endpoint(s)`}
            </span>
          </div>
        )}
      </div>

      {deps.length === 0 && !healthcheck && endpoints.length === 0 && (
        <p className="mt-2 text-center text-xs text-slate-500">
          Add dependencies or API endpoints in your recovery contract to map the full stack.
        </p>
      )}

      {deps.some((d) => /redis|s3/i.test(d)) && (
        <p className="mt-3 rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 text-xs text-slate-600">
          Redis and object storage are listed in your contract; native ping checks ship in a later
          release. Use HTTP health endpoints where possible today.
        </p>
      )}
    </section>
  );
}
