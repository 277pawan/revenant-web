import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  Handle,
  Position,
  useNodesInitialized,
  useReactFlow,
  type Edge,
  type Node,
  type NodeProps,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { CheckCircle2, Loader2, XCircle } from "lucide-react";
import { effectiveJobStatus } from "./jobStatus";
import type { JobDetailResource, JobResultResource } from "../../types/api";

export type GraphNodeData = {
  label: string;
  sublabel?: string;
  status: "pass" | "fail" | "running" | "pending" | "skip";
  detail?: string;
  checkResult?: JobResultResource;
  revealOrder?: number;
};

function nodeBorder(status: GraphNodeData["status"]) {
  switch (status) {
    case "pass":
      return "border-emerald-400 bg-white";
    case "fail":
      return "border-red-400 bg-red-50/40";
    case "running":
      return "border-cyan-400 bg-cyan-50/30 ring-2 ring-cyan-100";
    default:
      return "border-slate-200 bg-white";
  }
}

function PipelineNode({ data, selected }: NodeProps<Node<GraphNodeData>>) {
  const Icon =
    data.status === "pass"
      ? CheckCircle2
      : data.status === "fail"
        ? XCircle
        : data.status === "running"
          ? Loader2
          : null;

  return (
    <div
      className={`pipeline-node-enter min-w-[130px] max-w-[180px] rounded-lg border-2 px-3 py-2 shadow-sm transition-shadow ${nodeBorder(data.status)} ${
        selected ? "shadow-md ring-2 ring-brand/30" : ""
      }`}
      style={{ animationDelay: `${Math.min(data.revealOrder ?? 0, 20) * 70}ms` }}
    >
      <Handle type="target" position={Position.Left} className="!h-2 !w-2 !bg-slate-400" />
      <div className="flex items-start gap-1.5">
        {Icon && (
          <Icon
            size={14}
            className={`mt-0.5 shrink-0 ${
              data.status === "pass"
                ? "text-emerald-600"
                : data.status === "fail"
                  ? "text-red-600"
                  : "animate-spin text-cyan-600"
            }`}
          />
        )}
        <div className="min-w-0">
          <p className="text-xs font-semibold text-slate-900">{data.label}</p>
          {data.sublabel && (
            <p className="mt-0.5 truncate text-[10px] text-slate-500">{data.sublabel}</p>
          )}
          {data.detail && (
            <p className="mt-1 text-[10px] leading-snug text-slate-600">{data.detail}</p>
          )}
        </div>
      </div>
      <Handle type="source" position={Position.Right} className="!h-2 !w-2 !bg-slate-400" />
    </div>
  );
}

const nodeTypes = { pipeline: PipelineNode };

function GraphViewportController({
  jobId,
  status,
  nodeCount,
}: {
  jobId: string;
  status: string;
  nodeCount: number;
}) {
  const { fitView } = useReactFlow<Node<GraphNodeData>, Edge>();
  const nodesInitialized = useNodesInitialized();
  const initialFitJob = useRef<string | null>(null);
  const terminalFitJob = useRef<string | null>(null);

  useEffect(() => {
    if (!nodesInitialized) return;

    const terminal = ["pass", "fail", "error", "cancelled"].includes(status);
    const shouldFitInitially = initialFitJob.current !== jobId;
    const shouldFitOnCompletion =
      terminal && terminalFitJob.current !== jobId;
    if (!shouldFitInitially && !shouldFitOnCompletion) return;

    if (shouldFitInitially) initialFitJob.current = jobId;
    if (shouldFitOnCompletion) terminalFitJob.current = jobId;

    const frame = window.requestAnimationFrame(() => {
      void fitView({
        padding: 0.2,
        minZoom: 0.35,
        maxZoom: 1.1,
        duration: 450,
      });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [fitView, jobId, nodeCount, nodesInitialized, status]);

  return null;
}

function stageStatus(
  job: JobDetailResource,
  stage: "trigger" | "queue" | "agent" | "complete"
): GraphNodeData["status"] {
  const s = job.status;
  const resolved = effectiveJobStatus(job);

  if (stage === "trigger") return s === "pending" ? "running" : "pass";
  if (stage === "queue") return s === "pending" ? "pending" : "pass";
  if (stage === "agent") {
    if (s === "pending") return "pending";
    if (s === "running") return "running";
    return "pass";
  }
  if (resolved === "pass") return "pass";
  if (resolved === "fail" || resolved === "error") return "fail";
  return "pending";
}

type PipelineCheck = {
  key: string;
  label: string;
  sublabel: string;
  status: GraphNodeData["status"];
  detail?: string;
  result?: JobResultResource;
};

function checkStatus(status: string): GraphNodeData["status"] {
  if (status === "pass") return "pass";
  if (status === "fail" || status === "error") return "fail";
  if (status === "skip") return "skip";
  return "pending";
}

function getPipelineChecks(job: JobDetailResource): PipelineCheck[] {
  const checks = new Map<string, PipelineCheck>();
  const occurrences = new Map<string, number>();

  for (const check of job.runnerProgress?.checks ?? []) {
    const baseKey = `${check.checkType}:${check.checkName}`;
    const occurrence = occurrences.get(baseKey) ?? 0;
    occurrences.set(baseKey, occurrence + 1);
    checks.set(`${baseKey}:${occurrence}`, {
      key: `${baseKey}:${occurrence}`,
      label: check.checkName,
      sublabel: check.checkType,
      status: checkStatus(check.status),
      detail: check.status === "fail" ? check.message ?? undefined : undefined,
    });
  }

  occurrences.clear();
  for (const check of job.results) {
    const baseKey = `${check.checkType}:${check.checkName}`;
    const occurrence = occurrences.get(baseKey) ?? 0;
    occurrences.set(baseKey, occurrence + 1);
    const key = `${baseKey}:${occurrence}`;
    checks.set(key, {
      key,
      label: check.checkName,
      sublabel: check.checkType,
      status: checkStatus(check.status),
      detail:
        check.status === "fail" && check.message
          ? check.message.slice(0, 80)
          : check.durationMs != null
            ? `${check.durationMs}ms`
            : undefined,
      result: check,
    });
  }

  return [...checks.values()];
}

function buildGraph(job: JobDetailResource, checks: PipelineCheck[]): {
  nodes: Node<GraphNodeData>[];
  edges: Edge[];
} {
  const nodes: Node<GraphNodeData>[] = [];
  const edges: Edge[] = [];

  const linear: Array<{ id: string; label: string; sublabel?: string; stage: GraphNodeData["status"] }> = [
    {
      id: "trigger",
      label: "Trigger",
      sublabel: job.trigger,
      stage: stageStatus(job, "trigger"),
    },
    {
      id: "queue",
      label: "Queued",
      sublabel: "Control plane",
      stage: stageStatus(job, "queue"),
    },
    {
      id: "agent",
      label: "Agent",
      sublabel: job.executionMode ?? "agent",
      stage: stageStatus(job, "agent"),
    },
  ];

  linear.forEach((step, i) => {
    nodes.push({
      id: step.id,
      type: "pipeline",
      position: { x: i * 200, y: 120 },
      data: {
        label: step.label,
        sublabel: step.sublabel,
        status: step.stage,
        revealOrder: i,
      },
    });
    if (i > 0) {
      const prev = linear[i - 1];
      edges.push({
        id: `${prev.id}-${step.id}`,
        source: prev.id,
        target: step.id,
        type: "smoothstep",
        style: {
          stroke: prev.stage === "pass" ? "#22c55e" : "#cbd5e1",
          strokeWidth: 2,
        },
      });
    }
  });

  const verifyYStart = 20;
  const verifyX = 620;

  if (checks.length > 0) {
    checks.forEach((check, i) => {
      const id = `check-${encodeURIComponent(check.key)}`;
      const st = check.status;
      nodes.push({
        id,
        type: "pipeline",
        position: { x: verifyX, y: verifyYStart + i * 88 },
        data: {
          label: check.label,
          sublabel: check.sublabel,
          status: st,
          detail: check.detail,
          checkResult: check.result,
          revealOrder: linear.length + i,
        },
      });
      edges.push({
        id: `agent-${id}`,
        source: "agent",
        target: id,
        type: "smoothstep",
        style: {
          stroke: st === "fail" ? "#ef4444" : st === "pass" ? "#22c55e" : "#cbd5e1",
          strokeWidth: 2,
        },
      });
    });
  } else {
    const verifyStatus: GraphNodeData["status"] =
      job.status === "running"
        ? "running"
        : job.status === "pass"
          ? "pass"
          : job.status === "fail" || job.status === "error"
            ? "fail"
            : "pending";
    nodes.push({
      id: "verify",
      type: "pipeline",
      position: { x: verifyX, y: 120 },
      data: {
        label: "Verify",
        sublabel: "Validation checks",
        status: verifyStatus,
        revealOrder: linear.length,
      },
    });
    edges.push({
      id: "agent-verify",
      source: "agent",
      target: "verify",
      type: "smoothstep",
      animated: job.status === "running",
      style: {
        stroke: verifyStatus === "pass" ? "#22c55e" : "#cbd5e1",
        strokeWidth: 2,
      },
    });
  }

  const completeStatus = stageStatus(job, "complete");
  const completeX = checks.length > 0 ? 880 : 820;
  const completeY = checks.length > 0 ? 120 + ((checks.length - 1) * 88) / 2 : 120;

  nodes.push({
    id: "complete",
    type: "pipeline",
    position: { x: completeX, y: completeY },
    data: {
      label: "Complete",
      sublabel: job.rtoSeconds != null ? `${job.rtoSeconds}s` : undefined,
      status: completeStatus,
      revealOrder: linear.length + checks.length + 1,
    },
  });

  const lastSources =
    checks.length > 0
      ? checks.map((check) => `check-${encodeURIComponent(check.key)}`)
      : ["verify"];

  for (const src of lastSources) {
    edges.push({
      id: `${src}-complete`,
      source: src,
      target: "complete",
      type: "smoothstep",
      style: {
        stroke:
          completeStatus === "pass"
            ? "#22c55e"
            : completeStatus === "fail"
              ? "#ef4444"
              : "#cbd5e1",
        strokeWidth: 2,
      },
    });
  }

  return { nodes, edges };
}

export function RestorePipelineGraph({
  job,
  onSelectCheck,
}: {
  job: JobDetailResource;
  onSelectCheck: (check: JobResultResource | null) => void;
}) {
  const latestChecks = useMemo(() => getPipelineChecks(job), [job]);
  const [observedChecks, setObservedChecks] = useState<{
    jobId: string;
    checks: PipelineCheck[];
  }>({ jobId: job.id, checks: [] });
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    setObservedChecks((current) => {
      const checks = current.jobId === job.id ? [...current.checks] : [];
      const indexes = new Map(checks.map((check, index) => [check.key, index]));
      for (const check of latestChecks) {
        const index = indexes.get(check.key);
        if (index == null) {
          indexes.set(check.key, checks.length);
          checks.push(check);
        } else {
          checks[index] = { ...checks[index], ...check };
        }
      }
      return { jobId: job.id, checks };
    });
  }, [job.id, latestChecks]);

  const checks =
    observedChecks.jobId === job.id ? observedChecks.checks : latestChecks;
  const { nodes, edges } = useMemo(() => buildGraph(job, checks), [job, checks]);

  const onNodeClick = useCallback(
    (_: unknown, node: Node<GraphNodeData>) => {
      setSelectedId(node.id);
      onSelectCheck(node.data.checkResult ?? null);
    },
    [onSelectCheck]
  );

  useEffect(() => {
    const failed = job.results.find((r) => r.status === "fail");
    if (failed) {
      const check = checks.find((candidate) => candidate.result?.id === failed.id);
      if (!check) return;
      const id = `check-${encodeURIComponent(check.key)}`;
      setSelectedId(id);
      onSelectCheck(failed);
    }
  }, [job.id, job.results, checks, onSelectCheck]);

  const styledNodes = nodes.map((n) => ({
    ...n,
    selected: n.id === selectedId,
  }));
  const graphHeight = Math.min(760, Math.max(420, 260 + checks.length * 88));

  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-1 text-xs text-slate-500">
        <span>
          {checks.length} validation {checks.length === 1 ? "step" : "steps"} reported
        </span>
        {checks.length > 8 && <span>Use zoom and pan to explore the full diagram.</span>}
      </div>
      <div
        className="w-full overflow-hidden rounded-lg border border-slate-200 bg-slate-50"
        style={{ height: graphHeight }}
      >
        <ReactFlow
          nodes={styledNodes}
          edges={edges}
          nodeTypes={nodeTypes}
          onNodeClick={onNodeClick}
          minZoom={0.25}
          maxZoom={1.5}
          nodesDraggable={false}
          nodesConnectable={false}
          elementsSelectable
          proOptions={{ hideAttribution: true }}
        >
          <GraphViewportController
            jobId={job.id}
            status={job.status}
            nodeCount={nodes.length}
          />
          <Background gap={16} size={1} color="#e2e8f0" />
          <Controls showInteractive={false} className="!shadow-sm" />
        </ReactFlow>
      </div>
    </div>
  );
}
