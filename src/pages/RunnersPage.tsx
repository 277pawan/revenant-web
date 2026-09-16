import { useCallback, useEffect, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { Copy, KeyRound, RefreshCw, Server } from "lucide-react";
import { AppShell } from "../components/AppShell";
import { useToast } from "../components/toast/ToastProvider";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import { getPlanDefinition, planAllowsSelfHostedAgent } from "../lib/plans";
import { roleHasPermission, type PlanServiceResource } from "../types/api";

function CopyButton({ text, label = "Copy" }: { text: string; label?: string }) {
  const toast = useToast();
  return (
    <button
      type="button"
      className="inline-flex items-center gap-1 rounded border border-slate-300 bg-white px-2 py-1 text-xs hover:bg-slate-50"
      onClick={() => {
        void navigator.clipboard.writeText(text).then(() => {
          toast.info("Copied", `${label} ready to paste.`);
        });
      }}
    >
      <Copy size={12} />
      {label}
    </button>
  );
}

function agentStatus(lastSeenAt: string | null): {
  label: string;
  className: string;
} {
  if (!lastSeenAt) {
    return { label: "Offline", className: "bg-slate-100 text-slate-600" };
  }
  const online = Date.now() - new Date(lastSeenAt).getTime() < 60_000;
  if (online) {
    return { label: "Online", className: "bg-emerald-100 text-emerald-800" };
  }
  const idle = Date.now() - new Date(lastSeenAt).getTime() < 300_000;
  if (idle) {
    return { label: "Idle", className: "bg-amber-100 text-amber-800" };
  }
  return { label: "Offline", className: "bg-slate-100 text-slate-600" };
}

function AgentServiceCard({
  service,
  issuing,
  onIssue,
  issuedToken,
}: {
  service: PlanServiceResource;
  issuing: boolean;
  onIssue: () => void;
  issuedToken: string | null;
}) {
  const status = agentStatus(service.runner?.lastSeenAt ?? null);
  const lastRun = service.jobs[0];

  const token = issuedToken ?? "<your-token>";
  const hasToken = Boolean(issuedToken);
  const agentImage =
    import.meta.env.VITE_AGENT_IMAGE?.trim() || "277pawan/revenant-agent:latest";

  const dockerCustomerCmd = `docker run -d --restart unless-stopped \\
  -e REVENANT_RUNNER_TOKEN=${token} \\
  ${agentImage}`;

  return (
    <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 px-4 py-4">
        <div className="flex gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
            <Server size={20} />
          </div>
          <div>
            <h2 className="font-semibold text-slate-900">{service.planName}</h2>
            <p className="text-sm text-slate-500">{service.databaseName}</p>
            <p className="mt-0.5 text-xs text-slate-400">
              {service.recoveryMode === "direct"
                ? "Private Postgres — agent required"
                : "AWS RDS — managed by Revenant (token optional)"}
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <span
                className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${status.className}`}
              >
                {status.label}
              </span>
              {service.runner ? (
                <span className="font-mono text-xs text-slate-500">
                  Token {service.runner.tokenPrefix}…
                </span>
              ) : (
                <span className="text-xs text-amber-700">No agent token yet</span>
              )}
            </div>
          </div>
        </div>
        {service.recoveryMode === "direct" && (
          <button
            type="button"
            disabled={issuing}
            onClick={onIssue}
            className="inline-flex items-center gap-2 rounded-md bg-brand px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
          >
            <KeyRound size={14} />
            {issuing
              ? "Issuing…"
              : service.runner
                ? "Rotate token"
                : "Issue token"}
          </button>
        )}
      </div>

      <div className="space-y-4 px-4 py-4 text-sm">
        {service.recoveryMode !== "direct" && (
          <p className="rounded-md border border-blue-100 bg-blue-50 px-3 py-2 text-xs text-blue-900">
            This workflow uses managed AWS drills. Run from{" "}
            <Link to="/workflows" className="font-medium text-brand hover:underline">
              Workflows
            </Link>{" "}
            — no Docker needed.
          </p>
        )}

        {issuedToken && service.recoveryMode === "direct" && (
          <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-950">
            <p className="font-medium">Copy this token now — it won&apos;t be shown again.</p>
            <p className="mt-2 break-all font-mono">{issuedToken}</p>
            <div className="mt-2">
              <CopyButton text={issuedToken} label="Copy token" />
            </div>
          </div>
        )}

        {service.recoveryMode === "direct" && (service.runner || issuedToken) && (
          <div>
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">
              Docker (inside your VPC)
            </p>
            <pre className="overflow-x-auto rounded-md bg-slate-900 p-3 text-xs text-slate-100">
              {dockerCustomerCmd}
            </pre>
            <div className="mt-2">
              <CopyButton text={dockerCustomerCmd} label="Copy docker run" />
            </div>
          </div>
        )}

        {lastRun && (
          <p className="text-xs text-slate-500">
            Last run:{" "}
            <Link
              to={`/workflows/${lastRun.id}`}
              className="font-medium uppercase text-brand hover:underline"
            >
              {lastRun.status}
            </Link>
            {" · "}
            {new Date(lastRun.createdAt).toLocaleString()}
          </p>
        )}
      </div>
    </section>
  );
}

export function RunnersPage() {
  const { user, refreshUser } = useAuth();
  const toast = useToast();
  const canView = user ? roleHasPermission(user.role, "plans:read") : false;
  const plan = getPlanDefinition(user?.organizationPlan ?? "starter");
  const agentAllowed = user ? planAllowsSelfHostedAgent(user.organizationPlan) : false;

  const [services, setServices] = useState<PlanServiceResource[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [issuingId, setIssuingId] = useState<string | null>(null);
  const [issuedForDatabase, setIssuedForDatabase] = useState<string | null>(null);
  const [issuedToken, setIssuedToken] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      await refreshUser();
      const res = await api.listPlanServices();
      setServices(res.services);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load services");
    } finally {
      setLoading(false);
    }
  }, [refreshUser]);

  useEffect(() => {
    void load();
  }, [load]);

  async function issueToken(databaseId: string) {
    setIssuingId(databaseId);
    try {
      const res = await api.issueRunnerToken(databaseId);
      setIssuedToken(res.token);
      setIssuedForDatabase(databaseId);
      toast.success("Token issued", "Copy it now — previous token no longer works.");
      await load();
    } catch (err) {
      toast.error(
        "Could not issue token",
        err instanceof Error ? err.message : "Request failed"
      );
    } finally {
      setIssuingId(null);
    }
  }

  if (!canView) {
    return (
      <AppShell>
        <h1 className="text-2xl font-semibold">Private-network agent</h1>
        <p className="mt-2 text-sm text-slate-600">You do not have access.</p>
      </AppShell>
    );
  }

  if (user && !agentAllowed) {
    return <Navigate to="/workflows" replace />;
  }

  const directWorkflows = services.filter((s) => s.recoveryMode === "direct");

  return (
    <AppShell>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
            Private-network agent
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-slate-600">
            <strong className="font-medium text-slate-800">{plan.name} plan.</strong> AWS restore
            drills still run on Revenant&apos;s cloud automatically. Issue a token here only for
            workflows using <strong className="font-medium">direct Postgres</strong> inside a private
            VPC ({plan.parallelRestoreDrills ?? "unlimited"} parallel drills org-wide).
          </p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          className="inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
        >
          <RefreshCw size={14} />
          Refresh
        </button>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      )}

      {loading ? (
        <div className="space-y-3">
          {[1, 2].map((i) => (
            <div key={i} className="h-40 animate-pulse rounded-lg bg-slate-100" />
          ))}
        </div>
      ) : directWorkflows.length === 0 ? (
        <div className="rounded-lg border border-slate-200 bg-white px-6 py-12 text-center text-sm text-slate-600">
          <p className="font-medium text-slate-900">No private Postgres workflows yet</p>
          <p className="mt-2">
            Add a database with <strong>Direct Postgres</strong> mode, or run AWS drills from{" "}
            <Link to="/workflows" className="text-brand hover:underline">
              Workflows
            </Link>{" "}
            with no agent setup.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {directWorkflows.map((svc) => (
            <AgentServiceCard
              key={svc.databaseId}
              service={svc}
              issuing={issuingId === svc.databaseId}
              onIssue={() => void issueToken(svc.databaseId)}
              issuedToken={issuedForDatabase === svc.databaseId ? issuedToken : null}
            />
          ))}
        </div>
      )}
    </AppShell>
  );
}
