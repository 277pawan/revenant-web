import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Copy, KeyRound, RefreshCw, Server } from "lucide-react";
import { AppShell } from "../components/AppShell";
import { useToast } from "../components/toast/ToastProvider";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
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
  canIssue,
  issuing,
  onIssue,
  issuedToken,
}: {
  service: PlanServiceResource;
  canIssue: boolean;
  issuing: boolean;
  onIssue: () => void;
  issuedToken: string | null;
}) {
  const status = agentStatus(service.runner?.lastSeenAt ?? null);
  const lastRun = service.jobs[0];

  const dockerCmd = issuedToken
    ? `docker run -d --restart unless-stopped -e REVENANT_RUNNER_TOKEN=${issuedToken} yourorg/revenant-agent:latest`
    : service.runner
      ? `docker run -d --restart unless-stopped -e REVENANT_RUNNER_TOKEN=<your-token> yourorg/revenant-agent:latest`
      : "";

  const localCmd = issuedToken
    ? `REVENANT_RUNNER_TOKEN=${issuedToken} npm start`
    : "REVENANT_RUNNER_TOKEN=<your-token> npm start";

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
                <span className="text-xs text-amber-700">No agent token</span>
              )}
            </div>
          </div>
        </div>
        {canIssue && (
          <button
            type="button"
            disabled={issuing}
            onClick={onIssue}
            className="inline-flex items-center gap-2 rounded-md bg-brand px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
          >
            <KeyRound size={14} />
            {issuing
              ? "Rotating…"
              : service.runner
                ? "Rotate token"
                : "Issue token"}
          </button>
        )}
      </div>

      <div className="space-y-4 px-4 py-4 text-sm">
        {service.runner && (
          <p className="text-xs text-slate-500">
            One active token per plan. Rotating replaces the current token — the
            previous one stops working immediately.
          </p>
        )}

        {issuedToken && (
          <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-950">
            <span className="font-semibold">New token (copy now)</span>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <code className="break-all rounded bg-white px-2 py-1 font-mono">
                {issuedToken}
              </code>
              <CopyButton text={issuedToken} label="Token" />
            </div>
          </div>
        )}

        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
            Local agent
          </p>
          <pre className="mt-1 overflow-x-auto rounded-md border border-slate-200 bg-slate-50 p-2 font-mono text-[11px]">
            cd revenant-agent{"\n"}
            {localCmd}
          </pre>
          {issuedToken && (
            <CopyButton
              text={`cd revenant-agent\n${localCmd}`}
              label="Local cmd"
            />
          )}
        </div>

        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
            Docker
          </p>
          <pre className="mt-1 overflow-x-auto rounded-md border border-slate-200 bg-slate-50 p-2 font-mono text-[11px]">
            {dockerCmd || "Issue a token first"}
          </pre>
          {issuedToken && <CopyButton text={dockerCmd} label="Docker cmd" />}
        </div>

        {lastRun && (
          <p className="border-t border-slate-100 pt-3 text-xs text-slate-500">
            Last run:{" "}
            <Link
              to={`/workflows/${service.databaseId}/runs/${lastRun.id}`}
              className="font-medium uppercase text-brand hover:underline"
            >
              {lastRun.status}
            </Link>
            {" · "}
            {new Date(lastRun.createdAt).toLocaleString()}
            {" · "}
            <Link to="/workflows" className="text-brand hover:underline">
              All workflows
            </Link>
          </p>
        )}
      </div>
    </section>
  );
}

export function RunnersPage() {
  const { user } = useAuth();
  const toast = useToast();
  const canView = user ? roleHasPermission(user.role, "plans:read") : false;
  const canIssue = user ? roleHasPermission(user.role, "plans:write") : false;

  const [services, setServices] = useState<PlanServiceResource[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [issuingId, setIssuingId] = useState<string | null>(null);
  const [issuedForDatabase, setIssuedForDatabase] = useState<string | null>(
    null
  );
  const [issuedToken, setIssuedToken] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.listPlanServices();
      setServices(res.services);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load services");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function issueToken(databaseId: string) {
    setIssuingId(databaseId);
    try {
      const res = await api.issueRunnerToken(databaseId);
      setIssuedToken(res.token);
      setIssuedForDatabase(databaseId);
      toast.success(
        "Token rotated",
        "Previous token is invalid. Copy the new one now."
      );
      await load();
    } catch (err) {
      toast.error(
        "Could not rotate token",
        err instanceof Error ? err.message : "Request failed"
      );
    } finally {
      setIssuingId(null);
    }
  }

  if (!canView) {
    return (
      <AppShell>
        <h1 className="text-2xl font-semibold">Agent setup</h1>
        <p className="mt-2 text-sm text-slate-600">You do not have access.</p>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
            Agent services
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-slate-600">
            Connect one self-hosted agent per validation plan. Issue or rotate
            tokens here — run history lives under Workflows.
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
      ) : services.length === 0 ? (
        <div className="rounded-lg border border-slate-200 bg-white px-6 py-12 text-center text-sm text-slate-500">
          No validation plans yet.{" "}
          <Link to="/settings/validation-plans" className="text-brand hover:underline">
            Create a plan
          </Link>{" "}
          first — then connect an agent here.
        </div>
      ) : (
        <div className="space-y-4">
          {services.map((svc) => (
            <AgentServiceCard
              key={svc.databaseId}
              service={svc}
              canIssue={canIssue}
              issuing={issuingId === svc.databaseId}
              onIssue={() => void issueToken(svc.databaseId)}
              issuedToken={
                issuedForDatabase === svc.databaseId ? issuedToken : null
              }
            />
          ))}
        </div>
      )}
    </AppShell>
  );
}
