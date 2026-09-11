import {
  CheckCircle2,
  Circle,
  Loader2,
  XCircle,
  MinusCircle,
  ChevronRight,
} from "lucide-react";
import type { JobResource } from "../../types/api";

export type PipelineStepStatus =
  | "pending"
  | "running"
  | "pass"
  | "fail"
  | "skip";

export type PipelineStep = {
  id: string;
  label: string;
  status: PipelineStepStatus;
  detail?: string;
};

function stepIcon(status: PipelineStepStatus) {
  switch (status) {
    case "running":
      return <Loader2 size={14} className="animate-spin text-cyan-600" />;
    case "pass":
      return <CheckCircle2 size={14} className="text-emerald-600" />;
    case "fail":
      return <XCircle size={14} className="text-red-600" />;
    case "skip":
      return <MinusCircle size={14} className="text-slate-400" />;
    default:
      return <Circle size={14} className="text-slate-300" />;
  }
}

function stepBoxClass(status: PipelineStepStatus) {
  switch (status) {
    case "running":
      return "border-cyan-400 bg-cyan-50 text-cyan-950 workflow-step-running";
    case "pass":
      return "border-emerald-400 bg-emerald-50 text-emerald-950";
    case "fail":
      return "border-red-400 bg-red-50 text-red-950";
    case "skip":
      return "border-slate-200 bg-slate-50 text-slate-500";
    default:
      return "border-slate-200 bg-white text-slate-500";
  }
}

function connectorClass(left: PipelineStepStatus, right: PipelineStepStatus) {
  if (left === "running" || right === "running") {
    return "workflow-connector-active h-0.5";
  }
  if (left === "pass" && right !== "pending") {
    return "bg-emerald-400 h-0.5";
  }
  if (left === "fail" || right === "fail") {
    return "bg-red-300 h-0.5";
  }
  return "bg-slate-200 h-0.5";
}

function isConnectorLive(left: PipelineStepStatus, right: PipelineStepStatus) {
  return left === "running" || right === "running";
}

/** GitHub Actions–style horizontal pipeline with wired connectors */
export function WorkflowPipeline({
  steps,
  compact = false,
}: {
  steps: PipelineStep[];
  compact?: boolean;
}) {
  return (
    <div
      className={`flex min-w-0 items-center overflow-x-auto ${
        compact ? "py-0.5" : "rounded-lg border border-slate-200 bg-slate-50/80 px-3 py-3"
      }`}
      role="list"
      aria-label="Workflow pipeline"
    >
      {steps.map((step, i) => {
        const next = steps[i + 1];
        const live = next ? isConnectorLive(step.status, next.status) : false;

        return (
          <div key={step.id} className="flex min-w-0 items-center" role="listitem">
            <div
              className={`relative flex shrink-0 flex-col rounded-md border-2 shadow-sm transition-all duration-300 ${stepBoxClass(step.status)} ${
                compact ? "min-w-[76px] px-2 py-1.5" : "min-w-[96px] px-3 py-2"
              }`}
              title={step.detail}
            >
              <div className="flex items-center gap-1.5">
                {stepIcon(step.status)}
                <span
                  className={`font-semibold leading-tight ${
                    compact ? "text-[10px]" : "text-xs"
                  }`}
                >
                  {step.label}
                </span>
              </div>
              {!compact && step.detail && (
                <span className="mt-1 truncate text-[10px] font-normal opacity-75">
                  {step.detail}
                </span>
              )}
            </div>

            {next && (
              <div
                className={`flex shrink-0 items-center ${compact ? "w-8" : "w-12"}`}
                aria-hidden
              >
                <div
                  className={`flex-1 rounded-full transition-colors duration-500 ${connectorClass(
                    step.status,
                    next.status
                  )}`}
                />
                <ChevronRight
                  size={compact ? 12 : 14}
                  className={`-ml-0.5 shrink-0 ${
                    live
                      ? "text-cyan-500"
                      : step.status === "pass"
                        ? "text-emerald-500"
                        : step.status === "fail"
                          ? "text-red-400"
                          : "text-slate-300"
                  }`}
                  strokeWidth={2.5}
                />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export function jobToPipelineSteps(job: JobResource): PipelineStep[] {
  const s = job.status;
  const mode = job.executionMode ?? "agent";

  const queued: PipelineStepStatus =
    s === "pending" ? "pending" : "pass";

  const claimed: PipelineStepStatus =
    s === "pending"
      ? "pending"
      : s === "running"
        ? "running"
        : "pass";

  const verify: PipelineStepStatus =
    s === "pending"
      ? "pending"
      : s === "running"
        ? "running"
        : s === "pass"
          ? "pass"
          : s === "fail" || s === "error"
            ? "fail"
            : "pending";

  const done: PipelineStepStatus =
    s === "pass"
      ? "pass"
      : s === "fail" || s === "error"
        ? "fail"
        : "pending";

  return [
    {
      id: "trigger",
      label: "Trigger",
      status: s === "pending" ? "running" : "pass",
      detail: job.trigger,
    },
    { id: "queue", label: "Queued", status: queued },
    {
      id: "agent",
      label: "Agent",
      status: claimed,
      detail: mode === "stub" ? "simulated" : mode,
    },
    { id: "verify", label: "Verify", status: verify },
    {
      id: "done",
      label: "Complete",
      status: done,
      detail: job.rtoSeconds != null ? `${job.rtoSeconds}s` : undefined,
    },
  ];
}
