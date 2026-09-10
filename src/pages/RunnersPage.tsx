import { useCallback, useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Copy, Server } from "lucide-react";
import { AppShell } from "../components/AppShell";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { PaginationBar } from "../components/PaginationBar";
import { Field, Input, Select } from "../components/ui/Field";
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

export function RunnersPage() {
  const { user } = useAuth();
  const canManage = user ? roleHasPermission(user.role, "team:manage") : false;

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
      setOneTimeToken(res.runner.token);
      reset({ name: "office-agent", kind: "agent" });
      setShowCreate(false);
      await load(1);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create runner");
    } finally {
      setSaving(false);
    }
  }

  async function confirmRevoke() {
    if (!revokeTarget) return;
    setRevoking(true);
    try {
      await api.revokeRunner(revokeTarget.id);
      setRevokeTarget(null);
      await load(page);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to revoke");
    } finally {
      setRevoking(false);
    }
  }

  if (!canManage) {
    return (
      <AppShell>
        <h1 className="text-2xl font-semibold">Runners</h1>
        <p className="mt-2 text-sm text-slate-600">Only admins can manage org runners.</p>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Runners</h1>
          <p className="mt-1 max-w-2xl text-sm text-slate-600">
            Zero-cost execution: create an <strong>agent</strong> token for a self-hosted process,
            or a <strong>ci</strong> token for GitHub Actions. Each org has its own runners — later
            you can swap to managed paid workers without changing the UI.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowCreate((v) => !v)}
          className="inline-flex items-center gap-2 rounded-md bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          <Server size={16} />
          {showCreate ? "Close" : "Create runner"}
        </button>
      </div>

      <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
        Local <code className="rounded bg-white px-1 text-xs">npm run runner:stub</code> uses the
        global <code className="rounded bg-white px-1 text-xs">RUNNER_TOKEN</code> and marks jobs as{" "}
        <strong>SIMULATED</strong>. Real proof requires an org agent or CI runner.
      </div>

      {oneTimeToken && (
        <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-950">
          <div className="font-semibold">Copy this token now — it will not be shown again.</div>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <code className="break-all rounded bg-white px-2 py-1 font-mono text-xs">
              {oneTimeToken}
            </code>
            <button
              type="button"
              className="inline-flex items-center gap-1 rounded border border-emerald-300 bg-white px-2 py-1 text-xs"
              onClick={() => void navigator.clipboard.writeText(oneTimeToken)}
            >
              <Copy size={12} />
              Copy
            </button>
            <button
              type="button"
              className="text-xs underline"
              onClick={() => setOneTimeToken(null)}
            >
              Dismiss
            </button>
          </div>
          <pre className="mt-3 overflow-x-auto rounded bg-white p-2 font-mono text-[11px] text-slate-700">
{`export REVENANT_API_URL=http://localhost:8080
export REVENANT_RUNNER_TOKEN=${oneTimeToken.slice(0, 16)}…
npm run runner:agent -w @revenant/api`}
          </pre>
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
              <option value="agent">agent — self-hosted poller</option>
              <option value="ci">ci — GitHub Actions / CI job</option>
            </Select>
          </Field>
          <div className="flex items-end">
            <button
              type="submit"
              disabled={saving}
              className="rounded-md bg-brand px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              {saving ? "Creating…" : "Create & show token"}
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
            No org runners yet. Create one, or use the local stub for simulated jobs only.
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
              {runners.map((r) => (
                <tr key={r.id}>
                  <td className="px-4 py-3 font-medium text-slate-900">{r.name}</td>
                  <td className="px-4 py-3 uppercase text-slate-600">{r.kind}</td>
                  <td className="px-4 py-3 font-mono text-xs text-slate-500">
                    {r.tokenPrefix}…
                  </td>
                  <td className="px-4 py-3 text-slate-500">
                    {r.lastSeenAt ? new Date(r.lastSeenAt).toLocaleString() : "Never"}
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
              ))}
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
        title="Revoke runner?"
        description={
          revokeTarget
            ? `“${revokeTarget.name}” will stop being able to claim jobs. Create a new token if needed.`
            : ""
        }
        confirmLabel="Revoke"
        onCancel={() => !revoking && setRevokeTarget(null)}
        onConfirm={() => void confirmRevoke()}
      />
    </AppShell>
  );
}
