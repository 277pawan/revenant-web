import { useCallback, useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Copy, Server } from "lucide-react";
import { AppShell } from "../components/AppShell";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { PaginationBar } from "../components/PaginationBar";
import { Field, Input, Select } from "../components/ui/Field";
import { useToast } from "../components/toast/ToastProvider";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import {
  roleHasPermission,
  type PaginationMeta,
  type RunnerResource,
} from "../types/api";

const createSchema = z.object({
  name: z.string().min(2, "Name is required").max(255),
  kind: z.enum(["agent", "ci"]),
});

type CreateValues = z.infer<typeof createSchema>;

function CopyButton({ text, label = "Copy" }: { text: string; label?: string }) {
  const toast = useToast();
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className="inline-flex items-center gap-1 rounded border border-slate-300 bg-white px-2 py-1 text-xs hover:bg-slate-50"
      onClick={() => {
        void navigator.clipboard.writeText(text).then(() => {
          setCopied(true);
          toast.info(
            "Copied",
            label === "Copy" ? "Clipboard updated." : `${label} ready to paste.`
          );
          window.setTimeout(() => setCopied(false), 1500);
        });
      }}
    >
      <Copy size={12} />
      {copied ? "Copied" : label}
    </button>
  );
}

export function RunnersPage() {
  const { user } = useAuth();
  const toast = useToast();
  const canManage = user ? roleHasPermission(user.role, "team:manage") : false;
  const apiBase =
    (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, "") ??
    "http://localhost:8080";

  const [runners, setRunners] = useState<RunnerResource[]>([]);
  const [pagination, setPagination] = useState<PaginationMeta>({
    page: 1,
    pageSize: 20,
    total: 0,
    totalPages: 1,
  });
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [saving, setSaving] = useState(false);
  const [createdKind, setCreatedKind] = useState<"agent" | "ci">("agent");
  const [oneTimeToken, setOneTimeToken] = useState<string | null>(null);
  const [revokeTarget, setRevokeTarget] = useState<RunnerResource | null>(null);
  const [revoking, setRevoking] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CreateValues>({
    resolver: zodResolver(createSchema),
    defaultValues: { name: "office-agent", kind: "agent" },
  });

  const load = useCallback(async (nextPage: number) => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.listRunners(nextPage, 20);
      setRunners(res.data);
      setPagination(res.pagination);
      setPage(res.pagination.page);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load runners");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(page);
  }, [load, page]);

  async function onCreate(values: CreateValues) {
    setSaving(true);
    setError(null);
    try {
      const res = await api.createRunner(values);
      setCreatedKind(values.kind);
      setOneTimeToken(res.runner.token);
      reset({ name: "office-agent", kind: "agent" });
      setShowCreate(false);
      toast.success(
        values.kind === "agent" ? "Agent Box token ready" : "CI token ready",
        "Copy it now — it will not be shown again."
      );
      await load(1);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to create runner";
      setError(message);
      toast.error("Could not connect worker", message);
    } finally {
      setSaving(false);
    }
  }

  async function confirmRevoke() {
    if (!revokeTarget) return;
    setRevoking(true);
    try {
      await api.revokeRunner(revokeTarget.id);
      toast.warning(
        "Worker revoked",
        `“${revokeTarget.name}” can no longer claim jobs.`
      );
      setRevokeTarget(null);
      await load(page);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to revoke";
      setError(message);
      toast.error("Revoke failed", message);
    } finally {
      setRevoking(false);
    }
  }

  const agentYaml = useMemo(() => {
    if (!oneTimeToken) return "";
    return `apiUrl: ${apiBase}
token: ${oneTimeToken}
kind: ${createdKind}
pollIntervalMs: 3000
`;
  }, [apiBase, createdKind, oneTimeToken]);

  const agentCommands = useMemo(() => {
    if (!oneTimeToken) return "";
    return `# In the separate Agent Box repo (revenant-agent)
cp agent.example.yaml agent.yaml
# paste the yaml below into agent.yaml, then:
npm install
npm start
`;
  }, [oneTimeToken]);

  const ciSnippet = useMemo(() => {
    if (!oneTimeToken) return "";
    return `# GitHub Actions secret: REVENANT_RUNNER_TOKEN=${oneTimeToken}
# Also set REVENANT_API_URL=${apiBase}
#
# In CI, checkout revenant-agent and run:
#   npm ci && npm start
# with those env vars (or an agent.yaml generated in the job).
`;
  }, [apiBase, oneTimeToken]);

  if (!canManage) {
    return (
      <AppShell>
        <h1 className="text-2xl font-semibold">Agent Box</h1>
        <p className="mt-2 text-sm text-slate-600">
          Only admins can connect Agent Box / CI for this organization.
        </p>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
            Agent Box &amp; CI
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-slate-600">
            Agent Box is a <strong>separate app</strong> (not inside the cloud API). Connect it
            once; then your team only clicks <strong>Run</strong> in this website.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowCreate((v) => !v)}
          className="inline-flex items-center gap-2 rounded-md bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          <Server size={16} />
          {showCreate ? "Close" : "Connect worker"}
        </button>
      </div>

      <div className="mb-6 grid gap-4 lg:grid-cols-2">
        <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-900">1. Agent Box (always-on)</h2>
          <ol className="mt-2 list-decimal space-y-1 pl-4 text-sm text-slate-600">
            <li>
              Click <strong>Connect worker</strong> → kind <strong>agent</strong>
            </li>
            <li>
              On another machine, open the <strong>revenant-agent</strong> project (sibling of
              cloud)
            </li>
            <li>
              Put the token in <code className="text-xs">agent.yaml</code> →{" "}
              <code className="text-xs">npm start</code> (leave it running as a service)
            </li>
            <li>
              Watch <strong>Last seen</strong> below — then click Run in Jobs
            </li>
          </ol>
        </section>
        <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-900">2. CI only</h2>
          <ol className="mt-2 list-decimal space-y-1 pl-4 text-sm text-slate-600">
            <li>
              Connect worker → kind <strong>ci</strong>, store token as a CI secret
            </li>
            <li>CI checks out Agent Box and starts it when a job should run</li>
            <li>No always-on terminal — CI wakes, works, exits</li>
          </ol>
        </section>
      </div>

      <div className="mb-4 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
        Local cloud API can still use an embedded demo worker. Agent Box is the product path for
        customer machines so long verify/AWS work stays off your web servers.
      </div>

      {oneTimeToken && (
        <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-950">
          <div className="font-semibold">
            Copy this token now — it will not be shown again.
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <code className="break-all rounded bg-white px-2 py-1 font-mono text-xs">
              {oneTimeToken}
            </code>
            <CopyButton text={oneTimeToken} label="Copy token" />
            <button
              type="button"
              className="text-xs underline"
              onClick={() => setOneTimeToken(null)}
            >
              Dismiss
            </button>
          </div>

          {createdKind === "agent" ? (
            <div className="mt-4 space-y-3">
              <div>
                <div className="mb-1 flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold uppercase tracking-[0.12em] text-emerald-900">
                    agent.yaml (in revenant-agent)
                  </span>
                  <CopyButton text={agentYaml} label="Copy yaml" />
                </div>
                <pre className="overflow-x-auto rounded bg-white p-2 font-mono text-[11px] text-slate-700">
                  {agentYaml}
                </pre>
              </div>
              <div>
                <div className="mb-1 flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold uppercase tracking-[0.12em] text-emerald-900">
                    Start Agent Box
                  </span>
                  <CopyButton text={agentCommands} label="Copy steps" />
                </div>
                <pre className="overflow-x-auto rounded bg-white p-2 font-mono text-[11px] text-slate-700">
                  {agentCommands}
                </pre>
              </div>
            </div>
          ) : (
            <div className="mt-4">
              <div className="mb-1 flex items-center justify-between gap-2">
                <span className="text-xs font-semibold uppercase tracking-[0.12em] text-emerald-900">
                  CI secret + sketch
                </span>
                <CopyButton text={ciSnippet} label="Copy" />
              </div>
              <pre className="overflow-x-auto rounded bg-white p-2 font-mono text-[11px] text-slate-700">
                {ciSnippet}
              </pre>
            </div>
          )}
        </div>
      )}

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      )}

      {showCreate && (
        <form
          onSubmit={handleSubmit(onCreate)}
          noValidate
          className="mb-6 grid gap-4 rounded-lg border border-slate-200 bg-white p-4 shadow-sm sm:grid-cols-3"
        >
          <Field label="Name" htmlFor="name" required error={errors.name?.message}>
            <Input id="name" invalid={!!errors.name} {...register("name")} />
          </Field>
          <Field label="Kind" htmlFor="kind" required error={errors.kind?.message}>
            <Select id="kind" invalid={!!errors.kind} {...register("kind")}>
              <option value="agent">agent — Agent Box (always-on)</option>
              <option value="ci">ci — GitHub Actions / CI</option>
            </Select>
          </Field>
          <div className="flex items-end">
            <button
              type="submit"
              disabled={saving}
              className="rounded-md bg-brand px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              {saving ? "Creating…" : "Create & show install"}
            </button>
          </div>
        </form>
      )}

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        {loading ? (
          <div className="space-y-3 p-4">
            {[1, 2].map((i) => (
              <div key={i} className="h-10 animate-pulse rounded bg-slate-100" />
            ))}
          </div>
        ) : runners.length === 0 ? (
          <div className="px-6 py-12 text-center text-sm text-slate-500">
            No workers connected yet. Create an Agent Box or CI runner above.
          </div>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Kind</th>
                <th className="px-4 py-3 font-medium">Token</th>
                <th className="px-4 py-3 font-medium">Last seen</th>
                <th className="px-4 py-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {runners.map((r) => {
                const seen = r.lastSeenAt ? new Date(r.lastSeenAt) : null;
                const online = seen && Date.now() - seen.getTime() < 60_000;
                return (
                  <tr key={r.id}>
                    <td className="px-4 py-3 font-medium text-slate-900">{r.name}</td>
                    <td className="px-4 py-3 uppercase text-slate-600">{r.kind}</td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-500">
                      {r.tokenPrefix}…
                    </td>
                    <td className="px-4 py-3 text-slate-500">
                      {seen ? (
                        <span className="inline-flex items-center gap-2">
                          <span
                            className={`h-2 w-2 rounded-full ${
                              online ? "bg-emerald-500" : "bg-slate-300"
                            }`}
                            title={online ? "Seen in last minute" : "Idle / offline"}
                          />
                          {seen.toLocaleString()}
                        </span>
                      ) : (
                        "Never — start Agent Box"
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => setRevokeTarget(r)}
                        className="text-xs text-red-600 hover:underline"
                      >
                        Revoke
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
        {!loading && pagination.total > 0 && (
          <PaginationBar pagination={pagination} onPageChange={setPage} />
        )}
      </div>

      <ConfirmDialog
        open={!!revokeTarget}
        danger
        loading={revoking}
        title="Revoke worker?"
        description={
          revokeTarget
            ? `“${revokeTarget.name}” will stop claiming jobs. Create a new token if needed.`
            : ""
        }
        confirmLabel="Revoke"
        onCancel={() => !revoking && setRevokeTarget(null)}
        onConfirm={() => void confirmRevoke()}
      />
    </AppShell>
  );
}
