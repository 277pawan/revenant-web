import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  Handle,
  Position,
  type Edge,
  type Node,
  type NodeProps,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { CheckCircle2, Loader2, XCircle } from "lucide-react";
import type { JobDetailResource, JobResultResource } from "../../types/api";

export type GraphNodeData = {
  label: string;
  sublabel?: string;
  status: "pass" | "fail" | "running" | "pending" | "skip";
  detail?: string;
  checkResult?: JobResultResource;
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
      className={`min-w-[130px] max-w-[160px] rounded-lg border-2 px-3 py-2 shadow-sm transition-shadow ${nodeBorder(data.status)} ${
        selected ? "shadow-md ring-2 ring-brand/30" : ""
      }`}
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

function stageStatus(
  job: JobDetailResource,
  stage: "trigger" | "queue" | "agent" | "complete"
): GraphNodeData["status"] {
  const s = job.status;
  if (stage === "trigger") return s === "pending" ? "running" : "pass";
  if (stage === "queue") return s === "pending" ? "pending" : "pass";
  if (stage === "agent") {
    if (s === "pending") return "pending";
    if (s === "running") return "running";
    return "pass";
  }
  if (s === "pass") return "pass";
  if (s === "fail" || s === "error") return "fail";
  return "pending";
}

function buildGraph(job: JobDetailResource): {
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

  const checks = job.results;
  const verifyYStart = 20;
  const verifyX = 620;

  if (checks.length > 0) {
    checks.forEach((check, i) => {
      const id = `check-${check.id}`;
      const st: GraphNodeData["status"] =
        check.status === "pass"
          ? "pass"
          : check.status === "fail"
            ? "fail"
            : "pending";
      nodes.push({
        id,
        type: "pipeline",
        position: { x: verifyX, y: verifyYStart + i * 88 },
        data: {
          label: check.checkName,
          sublabel: check.checkType,
          status: st,
          detail:
            check.status === "fail" && check.message
              ? check.message.slice(0, 80)
              : check.durationMs != null
                ? `${check.durationMs}ms`
                : undefined,
          checkResult: check,
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
      },
    });
    edges.push({
      id: "agent-verify",
      source: "agent",
      target: "verify",
      type: "smoothstep",
      style: { stroke: "#cbd5e1", strokeWidth: 2 },
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
    },
  });

  const lastSources =
    checks.length > 0
      ? checks.map((c) => `check-${c.id}`)
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
  const { nodes, edges } = useMemo(() => buildGraph(job), [job]);
  const [selectedId, setSelectedId] = useState<string | null>(null);

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
      const id = `check-${failed.id}`;
      setSelectedId(id);
      onSelectCheck(failed);
    }
  }, [job.id, job.results, onSelectCheck]);

  const styledNodes = nodes.map((n) => ({
    ...n,
    selected: n.id === selectedId,
  }));

  return (
    <div className="h-[420px] w-full overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
      <ReactFlow
        nodes={styledNodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodeClick={onNodeClick}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable
        proOptions={{ hideAttribution: true }}
      >
        <Background gap={16} size={1} color="#e2e8f0" />
        <Controls showInteractive={false} className="!shadow-sm" />
      </ReactFlow>
    </div>
  );
}
