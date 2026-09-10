import { useEffect, useState } from "react";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, Lock } from "lucide-react";
import { AppShell } from "../components/AppShell";
import { Field, Input, Select, Textarea } from "../components/ui/Field";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import { roleHasPermission } from "../types/api";
import {
  databaseWizardSchema,
  wizardDefaults,
  type DatabaseWizardValues,
} from "../lib/forms/database.schema";

export function DatabaseEditPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const canWrite = user ? roleHasPermission(user.role, "databases:write") : false;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasCredentials, setHasCredentials] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<DatabaseWizardValues>({
    resolver: zodResolver(databaseWizardSchema),
    defaultValues: wizardDefaults,
    mode: "onBlur",
  });

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    api
      .getDatabase(id)
      .then(({ database }) => {
        setHasCredentials(database.hasCredentials);
        reset({
          name: database.name,
          description: database.description ?? "",
          engine: "postgres",
          host: database.host ?? "",
          port: database.port ?? 5432,
          databaseName: database.databaseName ?? "",
          username: database.username ?? "",
          password: "",
          sslMode: (database.sslMode as DatabaseWizardValues["sslMode"]) || "require",
          region: database.region ?? "",
        });
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load"))
      .finally(() => setLoading(false));
  }, [id, reset]);

  if (!canWrite) return <Navigate to="/databases" replace />;
  if (!id) return <Navigate to="/databases" replace />;

  async function onSave(values: DatabaseWizardValues) {
    if (!id) return;
    setSaving(true);
    setError(null);
    try {
      const password = values.password.trim();
      await api.updateDatabase(id, {
        name: values.name.trim(),
        engine: "postgres",
        host: values.host.trim() || null,
        port: values.port,
        databaseName: values.databaseName.trim() || null,
        username: values.username.trim() || null,
        sslMode: values.sslMode,
        region: values.region.trim() || null,
        description: values.description.trim() || null,
        // omit password if blank → leave credentials unchanged
        ...(password ? { password } : {}),
      });
      navigate("/databases");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update");
    } finally {
      setSaving(false);
    }
  }

  return (
    <AppShell>
      <div className="mb-6">
        <Link
          to="/databases"
          className="mb-2 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800"
        >
          <ArrowLeft size={14} />
          Databases
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Edit database</h1>
        <p className="mt-1 text-sm text-slate-600">
          Update connection metadata. Leave password blank to keep the existing encrypted secret
          {hasCredentials ? " (currently set)." : " (none stored yet)."}
        </p>
      </div>

      {loading ? (
        <div className="h-40 animate-pulse rounded-lg bg-slate-200" />
      ) : (
        <form
          onSubmit={handleSubmit(onSave)}
          noValidate
          className="max-w-3xl space-y-4 rounded-lg border border-slate-200 bg-white p-5 shadow-sm"
        >
          {error && (
            <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
              {error}
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Field label="Display name" htmlFor="name" required error={errors.name?.message}>
                <Input id="name" invalid={!!errors.name} {...register("name")} />
              </Field>
            </div>
            <Field label="Host" htmlFor="host" required error={errors.host?.message}>
              <Input id="host" invalid={!!errors.host} className="font-mono text-xs" {...register("host")} />
            </Field>
            <Field label="Port" htmlFor="port" required error={errors.port?.message}>
              <Input id="port" type="number" invalid={!!errors.port} {...register("port")} />
            </Field>
            <Field
              label="Database name"
              htmlFor="databaseName"
              required
              error={errors.databaseName?.message}
            >
              <Input id="databaseName" invalid={!!errors.databaseName} {...register("databaseName")} />
            </Field>
            <Field label="Username" htmlFor="username" required error={errors.username?.message}>
              <Input id="username" invalid={!!errors.username} {...register("username")} />
            </Field>
            <div className="sm:col-span-2">
              <Field
                label="Password"
                htmlFor="password"
                hint="Leave blank to keep current encrypted password. Enter a new value to rotate."
                error={errors.password?.message}
              >
                <Input
                  id="password"
                  type="password"
                  autoComplete="new-password"
                  invalid={!!errors.password}
                  {...register("password")}
                />
              </Field>
            </div>
            <Field label="Region" htmlFor="region" error={errors.region?.message}>
              <Input id="region" invalid={!!errors.region} {...register("region")} />
            </Field>
            <Field label="SSL mode" htmlFor="sslMode" required error={errors.sslMode?.message}>
              <Select id="sslMode" invalid={!!errors.sslMode} {...register("sslMode")}>
                <option value="require">require</option>
                <option value="prefer">prefer</option>
                <option value="disable">disable</option>
              </Select>
            </Field>
            <div className="sm:col-span-2">
              <Field label="Description" htmlFor="description" error={errors.description?.message}>
                <Textarea id="description" rows={3} invalid={!!errors.description} {...register("description")} />
              </Field>
            </div>
          </div>

          <div className="flex items-center gap-3 border-t border-slate-200 pt-4">
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-md bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              <Lock size={14} />
              {saving ? "Saving…" : "Save changes"}
            </button>
            <Link to="/databases" className="text-sm text-slate-600 hover:underline">
              Cancel
            </Link>
          </div>
        </form>
      )}
    </AppShell>
  );
}
