import { Link } from "react-router-dom";
import {
  Bell,
  Calendar,
  FileCode2,
  FileText,
  Play,
} from "lucide-react";
import { StatusBadge } from "./StatusBadge";
import { formatRelativeTime } from "../../lib/workflow";
import type { JobResource, RecoveryReadinessResource, PlanServiceResource } from "../../types/api";

type WorkflowCommandCenterProps = {
  service: PlanServiceResource;
  readiness: RecoveryReadinessResource | null;
  lastJob: JobResource | null | undefined;
  canRun: boolean;
  canRunFull: boolean;
  sourceStatusMessage?: string | null;
  canDownload: boolean;
  running: boolean;
  awsMode: boolean;
  onRunDrill: () => void;
};

export function WorkflowCommandCenter({
  service,
  readiness,
  lastJob,
  canRun,
  canRunFull,
  sourceStatusMessage,
  canDownload,
  running,
  awsMode,
  onRunDrill,
}: WorkflowCommandCenterProps) {
  const httpConfigured =
    readiness?.readiness.dimensions.some(
      (d) => d.id === "application_health" && d.status !== "not_configured"
    ) ?? false;

  return (
    <section className="mb-6 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-100 bg-slate-50 px-5 py-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Command center
            </p>
            <div className="mt-1 flex flex-wrap items-center gap-3">
              <h2 className="text-lg font-semibold text-slate-900">{service.databaseName}</h2>
              {lastJob && <StatusBadge status={lastJob.status} />}
            </div>
            <p className="mt-1 text-sm text-slate-600">
              {lastJob
                ? `Last drill ${formatRelativeTime(lastJob.createdAt)}`
                : "No drills yet — run your first restore proof below"}
              {readiness != null && (
                <>
                  {" "}
                  · Readiness{" "}
                  <span className="font-medium text-slate-800">{readiness.readiness.score}%</span>
                </>
              )}
              {httpConfigured && (
                <span className="ml-1 text-emerald-700">· API health enabled</span>
              )}
            </p>
          </div>
          {canRun && (
            <div className="flex flex-col items-end gap-1.5">
              <div className="flex flex-wrap justify-end gap-2">
                <button
                  type="button"
                  disabled={running || !canRunFull}
                  onClick={onRunDrill}
                  title={
                    !canRunFull
                      ? sourceStatusMessage ?? "A full drill requires an available AWS source RDS instance."
                      : awsMode
                      ? "Check live RDS → create a new manual snapshot (retained in AWS) → restore a temporary RDS database → validate → request cleanup. AWS may take an hour or more."
                      : "Run validation checks against the live database"
                  }
                  className="inline-flex items-center gap-2 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  <Play size={16} />
                  {running ? "Queuing…" : "Run restore drill"}
                </button>
              </div>
              {awsMode && !canRunFull && (
                <p role="status" className="max-w-md text-right text-xs text-amber-800">
                  {sourceStatusMessage ?? "Checking AWS source status…"}{" "}
                  <Link
                    to={`/workflows/${service.databaseId}?tab=recovery-points`}
                    className="font-medium underline"
                  >
                    Open Recovery Points
                  </Link>
                </p>
              )}
              {awsMode && (
                <p className="max-w-md text-right text-[11px] leading-snug text-slate-500">
                  <strong className="font-medium text-slate-600">Verify snapshot</strong> is
                  available on each recovery-point card and restores that specific snapshot to a
                  temporary RDS database for validation.{" "}
                  <strong className="font-medium text-slate-600">Full drill</strong> checks live RDS
                  first — if checks fail, no snapshot is created. A full drill creates a new AWS
                  snapshot that remains after the temporary database is deleted.
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="grid gap-px bg-slate-200 sm:grid-cols-2 lg:grid-cols-4">
        {[
          {
            label: "Validation plan",
            hint: service.planName,
            icon: FileCode2,
            to: `/settings/validation-plans?databaseId=${service.databaseId}`,
          },
          {
            label: "Schedule",
            hint: "Automate weekly drills",
            icon: Calendar,
            to: "/schedules",
          },
          {
            label: "Alerts",
            hint: "Slack & email",
            icon: Bell,
            to: "/settings/webhooks",
          },
          {
            label: "Evidence",
            hint: lastJob ? "Latest run" : "After first drill",
            icon: FileText,
            to: lastJob
              ? `/workflows/${service.databaseId}/runs/${lastJob.id}`
              : "/evidence",
          },
        ].map((action) => (
          <Link
            key={action.label}
            to={action.to}
            className="flex items-start gap-3 bg-white px-4 py-4 transition-colors hover:bg-slate-50"
          >
            <action.icon size={18} className="mt-0.5 shrink-0 text-brand" />
            <div>
              <div className="text-sm font-semibold text-slate-900">{action.label}</div>
              <div className="text-xs text-slate-500">{action.hint}</div>
            </div>
          </Link>
        ))}
      </div>

    </section>
  );
}
