import type { JobResource, PlanServiceResource } from "../types/api";
import { jobDurationSeconds } from "../components/workflow/jobStatus";
import { formatRelativeTime } from "./datetime";

export { formatRelativeTime };

export function workflowSlug(service: PlanServiceResource): string {
  const base = service.planName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return base || service.databaseName.toLowerCase().replace(/\s+/g, "-");
}

export function workflowShortId(databaseId: string): string {
  return `wf_${databaseId.replace(/-/g, "").slice(0, 5)}`;
}

export function runShortId(jobId: string): string {
  return `run_${jobId.replace(/-/g, "").slice(0, 5)}`;
}

export function formatDuration(job: JobResource): string {
  const sec = jobDurationSeconds(job);
  if (sec == null) return "—";
  if (sec < 60) return `${sec}s`;
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return s > 0 ? `${m}m ${s}s` : `${m}m`;
}

export function checksSummary(job: JobResource): string {
  if (job.status === "pending" || job.status === "running") return "—";
  if (job.status === "pass") return "All checks passed";
  if (job.status === "fail" || job.status === "error") return "Checks failed";
  return "—";
}
