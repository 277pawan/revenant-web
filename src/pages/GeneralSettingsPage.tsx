import { useCallback, useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Building2 } from "lucide-react";
import { AppShell } from "../components/AppShell";
import { Field, Input } from "../components/ui/Field";
import { useToast } from "../components/toast/ToastProvider";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import { getPlanDefinition } from "../lib/plans";
import { site } from "../lib/site";
import { redirectToWebsiteBilling } from "../lib/subscription-access";
import {
  roleHasPermission,
  type OrganizationSettingsResource,
  type OrgSubscriptionSummary,
} from "../types/api";

const schema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters").max(255),
});

type FormValues = z.infer<typeof schema>;

export function GeneralSettingsPage() {
  const { user, refreshUser } = useAuth();
  const toast = useToast();
  const canEdit = user ? roleHasPermission(user.role, "team:manage") : false;

  const [organization, setOrganization] = useState<OrganizationSettingsResource | null>(null);
  const [subscription, setSubscription] = useState<OrgSubscriptionSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isDirty },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: "" },
  });

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [orgRes, subRes] = await Promise.all([
        api.getOrganizationSettings(),
        api.getSubscription(),
      ]);
      setOrganization(orgRes.organization);
      setSubscription(subRes.subscription);
      reset({ name: orgRes.organization.name });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load settings");
    } finally {
      setLoading(false);
    }
  }, [reset]);

  useEffect(() => {
    void load();
  }, [load]);

  async function onSave(values: FormValues) {
    setSaving(true);
    setError(null);
    try {
      const res = await api.updateOrganizationSettings(values);
      setOrganization(res.organization);
      reset({ name: res.organization.name });
      await refreshUser();
      toast.success("Saved", "Organization settings updated.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  const plan = getPlanDefinition(organization?.plan ?? user?.organizationPlan ?? "starter");

  return (
    <AppShell>
      <div className="mb-4">
        <h1 className="text-xl font-semibold text-slate-900">General</h1>
        <p className="text-sm text-slate-500">Organization profile and subscription.</p>
      </div>

      {error && (
        <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      )}

      {loading ? (
        <p className="text-sm text-slate-500">Loading…</p>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center gap-2">
              <Building2 size={18} className="text-slate-500" />
              <h2 className="font-semibold text-slate-900">Organization</h2>
            </div>
            <form onSubmit={handleSubmit(onSave)} className="space-y-4">
              <Field label="Organization name" error={errors.name?.message}>
                <Input {...register("name")} disabled={!canEdit} />
              </Field>
              <p className="text-xs text-slate-500">
                Org ID: <span className="font-mono">{organization?.id}</span>
              </p>
              {canEdit && (
                <button
                  type="submit"
                  disabled={saving || !isDirty}
                  className="rounded-md bg-brand px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
                >
                  {saving ? "Saving…" : "Save changes"}
                </button>
              )}
            </form>
          </section>

          <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="mb-4 font-semibold text-slate-900">Plan & billing</h2>
            <dl className="space-y-3 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-slate-500">Current plan</dt>
                <dd className="font-medium text-slate-900">{plan.name}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-slate-500">Price</dt>
                <dd className="text-slate-900">{subscription?.priceLabel ?? plan.priceLabel}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-slate-500">Subscription</dt>
                <dd className="capitalize text-slate-900">
                  {subscription?.subscriptionStatus ?? organization?.subscriptionStatus}
                </dd>
              </div>
              {subscription?.trialDaysRemaining != null && (
                <div className="flex justify-between gap-4">
                  <dt className="text-slate-500">Trial</dt>
                  <dd className="text-slate-900">{subscription.trialDaysRemaining} days left</dd>
                </div>
              )}
              <div className="flex justify-between gap-4">
                <dt className="text-slate-500">Workflows</dt>
                <dd className="text-slate-900">
                  {subscription?.usage.workflows ?? 0} / {subscription?.limits.workflows ?? "—"}
                </dd>
              </div>
              {subscription?.autopaySetup && (
                <div className="flex justify-between gap-4">
                  <dt className="text-slate-500">Autopay</dt>
                  <dd className="font-medium text-emerald-700">
                    Active
                    {subscription.razorpaySubscriptionStatus
                      ? ` · ${subscription.razorpaySubscriptionStatus}`
                      : " (₹1 setup complete)"}
                  </dd>
                </div>
              )}
            </dl>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              {user?.role === "admin" && subscription && !subscription.autopaySetup && (
                <button
                  type="button"
                  onClick={() => redirectToWebsiteBilling()}
                  className="rounded-md bg-brand px-3 py-2 text-sm font-medium text-white hover:bg-blue-700"
                >
                  Set up autopay on website — ₹1
                </button>
              )}
              <a
                href={site.pricingUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm font-medium text-brand hover:underline"
              >
                View pricing →
              </a>
            </div>
          </section>
        </div>
      )}
    </AppShell>
  );
}
