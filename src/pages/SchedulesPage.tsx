import { useCallback, useEffect, useMemo, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Calendar, Pause, Pencil, Play, Plus, Trash2 } from "lucide-react";
import { AppShell } from "../components/AppShell";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { DateTimeText } from "../components/DateTimeText";
import { PaginationBar } from "../components/PaginationBar";
import {
  ScheduleTimingFields,
  scheduleTimingDefaults,
} from "../components/ScheduleTimingFields";
import { TableSearchBar } from "../components/TableSearchBar";
import { WorkflowPicker } from "../components/WorkflowPicker";
import { Field, Input } from "../components/ui/Field";
import { useToast } from "../components/toast/ToastProvider";
import { useDebouncedValue } from "../hooks/useDebouncedValue";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import {
  buildCronExpression,
  describeCronExpression,
  parseCronExpression,
  suggestScheduleName,
} from "../lib/schedule";
import {
  roleHasPermission,
  type PaginationMeta,
  type ScheduleResource,
} from "../types/api";

const scheduleFormSchema = z.object({
  databaseId: z.string().uuid("Select a workflow"),
  name: z.string().min(1, "Name is required").max(255),
  frequency: z.enum(["daily", "weekly", "monthly"]),
  hour: z.number().int().min(0).max(23),
  minute: z.number().int().min(0).max(59),
  dayOfWeek: z.number().int().min(0).max(6),
  dayOfMonth: z.number().int().min(1).max(28),
  timezone: z.string().min(1, "Select a timezone"),
  enabled: z.boolean(),
});

type ScheduleFormValues = z.infer<typeof scheduleFormSchema>;

function defaultFormValues(): ScheduleFormValues {
  const timing = scheduleTimingDefaults();
  return {
    databaseId: "",
    name: suggestScheduleName(timing),
    ...timing,
    enabled: true,
  };
}

export function SchedulesPage() {
  const { user } = useAuth();
  const toast = useToast();
  const canWrite = user ? roleHasPermission(user.role, "schedules:write") : false;

  const [schedules, setSchedules] = useState<ScheduleResource[]>([]);
  const [pagination, setPagination] = useState<PaginationMeta>({
    page: 1,
    pageSize: 20,
    total: 0,
    totalPages: 1,
  });
  const [page, setPage] = useState(1);
  const [listSearch, setListSearch] = useState("");
  const debouncedListSearch = useDebouncedValue(listSearch, 250);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<ScheduleResource | null>(null);
  const [saving, setSaving] = useState(false);
  const [removeTarget, setRemoveTarget] = useState<ScheduleResource | null>(null);
  const [removing, setRemoving] = useState(false);

  const {
    register,
    handleSubmit,
    control,
    reset,
    watch,
    setValue,
    formState: { errors },
  } = useForm<ScheduleFormValues>({
    resolver: zodResolver(scheduleFormSchema),
    defaultValues: defaultFormValues(),
  });

  const load = useCallback(async (nextPage: number) => {
    setLoading(true);
    setError(null);
    try {
      const schedRes = await api.listSchedules(nextPage, 20);
      setSchedules(schedRes.data);
      setPagination(schedRes.pagination);
      setPage(schedRes.pagination.page);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load schedules");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(page);
  }, [load, page]);

  const scheduledDbIds = useMemo(
    () => schedules.map((s) => s.databaseId),
    [schedules]
  );

  const filteredSchedules = useMemo(() => {
    const q = debouncedListSearch.trim().toLowerCase();
    if (!q) return schedules;
    return schedules.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.databaseName.toLowerCase().includes(q) ||
        describeCronExpression(s.cronExpression, s.timezone).toLowerCase().includes(q)
    );
  }, [schedules, debouncedListSearch]);

  function closeForm() {
    setShowForm(false);
    setEditingSchedule(null);
    reset(defaultFormValues());
  }

  async function onSave(values: ScheduleFormValues) {
    setSaving(true);
    setError(null);
    try {
      const cronExpression = buildCronExpression({
        frequency: values.frequency,
        hour: values.hour,
        minute: values.minute,
        dayOfWeek: values.dayOfWeek,
        dayOfMonth: values.dayOfMonth,
      });

      if (editingSchedule) {
        await api.updateSchedule(editingSchedule.id, {
          name: values.name.trim(),
          cronExpression,
          timezone: values.timezone,
          enabled: values.enabled,
        });
        toast.success(
          "Schedule updated",
          describeCronExpression(cronExpression, values.timezone)
        );
      } else {
        await api.createSchedule({
          databaseId: values.databaseId,
          name: values.name.trim(),
          cronExpression,
          timezone: values.timezone,
          enabled: values.enabled,
        });
        toast.success(
          "Schedule created",
          describeCronExpression(cronExpression, values.timezone)
        );
      }

      closeForm();
      await load(editingSchedule ? page : 1);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to save schedule";
      setError(message);
      toast.error(editingSchedule ? "Update failed" : "Create failed", message);
    } finally {
      setSaving(false);
    }
  }

  async function toggleEnabled(schedule: ScheduleResource) {
    if (!canWrite) return;
    try {
      await api.updateSchedule(schedule.id, { enabled: !schedule.enabled });
      toast.success(
        schedule.enabled ? "Schedule paused" : "Schedule enabled",
        schedule.name
      );
      await load(page);
    } catch (err) {
      toast.error(
        "Update failed",
        err instanceof Error ? err.message : "Could not update schedule"
      );
    }
  }

  async function confirmRemove() {
    if (!removeTarget) return;
    setRemoving(true);
    try {
      await api.deleteSchedule(removeTarget.id);
      toast.warning("Schedule deleted", removeTarget.name);
      setRemoveTarget(null);
      await load(page);
    } catch (err) {
      toast.error(
        "Delete failed",
        err instanceof Error ? err.message : "Could not delete schedule"
      );
    } finally {
      setRemoving(false);
    }
  }

  function openCreateForm() {
    setEditingSchedule(null);
    reset(defaultFormValues());
    setShowForm(true);
  }

  function openEditForm(schedule: ScheduleResource) {
    const timing = parseCronExpression(schedule.cronExpression) ?? scheduleTimingDefaults();
    setEditingSchedule(schedule);
    reset({
      databaseId: schedule.databaseId,
      name: schedule.name,
      ...timing,
      timezone: schedule.timezone,
      enabled: schedule.enabled,
    });
    setShowForm(true);
  }

  function applySuggestedName() {
    setValue(
      "name",
      suggestScheduleName({
        frequency: watch("frequency"),
        hour: watch("hour"),
        minute: watch("minute"),
        dayOfWeek: watch("dayOfWeek"),
        dayOfMonth: watch("dayOfMonth"),
      }),
      { shouldValidate: true }
    );
  }

  return (
    <AppShell>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Schedules</h1>
          <p className="mt-1 text-sm text-slate-600">
            Automatic validation runs — pick a workflow, frequency, time, and timezone. No cron
            syntax required.
          </p>
        </div>
        {canWrite && (
          <button
            type="button"
            onClick={() => (showForm ? closeForm() : openCreateForm())}
            className="inline-flex items-center gap-2 rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand/90"
          >
            <Plus size={16} />
            New schedule
          </button>
        )}
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {showForm && canWrite && (
        <form
          onSubmit={handleSubmit(onSave)}
          className="mb-6 rounded-xl border border-slate-200 bg-white p-6 shadow-sm"
        >
          <h2 className="mb-1 text-lg font-medium text-slate-900">
            {editingSchedule ? "Edit schedule" : "Create schedule"}
          </h2>
          <p className="mb-5 text-sm text-slate-500">
            {editingSchedule
              ? "Update the name, timing, or timezone for this schedule."
              : "Search and select a workflow, then choose when it should run."}
          </p>

          <div className="grid gap-6 lg:grid-cols-2">
            <div className="space-y-4">
              {editingSchedule ? (
                <Field label="Workflow">
                  <div className="mt-1 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                    {editingSchedule.databaseName}
                  </div>
                </Field>
              ) : (
                <Field label="Workflow" required error={errors.databaseId?.message}>
                  <Controller
                    name="databaseId"
                    control={control}
                    render={({ field }) => (
                      <WorkflowPicker
                        value={field.value}
                        onChange={(id) => field.onChange(id)}
                        excludeIds={scheduledDbIds}
                        invalid={!!errors.databaseId}
                      />
                    )}
                  />
                </Field>
              )}

              <Field label="Schedule name" required error={errors.name?.message}>
                <div className="flex gap-2">
                  <Input invalid={!!errors.name} className="flex-1" {...register("name")} />
                  <button
                    type="button"
                    onClick={applySuggestedName}
                    className="shrink-0 rounded-md border border-slate-300 px-3 py-2 text-xs text-slate-600 hover:bg-slate-50"
                  >
                    Suggest
                  </button>
                </div>
              </Field>

              <Field label="Status">
                <label className="mt-1 flex cursor-pointer items-center gap-2 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    className="rounded border-slate-300 text-brand focus:ring-brand/20"
                    {...register("enabled")}
                  />
                  Schedule is active
                </label>
              </Field>
            </div>

            <ScheduleTimingFields
              values={{
                frequency: watch("frequency"),
                hour: watch("hour"),
                minute: watch("minute"),
                dayOfWeek: watch("dayOfWeek"),
                dayOfMonth: watch("dayOfMonth"),
                timezone: watch("timezone"),
              }}
              onChange={(patch) => {
                for (const [key, val] of Object.entries(patch)) {
                  setValue(key as keyof ScheduleFormValues, val as never, {
                    shouldValidate: true,
                  });
                }
              }}
              errors={{
                frequency: errors.frequency?.message,
                hour: errors.hour?.message,
                minute: errors.minute?.message,
                dayOfWeek: errors.dayOfWeek?.message,
                dayOfMonth: errors.dayOfMonth?.message,
                timezone: errors.timezone?.message,
              }}
            />
          </div>

          <div className="mt-6 flex gap-2 border-t border-slate-100 pt-4">
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              {saving ? "Saving…" : editingSchedule ? "Save changes" : "Create schedule"}
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

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <TableSearchBar
          value={listSearch}
          onChange={setListSearch}
          placeholder="Search schedules by name, workflow, or timing…"
        />
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50 text-left text-slate-600">
            <tr>
              <th className="px-4 py-3 font-medium">Name</th>
              <th className="px-4 py-3 font-medium">Workflow</th>
              <th className="px-4 py-3 font-medium">When</th>
              <th className="px-4 py-3 font-medium">Next run</th>
              <th className="px-4 py-3 font-medium">Status</th>
              {canWrite && <th className="px-4 py-3 font-medium" />}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr>
                <td colSpan={canWrite ? 6 : 5} className="px-4 py-8 text-center text-slate-500">
                  Loading…
                </td>
              </tr>
            ) : schedules.length === 0 ? (
              <tr>
                <td colSpan={canWrite ? 6 : 5} className="px-4 py-12 text-center text-slate-500">
                  <Calendar className="mx-auto mb-2 text-slate-300" size={32} />
                  No schedules yet. Create one to run validations automatically.
                </td>
              </tr>
            ) : filteredSchedules.length === 0 ? (
              <tr>
                <td colSpan={canWrite ? 6 : 5} className="px-4 py-8 text-center text-slate-500">
                  No schedules match “{debouncedListSearch.trim()}”.
                </td>
              </tr>
            ) : (
              filteredSchedules.map((s) => (
                <tr key={s.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium text-slate-900">{s.name}</td>
                  <td className="px-4 py-3 text-slate-600">{s.databaseName}</td>
                  <td className="px-4 py-3 text-slate-600">
                    {describeCronExpression(s.cronExpression, s.timezone)}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                    {s.nextRunAt ? <DateTimeText value={s.nextRunAt} /> : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                        s.enabled
                          ? "bg-emerald-100 text-emerald-800"
                          : "bg-slate-100 text-slate-600"
                      }`}
                    >
                      {s.enabled ? "Active" : "Paused"}
                    </span>
                  </td>
                  {canWrite && (
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-0.5">
                        <button
                          type="button"
                          onClick={() => openEditForm(s)}
                          className="rounded p-1.5 text-slate-600 hover:bg-slate-100"
                          title="Edit schedule"
                          aria-label="Edit schedule"
                        >
                          <Pencil size={16} />
                        </button>
                        <button
                          type="button"
                          onClick={() => void toggleEnabled(s)}
                          className="rounded p-1.5 text-slate-600 hover:bg-slate-100"
                          title={s.enabled ? "Pause schedule" : "Enable schedule"}
                          aria-label={s.enabled ? "Pause schedule" : "Enable schedule"}
                        >
                          {s.enabled ? <Pause size={16} /> : <Play size={16} />}
                        </button>
                        <button
                          type="button"
                          onClick={() => setRemoveTarget(s)}
                          className="rounded p-1.5 text-red-600 hover:bg-red-50"
                          title="Delete schedule"
                          aria-label="Delete schedule"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <PaginationBar pagination={pagination} onPageChange={setPage} />

      <ConfirmDialog
        open={!!removeTarget}
        title="Delete schedule?"
        description={`"${removeTarget?.name}" will stop running automatically.`}
        confirmLabel="Delete"
        loading={removing}
        onConfirm={() => void confirmRemove()}
        onCancel={() => setRemoveTarget(null)}
      />
    </AppShell>
  );
}
