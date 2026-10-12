import { useEffect, useState } from "react";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, Lock } from "lucide-react";
import { AppShell } from "../components/AppShell";
import { Field, Input, SecretInput, Select, Textarea } from "../components/ui/Field";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import { roleHasPermission } from "../types/api";
import {
  databaseEditSchema,
  wizardDefaults,
  type DatabaseWizardValues,
} from "../lib/forms/database.schema";
import type { DatabaseEngine } from "../types/api";

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
  const [initialEngine, setInitialEngine] = useState<DatabaseEngine>("postgres");

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<DatabaseWizardValues>({
    resolver: zodResolver(databaseEditSchema),
    defaultValues: wizardDefaults,
    mode: "onBlur",
  });

  const recoveryMode = watch("recoveryMode");
  const engine = watch("engine");

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    api
      .getDatabase(id)
      .then(({ database }) => {
        setHasCredentials(database.hasCredentials);
        setHasAwsCredentials(database.hasAwsCredentials);
        const databaseEngine: DatabaseEngine =
          database.engine === "mongodb" ? "mongodb" : database.engine === "mysql" ? "mysql" : "postgres";
        setInitialEngine(databaseEngine);
        reset({
          name: database.name,
          description: database.description ?? "",
          engine: databaseEngine,
          recoveryMode: databaseEngine === "mongodb" ? "direct" : database.recoveryMode ?? "direct",
          connectionString: "",
          host: database.host ?? "",
          port: database.port ?? (database.engine === "mysql" ? 3306 : 5432),
          databaseName: database.databaseName ?? "",
          username: database.username ?? "",
          password: "",
          sslMode: (database.sslMode as DatabaseWizardValues["sslMode"]) || "require",
          region: database.region ?? "",
          rdsSourceIdentifier: database.rdsSourceIdentifier ?? "",
          recoveryUseFreetier: database.recoveryUseFreetier ?? true,
          recoveryDrillsEnabled: database.recoveryDrillsEnabled ?? false,
          recoverySandboxInstanceClass: database.recoverySandboxInstanceClass ?? "",
          awsAccessKeyId: "",
          awsSecretAccessKey: "",
          awsSessionToken: "",
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
      const awsSessionToken = values.awsSessionToken.trim();

      if (
        values.engine === "mongodb" &&
        !values.connectionString.trim() &&
        (initialEngine !== "mongodb" || !hasCredentials)
      ) {
        setError("Enter a MongoDB connection URI to switch this database to MongoDB.");
        setSaving(false);
        return;
      }

      if (
        values.recoveryMode === "aws-rds" &&
        !hasAwsCredentials &&
        (!awsKey || !awsSecret)
      ) {
        setError("AWS access keys are required for snapshot restore mode");
        setSaving(false);
        return;
      }

      if (values.engine === "mongodb") {
        await api.updateDatabase(id, {
          name: values.name.trim(),
          engine: "mongodb",
          recoveryMode: "direct",
          databaseName: values.databaseName.trim(),
          ...(values.connectionString.trim()
            ? { connectionString: values.connectionString.trim() }
            : {}),
          description: values.description.trim() || null,
        });
      } else {
        await api.updateDatabase(id, {
          name: values.name.trim(),
          engine: values.engine,
          recoveryMode: values.recoveryMode,
          host: values.host.trim() || null,
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
          ...(awsKey && awsSecret
            ? {
                awsAccessKeyId: awsKey,
                awsSecretAccessKey: awsSecret,
                ...(awsSessionToken ? { awsSessionToken } : {}),
              }
            : {}),
        });
      }
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
          {engine === "mongodb"
            ? "Update the MongoDB connection. Leave the URI blank to keep the current encrypted secret."
            : `Update connection metadata. Leave password blank to keep the existing encrypted secret${
                hasCredentials ? " (currently set)." : " (none stored yet)."
              }`}
          {recoveryMode === "aws-rds" &&
            (hasAwsCredentials
              ? " AWS keys are stored — enter new values only to rotate."
              : " Add AWS keys below.")}
          {engine === "mongodb" &&
            " MongoDB uses direct read-only checks; Atlas backup restore is not supported. The saved URI is never displayed."}
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

            <Field label="Database engine" htmlFor="engine" error={errors.engine?.message}>
              <Select
                id="engine"
                invalid={!!errors.engine}
                {...register("engine", {
                  onChange: (event) => {
                    const nextEngine = event.target.value as DatabaseWizardValues["engine"];
                    if (nextEngine === "mongodb") {
                      setValue("recoveryMode", "direct");
                    } else {
                      setValue("port", nextEngine === "mysql" ? 3306 : 5432);
                      setValue("connectionString", "");
                    }
                  },
                })}
              >
                <option value="postgres">PostgreSQL</option>
                <option value="mysql">MySQL</option>
                <option value="mongodb">MongoDB</option>
              </Select>
            </Field>

            <Field label="Validation mode" htmlFor="recoveryMode" error={errors.recoveryMode?.message}>
              <Select
                id="recoveryMode"
                invalid={!!errors.recoveryMode}
                {...register("recoveryMode", {
                  onChange: (event) => {
                    if (engine === "mongodb" && event.target.value === "aws-rds") {
                      setValue("recoveryMode", "direct");
                    }
                  },
                })}
              >
                <option value="direct">
                  {engine === "mongodb" ? "Direct — read-only MongoDB checks" : "Direct — connect to live database"}
                </option>
                <option value="aws-rds" disabled={engine === "mongodb"}>
                  AWS RDS — snapshot restore drill (SQL only)
                </option>
              </Select>
            </Field>

            {engine === "mongodb" && (
              <div className="sm:col-span-2 rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-950">
                <p className="font-medium">MongoDB uses direct read-only checks only</p>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-emerald-900">
                  <li>Grant read access only to the database and collections you validate.</li>
                  <li>Do not grant write, admin, backup, or restore privileges.</li>
                  <li>Allowlist Cloud’s outbound IP in Atlas to show connectivity status. Self-hosted runners also need their own network access allowed for validation jobs.</li>
                </ul>
                <p className="mt-2 text-xs">
                  Atlas backup restore and snapshot workflows are not supported for MongoDB.
                </p>
              </div>
            )}

            {engine !== "mongodb" && (
              <Field label="Region" htmlFor="region" error={errors.region?.message}>
                <Input id="region" invalid={!!errors.region} {...register("region")} />
              </Field>
            )}

            {engine === "mongodb" && (
              <>
                <Field
                  label="MongoDB database name"
                  htmlFor="databaseName"
                  required
                  hint="The actual database inside Atlas, not the display name shown in Revenant. Find it under Database → Collections."
                  error={errors.databaseName?.message}
                >
                  <Input
                    id="databaseName"
                    invalid={!!errors.databaseName}
                    placeholder="myapp"
                    {...register("databaseName")}
                  />
                </Field>
                <div className="sm:col-span-2">
                  <Field
                    label="MongoDB connection URI"
                    htmlFor="connectionString"
                    required={!hasCredentials || initialEngine !== "mongodb"}
                    hint={
                      hasCredentials && initialEngine === "mongodb"
                        ? "Leave blank to keep the current encrypted URI. Enter a new URI only to rotate it; the saved URI is never shown."
                        : "Use mongodb:// or mongodb+srv://. URI is encrypted by the backend and never returned in database details."
                    }
                    error={errors.connectionString?.message}
                  >
                    <SecretInput
                      id="connectionString"
                      invalid={!!errors.connectionString}
                      autoComplete="new-password"
                      placeholder={
                        hasCredentials && initialEngine === "mongodb"
                          ? "Stored securely — enter only to replace"
                          : "mongodb+srv://cluster.example.mongodb.net/database"
                      }
                      className="font-mono text-xs"
                      {...register("connectionString")}
                    />
                  </Field>
                </div>
              </>
            )}

            {recoveryMode === "aws-rds" && (
              <>
                <Field
                  label="RDS endpoint (host)"
                  htmlFor="host"
                  required
                  hint="AWS Console → RDS → database-1 → Endpoint. Required for full drill snapshot step."
                  error={errors.host?.message}
                >
                  <Input
                    id="host"
                    className="font-mono text-xs"
                    placeholder="database-1.xxxx.eu-west-2.rds.amazonaws.com"
                    invalid={!!errors.host}
                    {...register("host")}
                  />
                </Field>
                <Field label="Port" htmlFor="port" required error={errors.port?.message}>
                  <Input id="port" type="number" invalid={!!errors.port} {...register("port")} />
                </Field>
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

            {engine !== "mongodb" && recoveryMode === "direct" && (
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

            {engine !== "mongodb" && <Field
              label="Database name"
              htmlFor="databaseName"
              required={recoveryMode === "aws-rds"}
              error={errors.databaseName?.message}
            >
              <Input id="databaseName" invalid={!!errors.databaseName} {...register("databaseName")} />
            </Field>}
            {engine !== "mongodb" && <Field
              label="Username"
              htmlFor="username"
              required={recoveryMode === "aws-rds"}
              error={errors.username?.message}
            >
              <Input id="username" invalid={!!errors.username} {...register("username")} />
            </Field>}

            {engine !== "mongodb" && <div className="sm:col-span-2">
              <Field
                label={recoveryMode === "aws-rds" ? "RDS master password" : "Password"}
                htmlFor="password"
                hint="Leave blank to keep current encrypted password."
                error={errors.password?.message}
              >
                <SecretInput
                  id="password"
                  autoComplete="new-password"
                  placeholder={hasCredentials ? "••••••••" : ""}
                  invalid={!!errors.password}
                  {...register("password")}
                />
              </Field>
            </div>}

            {recoveryMode === "aws-rds" && (
              <div className="sm:col-span-2 rounded-lg border border-slate-200 bg-slate-50/80 p-4">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-medium text-slate-800">AWS credentials</p>
                  {hasAwsCredentials ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-800 ring-1 ring-emerald-200">
                      <Lock size={10} />
                      Keys stored — leave blank unless rotating
                    </span>
                  ) : (
                    <span className="text-xs text-amber-700">Required before your first restore drill</span>
                  )}
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field
                    label="AWS access key ID"
                    htmlFor="awsAccessKeyId"
                    required={!hasAwsCredentials}
                    hint={hasAwsCredentials ? "Optional — enter only to rotate" : undefined}
                    error={errors.awsAccessKeyId?.message}
                  >
                    <Input
                      id="awsAccessKeyId"
                      className="font-mono text-xs"
                      autoComplete="off"
                      placeholder={hasAwsCredentials ? "AKIA…" : ""}
                      invalid={!!errors.awsAccessKeyId}
                      {...register("awsAccessKeyId")}
                    />
                  </Field>
                  <Field
                    label="AWS secret access key"
                    htmlFor="awsSecretAccessKey"
                    required={!hasAwsCredentials}
                    hint={hasAwsCredentials ? "Optional — enter only to rotate" : undefined}
                    error={errors.awsSecretAccessKey?.message}
                  >
                    <SecretInput
                      id="awsSecretAccessKey"
                      className="font-mono text-xs"
                      autoComplete="new-password"
                      placeholder={hasAwsCredentials ? "••••••••" : ""}
                      invalid={!!errors.awsSecretAccessKey}
                      {...register("awsSecretAccessKey")}
                    />
                  </Field>
                  <Field
                    label="AWS session token"
                    htmlFor="awsSessionToken"
                    hint={hasAwsCredentials ? "Optional — used for temporary credentials" : "Optional for temporary IAM credentials"}
                    error={errors.awsSessionToken?.message}
                  >
                    <SecretInput
                      id="awsSessionToken"
                      className="font-mono text-xs"
                      autoComplete="off"
                      placeholder={hasAwsCredentials ? "Optional" : ""}
                      invalid={!!errors.awsSessionToken}
                      {...register("awsSessionToken")}
                    />
                  </Field>
                </div>
              </div>
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
