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
  databaseEditSchema,
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
  const [hasAwsCredentials, setHasAwsCredentials] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors },
  } = useForm<DatabaseWizardValues>({
    resolver: zodResolver(databaseEditSchema),
    defaultValues: wizardDefaults,
    mode: "onBlur",
  });

  const recoveryMode = watch("recoveryMode");

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    api
      .getDatabase(id)
      .then(({ database }) => {
        setHasCredentials(database.hasCredentials);
        setHasAwsCredentials(database.hasAwsCredentials);
        reset({
          name: database.name,
          description: database.description ?? "",
          engine: "postgres",
          recoveryMode: database.recoveryMode ?? "direct",
          host: database.host ?? "",
          port: database.port ?? 5432,
          databaseName: database.databaseName ?? "",
          username: database.username ?? "",
          password: "",
          sslMode: (database.sslMode as DatabaseWizardValues["sslMode"]) || "require",
          region: database.region ?? "",
          rdsSourceIdentifier: database.rdsSourceIdentifier ?? "",
          recoveryUseFreetier: database.recoveryUseFreetier ?? true,
          recoverySandboxInstanceClass: database.recoverySandboxInstanceClass ?? "",
          awsAccessKeyId: "",
          awsSecretAccessKey: "",
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
      const awsKey = values.awsAccessKeyId.trim();
      const awsSecret = values.awsSecretAccessKey.trim();

      if (
        values.recoveryMode === "aws-rds" &&
        !hasAwsCredentials &&
        (!awsKey || !awsSecret)
      ) {
        setError("AWS access keys are required for snapshot restore mode");
        setSaving(false);
        return;
      }

      await api.updateDatabase(id, {
        name: values.name.trim(),
        engine: "postgres",
        recoveryMode: values.recoveryMode,
        host: values.recoveryMode === "direct" ? values.host.trim() || null : null,
        port: values.port,
        databaseName: values.databaseName.trim() || null,
        username: values.username.trim() || null,
        sslMode: values.sslMode,
        region: values.region.trim() || null,
        rdsSourceIdentifier:
          values.recoveryMode === "aws-rds" ? values.rdsSourceIdentifier.trim() : null,
        recoveryUseFreetier: values.recoveryMode === "aws-rds" ? values.recoveryUseFreetier : false,
        recoverySandboxInstanceClass:
          values.recoveryMode === "aws-rds" && values.recoverySandboxInstanceClass.trim()
            ? values.recoverySandboxInstanceClass.trim()
            : null,
        description: values.description.trim() || null,
        ...(password ? { password } : {}),
        ...(awsKey && awsSecret ? { awsAccessKeyId: awsKey, awsSecretAccessKey: awsSecret } : {}),
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
          {recoveryMode === "aws-rds" &&
            (hasAwsCredentials
              ? " AWS keys are stored — enter new values only to rotate."
              : " Add AWS keys below.")}
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

            <Field label="Validation mode" htmlFor="recoveryMode" error={errors.recoveryMode?.message}>
              <Select id="recoveryMode" invalid={!!errors.recoveryMode} {...register("recoveryMode")}>
                <option value="direct">Direct — connect to live Postgres</option>
                <option value="aws-rds">AWS RDS — snapshot restore drill</option>
              </Select>
            </Field>

            <Field label="Region" htmlFor="region" error={errors.region?.message}>
              <Input id="region" invalid={!!errors.region} {...register("region")} />
            </Field>

            {recoveryMode === "aws-rds" && (
              <>
                <Field
                  label="RDS instance identifier"
                  htmlFor="rdsSourceIdentifier"
                  required
                  error={errors.rdsSourceIdentifier?.message}
                >
                  <Input
                    id="rdsSourceIdentifier"
                    className="font-mono text-xs"
                    invalid={!!errors.rdsSourceIdentifier}
                    {...register("rdsSourceIdentifier")}
                  />
                </Field>
                <Field
                  label="Sandbox instance class"
                  htmlFor="recoverySandboxInstanceClass"
                  error={errors.recoverySandboxInstanceClass?.message}
                >
                  <Input
                    id="recoverySandboxInstanceClass"
                    className="font-mono text-xs"
                    placeholder="db.t3.micro"
                    invalid={!!errors.recoverySandboxInstanceClass}
                    {...register("recoverySandboxInstanceClass")}
                  />
                </Field>
                <div className="sm:col-span-2 flex items-center gap-2">
                  <input
                    id="recoveryUseFreetier"
                    type="checkbox"
                    className="h-4 w-4 rounded border-slate-300"
                    {...register("recoveryUseFreetier")}
                  />
                  <label htmlFor="recoveryUseFreetier" className="text-sm text-slate-700">
                    Use AWS free-tier compatible sandbox
                  </label>
                </div>
              </>
            )}

            {recoveryMode === "direct" && (
              <>
                <Field label="Host" htmlFor="host" required error={errors.host?.message}>
                  <Input
                    id="host"
                    invalid={!!errors.host}
                    className="font-mono text-xs"
                    {...register("host")}
                  />
                </Field>
                <Field label="Port" htmlFor="port" required error={errors.port?.message}>
                  <Input id="port" type="number" invalid={!!errors.port} {...register("port")} />
                </Field>
              </>
            )}

            <Field
              label="Database name"
              htmlFor="databaseName"
              required={recoveryMode === "aws-rds"}
              error={errors.databaseName?.message}
            >
              <Input id="databaseName" invalid={!!errors.databaseName} {...register("databaseName")} />
            </Field>
            <Field
              label="Username"
              htmlFor="username"
              required={recoveryMode === "aws-rds"}
              error={errors.username?.message}
            >
              <Input id="username" invalid={!!errors.username} {...register("username")} />
            </Field>

            <div className="sm:col-span-2">
              <Field
                label={recoveryMode === "aws-rds" ? "RDS master password" : "Password"}
                htmlFor="password"
                hint="Leave blank to keep current encrypted password."
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

            {recoveryMode === "aws-rds" && (
              <>
                <Field
                  label="AWS access key ID"
                  htmlFor="awsAccessKeyId"
                  hint={hasAwsCredentials ? "Leave blank to keep current keys" : "Required for restore drill"}
                  error={errors.awsAccessKeyId?.message}
                >
                  <Input
                    id="awsAccessKeyId"
                    className="font-mono text-xs"
                    autoComplete="off"
                    invalid={!!errors.awsAccessKeyId}
                    {...register("awsAccessKeyId")}
                  />
                </Field>
                <Field
                  label="AWS secret access key"
                  htmlFor="awsSecretAccessKey"
                  error={errors.awsSecretAccessKey?.message}
                >
                  <Input
                    id="awsSecretAccessKey"
                    type="password"
                    className="font-mono text-xs"
                    autoComplete="new-password"
                    invalid={!!errors.awsSecretAccessKey}
                    {...register("awsSecretAccessKey")}
                  />
                </Field>
              </>
            )}

            {recoveryMode === "direct" && (
              <Field label="SSL mode" htmlFor="sslMode" required error={errors.sslMode?.message}>
                <Select id="sslMode" invalid={!!errors.sslMode} {...register("sslMode")}>
                  <option value="require">require</option>
                  <option value="prefer">prefer</option>
                  <option value="disable">disable</option>
                </Select>
              </Field>
            )}

            <div className="sm:col-span-2">
              <Field label="Description" htmlFor="description" error={errors.description?.message}>
                <Textarea
                  id="description"
                  rows={3}
                  invalid={!!errors.description}
                  {...register("description")}
                />
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
