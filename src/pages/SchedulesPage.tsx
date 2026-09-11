import { useCallback, useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Calendar, Plus } from "lucide-react";
import { AppShell } from "../components/AppShell";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { PaginationBar } from "../components/PaginationBar";
import { Field, Input, Select } from "../components/ui/Field";
import { useToast } from "../components/toast/ToastProvider";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import {
  roleHasPermission,
  type DatabaseResource,
  type PaginationMeta,
  type ScheduleResource,
} from "../types/api";

const scheduleSchema = z.object({
  databaseId: z.string().uuid("Select a workflow"),
  name: z.string().min(1, "Name is required").max(255),
  cronExpression: z.string().min(9, "Enter a valid cron expression"),
  timezone: z.string().min(1),
  enabled: z.boolean(),
});

type ScheduleValues = z.infer<typeof scheduleSchema>;

export function SchedulesPage() {
  const { user } = useAuth();
  const toast = useToast();
  const canWrite = user ? roleHasPermission(user.role, "schedules:write") : false;

  const [schedules, setSchedules] = useState<ScheduleResource[]>([]);
  const [databases, setDatabases] = useState<DatabaseResource[]>([]);
  const [pagination, setPagination] = useState<PaginationMeta>({
    page: 1,
    pageSize: 20,
    total: 0,
    totalPages: 1,
  });
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [removeTarget, setRemoveTarget] = useState<ScheduleResource | null>(null);
  const [removing, setRemoving] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ScheduleValues>({
    resolver: zodResolver(scheduleSchema),
    defaultValues: {
      databaseId: "",
      name: "Daily validation",
      cronExpression: "0 2 * * *",
      timezone: "UTC",
      enabled: true,
    },
  });

  const load = useCallback(async (nextPage: number) => {
    setLoading(true);
    setError(null);
    try {
      const [schedRes, dbRes] = await Promise.all([
        api.listSchedules(nextPage, 20),
        api.listDatabases(1, 100),
      ]);
      setSchedules(schedRes.data);
      setPagination(schedRes.pagination);
      setPage(schedRes.pagination.page);
      setDatabases(dbRes.data.filter((d) => d.hasValidationPlan));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load schedules");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(page);
  }, [load, page]);

  async function onCreate(values: ScheduleValues) {
    setSaving(true);
    setError(null);
    try {
      await api.createSchedule(values);
      toast.success("Schedule created", `${values.name} will run on cron.`);
      reset();
      setShowForm(false);
      await load(1);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to create schedule";
      setError(message);
      toast.error("Create failed", message);
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

  const scheduledDbIds = new Set(schedules.map((s) => s.databaseId));

  return (
    <AppShell>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Schedules</h1>
          <p className="mt-1 text-sm text-slate-600">
            Cron-triggered validation runs per workflow.
          </p>
        </div>
        {canWrite && (
          <button
            type="button"
            onClick={() => setShowForm((v) => !v)}
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
          onSubmit={handleSubmit(onCreate)}
          className="mb-6 rounded-xl border border-slate-200 bg-white p-6 shadow-sm"
        >
          <h2 className="mb-4 text-lg font-medium text-slate-900">Create schedule</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Workflow" error={errors.databaseId?.message}>
              <Select {...register("databaseId")}>
                <option value="">Select workflow…</option>
                {databases
                  .filter((d) => !scheduledDbIds.has(d.id))
                  .map((d) => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
              </Select>
            </Field>
            <Field label="Name" error={errors.name?.message}>
              <Input {...register("name")} />
            </Field>
            <Field label="Cron expression" error={errors.cronExpression?.message}>
              <Input {...register("cronExpression")} placeholder="0 2 * * *" />
            </Field>
            <Field label="Timezone" error={errors.timezone?.message}>
              <Input {...register("timezone")} placeholder="UTC" />
            </Field>
          </div>
          <div className="mt-4 flex gap-2">
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              {saving ? "Saving…" : "Create"}
            </button>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-700"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50 text-left text-slate-600">
            <tr>
              <th className="px-4 py-3 font-medium">Name</th>
              <th className="px-4 py-3 font-medium">Workflow</th>
              <th className="px-4 py-3 font-medium">Cron</th>
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
                  No schedules yet. Create one to run validations on a cron.
                </td>
              </tr>
            ) : (
              schedules.map((s) => (
                <tr key={s.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium text-slate-900">{s.name}</td>
                  <td className="px-4 py-3 text-slate-600">{s.databaseName}</td>
                  <td className="px-4 py-3 font-mono text-xs text-slate-600">
                    {s.cronExpression}
                    <span className="ml-2 text-slate-400">({s.timezone})</span>
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {s.nextRunAt ? new Date(s.nextRunAt).toLocaleString() : "—"}
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
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => void toggleEnabled(s)}
                        className="mr-2 text-xs text-brand hover:underline"
                      >
                        {s.enabled ? "Pause" : "Enable"}
                      </button>
                      <button
                        type="button"
                        onClick={() => setRemoveTarget(s)}
                        className="text-xs text-red-600 hover:underline"
                      >
                        Delete
                      </button>
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
