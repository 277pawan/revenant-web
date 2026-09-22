import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useForm, Controller, type FieldErrors } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { AlignLeft, ChevronDown, FileDown, List, Save, Wand2 } from "lucide-react";
import { AppShell } from "../components/AppShell";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { PaginationBar } from "../components/PaginationBar";
import { TableSearchBar } from "../components/TableSearchBar";
import { DatabasePlanPicker } from "../components/DatabasePlanPicker";
import { Field, Input } from "../components/ui/Field";
import {
  YamlEditor,
  formatYaml,
  parseYamlChecks,
  useYamlPreview,
} from "../components/YamlEditor";
import { ProofComposer } from "../components/ProofComposer";
import { AccordionSection } from "../components/ui/AccordionSection";
import { useToast } from "../components/toast/ToastProvider";
import { useDebouncedValue } from "../hooks/useDebouncedValue";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import {
  roleHasPermission,
  type DatabaseResource,
  type PaginationMeta,
  type ValidationPlanResource,
  type ValidationPlanTemplateResource,
  type YamlComposerStatus,
} from "../types/api";

const PAGE_SIZE = 10;

type LeftPanel = "plans" | "composer";

const planFormSchema = z.object({
  databaseId: z
    .string()
    .min(1, "Select a database")
    .uuid("Select a database"),
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
  const toast = useToast();
  const canWrite = user ? roleHasPermission(user.role, "plans:write") : false;
  const [searchParams, setSearchParams] = useSearchParams();

  const [plans, setPlans] = useState<ValidationPlanResource[]>([]);
  const [pagination, setPagination] = useState<PaginationMeta>({
    page: 1,
    pageSize: PAGE_SIZE,
    total: 0,
    totalPages: 1,
  });
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search, 300);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [formatError, setFormatError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ValidationPlanResource | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [loadingPlan, setLoadingPlan] = useState(false);
  const [leftPanel, setLeftPanel] = useState<LeftPanel>("plans");
  const [composerStatus, setComposerStatus] = useState<YamlComposerStatus | null>(null);
  const [templates, setTemplates] = useState<ValidationPlanTemplateResource[]>([]);
  const [savedPlanVersion, setSavedPlanVersion] = useState<number | null>(null);
  const [savedSnapshot, setSavedSnapshot] = useState<{
    databaseId: string;
    name: string;
    yamlText: string;
  } | null>(null);
  const initialDbLoaded = useRef(false);

  function toggleLeftPanel(panel: LeftPanel) {
    setLeftPanel((current) => (current === panel ? current : panel));
  }

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
  const planName = watch("name");
  const selectedDatabaseId = watch("databaseId");
  const preview = useYamlPreview(yamlText ?? "");

  const uniqueCheckTypes = useMemo(() => {
    if (!preview.ok) return [];
    const seen = new Set<string>();
    const types: string[] = [];
    for (const check of preview.checks) {
      if (!seen.has(check.type)) {
        seen.add(check.type);
        types.push(check.type);
      }
    }
    return types;
  }, [preview]);

  const loadPlans = useCallback(async (nextPage: number, searchTerm: string) => {
    const res = await api.listValidationPlans(
      nextPage,
      PAGE_SIZE,
      searchTerm.trim() || undefined
    );
    setPlans(res.data);
    setPagination(res.pagination);
    setPage(res.pagination.page);
  }, []);

  const loadPlanForDatabase = useCallback(
    async (databaseId: string, db?: DatabaseResource | null) => {
      setLoadingPlan(true);
      try {
        const mayExist =
          db?.hasValidationPlan ?? plans.some((p) => p.databaseId === databaseId);
        if (mayExist) {
          const res = await api.getValidationPlan(databaseId);
          const values = {
            databaseId,
            name: res.plan.name,
            yamlText: res.plan.yamlText,
          };
          reset(values);
          setSavedSnapshot(values);
          setSavedPlanVersion(res.plan.version);
          return;
        }
        const values = {
          databaseId,
          name: "default",
          yamlText: DEFAULT_YAML,
        };
        reset(values);
        setSavedSnapshot(values);
        setSavedPlanVersion(null);
      } catch (err) {
        const values = {
          databaseId,
          name: "default",
          yamlText: DEFAULT_YAML,
        };
        reset(values);
        setSavedSnapshot(values);
        setSavedPlanVersion(null);
        if (db && !db.hasValidationPlan) return;
        toast.error(
          "Could not load plan",
          err instanceof Error ? err.message : "Try again"
        );
      } finally {
        setLoadingPlan(false);
      }
    },
    [plans, reset, toast]
  );

  const isDirty =
    savedSnapshot != null &&
    (savedSnapshot.databaseId !== selectedDatabaseId ||
      savedSnapshot.name !== (planName ?? "") ||
      savedSnapshot.yamlText !== (yamlText ?? ""));

  useEffect(() => {
    void api
      .listValidationPlanTemplates()
      .then((res) => setTemplates(res.templates))
      .catch(() => setTemplates([]));
  }, []);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch]);

  useEffect(() => {
    setLoading(true);
    setError(null);
    loadPlans(page, debouncedSearch)
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load"))
      .finally(() => setLoading(false));
  }, [loadPlans, page, debouncedSearch]);

  useEffect(() => {
    if (loading || initialDbLoaded.current) return;
    const id = searchParams.get("databaseId");
    if (id) {
      initialDbLoaded.current = true;
      setValue("databaseId", id);
      void loadPlanForDatabase(id);
    }
  }, [loading, searchParams, setValue, loadPlanForDatabase]);

  async function onDatabaseChange(databaseId: string, db: DatabaseResource | null) {
    setValue("databaseId", databaseId, { shouldValidate: true });
    setSearchParams({ databaseId });
    await loadPlanForDatabase(databaseId, db);
  }

  async function onSave(values: PlanFormValues) {
    setSaving(true);
    setError(null);
    try {
      const { plan } = await api.upsertValidationPlan(values.databaseId, {
        name: values.name,
        yamlText: values.yamlText,
      });
      setSearchParams({ databaseId: values.databaseId });
      setSavedSnapshot({
        databaseId: values.databaseId,
        name: values.name,
        yamlText: values.yamlText,
      });
      setSavedPlanVersion(plan.version);
      await loadPlans(page, debouncedSearch);
      toast.success(
        "Plan saved",
        `v${plan.version} — workflow runs will use this YAML on the next drill.`
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to save plan";
      setError(message);
      toast.error("Save failed", message);
    } finally {
      setSaving(false);
    }
  }

  function onInvalid(formErrors: FieldErrors<PlanFormValues>) {
    if (formErrors.databaseId) {
      toast.error("Select a database", "Choose which database this plan applies to.");
      return;
    }
    if (formErrors.yamlText) {
      toast.error("Invalid YAML", formErrors.yamlText.message ?? "Fix YAML before saving.");
      return;
    }
    if (formErrors.name) {
      toast.error("Plan name required", formErrors.name.message ?? "Enter a plan name.");
      return;
    }
    toast.error("Cannot save", "Please fix the highlighted fields.");
  }

  async function importTemplate(templateId: string) {
    try {
      const { template } = await api.getValidationPlanTemplate(templateId);
      setValue("yamlText", template.yamlText, { shouldValidate: true });
      toast.success(
        "Template loaded in editor",
        `${template.name} — click Save plan to apply to workflow runs.`
      );
    } catch (err) {
      toast.error(
        "Import failed",
        err instanceof Error ? err.message : "Could not load template"
      );
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
      await loadPlans(page, debouncedSearch);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete plan");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <AppShell>
      <div className="mb-4">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
          Validation plans
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          Edit <code className="rounded bg-slate-200 px-1 text-xs">revenant.yaml</code> per
          workflow. Use Proof Composer on the left to generate checks from your schema.
        </p>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      )}

      <div className="grid gap-4 lg:h-[calc(100vh-9rem)] lg:grid-cols-[2fr_3fr] lg:items-stretch">
        {/* Left 40% — mutually exclusive accordions */}
        <div className="flex h-full min-h-0 flex-col gap-3">
          <AccordionSection
            open={leftPanel === "plans"}
            onToggle={() => toggleLeftPanel("plans")}
            fill={leftPanel === "plans"}
            title="Plans in this org"
            subtitle={
              loading
                ? "Loading…"
                : `${pagination.total} plan${pagination.total === 1 ? "" : "s"}`
            }
            icon={<List size={16} />}
          >
            <div className="flex h-full min-h-0 flex-col">
              <TableSearchBar
                value={search}
                onChange={setSearch}
                placeholder="Search workflow or plan name…"
                className="border-b border-slate-100 py-2"
              />
              <div className="scrollbar-thin min-h-0 flex-1 overflow-auto">
                <table className="min-w-full text-sm">
                  <thead className="sticky top-0 bg-slate-50 text-left text-xs text-slate-600">
                    <tr>
                      <th className="px-3 py-2 font-medium">Workflow</th>
                      <th className="px-3 py-2 font-medium">Plan</th>
                      <th className="px-3 py-2 font-medium">Ver</th>
                      <th className="px-3 py-2 font-medium" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {loading ? (
                      <tr>
                        <td colSpan={4} className="px-3 py-8 text-center text-slate-500">
                          Loading…
                        </td>
                      </tr>
                    ) : plans.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="px-3 py-10 text-center text-slate-500">
                          {debouncedSearch.trim()
                            ? "No plans match your search."
                            : "No plans yet — pick a database on the right."}
                        </td>
                      </tr>
                    ) : (
                      plans.map((plan) => {
                        const active = plan.databaseId === selectedDatabaseId;
                        return (
                          <tr
                            key={plan.id}
                            className={
                              active
                                ? "bg-blue-50/80"
                                : "cursor-pointer hover:bg-slate-50"
                            }
                            onClick={() => void loadIntoEditor(plan)}
                          >
                            <td className="px-3 py-2.5 font-medium text-slate-900">
                              {plan.databaseName}
                            </td>
                            <td className="px-3 py-2.5 text-slate-600">{plan.name}</td>
                            <td className="px-3 py-2.5 font-mono text-xs text-slate-500">
                              v{plan.version}
                            </td>
                            <td className="px-3 py-2.5 text-right">
                              {canWrite && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setDeleteTarget(plan);
                                  }}
                                  className="text-xs text-red-600 hover:underline"
                                >
                                  Delete
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
              {!loading && pagination.total > 0 && (
                <PaginationBar pagination={pagination} onPageChange={setPage} />
              )}
            </div>
          </AccordionSection>

          {canWrite && (
            <AccordionSection
              open={leftPanel === "composer"}
              onToggle={() => toggleLeftPanel("composer")}
              fill={leftPanel === "composer"}
              variant="composer"
              title="Proof Composer"
              subtitle="Schema in → revenant.yaml out"
              icon={<Wand2 size={16} />}
              badge={
                <span className="rounded bg-blue-50 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-brand">
                  {composerStatus?.enabled ? "ready" : "off"}
                </span>
              }
            >
              <ProofComposer
                planName={planName ?? "restore-proof"}
                onStatusChange={setComposerStatus}
                onRequestOpen={() => setLeftPanel("composer")}
                onApply={(yaml) => {
                  setValue("yamlText", yaml, { shouldValidate: true });
                  toast.success("YAML composed", "Review the editor, then save.");
                }}
              />
            </AccordionSection>
          )}
        </div>

        {/* Right 60% — YAML editor */}
        <form
          onSubmit={handleSubmit(onSave, onInvalid)}
          noValidate
          className="flex h-full min-h-[calc(100vh-9rem)] flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm lg:min-h-0"
        >
          <div className="border-b border-slate-200 bg-slate-50/60 px-5 py-4">
            <div className="mb-4 flex items-start justify-between gap-4">
              <div className="min-w-0">
                <h2 className="text-sm font-semibold text-slate-900">Plan editor</h2>
                <p className="mt-0.5 text-xs text-slate-500">
                  These checks run on each drill. Importing a template only updates the editor
                  until you save.
                </p>
                {savedPlanVersion != null && (
                  <p className="mt-1 text-xs text-slate-500">
                    Saved version:{" "}
                    <span className="font-medium text-slate-700">v{savedPlanVersion}</span>
                    {isDirty && (
                      <span className="ml-2 font-medium text-amber-700">· unsaved changes</span>
                    )}
                  </p>
                )}
              </div>
              {canWrite && (
                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-md bg-brand px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 disabled:opacity-50"
                >
                  <Save size={15} />
                  {saving ? "Saving…" : isDirty ? "Save plan" : "Saved"}
                </button>
              )}
            </div>
            <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_160px]">
              <Field
                label="Database"
                htmlFor="databaseId"
                required
                error={errors.databaseId?.message}
                hint={loadingPlan ? "Loading…" : undefined}
              >
                <Controller
                  name="databaseId"
                  control={control}
                  render={({ field }) => (
                    <DatabasePlanPicker
                      value={field.value}
                      onChange={(id, db) => void onDatabaseChange(id, db)}
                      disabled={!canWrite || loadingPlan}
                      invalid={!!errors.databaseId}
                    />
                  )}
                />
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
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-2.5">
            <div className="flex min-w-0 items-center gap-2">
              <span className="rounded border border-slate-200 bg-slate-50 px-2 py-1 font-mono text-xs font-medium text-slate-700">
                revenant.yaml
              </span>
              <span className="text-xs text-red-500">*</span>
              {!preview.ok && (
                <span className="text-xs text-amber-700">Fix YAML to preview checks</span>
              )}
            </div>
            {canWrite && (
              <div className="flex items-center gap-2">
                {templates.length > 0 && (
                  <div className="relative">
                    <FileDown
                      size={14}
                      className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400"
                    />
                    <ChevronDown
                      size={14}
                      className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-slate-400"
                    />
                    <select
                      defaultValue=""
                      onChange={(e) => {
                        const id = e.target.value;
                        if (id) void importTemplate(id);
                        e.target.value = "";
                      }}
                      aria-label="Import validation plan template"
                      className="appearance-none rounded-md border border-slate-300 bg-white py-1.5 pl-8 pr-8 text-xs font-medium text-slate-700 hover:bg-slate-50 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
                    >
                      <option value="" disabled>Import template…</option>
                      {templates.map((t) => (
                        <option key={t.id} value={t.id}>{t.name}</option>
                      ))}
                    </select>
                  </div>
                )}
                <button
                  type="button"
                  onClick={onFormat}
                  className="inline-flex items-center gap-1 rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                >
                  <AlignLeft size={14} />
                  Format
                </button>
              </div>
            )}
          </div>

          {preview.ok && uniqueCheckTypes.length > 0 && (
            <div className="border-b border-slate-100 px-5 py-2.5">
              <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                Checks in this plan
              </p>
              <div className="flex flex-wrap items-center gap-1.5">
                {uniqueCheckTypes.map((type) => (
                  <span
                    key={type}
                    className="rounded-md border border-slate-200 bg-white px-2 py-0.5 text-xs font-medium text-slate-600"
                  >
                    {type}
                  </span>
                ))}
                {preview.checks.length > uniqueCheckTypes.length && (
                  <span className="text-xs text-slate-400">
                    {preview.checks.length} checks total
                  </span>
                )}
              </div>
            </div>
          )}

          <div className="flex min-h-0 flex-1 flex-col px-5 py-3">
            <div className="min-h-0 flex-1">
              <Controller
                name="yamlText"
                control={control}
                render={({ field }) => (
                  <YamlEditor
                    value={field.value}
                    onChange={field.onChange}
                    readOnly={!canWrite}
                    height="100%"
                  />
                )}
              />
            </div>
            {(errors.yamlText?.message || formatError) && (
              <p className="mt-2 text-xs text-red-600" role="alert">
                {errors.yamlText?.message || formatError}
              </p>
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
