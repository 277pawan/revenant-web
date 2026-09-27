import { Link } from "react-router-dom";
import {
  Bell,
  Calendar,
  FileCode2,
  FileText,
  Play,
  Share2,
} from "lucide-react";
import { ShareProofButton } from "../evidence/ShareProofButton";
import { StatusBadge } from "./StatusBadge";
import { formatRelativeTime } from "../../lib/workflow";
import type { JobResource, RecoveryReadinessResource, PlanServiceResource } from "../../types/api";

type WorkflowCommandCenterProps = {
  service: PlanServiceResource;
  readiness: RecoveryReadinessResource | null;
  lastJob: JobResource | null | undefined;
  canRun: boolean;
  canDownload: boolean;
  running: boolean;
  awsMode: boolean;
  onRunDrill: (kind: "full" | "verify") => void;
};

export function WorkflowCommandCenter({
  service,
  readiness,
  lastJob,
  canRun,
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
                {awsMode && (
                  <button
                    type="button"
                    disabled={running}
                    onClick={() => onRunDrill("verify")}
                    title="Restore the latest existing AWS snapshot into a sandbox and run checks — does not create a new snapshot"
                    className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                  >
                    Verify snapshot
                  </button>
                )}
                <button
                  type="button"
                  disabled={running}
                  onClick={() => onRunDrill("full")}
                  title={
                    awsMode
                      ? "Check live RDS → create new snapshot → restore sandbox → validate → cleanup"
                      : "Run validation checks against the live database"
                  }
                  className="inline-flex items-center gap-2 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  <Play size={16} />
                  {running ? "Queuing…" : "Run restore drill"}
                </button>
              </div>
              {awsMode && (
                <p className="max-w-md text-right text-[11px] leading-snug text-slate-500">
                  <strong className="font-medium text-slate-600">Verify snapshot</strong> uses your
                  latest AWS backup.{" "}
                  <strong className="font-medium text-slate-600">Full drill</strong> checks live RDS
                  first — if checks fail, no snapshot is created.
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

      {canDownload && lastJob && ["pass", "fail", "error"].includes(lastJob.status) && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 bg-emerald-50/40 px-5 py-3">
          <p className="text-sm text-slate-700">
            <Share2 size={14} className="mr-1 inline text-emerald-700" />
            Share proof with your manager or auditor
          </p>
          <ShareProofButton
            job={lastJob}
            workflowName={service.databaseName}
            variant="primary"
          />
        </div>
      )}
    </section>
  );
}
