import { useState } from "react";
import { Link, Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, ArrowRight, Lock, ShieldCheck } from "lucide-react";
import { AppShell } from "../components/AppShell";
import { WizardStepper } from "../components/WizardStepper";
import { Field, Input, SecretInput, Select, Textarea } from "../components/ui/Field";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import { roleHasPermission } from "../types/api";
import {
  databaseWizardSchema,
  stepFields,
  wizardDefaults,
  type DatabaseWizardValues,
} from "../lib/forms/database.schema";

const SAMPLE_PRESETS: Record<
  string,
  Partial<DatabaseWizardValues> & { description: string }
> = {
  "aws-freetier": {
    name: "Production RDS (sample)",
    description: "Sample AWS RDS workflow — replace instance ID, region, and AWS keys.",
    recoveryMode: "aws-rds",
    region: "eu-west-2",
    rdsSourceIdentifier: "database-1",
    recoveryUseFreetier: true,
    username: "postgres",
  },
};

export function DatabaseWizardPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const sampleId = searchParams.get("sample");
  const samplePreset = sampleId ? SAMPLE_PRESETS[sampleId] : undefined;
  const canWrite = user ? roleHasPermission(user.role, "databases:write") : false;
  const allowDirectPostgres = user?.organizationPlan !== "starter";

  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const {
    register,
    handleSubmit,
    trigger,
    getValues,
    setValue,
    watch,
    formState: { errors },
  } = useForm<DatabaseWizardValues>({
    resolver: zodResolver(databaseWizardSchema),
    defaultValues: samplePreset
      ? { ...wizardDefaults, ...samplePreset }
      : wizardDefaults,
    mode: "onBlur",
  });

  if (!canWrite) {
    return <Navigate to="/databases" replace />;
  }

  async function goNext() {
    setSubmitError(null);
    const fields = stepFields[step];
    if (fields.length > 0) {
      const ok = await trigger(fields);
      if (!ok) return;
    }
    setStep((s) => Math.min(4, s + 1) as 1 | 2 | 3 | 4);
  }

  function goBack() {
    setSubmitError(null);
    setStep((s) => Math.max(1, s - 1) as 1 | 2 | 3 | 4);
  }

  async function onCreate(values: DatabaseWizardValues) {
    setSaving(true);
    setSubmitError(null);
    try {
      const { database } = await api.createDatabase({
        name: values.name.trim(),
        engine: values.engine,
        recoveryMode: values.engine === "mongodb" ? "direct" : values.recoveryMode,
        ...(values.engine === "mongodb"
          ? {
              connectionString: values.connectionString.trim(),
              databaseName: values.databaseName.trim(),
            }
          : {
              host: values.host.trim() || undefined,
              port: values.port,
              databaseName: values.databaseName.trim() || undefined,
              username: values.username.trim() || undefined,
              password: values.password?.trim() || undefined,
              sslMode: values.sslMode,
            }),
        region: values.region?.trim() || undefined,
        rdsSourceIdentifier:
          values.recoveryMode === "aws-rds"
            ? values.rdsSourceIdentifier.trim()
            : undefined,
        recoveryUseFreetier:
          values.recoveryMode === "aws-rds" ? values.recoveryUseFreetier : undefined,
        recoveryDrillsEnabled:
          values.recoveryMode === "aws-rds" ? values.recoveryDrillsEnabled : undefined,
        recoverySandboxInstanceClass:
          values.recoveryMode === "aws-rds" && values.recoverySandboxInstanceClass.trim()
            ? values.recoverySandboxInstanceClass.trim()
            : undefined,
        awsAccessKeyId:
          values.recoveryMode === "aws-rds" ? values.awsAccessKeyId.trim() : undefined,
        awsSecretAccessKey:
          values.recoveryMode === "aws-rds"
            ? values.awsSecretAccessKey.trim()
            : undefined,
        awsSessionToken:
          values.recoveryMode === "aws-rds" && values.awsSessionToken.trim()
            ? values.awsSessionToken.trim()
            : undefined,
        description: values.description?.trim() || undefined,
      });
      if (sampleId === "aws-freetier") {
        navigate(
          `/settings/validation-plans?databaseId=${database.id}&template=aws-freetier`
        );
        return;
      }
      navigate("/databases");
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Failed to create database");
    } finally {
      setSaving(false);
    }
  }

  const values = getValues();
  const engine = watch("engine");
  const recoveryMode = watch("recoveryMode");

  return (
    <AppShell>
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <Link
            to="/databases"
            className="mb-2 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800"
          >
            <ArrowLeft size={14} />
            Databases
          </Link>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
            Add database
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Register a SQL recovery target or a MongoDB read-only validation connection.
          </p>
        </div>
      </div>

      <div className="mb-6 rounded-lg border border-slate-200 bg-white px-5 py-4 shadow-sm">
        <WizardStepper current={step} />
      </div>

      <form
        onSubmit={handleSubmit(onCreate)}
        className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]"
        noValidate
      >
        <div className="rounded-lg border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-5 py-4">
            <h2 className="text-base font-semibold text-slate-900">
              {step === 1 && "Identity"}
              {step === 2 && "Connection & credentials"}
              {step === 3 && "Validation plan"}
              {step === 4 && "Review & create"}
            </h2>
            <p className="mt-0.5 text-sm text-slate-500">
              {step === 1 && "How this database appears in your org fleet."}
              {step === 2 &&
                (engine === "mongodb"
                  ? "Direct read-only checks connect to your MongoDB using the URI you provide."
                  : recoveryMode === "aws-rds"
                    ? `AWS RDS snapshot restore drill for ${engine === "mysql" ? "MySQL" : "PostgreSQL"}.`
                    : `How Revenant reaches ${engine === "mysql" ? "MySQL" : "PostgreSQL"}. Password is optional but recommended.`)}
              {step === 3 && (engine === "mongodb"
                ? "MongoDB validation runs directly and read-only; no backup restore workflow is available."
                : "Checks will live here in the next phase — you can skip for now.")}
              {step === 4 && "Confirm details before writing to the control plane."}
            </p>
          </div>

          <div className="space-y-4 p-5">
            {step === 1 && (
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <Field
                    label="Display name"
                    htmlFor="name"
                    required
                    error={errors.name?.message}
                  >
                    <Input
                      id="name"
                      invalid={!!errors.name}
                      placeholder="Production RDS"
                      {...register("name")}
                    />
                  </Field>
                </div>
                <Field
                  label="Validation mode"
                  htmlFor="recoveryMode"
                  hint={engine === "mongodb"
                    ? "MongoDB uses direct read-only checks. Atlas backup restore is not supported."
                    : "AWS RDS snapshot restore and direct connections support PostgreSQL and MySQL."}
                  error={errors.recoveryMode?.message}
                >
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
                    {(allowDirectPostgres || engine === "mongodb") && (
                      <option value="direct">
                        {engine === "mongodb"
                          ? "Direct — read-only MongoDB checks"
                          : "Direct — connect to live database (Pro+)"}
                      </option>
                    )}
                    <option value="aws-rds" disabled={engine === "mongodb"}>
                      AWS RDS — snapshot restore drill (SQL only)
                    </option>
                  </Select>
                </Field>
                {engine === "mongodb" && (
                  <div className="sm:col-span-2 rounded-md border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-900">
                    MongoDB is checked directly in read-only mode. Revenant does not restore Atlas
                    backups or create snapshots for MongoDB.
                  </div>
                )}
                {engine !== "mongodb" && (
                  <Field
                    label="Region"
                    htmlFor="region"
                    hint={recoveryMode === "aws-rds" ? "Required — e.g. eu-west-2" : "Optional metadata"}
                    error={errors.region?.message}
                    required={recoveryMode === "aws-rds"}
                  >
                    <Input
                      id="region"
                      invalid={!!errors.region}
                      placeholder="eu-west-2"
                      {...register("region")}
                    />
                  </Field>
                )}
                <Field
                  label="Database engine"
                  htmlFor="engine"
                  hint="Choose PostgreSQL/MySQL for SQL recovery, or MongoDB for direct read-only checks."
                  error={errors.engine?.message}
                >
                  <Select
                    id="engine"
                    invalid={!!errors.engine}
                    {...register("engine", {
                      onChange: (event) => {
                        const nextEngine = event.target.value as DatabaseWizardValues["engine"];
                        if (nextEngine === "mongodb") {
                          setValue("recoveryMode", "direct");
                          setValue("connectionString", "");
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
                <div className="sm:col-span-2">
                  <Field
                    label="Description"
                    htmlFor="description"
                    error={errors.description?.message}
                  >
                    <Textarea
                      id="description"
                      rows={3}
                      invalid={!!errors.description}
                      placeholder="Main app database — nightly restore drills"
                      {...register("description")}
                    />
                  </Field>
                </div>
              </div>
            )}

            {step === 2 && engine === "mongodb" && (
              <div className="space-y-4">
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
                <Field
                  label="MongoDB connection URI"
                  htmlFor="connectionString"
                  required
                  hint="Use mongodb:// or mongodb+srv://. The URI is treated as a secret, encrypted by the backend, and never returned in database details."
                  error={errors.connectionString?.message}
                >
                  <SecretInput
                    id="connectionString"
                    invalid={!!errors.connectionString}
                    autoComplete="new-password"
                    placeholder="mongodb+srv://cluster.example.mongodb.net/database"
                    className="font-mono text-xs"
                    {...register("connectionString")}
                  />
                </Field>
                <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-950">
                  <p className="font-medium">Use a dedicated least-privilege MongoDB user</p>
                  <ul className="mt-2 list-disc space-y-1 pl-5 text-emerald-900">
                    <li>Grant read-only access only to the database and collections to validate.</li>
                    <li>Do not grant write, admin, backup, or restore privileges.</li>
                    <li>Allowlist Cloud’s outbound IP in Atlas to show connectivity status. Self-hosted runners also need their own network access allowed for validation jobs.</li>
                  </ul>
                  <p className="mt-2 text-xs">
                    Checks run directly against the live database after you create this connection;
                    no Atlas backup restore is performed.
                  </p>
                </div>
              </div>
            )}

            {step === 2 && engine !== "mongodb" && recoveryMode === "aws-rds" && (
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">
                  Jobs will find the latest RDS snapshot, restore to a temporary sandbox, run your
                  validation plan, then tear down — same as{" "}
                  <code className="rounded bg-white px-1 text-xs">revenant verify</code> in GitHub
                  Actions.
                </div>
                <Field
                  label="RDS endpoint (host)"
                  htmlFor="host"
                  required
                  hint="AWS Console → RDS → Endpoint hostname"
                  error={errors.host?.message}
                >
                  <Input
                    id="host"
                    invalid={!!errors.host}
                    placeholder="database-1.xxxx.eu-west-2.rds.amazonaws.com"
                    className="font-mono text-xs"
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
                  hint="AWS Console → RDS → Databases → DB identifier"
                  error={errors.rdsSourceIdentifier?.message}
                >
                  <Input
                    id="rdsSourceIdentifier"
                    invalid={!!errors.rdsSourceIdentifier}
                    placeholder="database-1"
                    className="font-mono text-xs"
                    {...register("rdsSourceIdentifier")}
                  />
                </Field>
                <Field
                  label="Sandbox instance class"
                  htmlFor="recoverySandboxInstanceClass"
                  hint="Leave blank to use free tier (db.t3.micro) when enabled"
                  error={errors.recoverySandboxInstanceClass?.message}
                >
                  <Input
                    id="recoverySandboxInstanceClass"
                    invalid={!!errors.recoverySandboxInstanceClass}
                    placeholder="db.t3.micro"
                    className="font-mono text-xs"
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
                    Use AWS free-tier compatible sandbox (db.t3.micro)
                  </label>
                </div>
                <div className="sm:col-span-2 rounded-md border border-amber-200 bg-amber-50 p-3">
                  <label className="flex items-start gap-2 text-sm text-slate-800">
                    <input
                      id="recoveryDrillsEnabled"
                      type="checkbox"
                      className="mt-0.5 h-4 w-4 rounded border-slate-300"
                      {...register("recoveryDrillsEnabled")}
                    />
                    <span>
                      <span className="font-medium">Allow recovery drills for this database</span>
                      <span className="mt-1 block text-xs text-slate-600">
                        A drill restores a temporary RDS instance and may create a snapshot. New databases are disabled by default; you can change this later in Recovery Operations.
                      </span>
                    </span>
                  </label>
                </div>
                <Field
                  label="RDS master username"
                  htmlFor="username"
                  required
                  hint="Used as SANDBOX_USER after restore"
                  error={errors.username?.message}
                >
                  <Input
                    id="username"
                    invalid={!!errors.username}
                    placeholder="postgres"
                    autoComplete="off"
                    {...register("username")}
                  />
                </Field>
                <Field
                  label="Database name"
                  htmlFor="databaseName"
                  required
                  hint="Used as SANDBOX_DBNAME after restore"
                  error={errors.databaseName?.message}
                >
                  <Input
                    id="databaseName"
                    invalid={!!errors.databaseName}
                    placeholder="postgres"
                    {...register("databaseName")}
                  />
                </Field>
                <div className="sm:col-span-2">
                  <Field
                    label="RDS master password"
                    htmlFor="password"
                    required
                    error={errors.password?.message}
                  >
                    <SecretInput
                      id="password"
                      invalid={!!errors.password}
                      autoComplete="new-password"
                      {...register("password")}
                    />
                  </Field>
                </div>
                <Field
                  label="AWS access key ID"
                  htmlFor="awsAccessKeyId"
                  required
                  error={errors.awsAccessKeyId?.message}
                >
                  <Input
                    id="awsAccessKeyId"
                    invalid={!!errors.awsAccessKeyId}
                    className="font-mono text-xs"
                    autoComplete="off"
                    {...register("awsAccessKeyId")}
                  />
                </Field>
                <Field
                  label="AWS secret access key"
                  htmlFor="awsSecretAccessKey"
                  required
                  error={errors.awsSecretAccessKey?.message}
                >
                  <SecretInput
                    id="awsSecretAccessKey"
                    invalid={!!errors.awsSecretAccessKey}
                    className="font-mono text-xs"
                    autoComplete="new-password"
                    {...register("awsSecretAccessKey")}
                  />
                </Field>
                <Field
                  label="AWS session token"
                  htmlFor="awsSessionToken"
                  hint="Optional for temporary IAM credentials"
                  error={errors.awsSessionToken?.message}
                >
                  <SecretInput
                    id="awsSessionToken"
                    invalid={!!errors.awsSessionToken}
                    className="font-mono text-xs"
                    autoComplete="off"
                    {...register("awsSessionToken")}
                  />
                </Field>
              </div>
            )}

            {step === 2 && engine !== "mongodb" && recoveryMode === "direct" && (
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <Field label="Host" htmlFor="host" required error={errors.host?.message}>
                    <Input
                      id="host"
                      invalid={!!errors.host}
                      placeholder="database-1.xxx.eu-west-2.rds.amazonaws.com"
                      className="font-mono text-xs"
                      {...register("host")}
                    />
                  </Field>
                </div>
                <Field label="Port" htmlFor="port" required error={errors.port?.message}>
                  <Input
                    id="port"
                    type="number"
                    invalid={!!errors.port}
                    {...register("port")}
                  />
                </Field>
                <Field
                  label="SSL mode"
                  htmlFor="sslMode"
                  required
                  error={errors.sslMode?.message}
                >
                  <Select id="sslMode" invalid={!!errors.sslMode} {...register("sslMode")}>
                    <option value="require">require</option>
                    <option value="prefer">prefer</option>
                    <option value="disable">disable</option>
                  </Select>
                </Field>
                <Field
                  label="Database name"
                  htmlFor="databaseName"
                  required
                  error={errors.databaseName?.message}
                >
                  <Input
                    id="databaseName"
                    invalid={!!errors.databaseName}
                    placeholder="myapp"
                    {...register("databaseName")}
                  />
                </Field>
                <Field
                  label="Username"
                  htmlFor="username"
                  required
                  error={errors.username?.message}
                >
                  <Input
                    id="username"
                    invalid={!!errors.username}
                    placeholder="postgres"
                    autoComplete="off"
                    {...register("username")}
                  />
                </Field>
                <div className="sm:col-span-2">
                  <Field
                    label="Password"
                    htmlFor="password"
                    hint="Optional. Encrypted with AES-256-GCM — never shown again in the UI."
                    error={errors.password?.message}
                  >
                    <SecretInput
                      id="password"
                      invalid={!!errors.password}
                      autoComplete="new-password"
                      {...register("password")}
                    />
                  </Field>
                </div>
              </div>
            )}

            {step === 3 && (
              <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-6">
                <div className="flex items-start gap-3">
                  <ShieldCheck className="mt-0.5 shrink-0 text-brand" size={22} />
                  <div>
                    <h3 className="font-medium text-slate-900">Validation plans come next</h3>
                    <p className="mt-1 text-sm text-slate-600">
                      Phase 1b will store a <code className="rounded bg-white px-1 text-xs">revenant.yaml</code>{" "}
                      per database (connect, schema, freshness, golden queries). You can create the
                      connection now and attach a plan later — nothing blocks create.
                    </p>
                    <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-slate-600">
                      <li>Visual check builder</li>
                      <li>YAML editor synced with CLI configs</li>
                      <li>Version history per plan</li>
                    </ul>
                  </div>
                </div>
              </div>
            )}

            {step === 4 && (
              <div className="space-y-4">
                <dl className="grid gap-3 sm:grid-cols-2">
                  {[
                    ["Display name", values.name],
                    [
                      "Mode",
                      engine === "mongodb"
                        ? "Direct MongoDB read-only checks"
                        : values.recoveryMode === "aws-rds"
                        ? "AWS RDS snapshot restore"
                        : `Direct ${engine === "mysql" ? "MySQL" : "PostgreSQL"}`,
                    ],
                    ["Database engine", engine === "mongodb" ? "MongoDB" : engine === "mysql" ? "MySQL" : "PostgreSQL"],
                    ["Region", values.region || "—"],
                    ...(engine === "mongodb"
                      ? [
                          ["MongoDB database", values.databaseName],
                          ["Connection URI", values.connectionString.trim() ? "Will be encrypted on save" : "—"],
                        ]
                      : values.recoveryMode === "aws-rds"
                      ? [
                          ["RDS instance", values.rdsSourceIdentifier],
                          [
                            "Recovery drills",
                            values.recoveryDrillsEnabled ? "Enabled" : "Disabled",
                          ],
                          [
                            "Free tier sandbox",
                            values.recoveryUseFreetier ? "Yes" : "No",
                          ],
                          [
                            "AWS keys",
                            values.awsAccessKeyId?.trim()
                              ? "Will be encrypted on save"
                              : "—",
                          ],
                        ]
                      : [
                          ["Host", values.host],
                          ["Port", String(values.port)],
                          ["SSL", values.sslMode],
                        ]),
                    ...(engine === "mongodb"
                      ? []
                      : [
                          ["Database", values.databaseName],
                          ["Username", values.username],
                          [
                            "Password",
                            values.password?.trim()
                              ? "Will be encrypted on save"
                              : "Not provided (can add later)",
                          ],
                        ]),
                  ].map(([k, v]) => (
                    <div
                      key={k}
                      className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2"
                    >
                      <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">
                        {k}
                      </dt>
                      <dd className="mt-0.5 break-all text-sm text-slate-900">{v || "—"}</dd>
                    </div>
                  ))}
                </dl>
                {values.description?.trim() && (
                  <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
                    <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
                      Description
                    </div>
                    <p className="mt-0.5 text-sm text-slate-900">{values.description}</p>
                  </div>
                )}
              </div>
            )}

            {submitError && (
              <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
                {submitError}
              </div>
            )}
          </div>

          <div className="flex items-center justify-between gap-3 border-t border-slate-200 px-5 py-4">
            <button
              type="button"
              onClick={goBack}
              disabled={step === 1 || saving}
              className="inline-flex items-center gap-1 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40"
            >
              <ArrowLeft size={14} />
              Back
            </button>

            {step < 4 ? (
              <button
                type="button"
                onClick={() => void goNext()}
                className="inline-flex items-center gap-1 rounded-md bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
              >
                Continue
                <ArrowRight size={14} />
              </button>
            ) : (
              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center gap-2 rounded-md bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                <Lock size={14} />
                {saving ? "Creating…" : "Create database"}
              </button>
            )}
          </div>
        </div>

        <aside className="space-y-4">
          <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <h3 className="text-sm font-semibold text-slate-900">What gets stored</h3>
            {engine === "mongodb" ? (
              <ul className="mt-3 space-y-2 text-sm text-slate-600">
                <li>Database metadata is returned without the MongoDB URI.</li>
                <li>The connection URI is a secret stored encrypted by the backend.</li>
                <li>MongoDB checks are direct and read-only; Atlas restore is not supported.</li>
              </ul>
            ) : (
              <ul className="mt-3 space-y-2 text-sm text-slate-600">
              <li>
                <span className="font-medium text-slate-800">databases</span> — host, user, region
                (metadata)
              </li>
              <li>
                <span className="font-medium text-slate-800">database_credentials</span> — ciphertext +
                iv + auth tag only
              </li>
              <li>GET APIs never return the password — only <code className="text-xs">hasCredentials</code></li>
              </ul>
            )}
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <h3 className="text-sm font-semibold text-slate-900">Roadmap on this wizard</h3>
            <ol className="mt-3 list-decimal space-y-1 pl-4 text-sm text-slate-600">
              <li className="text-emerald-700">Identity + connection (now)</li>
              <li>Validation plan YAML</li>
              <li>Schedule + first job run</li>
            </ol>
          </div>
        </aside>
      </form>
    </AppShell>
  );
}
