import { useCallback, useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  AlertTriangle,
  Database,
  HardDrive,
  Loader2,
  Pencil,
  Play,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import { Link } from "react-router-dom";

import { AppShell } from "../components/AppShell";
import { PageHeader } from "../components/layout/PageHeader";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { DateTimeText } from "../components/DateTimeText";
import { TableSearchBar } from "../components/TableSearchBar";
import { WorkflowPicker } from "../components/WorkflowPicker";
import { Field, Input, Select } from "../components/ui/Field";
import { useToast } from "../components/toast/ToastProvider";
import { RedisUrlTestPanel } from "../components/redis/RedisUrlTestPanel";
import { RedisFingerprintCard } from "../components/redis/RedisFingerprintCard";
import { RedisProofHistory } from "../components/redis/RedisProofHistory";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import { useDebouncedValue } from "../hooks/useDebouncedValue";
import {
  REDIS_RETENTION_OPTIONS,
  formatRedisRetention,
  getPlanDefinition,
  redisRetentionWillBeClamped,
  resolveRedisRetentionHours,
} from "../lib/plans";
import {
  VERIFICATION_LABEL,
  VERIFICATION_TONE,
  formatNumber,
  timeUntil,
} from "../lib/redis-format";
import {
  roleHasPermission,
  type OrganizationPlan,
  type RedisProofResource,
  type RedisResource,
  type RedisSnapshotResource,
} from "../types/api";

const redisUrlSchema = z
  .string()
  .trim()
  .min(1, "Redis URL is required")
  .refine(
    (v) => v.startsWith("redis://") || v.startsWith("rediss://"),
    "Must start with redis:// or rediss://"
  );

const redisFormFields = {
  name: z.string().trim().min(1, "Name is required").max(255),
  url: redisUrlSchema,
  databaseId: z.string().uuid().or(z.literal("")).optional(),
  snapshotEnabled: z.boolean(),
  snapshotRetentionHours: z.coerce.number().int().positive().optional(),
};

const redisFormSchema = z.object(redisFormFields);
const redisEditFormSchema = redisFormSchema.extend({
  url: z
    .string()
    .trim()
    .refine(
      (v) => !v || v.startsWith("redis://") || v.startsWith("rediss://"),
      "Must start with redis:// or rediss://"
    ),
});

type RedisFormValues = z.infer<typeof redisFormSchema>;

function defaultFormValues(): RedisFormValues {
  return {
    name: "",
    url: "",
    databaseId: "",
    snapshotEnabled: false,
    snapshotRetentionHours: 24,
  };
}

export function RedisPage() {
  const { user } = useAuth();
  const toast = useToast();
  const plan = (user?.organizationPlan ?? "starter") as OrganizationPlan;
  const planLimits = getPlanDefinition(plan);

  const canRead = user ? roleHasPermission(user.role, "databases:read") : false;
  const canWrite = user ? roleHasPermission(user.role, "credentials:write") : false;
  const canRun = user ? roleHasPermission(user.role, "jobs:run") : false;

  const [resources, setResources] = useState<RedisResource[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search, 250);

  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<RedisResource | null>(null);
  const [saving, setSaving] = useState(false);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [proofs, setProofs] = useState<RedisProofResource[]>([]);
  const [snapshots, setSnapshots] = useState<RedisSnapshotResource[]>([]);
  const [proofsUsedThisMonth, setProofsUsedThisMonth] = useState(0);
  const [detailLoading, setDetailLoading] = useState(false);
  const [runningProof, setRunningProof] = useState(false);

  const [removeTarget, setRemoveTarget] = useState<RedisResource | null>(null);
  const [removing, setRemoving] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors },
  } = useForm<RedisFormValues>({
    resolver: zodResolver(editing ? redisEditFormSchema : redisFormSchema),
    defaultValues: defaultFormValues(),
  });

  const watchUrl = watch("url");
  const watchSnapshotEnabled = watch("snapshotEnabled");
  const watchRetention = watch("snapshotRetentionHours");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.listRedisResources();
      setResources(res.resources);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load Redis resources");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const loadDetail = useCallback(async (id: string) => {
    setDetailLoading(true);
    try {
      const res = await api.listRedisProofs(id);
      setProofs(res.proofs);
      setSnapshots(res.snapshots);
      setProofsUsedThisMonth(res.proofsUsedThisMonth);
    } catch (err) {
      toast.error(
        "Could not load proof history",
        err instanceof Error ? err.message : "Unexpected error"
      );
    } finally {
      setDetailLoading(false);
    }
  }, [toast]);

  // Auto-select the first resource so the detail panel is never empty on desktop.
  useEffect(() => {
    if (!selectedId && resources.length > 0) {
      setSelectedId(resources[0].id);
    }
    if (selectedId && !resources.some((r) => r.id === selectedId)) {
      setSelectedId(resources[0]?.id ?? null);
    }
  }, [resources, selectedId]);

  useEffect(() => {
    if (selectedId) void loadDetail(selectedId);
  }, [selectedId, loadDetail]);

  /**
   * Poll only while a proof is actually in flight, and only while the tab is
   * visible. A 5s interval fired unconditionally would mean a permanent
   * background request stream from every open dashboard tab — and the agent
   * was already polling the API every 5s on the server side, so the UI adds
   * nothing while idle.
   */
  useEffect(() => {
    const hasActiveProof = proofs.some((p) => p.status === "pending" || p.status === "running");
    if (!selectedId || !hasActiveProof) return;
    if (typeof document !== "undefined" && document.hidden) return;

    const timer = setInterval(() => {
      if (document.hidden) return;
      void loadDetail(selectedId);
    }, 5000);
    return () => clearInterval(timer);
  }, [selectedId, proofs, loadDetail]);

  const selected = useMemo(
    () => resources.find((r) => r.id === selectedId) ?? null,
    [resources, selectedId]
  );

  const filtered = useMemo(() => {
    const q = debouncedSearch.trim().toLowerCase();
    if (!q) return resources;
    return resources.filter(
      (r) =>
        r.name.toLowerCase().includes(q) ||
        `${r.host}:${r.port}`.toLowerCase().includes(q) ||
        (r.engineVersion ?? "").toLowerCase().includes(q)
    );
  }, [resources, debouncedSearch]);

  function closeForm() {
    setShowForm(false);
    setEditing(null);
    reset(defaultFormValues());
  }

  function openCreate() {
    setEditing(null);
    reset({
      ...defaultFormValues(),
      snapshotRetentionHours: resolveRedisRetentionHours(plan, 24),
    });
    setShowForm(true);
  }

  function openEdit(resource: RedisResource) {
    setEditing(resource);
    reset({
      name: resource.name,
      // The URL is never returned by the API, so we leave it blank and only
      // overwrite it if the user actually types a new one.
      url: "",
      databaseId: resource.databaseId ?? "",
      snapshotEnabled: resource.snapshotEnabled,
      snapshotRetentionHours:
        resource.snapshotRetentionHours ??
        resolveRedisRetentionHours(plan, 24),
    });
    setShowForm(true);
  }

  async function onSave(values: RedisFormValues) {
    setSaving(true);
    setError(null);
    try {
      const snapshotEnabled = values.snapshotEnabled;
      const retentionHours = snapshotEnabled
        ? resolveRedisRetentionHours(plan, values.snapshotRetentionHours)
        : null;

      if (editing) {
        // Only send url when the user typed one — a blank field must not wipe
        // stored credentials.
        const body: Parameters<typeof api.updateRedisResource>[1] = {
          name: values.name.trim(),
          databaseId: values.databaseId || null,
          snapshotEnabled,
          snapshotRetentionHours: retentionHours,
        };
        if (values.url.trim()) body.url = values.url.trim();

        await api.updateRedisResource(editing.id, body);
        toast.success(
          "Redis updated",
          snapshotEnabled
            ? `Snapshots will be kept for ${formatRedisRetention(retentionHours)}`
            : "Snapshot storage is off — verify only, nothing stored"
        );
      } else {
        await api.createRedisResource({
          name: values.name.trim(),
          url: values.url.trim(),
          databaseId: values.databaseId || null,
          snapshotEnabled,
          snapshotRetentionHours: retentionHours,
        });
        toast.success(
          "Redis added",
          snapshotEnabled
            ? `Snapshots kept for ${formatRedisRetention(retentionHours)}`
            : "Verify-only — enable snapshot storage whenever you want"
        );
      }

      closeForm();
      await load();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to save Redis resource";
      setError(message);
      toast.error("Save failed", message);
    } finally {
      setSaving(false);
    }
  }

  async function runProof(resource: RedisResource) {
    setRunningProof(true);
    try {
      await api.startRedisProof(resource.id, {});
      toast.success(
        "Proof queued",
        "Revenant's cloud runner picks it up automatically — the restore checks appear below, usually within a few seconds."
      );
      await loadDetail(resource.id);
      await load();
    } catch (err) {
      toast.error(
        "Could not start proof",
        err instanceof Error ? err.message : "Unexpected error"
      );
    } finally {
      setRunningProof(false);
    }
  }

  async function toggleSnapshotStorage(resource: RedisResource) {
    const next = !resource.snapshotEnabled;
    try {
      await api.updateRedisResource(resource.id, {
        snapshotEnabled: next,
        snapshotRetentionHours: next
          ? resolveRedisRetentionHours(plan, resource.snapshotRetentionHours ?? 24)
          : null,
      });
      toast.success(
        next ? "Snapshot storage enabled" : "Snapshot storage disabled",
        next
          ? `Artifacts are hard-deleted after ${formatRedisRetention(
              resource.snapshotRetentionHours ??
                resolveRedisRetentionHours(plan, 24)
            )}`
          : "Existing artifacts were deleted"
      );
      await load();
      await loadDetail(resource.id);
    } catch (err) {
      toast.error(
        "Update failed",
        err instanceof Error ? err.message : "Could not update Redis resource"
      );
    }
  }

  async function confirmRemove() {
    if (!removeTarget) return;
    setRemoving(true);
    try {
      await api.deleteRedisResource(removeTarget.id);
      toast.warning(
        "Redis deleted",
        "Credentials, proofs and any stored snapshots were removed"
      );
      setRemoveTarget(null);
      await load();
    } catch (err) {
      toast.error(
        "Delete failed",
        err instanceof Error ? err.message : "Could not delete Redis resource"
      );
    } finally {
      setRemoving(false);
    }
  }

  async function deleteSnapshot(snapshotId: string) {
    try {
      await api.deleteRedisSnapshot(snapshotId);
      toast.success("Snapshot deleted", "The stored artifact was removed immediately");
      if (selectedId) await loadDetail(selectedId);
      await load();
    } catch (err) {
      toast.error(
        "Delete failed",
        err instanceof Error ? err.message : "Could not delete snapshot"
      );
    }
  }

  // ─── plan gate ───────────────────────────────────────────────────────────

  if (planLimits.redisResources === 0) {
    return (
      <AppShell>
        <PageHeader
          title="Redis"
          description="Prove that a Redis backup actually restores."
        />
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-8 text-center">
          <HardDrive className="mx-auto mb-3 text-amber-600" size={32} />
          <h2 className="text-lg font-medium text-amber-900">
            Redis restore proofs are available on Starter and Pro
          </h2>
          <p className="mx-auto mt-2 max-w-lg text-sm text-amber-800">
            Create and run Redis restore proofs from this page with a supported plan.
            Revenant creates the proof record, runs its built-in restore checks, and
            shows the results here. No proof file or validation script is required.
          </p>
          <p className="mt-4 text-sm text-amber-800">
            <a
              href="/settings/billing"
              className="font-medium underline underline-offset-2"
            >
              View plans and billing
            </a>{" "}
            to enable Redis resources for this organization.
          </p>
        </div>
      </AppShell>
    );
  }

  const atLimit =
    planLimits.redisResources != null && resources.length >= planLimits.redisResources;
  const proofLimit = planLimits.redisRestoreProofsPerMonth;

  return (
    <AppShell>
      <PageHeader
        title="Redis"
        description="Your cache keeps its RDB on the same disk that fails. Prove it still restores."
      >
        {canWrite && (
          <button
            type="button"
            onClick={() => (showForm ? closeForm() : openCreate())}
            className="inline-flex items-center gap-2 rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand/90"
          >
            <Plus size={16} />
            Add Redis
          </button>
        )}
      </PageHeader>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white px-4 py-3">
        <p className="text-sm text-slate-600">
          Revenant creates the proof and records each restore check here. No proof file
          or script is needed.
        </p>
        <Link
          to="/redis/guide"
          className="shrink-0 text-sm font-medium text-brand underline"
        >
          Redis proof guide
        </Link>
      </div>

      {error && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
          <button
            type="button"
            onClick={() => void load()}
            disabled={loading}
            className="inline-flex shrink-0 items-center gap-1 rounded-md border border-red-300 bg-white px-2.5 py-1.5 text-xs font-medium text-red-800 disabled:opacity-50"
          >
            <Loader2 size={13} className={loading ? "animate-spin" : undefined} />
            Retry
          </button>
        </div>
      )}

      {showForm && canWrite && (
        <form
          onSubmit={handleSubmit(onSave)}
          className="mb-6 rounded-xl border border-slate-200 bg-white p-6 shadow-sm"
        >
          <h2 className="mb-1 text-lg font-medium text-slate-900">
            {editing ? "Edit Redis" : "Add a Redis instance"}
          </h2>
          <p className="mb-5 text-sm text-slate-500">
            {editing
              ? "Leave the URL blank to keep the stored connection string."
              : "Test the URL first — nothing is saved until you click the button at the bottom."}
          </p>

          <div className="space-y-5">
            <Field label="Name" required error={errors.name?.message}>
              <Input
                placeholder="cache-prod"
                invalid={!!errors.name}
                {...register("name")}
              />
            </Field>

            {(!editing || watchUrl.trim().length > 0) && (
              <RedisUrlTestPanel
                value={watchUrl}
                error={errors.url?.message}
                required={!editing}
                onChange={(v) => setValue("url", v, { shouldValidate: true })}
              />
            )}
            {editing && watchUrl.trim().length === 0 && (
              <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                Connection string unchanged.{" "}
                <button
                  type="button"
                  onClick={() => setValue("url", "redis://")}
                  className="font-medium text-brand underline"
                >
                  Replace it
                </button>
              </div>
            )}

            <Field
              label="Attach to a workflow (optional)"
              hint="Links this cache to a workflow's recovery system. It can also stand alone."
            >
              <WorkflowPicker
                value={watch("databaseId") ?? ""}
                onChange={(id) => setValue("databaseId", id)}
              />
            </Field>

            <div className="rounded-lg border border-slate-200 p-4">
              <label className="flex cursor-pointer items-start gap-3">
                <input
                  type="checkbox"
                  className="mt-0.5 rounded border-slate-300 text-brand focus:ring-brand/20"
                  {...register("snapshotEnabled")}
                />
                <span className="min-w-0">
                  <span className="block text-sm font-medium text-slate-900">
                    Keep a compressed snapshot in Revenant storage
                  </span>
                  <span className="mt-0.5 block text-xs text-slate-500">
                    Off by default. When off, Revenant verifies your backup and stores
                    nothing. When on, each artifact is hard-deleted at its expiry.
                  </span>
                </span>
              </label>

              {watchSnapshotEnabled && editing && (
                <p className="mt-3 border-t border-slate-100 pt-3 text-xs text-slate-500">
                  The current retention policy is{" "}
                  {formatRedisRetention(
                    editing.snapshotRetentionHours ??
                      resolveRedisRetentionHours(plan, 24)
                  )}
                  . Snapshot expiry is fixed at capture; editing this Redis does not
                  change existing snapshots&apos; expiry times.
                </p>
              )}

              {watchSnapshotEnabled && !editing && (
                <div className="mt-4 border-t border-slate-100 pt-4">
                  <Field
                    label="Retention window (TTL)"
                    error={errors.snapshotRetentionHours?.message}
                    hint="Every stored snapshot is deleted automatically at this deadline. There is no keep-forever option."
                  >
                    <Select {...register("snapshotRetentionHours")}>
                      {REDIS_RETENTION_OPTIONS.filter(
                        (o) =>
                          planLimits.redisSnapshotRetentionHours == null ||
                          o.hours <= planLimits.redisSnapshotRetentionHours
                      ).map((o) => (
                        <option key={o.hours} value={o.hours}>
                          {o.label}
                        </option>
                      ))}
                    </Select>
                  </Field>

                  {redisRetentionWillBeClamped(plan, watchRetention) && (
                    <p className="mt-2 flex items-start gap-2 rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800">
                      <AlertTriangle size={14} className="mt-0.5 shrink-0" />
                      <span>
                        Your {planLimits.name} plan caps this at{" "}
                        {formatRedisRetention(planLimits.redisSnapshotRetentionHours)}.
                        We will store it for{" "}
                        {formatRedisRetention(resolveRedisRetentionHours(plan, watchRetention))}{" "}
                        instead — Pro allows{" "}
                        {formatRedisRetention(
                          getPlanDefinition("pro").redisSnapshotRetentionHours
                        )}
                        .
                      </span>
                    </p>
                  )}

                  {!planLimits.redisSnapshotEnabled && (
                    <p className="mt-2 rounded-md bg-red-50 px-3 py-2 text-xs text-red-800">
                      Snapshot storage is not included in your plan. You can still run
                      unlimited restore proofs.
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="mt-6 flex gap-2 border-t border-slate-100 pt-4">
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              {saving && <Loader2 size={14} className="animate-spin" />}
              {saving ? "Saving…" : editing ? "Save changes" : "Add Redis"}
            </button>
            <button
              type="button"
              onClick={closeForm}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-700"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      <div className="grid min-w-0 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        {/* ─── list ─────────────────────────────────────────────────────── */}
        <div className="min-w-0 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <TableSearchBar
            value={search}
            onChange={setSearch}
            placeholder="Search Redis by name, host, or version…"
          />

          <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50 px-4 py-2 text-xs text-slate-600">
            <span>
              {resources.length}
              {planLimits.redisResources != null
                ? ` of ${planLimits.redisResources} used`
                : " registered"}
            </span>
            {proofLimit != null && (
              <span className={proofsUsedThisMonth >= proofLimit ? "text-amber-700" : undefined}>
                {proofsUsedThisMonth}/{proofLimit} proof{proofLimit === 1 ? "" : "s"} this month
              </span>
            )}
          </div>

          {loading ? (
            <p className="px-4 py-8 text-center text-sm text-slate-500">Loading…</p>
          ) : filtered.length === 0 ? (
            <div className="px-4 py-14 text-center">
              <HardDrive className="mx-auto mb-2 text-slate-300" size={32} />
              <p className="font-medium text-slate-800">
                {resources.length === 0 ? "No Redis instances yet" : "No matches"}
              </p>
              <p className="mx-auto mt-1 max-w-sm text-sm text-slate-500">
                {resources.length === 0
                  ? "Paste a Redis URL, test it, and Revenant will prove the backup restores."
                  : `Nothing matches “${debouncedSearch.trim()}”.`}
              </p>
              {canWrite && resources.length === 0 && !atLimit && (
                <button
                  type="button"
                  onClick={openCreate}
                  className="mt-4 inline-flex items-center gap-2 rounded-lg bg-brand px-3 py-2 text-sm font-medium text-white hover:bg-brand/90"
                >
                  <Plus size={16} />
                  Add Redis
                </button>
              )}
            </div>
          ) : (
            <ul className="divide-y divide-slate-100">
              {filtered.map((r) => (
                <li
                  key={r.id}
                  onClick={() => setSelectedId(r.id)}
                  className={`min-w-0 cursor-pointer p-4 hover:bg-slate-50 ${
                    selectedId === r.id ? "bg-brand/5" : ""
                  }`}
                >
                  <div className="min-w-0">
                    <p className="break-words font-medium text-slate-900">{r.name}</p>
                    <p className="break-all font-mono text-xs text-slate-500">
                      {r.host}:{r.port}/{r.dbIndex}
                      {r.tls ? " · TLS" : ""}
                    </p>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                    <span className="text-slate-500">
                      {formatNumber(r.fingerprint?.totalKeys ?? null)} keys
                    </span>
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 font-medium ${
                        VERIFICATION_TONE[r.lastVerificationStatus]
                      }`}
                    >
                      {VERIFICATION_LABEL[r.lastVerificationStatus]}
                    </span>
                    <span className="text-slate-500">
                      Snapshots:{" "}
                      {r.snapshotEnabled
                        ? formatRedisRetention(r.snapshotRetentionHours)
                        : "off"}
                    </span>
                  </div>
                  {(canWrite || canRun) && (
                    <div
                      className="mt-3 flex flex-wrap items-center gap-1"
                      onClick={(event) => event.stopPropagation()}
                    >
                      {canRun && (
                        <button
                          type="button"
                          onClick={() => void runProof(r)}
                          disabled={runningProof}
                          title="Create and run a restore proof"
                          className="inline-flex items-center gap-1 rounded-md bg-brand px-2.5 py-1.5 text-xs font-medium text-white hover:bg-brand/90 disabled:opacity-50"
                        >
                          <Play size={13} />
                          Run proof
                        </button>
                      )}
                      {canWrite && (
                        <>
                          <button
                            type="button"
                            onClick={() => void toggleSnapshotStorage(r)}
                            title={
                              r.snapshotEnabled
                                ? "Disable snapshot storage"
                                : "Enable snapshot storage"
                            }
                            aria-label={`Toggle snapshot storage for ${r.name}`}
                            className={`rounded p-1.5 hover:bg-slate-100 ${
                              r.snapshotEnabled ? "text-brand" : "text-slate-500"
                            }`}
                          >
                            <HardDrive size={15} />
                          </button>
                          <button
                            type="button"
                            onClick={() => openEdit(r)}
                            title="Edit Redis"
                            aria-label={`Edit ${r.name}`}
                            className="rounded p-1.5 text-slate-500 hover:bg-slate-100"
                          >
                            <Pencil size={15} />
                          </button>
                          <button
                            type="button"
                            onClick={() => setRemoveTarget(r)}
                            title="Delete Redis"
                            aria-label={`Delete ${r.name}`}
                            className="rounded p-1.5 text-red-600 hover:bg-red-50"
                          >
                            <Trash2 size={15} />
                          </button>
                        </>
                      )}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* ─── detail ───────────────────────────────────────────────────── */}
        <div className="space-y-4">
          {!selected ? (
            <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-500">
              Select a Redis instance to see its fingerprint, proofs, and snapshots.
            </div>
          ) : (
            <>
              <div className="min-w-0 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="mb-3 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="truncate text-lg font-medium text-slate-900">
                      {selected.name}
                    </h2>
                    <p className="font-mono text-xs text-slate-500">
                      {selected.host}:{selected.port}/{selected.dbIndex}
                      {selected.tls ? " · TLS" : ""}
                      {selected.engineVersion ? ` · Redis ${selected.engineVersion}` : ""}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedId(null)}
                    className="rounded p-1 text-slate-400 hover:bg-slate-100"
                    aria-label="Close details"
                  >
                    <X size={16} />
                  </button>
                </div>

                {canRun && (
                  <button
                    type="button"
                    onClick={() => void runProof(selected)}
                    disabled={runningProof}
                    className="inline-flex items-center gap-2 rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand/90 disabled:opacity-50"
                  >
                    {runningProof ? (
                      <Loader2 size={16} className="animate-spin" />
                    ) : (
                      <Play size={16} />
                    )}
                    {runningProof ? "Creating proof…" : "Create & run restore proof"}
                  </button>
                )}
                <Link
                  to="/redis/guide"
                  className="ml-3 inline-block text-sm font-medium text-brand underline"
                >
                  How restore proofs work
                </Link>
              </div>

              <RedisFingerprintCard resource={selected} />

              <RedisProofHistory
                resource={selected}
                proofs={proofs}
                snapshots={snapshots}
                loading={detailLoading}
                canDelete={canWrite}
                onDeleteSnapshot={(id) => void deleteSnapshot(id)}
                onRefresh={() => void loadDetail(selected.id)}
              />
            </>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={!!removeTarget}
        title="Delete this Redis?"
        description={`"${removeTarget?.name}" and all its credentials, proofs and stored snapshots will be permanently removed.`}
        confirmLabel="Delete"
        loading={removing}
        onConfirm={() => void confirmRemove()}
        onCancel={() => setRemoveTarget(null)}
      />

      {!canRead && (
        <p className="mt-4 text-sm text-slate-500">
          Your role does not include read access to Redis resources.
        </p>
      )}

      <p className="mt-6 text-xs text-slate-400">
        <Database size={12} className="mr-1 inline" />
        Redis bytes never enter the control-plane database. Only metadata — keyspace
        counts, config flags and SHA-256 digests — is stored here.
      </p>
    </AppShell>
  );
}