import { useCallback, useEffect, useState } from "react";
import { AppShell } from "../components/AppShell";
import { PlanBillingCard } from "../components/settings/PlanBillingCard";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import type { OrganizationSettingsResource, OrgSubscriptionSummary } from "../types/api";

export function BillingSettingsPage() {
  const { user } = useAuth();
  const [organization, setOrganization] = useState<OrganizationSettingsResource | null>(null);
  const [subscription, setSubscription] = useState<OrgSubscriptionSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load billing");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <AppShell>
      <div className="mb-4">
        <h1 className="text-xl font-semibold text-slate-900">Plan & billing</h1>
        <p className="text-sm text-slate-500">
          Subscription status, trial, and usage limits for your organization.
        </p>
      </div>

      {error && (
        <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      )}

      {loading ? (
        <p className="text-sm text-slate-500">Loading…</p>
      ) : (
        <div className="max-w-xl">
          <PlanBillingCard
            organization={organization}
            subscription={subscription}
            isAdmin={user?.role === "admin"}
          />
        </div>
      )}
    </AppShell>
  );
}
