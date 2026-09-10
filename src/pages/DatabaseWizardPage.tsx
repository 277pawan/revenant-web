import { useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, ArrowRight, Lock, ShieldCheck } from "lucide-react";
import { AppShell } from "../components/AppShell";
import { WizardStepper } from "../components/WizardStepper";
import { Field, Input, Select, Textarea } from "../components/ui/Field";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import { roleHasPermission } from "../types/api";
import {
  databaseWizardSchema,
  stepFields,
  wizardDefaults,
  type DatabaseWizardValues,
} from "../lib/forms/database.schema";

export function DatabaseWizardPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const canWrite = user ? roleHasPermission(user.role, "databases:write") : false;

  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const {
    register,
    handleSubmit,
    trigger,
    getValues,
    formState: { errors },
  } = useForm<DatabaseWizardValues>({
    resolver: zodResolver(databaseWizardSchema),
    defaultValues: wizardDefaults,
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
      await api.createDatabase({
        name: values.name.trim(),
        engine: "postgres",
        host: values.host.trim(),
        port: values.port,
        databaseName: values.databaseName.trim(),
        username: values.username.trim(),
        password: values.password?.trim() || undefined,
        sslMode: values.sslMode,
        region: values.region?.trim() || undefined,
        description: values.description?.trim() || undefined,
      });
      navigate("/databases");
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Failed to create database");
    } finally {
      setSaving(false);
    }
  }

  const values = getValues();

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
            Register a Postgres target for restore validation. Secrets are encrypted before storage.
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
              {step === 2 && "How Revenant reaches Postgres. Password is optional but recommended."}
              {step === 3 && "Checks will live here in the next phase — you can skip for now."}
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
                  label="Region"
                  htmlFor="region"
                  hint="e.g. eu-west-2 — used for AWS restore drills later"
                  error={errors.region?.message}
                >
                  <Input
                    id="region"
                    invalid={!!errors.region}
                    placeholder="eu-west-2"
                    {...register("region")}
                  />
                </Field>
                <Field label="Engine" htmlFor="engine">
                  <Select id="engine" disabled {...register("engine")}>
                    <option value="postgres">PostgreSQL</option>
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

            {step === 2 && (
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
                    <Input
                      id="password"
                      type="password"
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
                    ["Region", values.region || "—"],
                    ["Host", values.host],
                    ["Port", String(values.port)],
                    ["Database", values.databaseName],
                    ["Username", values.username],
                    ["SSL", values.sslMode],
                    [
                      "Password",
                      values.password?.trim()
                        ? "Will be encrypted on save"
                        : "Not provided (can add later)",
                    ],
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
