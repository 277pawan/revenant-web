import { useCallback, useEffect, useState } from "react";
import { Plus, Webhook, ArrowLeft } from "lucide-react";
import { AppShell } from "../components/AppShell";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { CustomHttpGuide } from "../components/CustomHttpGuide";
import { IntegrationProviderIcon } from "../components/IntegrationProviderIcon";
import { PaginationBar } from "../components/PaginationBar";
import { WebhookEventPicker } from "../components/WebhookEventPicker";
import { Field, Input } from "../components/ui/Field";
import { useToast } from "../components/toast/ToastProvider";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import {
  INTEGRATION_PROVIDERS,
  configSummary,
  providerLabel,
} from "../lib/integrations";
import type { WebhookEventType } from "../lib/webhook-events";
import {
  roleHasPermission,
  type PaginationMeta,
  type WebhookEndpointResource,
  type WebhookProvider,
} from "../types/api";

type FormStep = "list" | "pick-provider" | "configure";

export function WebhooksPage() {
  const { user } = useAuth();
  const toast = useToast();
  const canWrite = user ? roleHasPermission(user.role, "webhooks:write") : false;

  const [endpoints, setEndpoints] = useState<WebhookEndpointResource[]>([]);
  const [pagination, setPagination] = useState<PaginationMeta>({
    page: 1,
    pageSize: 20,
    total: 0,
    totalPages: 1,
  });
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<FormStep>("list");
  const [selectedProvider, setSelectedProvider] = useState<WebhookProvider | null>(null);
  const [name, setName] = useState("");
  const [slackUrl, setSlackUrl] = useState("");
  const [httpUrl, setHttpUrl] = useState("");
  const [smtpUser, setSmtpUser] = useState("");
  const [smtpPassword, setSmtpPassword] = useState("");
  const [emailRecipients, setEmailRecipients] = useState("");
  const [events, setEvents] = useState<WebhookEventType[]>(["job.pass", "job.fail"]);
  const [saving, setSaving] = useState(false);
  const [newSecret, setNewSecret] = useState<string | null>(null);
  const [removeTarget, setRemoveTarget] = useState<WebhookEndpointResource | null>(null);
  const [removing, setRemoving] = useState(false);

  const load = useCallback(async (nextPage: number) => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.listWebhooks(nextPage, 20);
      setEndpoints(res.data);
      setPagination(res.pagination);
      setPage(res.pagination.page);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load integrations");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(page);
  }, [load, page]);

  function resetForm() {
    setSelectedProvider(null);
    setName("");
    setSlackUrl("");
    setHttpUrl("");
    setSmtpUser("");
    setSmtpPassword("");
    setEmailRecipients("");
    setEvents(["job.pass", "job.fail"]);
    setStep("list");
  }

  function startCreate() {
    resetForm();
    setStep("pick-provider");
  }

  async function onCreate() {
    if (!selectedProvider) return;
    setSaving(true);
    setError(null);

    try {
      let config: Record<string, unknown>;
      switch (selectedProvider) {
        case "slack":
          config = { webhookUrl: slackUrl };
          break;
        case "email":
          config = {
            smtpUser,
            smtpPassword,
            smtpHost: "smtp.gmail.com",
            smtpPort: 587,
            recipients: emailRecipients
              .split(",")
              .map((e) => e.trim())
              .filter(Boolean),
          };
          break;
        case "http":
          config = { url: httpUrl };
          break;
        default:
          throw new Error("Unknown provider");
      }

      const res = await api.createWebhook({
        name: name || providerLabel(selectedProvider),
        provider: selectedProvider,
        config: config as never,
        events,
        enabled: true,
      });

      if (res.secret) {
        setNewSecret(res.secret);
      }
      toast.success(
        "Integration connected",
        `${providerLabel(selectedProvider)} will receive alerts for selected events.`
      );
      resetForm();
      await load(1);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to connect";
      setError(message);
      toast.error("Setup failed", message);
    } finally {
      setSaving(false);
    }
  }

  async function confirmRemove() {
    if (!removeTarget) return;
    setRemoving(true);
    try {
      await api.deleteWebhook(removeTarget.id);
      toast.warning("Integration removed", removeTarget.name);
      setRemoveTarget(null);
      await load(page);
    } catch (err) {
      toast.error(
        "Remove failed",
        err instanceof Error ? err.message : "Could not remove"
      );
    } finally {
      setRemoving(false);
    }
  }

  const providerMeta = INTEGRATION_PROVIDERS.find((p) => p.id === selectedProvider);

  return (
    <AppShell>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold text-slate-900 sm:text-2xl">Integrations</h1>
          <p className="mt-1 text-sm text-slate-600">
            Slack, Gmail/email, or custom HTTP when jobs finish.
          </p>
        </div>
        {canWrite && step === "list" && (
          <button
            type="button"
            onClick={startCreate}
            className="inline-flex w-full shrink-0 items-center justify-center gap-2 rounded-lg bg-brand px-4 py-2.5 text-sm font-medium text-white hover:bg-brand/90 sm:w-auto"
          >
            <Plus size={16} />
            Add integration
          </button>
        )}
      </div>

      {newSecret && (
        <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-3 text-sm text-amber-900 sm:px-4">
          <strong>HTTP signing secret (copy now):</strong>
          <code className="mt-1 block break-all font-mono text-[11px] sm:text-xs">{newSecret}</code>
          <p className="mt-2 text-xs text-amber-800">
            Verify <code>X-Revenant-Signature</code> on your server with HMAC-SHA256.
          </p>
          <button type="button" onClick={() => setNewSecret(null)} className="mt-2 text-xs underline">
            Dismiss
          </button>
        </div>
      )}

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-3 text-sm text-red-700 sm:px-4">
          {error}
        </div>
      )}

      {step === "pick-provider" && (
        <div className="mb-6">
          <button
            type="button"
            onClick={() => setStep("list")}
            className="mb-4 inline-flex items-center gap-1 text-sm text-slate-600 hover:text-slate-900"
          >
            <ArrowLeft size={14} /> Back
          </button>
          <h2 className="mb-3 text-lg font-medium text-slate-900">Choose an integration</h2>
          <div className="grid grid-cols-1 gap-3 xs:grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
            {INTEGRATION_PROVIDERS.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => {
                  setSelectedProvider(p.id);
                  setName(p.name);
                  setStep("configure");
                }}
                className="flex items-start gap-3 rounded-xl border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:border-brand hover:shadow-md active:scale-[0.99]"
              >
                <IntegrationProviderIcon provider={p.id} size={44} />
                <div className="min-w-0 flex-1">
                  <div className="font-medium text-slate-900">{p.name}</div>
                  <p className="mt-1 text-xs leading-relaxed text-slate-500">{p.description}</p>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {step === "configure" && selectedProvider && providerMeta && (
        <div className="mb-6 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
          <button
            type="button"
            onClick={() => setStep("pick-provider")}
            className="mb-4 inline-flex items-center gap-1 text-sm text-slate-600 hover:text-slate-900"
          >
            <ArrowLeft size={14} /> Change integration
          </button>
          <div className="mb-4 flex items-center gap-3">
            <IntegrationProviderIcon provider={selectedProvider} size={48} />
            <div>
              <h2 className="text-lg font-medium text-slate-900">
                Connect {providerMeta.name}
              </h2>
              <p className="text-sm text-slate-500">{providerMeta.setupHint}</p>
            </div>
          </div>

          {selectedProvider === "http" && (
            <div className="mb-4">
              <CustomHttpGuide />
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Display name">
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </Field>

            {selectedProvider === "slack" && (
              <div className="sm:col-span-2">
                <Field label="Slack Incoming Webhook URL">
                  <Input
                    value={slackUrl}
                    onChange={(e) => setSlackUrl(e.target.value)}
                    placeholder="https://hooks.slack.com/services/..."
                    className="font-mono text-xs sm:text-sm"
                  />
                </Field>
              </div>
            )}

            {selectedProvider === "email" && (
              <div className="sm:col-span-2 space-y-4">
                <Field label="Gmail address (sends from this account)">
                  <Input
                    type="email"
                    value={smtpUser}
                    onChange={(e) => setSmtpUser(e.target.value)}
                    placeholder="you@gmail.com"
                    autoComplete="email"
                  />
                </Field>
                <Field label="Gmail App Password">
                  <Input
                    type="password"
                    value={smtpPassword}
                    onChange={(e) => setSmtpPassword(e.target.value)}
                    placeholder="16-character app password"
                    autoComplete="new-password"
                  />
                </Field>
                <p className="text-xs leading-relaxed text-slate-500">
                  Google Account → Security → 2-Step Verification → App passwords.
                  Create one for &quot;Mail&quot;. Stored encrypted — never shown again.
                </p>
                <Field label="Notify these addresses (comma-separated)">
                  <Input
                    value={emailRecipients}
                    onChange={(e) => setEmailRecipients(e.target.value)}
                    placeholder="you@gmail.com, oncall@company.com"
                    inputMode="email"
                  />
                </Field>
              </div>
            )}

            {selectedProvider === "http" && (
              <div className="sm:col-span-2">
                <Field label="Your endpoint URL">
                  <Input
                    value={httpUrl}
                    onChange={(e) => setHttpUrl(e.target.value)}
                    placeholder="https://api.yourcompany.com/hooks/revenant"
                    className="font-mono text-xs sm:text-sm"
                  />
                </Field>
              </div>
            )}

            <div className="sm:col-span-2">
              <WebhookEventPicker
                value={events}
                onChange={setEvents}
                error={events.length === 0 ? "Select at least one event" : undefined}
              />
            </div>
          </div>

          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              disabled={
                saving ||
                events.length === 0 ||
                (selectedProvider === "email" &&
                  (!smtpUser || !smtpPassword || !emailRecipients.trim()))
              }
              onClick={() => void onCreate()}
              className="w-full rounded-lg bg-brand px-4 py-2.5 text-sm font-medium text-white disabled:opacity-50 sm:w-auto"
            >
              {saving ? "Connecting…" : "Connect"}
            </button>
            <button
              type="button"
              onClick={resetForm}
              className="w-full rounded-lg border border-slate-300 px-4 py-2.5 text-sm text-slate-700 sm:w-auto"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {step === "list" && (
        <>
          {/* Mobile: cards */}
          <div className="space-y-3 md:hidden">
            {loading ? (
              <p className="py-8 text-center text-sm text-slate-500">Loading…</p>
            ) : endpoints.length === 0 ? (
              <div className="rounded-xl border border-slate-200 bg-white py-12 text-center text-slate-500">
                <Webhook className="mx-auto mb-2 text-slate-300" size={32} />
                <p className="text-sm">No integrations yet.</p>
              </div>
            ) : (
              endpoints.map((e) => (
                <article
                  key={e.id}
                  className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
                >
                  <div className="flex items-start gap-3">
                    <IntegrationProviderIcon provider={e.provider} size={40} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="font-medium text-slate-900">{e.name}</h3>
                        <span
                          className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${
                            e.enabled
                              ? "bg-emerald-100 text-emerald-800"
                              : "bg-slate-100 text-slate-600"
                          }`}
                        >
                          {e.enabled ? "Active" : "Off"}
                        </span>
                      </div>
                      <p className="mt-0.5 text-xs text-slate-500">{providerLabel(e.provider)}</p>
                      <p className="mt-2 break-all font-mono text-[11px] text-slate-600">
                        {configSummary(e.provider, e.config as Record<string, unknown>)}
                      </p>
                      <p className="mt-2 text-xs text-slate-500">{e.events.join(", ")}</p>
                      {canWrite && (
                        <button
                          type="button"
                          onClick={() => setRemoveTarget(e)}
                          className="mt-3 text-xs text-red-600 hover:underline"
                        >
                          Remove
                        </button>
                      )}
                    </div>
                  </div>
                </article>
              ))
            )}
          </div>

          {/* Desktop: table */}
          <div className="hidden overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm md:block">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 text-left text-slate-600">
                <tr>
                  <th className="px-4 py-3 font-medium">Name</th>
                  <th className="px-4 py-3 font-medium">Type</th>
                  <th className="px-4 py-3 font-medium">Destination</th>
                  <th className="px-4 py-3 font-medium">Events</th>
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
                ) : endpoints.length === 0 ? (
                  <tr>
                    <td colSpan={canWrite ? 6 : 5} className="px-4 py-12 text-center text-slate-500">
                      <Webhook className="mx-auto mb-2 text-slate-300" size={32} />
                      No integrations yet.
                    </td>
                  </tr>
                ) : (
                  endpoints.map((e) => (
                    <tr key={e.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <IntegrationProviderIcon provider={e.provider} size={32} />
                          <span className="font-medium text-slate-900">{e.name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-slate-600">{providerLabel(e.provider)}</td>
                      <td className="max-w-xs truncate px-4 py-3 font-mono text-xs text-slate-500">
                        {configSummary(e.provider, e.config as Record<string, unknown>)}
                      </td>
                      <td className="px-4 py-3 text-slate-600">{e.events.join(", ")}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                            e.enabled
                              ? "bg-emerald-100 text-emerald-800"
                              : "bg-slate-100 text-slate-600"
                          }`}
                        >
                          {e.enabled ? "Active" : "Disabled"}
                        </span>
                      </td>
                      {canWrite && (
                        <td className="px-4 py-3 text-right">
                          <button
                            type="button"
                            onClick={() => setRemoveTarget(e)}
                            className="text-xs text-red-600 hover:underline"
                          >
                            Remove
                          </button>
                        </td>
                      )}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {step === "list" && <PaginationBar pagination={pagination} onPageChange={setPage} />}

      <ConfirmDialog
        open={!!removeTarget}
        title="Remove integration?"
        description={`"${removeTarget?.name}" will stop receiving alerts.`}
        confirmLabel="Remove"
        loading={removing}
        onConfirm={() => void confirmRemove()}
        onCancel={() => setRemoveTarget(null)}
      />
    </AppShell>
  );
}
