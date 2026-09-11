import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { AlignLeft } from "lucide-react";
import { AppShell } from "../components/AppShell";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { PaginationBar } from "../components/PaginationBar";
import { Field, Input, Select } from "../components/ui/Field";
import {
  YamlEditor,
  formatYaml,
  parseYamlChecks,
  useYamlPreview,
} from "../components/YamlEditor";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import {
  roleHasPermission,
  type DatabaseResource,
  type PaginationMeta,
  type ValidationPlanResource,
} from "../types/api";

const planFormSchema = z.object({
  databaseId: z.string().uuid("Select a database"),
  name: z.string().min(1, "Name is required").max(255),
  yamlText: z
    .string()
    .min(10, "YAML is required")
    .superRefine((val, ctx) => {
      const parsed = parseYamlChecks(val);
      if (!parsed.ok) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: parsed.error ?? "Invalid YAML" });
      }
    }),
});

type PlanFormValues = z.infer<typeof planFormSchema>;

const DEFAULT_YAML = `plan: cloud-validation
database:
  engine: postgres
  connection: \${DATABASE_URL}
checks:
  - type: connect
  - type: schema
    expect_tables:
      - customers
`;

export function ValidationPlansPage() {
  const { user } = useAuth();
  const canWrite = user ? roleHasPermission(user.role, "plans:write") : false;
  const [searchParams, setSearchParams] = useSearchParams();

  const [plans, setPlans] = useState<ValidationPlanResource[]>([]);
  const [pagination, setPagination] = useState<PaginationMeta>({
    page: 1,
    pageSize: 20,
    total: 0,
    totalPages: 1,
  });
  const [page, setPage] = useState(1);
  const [databases, setDatabases] = useState<DatabaseResource[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [formatError, setFormatError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ValidationPlanResource | null>(null);
  const [deleting, setDeleting] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    control,
    formState: { errors },
  } = useForm<PlanFormValues>({
    resolver: zodResolver(planFormSchema),
    defaultValues: {
      databaseId: searchParams.get("databaseId") ?? "",
      name: "default",
      yamlText: DEFAULT_YAML,
    },
  });

  const yamlText = watch("yamlText");
  const preview = useYamlPreview(yamlText ?? "");

  const loadPlans = useCallback(async (nextPage: number) => {
    const res = await api.listValidationPlans(nextPage, 20);
    setPlans(res.data);
    setPagination(res.pagination);
    setPage(res.pagination.page);
  }, []);

  const loadDatabases = useCallback(async () => {
    const res = await api.listDatabases(1, 100);
    setDatabases(res.data);
  }, []);

  useEffect(() => {
    setLoading(true);
    setError(null);
    Promise.all([loadPlans(page), loadDatabases()])
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load"))
      .finally(() => setLoading(false));
  }, [loadPlans, loadDatabases, page]);

  useEffect(() => {
    const id = searchParams.get("databaseId");
    if (id) setValue("databaseId", id);
  }, [searchParams, setValue]);

  async function onSave(values: PlanFormValues) {
    setSaving(true);
    setError(null);
    try {
      await api.upsertValidationPlan(values.databaseId, {
        name: values.name,
        yamlText: values.yamlText,
      });
      setSearchParams({ databaseId: values.databaseId });
      await loadPlans(page);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save plan");
    } finally {
      setSaving(false);
    }
  }

  function onFormat() {
    setFormatError(null);
    try {
      const formatted = formatYaml(yamlText ?? "");
      setValue("yamlText", formatted, { shouldValidate: true });
    } catch (err) {
      setFormatError(err instanceof Error ? err.message : "Cannot format invalid YAML");
    }
  }

  async function loadIntoEditor(plan: ValidationPlanResource) {
    reset({
      databaseId: plan.databaseId,
      name: plan.name,
      yamlText: plan.yamlText,
    });
    setSearchParams({ databaseId: plan.databaseId });
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.deleteValidationPlan(deleteTarget.databaseId);
      setDeleteTarget(null);
      await loadPlans(page);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete plan");
    } finally {
      setDeleting(false);
    }
  }

  const dbOptions = useMemo(() => databases, [databases]);

  return (
    <AppShell>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
          Validation plans
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          Edit <code className="rounded bg-slate-200 px-1 text-xs">revenant.yaml</code> with a
          real code editor (not rich text). Format before save. Agents/CI use this YAML at run time.
        </p>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.3fr)]">
        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-4 py-3 text-sm font-medium text-slate-900">
            Plans in this org
          </div>
          {loading ? (
            <div className="space-y-3 p-4">
              {[1, 2].map((i) => (
                <div key={i} className="h-10 animate-pulse rounded bg-slate-100" />
              ))}
            </div>
          ) : plans.length === 0 ? (
            <div className="px-4 py-10 text-center text-sm text-slate-500">
              No validation plans yet. Create one on the right.
            </div>
          ) : (
            <ul className="divide-y divide-slate-100">
              {plans.map((plan) => (
                <li key={plan.id} className="flex items-start justify-between gap-3 px-4 py-3">
                  <button
                    type="button"
                    onClick={() => void loadIntoEditor(plan)}
                    className="min-w-0 flex-1 text-left"
                  >
                    <div className="font-medium text-slate-900">{plan.databaseName}</div>
                    <div className="text-xs text-slate-500">
                      {plan.name} · v{plan.version} · updated{" "}
                      {new Date(plan.updatedAt).toLocaleString()}
                    </div>
                  </button>
                  {canWrite && (
                    <button
                      type="button"
                      onClick={() => setDeleteTarget(plan)}
                      className="text-xs text-red-600 hover:underline"
                    >
                      Delete
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
          {!loading && pagination.total > 0 && (
            <PaginationBar pagination={pagination} onPageChange={setPage} />
          )}
        </div>

        <form
          onSubmit={handleSubmit(onSave)}
          noValidate
          className="rounded-lg border border-slate-200 bg-white shadow-sm"
        >
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 px-4 py-3">
            <h2 className="text-sm font-semibold text-slate-900">
              {canWrite ? "Create / update plan" : "Plan editor (read-only)"}
            </h2>
            {canWrite && (
              <button
                type="button"
                onClick={onFormat}
                className="inline-flex items-center gap-1 rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
              >
                <AlignLeft size={14} />
                Format YAML
              </button>
            )}
          </div>
          <div className="space-y-4 p-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                label="Database"
                htmlFor="databaseId"
                required
                error={errors.databaseId?.message}
              >
                <Select
                  id="databaseId"
                  invalid={!!errors.databaseId}
                  disabled={!canWrite}
                  {...register("databaseId")}
                >
                  <option value="">Select database…</option>
                  {dbOptions.map((db) => (
                    <option key={db.id} value={db.id}>
                      {db.name}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Plan name" htmlFor="name" required error={errors.name?.message}>
                <Input
                  id="name"
                  invalid={!!errors.name}
                  disabled={!canWrite}
                  {...register("name")}
                />
              </Field>
            </div>

            <div>
              <div className="mb-1 text-sm font-medium text-slate-700">
                YAML <span className="text-red-500">*</span>
              </div>
              <Controller
                name="yamlText"
                control={control}
                render={({ field }) => (
                  <YamlEditor
                    value={field.value}
                    onChange={field.onChange}
                    readOnly={!canWrite}
                    height="380px"
                  />
                )}
              />
              {(errors.yamlText?.message || formatError) && (
                <p className="mt-1 text-xs text-red-600" role="alert">
                  {errors.yamlText?.message || formatError}
                </p>
              )}
              <p className="mt-1 text-xs text-slate-500">
                Same shape as local CLI <code>revenant.yaml</code>. Indentation matters.
              </p>
            </div>

            <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-3">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Parsed checks preview
              </div>
              {!preview.ok ? (
                <p className="mt-2 text-sm text-amber-800">Fix YAML to preview checks.</p>
              ) : preview.checks.length === 0 ? (
                <p className="mt-2 text-sm text-slate-600">No <code>checks</code> array found.</p>
              ) : (
                <ul className="mt-2 flex flex-wrap gap-2">
                  {preview.checks.map((c, i) => (
                    <li
                      key={`${c.type}-${i}`}
                      className="rounded-full bg-white px-2.5 py-1 text-xs font-medium text-slate-700 ring-1 ring-slate-200"
                    >
                      {c.type}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {canWrite && (
              <button
                type="submit"
                disabled={saving}
                className="rounded-md bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {saving ? "Saving…" : "Save validation plan"}
              </button>
            )}
          </div>
        </form>
      </div>

      <ConfirmDialog
        open={!!deleteTarget}
        danger
        loading={deleting}
        title="Delete validation plan?"
        description={
          deleteTarget
            ? `Remove the plan for “${deleteTarget.databaseName}”? The database connection itself will stay.`
            : ""
        }
        confirmLabel="Delete plan"
        onCancel={() => !deleting && setDeleteTarget(null)}
        onConfirm={() => void confirmDelete()}
      />
    </AppShell>
  );
}
