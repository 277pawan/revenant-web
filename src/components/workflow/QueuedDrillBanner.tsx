import { Link } from "react-router-dom";
import { AlertTriangle, Loader2, XCircle } from "lucide-react";
import { runShortId } from "../../lib/workflow";
import type { JobResource } from "../../types/api";

export function QueuedDrillBanner({
  activeJobs,
  currentDatabaseId,
  canCancel,
  cancellingId,
  onCancel,
}: {
  activeJobs: JobResource[];
  currentDatabaseId: string;
  canCancel: boolean;
  cancellingId: string | null;
  onCancel: (jobId: string) => void;
}) {
  if (activeJobs.length === 0) return null;

  const onThisWorkflow = activeJobs.filter((j) => j.databaseId === currentDatabaseId);
  const elsewhere = activeJobs.filter((j) => j.databaseId !== currentDatabaseId);

  return (
    <div className="mb-4 space-y-2">
      {onThisWorkflow.map((job) => (
        <div
          key={job.id}
          className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950"
        >
          <div className="flex items-start gap-2">
            {job.status === "pending" ? (
              <Loader2 size={16} className="mt-0.5 shrink-0 animate-spin" />
            ) : (
              <AlertTriangle size={16} className="mt-0.5 shrink-0" />
            )}
            <div>
              <p className="font-medium">
                {job.status === "pending" ? "Drill queued" : "Drill running"} —{" "}
                {runShortId(job.id)}
              </p>
              <p className="text-xs text-amber-900/80">
                Starter allows one drill at a time. Failed drills do not block — this one is still{" "}
                {job.status}. If your agent is offline, start it under Settings → Runners or cancel
                the queue.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              to={`/workflows/${job.databaseId}/runs/${job.id}`}
              className="rounded-md border border-amber-300 bg-white px-3 py-1.5 text-xs font-medium hover:bg-amber-100"
            >
              View run
            </Link>
            {canCancel && (
              <button
                type="button"
                disabled={cancellingId === job.id}
                onClick={() => onCancel(job.id)}
                className="inline-flex items-center gap-1 rounded-md border border-amber-400 bg-amber-100 px-3 py-1.5 text-xs font-medium hover:bg-amber-200 disabled:opacity-50"
              >
                <XCircle size={14} />
                {cancellingId === job.id ? "Cancelling…" : "Cancel queue"}
              </button>
            )}
          </div>
        </div>
      ))}

      {elsewhere.map((job) => (
        <div
          key={job.id}
          className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700"
        >
          Another workflow has an active drill ({job.databaseName}, {job.status}). Finish or cancel
          it before starting here.{" "}
          <Link
            to={`/workflows/${job.databaseId}/runs/${job.id}`}
            className="font-medium text-brand hover:underline"
          >
            Open {runShortId(job.id)} →
          </Link>
        </div>
      ))}
    </div>
  );
}
