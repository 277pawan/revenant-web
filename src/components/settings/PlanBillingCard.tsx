import { CreditCard } from "lucide-react";
import { getPlanDefinition } from "../../lib/plans";
import { site } from "../../lib/site";
import { redirectToWebsiteBilling } from "../../lib/subscription-access";
import type {
  OrganizationSettingsResource,
  OrgSubscriptionSummary,
} from "../../types/api";

type PlanBillingCardProps = {
  organization: OrganizationSettingsResource | null;
  subscription: OrgSubscriptionSummary | null;
  isAdmin: boolean;
};

export function PlanBillingCard({
  organization,
  subscription,
  isAdmin,
}: PlanBillingCardProps) {
  const plan = getPlanDefinition(organization?.plan ?? subscription?.plan ?? "starter");

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center gap-2">
        <CreditCard size={18} className="text-slate-500" />
        <h2 className="font-semibold text-slate-900">Plan & billing</h2>
      </div>
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
        <div className="flex justify-between gap-4">
          <dt className="text-slate-500">Schedules</dt>
          <dd className="text-slate-900">
            {subscription?.usage.schedules ?? 0} / {subscription?.limits.schedules ?? "—"}
          </dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-slate-500">Team members</dt>
          <dd className="text-slate-900">
            {subscription?.usage.teamMembers ?? 0} / {subscription?.limits.teamMembers ?? "—"}
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
        {isAdmin && subscription && !subscription.autopaySetup && (
          <button
            type="button"
            onClick={() => redirectToWebsiteBilling()}
            className="rounded-md bg-brand px-3 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            Set up autopay on website — ₹1
          </button>
        )}
        {isAdmin && plan.id === "starter" && subscription?.autopaySetup && (
          <button
            type="button"
            onClick={() => redirectToWebsiteBilling({ plan: "pro", upgrade: true })}
            className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50"
          >
            Upgrade to Pro
          </button>
        )}
        <a
          href={site.talkUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm font-medium text-slate-700 hover:underline"
        >
          Billing help
        </a>
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
  );
}
