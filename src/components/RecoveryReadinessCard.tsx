import { AlertTriangle, CheckCircle2, ChevronRight, Shield } from "lucide-react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import type { RecoveryReadinessResource, ReadinessDimension } from "../types/api";

function statusLabel(status: RecoveryReadinessResource["readiness"]["status"]) {
  switch (status) {
    case "recovery_ready":
      return { text: "Recovery ready", className: "text-emerald-700 bg-emerald-50 ring-emerald-200" };
    case "at_risk":
      return { text: "Needs attention", className: "text-amber-800 bg-amber-50 ring-amber-200" };
    case "not_ready":
      return { text: "Not recovery ready", className: "text-red-800 bg-red-50 ring-red-200" };
    default:
      return { text: "Not verified", className: "text-slate-600 bg-slate-100 ring-slate-200" };
  }
}

function formatSeconds(seconds: number | null): string {
  if (seconds == null) return "—";
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return s > 0 ? `${m}m ${s}s` : `${m}m`;
}

function dimIcon(status: ReadinessDimension["status"]) {
  if (status === "pass") {
    return <CheckCircle2 size={14} className="shrink-0 text-emerald-600" />;
  }
  if (status === "fail") {
    return <AlertTriangle size={14} className="shrink-0 text-red-600" />;
  }
  if (status === "not_configured") {
    return <span className="mt-0.5 h-3.5 w-3.5 shrink-0 rounded-full border border-slate-300" />;
  }
  return <AlertTriangle size={14} className="shrink-0 text-amber-500" />;
}

function dimensionAction(
  dim: ReadinessDimension,
  databaseId: string
): { label: string; to: string } | null {
  if (dim.status === "pass" || dim.status === "not_configured") return null;
  switch (dim.id) {
    case "recovery_procedure":
      return { label: "Add schedule", to: "/schedules" };
    case "rpo":
      return {
        label: "Edit validation plan",
        to: `/settings/validation-plans?databaseId=${databaseId}`,
      };
    case "application_health":
      return { label: "Edit contract", to: `/workflows/${databaseId}#recovery-contract` };
    case "dependencies":
      return { label: "Edit contract", to: `/workflows/${databaseId}#recovery-contract` };
    default:
      return null;
  }
}

export function RecoveryReadinessCard({
  data,
  executionHistoryId = "workflow-execution-history",
  compact = false,
}: {
  data: RecoveryReadinessResource;
  executionHistoryId?: string;
  compact?: boolean;
}) {
  const navigate = useNavigate();
  const location = useLocation();
  const workflowPath = `/workflows/${data.databaseId}`;
  const onThisWorkflow = location.pathname === workflowPath;
  const badge = statusLabel(data.readiness.status);
  const topRisks = data.readiness.risks.slice(0, 2);

  function openWorkflow() {
    if (onThisWorkflow) {
      document.getElementById(executionHistoryId)?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
      return;
    }
    navigate(workflowPath);
  }

  return (
    <section
      className={`border border-slate-200 bg-white shadow-sm ${
        compact ? "rounded-lg" : "mb-6 rounded-xl"
      }`}
    >
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-4 py-3">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-slate-100 text-slate-600">
            <Shield size={16} />
          </div>
          <div className="min-w-0">
            <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
              Recovery readiness
            </div>
            <h2 className="truncate text-base font-semibold text-slate-900">{data.databaseName}</h2>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <div className="text-2xl font-bold tabular-nums leading-none text-slate-900">
              {data.readiness.score}
              <span className="text-sm font-medium text-slate-400">/100</span>
            </div>
          </div>
          <span
            className={`rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${badge.className}`}
          >
            {badge.text}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-3 divide-x divide-slate-100 border-b border-slate-100 text-sm">
        <div className="px-4 py-2.5">
          <div className="text-[10px] font-medium uppercase tracking-wide text-slate-500">RTO</div>
          <div className="font-mono font-medium text-slate-900">
            {formatSeconds(data.readiness.rtoActualSeconds)}
            {data.readiness.rtoTargetSeconds != null && (
              <span className="text-slate-400">
                {" "}
                / {formatSeconds(data.readiness.rtoTargetSeconds)}
              </span>
            )}
          </div>
        </div>
        <div className="px-4 py-2.5">
          <div className="text-[10px] font-medium uppercase tracking-wide text-slate-500">RPO</div>
          <div className="font-mono font-medium text-slate-900">
            {formatSeconds(data.readiness.rpoObservedSeconds)}
            {data.readiness.rpoTargetSeconds != null && (
              <span className="text-slate-400">
                {" "}
                / {formatSeconds(data.readiness.rpoTargetSeconds)}
              </span>
            )}
          </div>
        </div>
        <div className="px-4 py-2.5">
          <div className="text-[10px] font-medium uppercase tracking-wide text-slate-500">
            Last verified
          </div>
          <div className="font-medium text-slate-900">
            {data.readiness.lastVerifiedAt
              ? new Date(data.readiness.lastVerifiedAt).toLocaleString(undefined, {
                  month: "short",
                  day: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })
              : "Never"}
          </div>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <tbody className="divide-y divide-slate-100">
            {data.readiness.dimensions.map((dim) => {
              const action = dimensionAction(dim, data.databaseId);
              return (
                <tr key={dim.id} className="hover:bg-slate-50/80">
                  <td className="w-8 px-3 py-2">{dimIcon(dim.status)}</td>
                  <td className="whitespace-nowrap px-1 py-2 font-medium text-slate-800">
                    {dim.label}
                  </td>
                  <td className="px-2 py-2 text-slate-500">{dim.detail ?? "—"}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-right">
                    {action ? (
                      <Link
                        to={action.to}
                        className="text-xs font-medium text-brand hover:underline"
                      >
                        {action.label} →
                      </Link>
                    ) : null}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {topRisks.length > 0 && (
        <div className="border-t border-amber-100 bg-amber-50/60 px-4 py-2.5">
          <div className="text-[10px] font-semibold uppercase tracking-wide text-amber-800">
            Recovery risk
          </div>
          <ul className="mt-1 space-y-0.5 text-xs text-amber-900">
            {topRisks.map((risk) => (
              <li key={risk.message}>• {risk.message}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex items-center justify-between border-t border-slate-100 px-4 py-2">
        <span className="text-xs text-slate-500">
          Score from applicable checks on last drill — advisory gaps listed below
        </span>
        <button
          type="button"
          onClick={openWorkflow}
          className="inline-flex items-center gap-0.5 text-xs font-medium text-brand hover:underline"
        >
          {onThisWorkflow ? "Execution history" : "Open workflow"}
          <ChevronRight size={14} />
        </button>
      </div>
    </section>
  );
}
