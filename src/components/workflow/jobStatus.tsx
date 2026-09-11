import {
  CheckCircle2,
  Circle,
  Loader2,
  XCircle,
  Clock,
} from "lucide-react";
import type { JobResource, JobStatus } from "../../types/api";

export function jobDurationSeconds(job: JobResource): number | null {
  if (job.finishedAt && job.startedAt) {
    return Math.round(
      (new Date(job.finishedAt).getTime() - new Date(job.startedAt).getTime()) /
        1000
    );
  }
  return job.rtoSeconds;
}

export function statusLabel(status: string): string {
  switch (status) {
    case "pass":
      return "Success";
    case "fail":
      return "Failed";
    case "error":
      return "Error";
    case "running":
      return "In progress";
    case "pending":
      return "Queued";
    case "cancelled":
      return "Cancelled";
    default:
      return status;
  }
}

export function statusBadgeClass(status: string): string {
  switch (status) {
    case "pass":
      return "bg-emerald-100 text-emerald-800 ring-emerald-200";
    case "fail":
    case "error":
      return "bg-red-100 text-red-800 ring-red-200";
    case "running":
      return "bg-cyan-100 text-cyan-800 ring-cyan-200";
    case "pending":
      return "bg-slate-100 text-slate-600 ring-slate-200";
    case "cancelled":
      return "bg-amber-100 text-amber-800 ring-amber-200";
    default:
      return "bg-slate-100 text-slate-600 ring-slate-200";
  }
}

export function RunStatusIcon({
  status,
  size = 18,
}: {
  status: string;
  size?: number;
}) {
  if (status === "running") {
    return (
      <Loader2 size={size} className="shrink-0 animate-spin text-cyan-600" />
    );
  }
  if (status === "pending") {
    return <Clock size={size} className="shrink-0 text-slate-400" />;
  }
  if (status === "pass") {
    return <CheckCircle2 size={size} className="shrink-0 text-emerald-600" />;
  }
  if (status === "fail" || status === "error") {
    return <XCircle size={size} className="shrink-0 text-red-600" />;
  }
  return <Circle size={size} className="shrink-0 text-slate-300" />;
}

export function isActiveJob(status: string): boolean {
  return status === "pending" || status === "running";
}

export type { JobStatus };
