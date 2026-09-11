import type { JobResource, PlanServiceResource } from "../types/api";
import { jobDurationSeconds } from "../components/workflow/jobStatus";

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

export function formatRelativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60_000);
  if (min < 1) return "Just now";
  if (min < 60) return `${min} min ago`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

export function checksSummary(job: JobResource): string {
  if (job.status === "pending" || job.status === "running") return "—";
  if (job.status === "pass") return "All checks passed";
  if (job.status === "fail" || job.status === "error") return "Checks failed";
  return "—";
}
