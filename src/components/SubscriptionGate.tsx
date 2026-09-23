import { AlertTriangle, ExternalLink } from "lucide-react";
import type { AuthUser } from "../types/api";
import { site } from "../lib/site";
import { trialDaysRemaining, getPlanDefinition } from "../lib/plans";
import { redirectToWebsiteBilling, websiteBillingUrl } from "../lib/subscription-access";

type Props = {
  user: AuthUser;
  onSignOut: () => void;
};

export function SubscriptionGate({ user, onSignOut }: Props) {
  const plan = getPlanDefinition(user.organizationPlan);
  const daysLeft = trialDaysRemaining(user.trialEndsAt);
  const trialExpired =
    user.subscriptionStatus === "trialing" && daysLeft === 0;
  const canceled = user.subscriptionStatus === "canceled";
  const billingUrl = websiteBillingUrl(localStorage.getItem("revenant_token"));

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 px-4 py-12">
      <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 text-amber-700">
          <AlertTriangle size={24} />
        </div>
        <h1 className="text-2xl font-bold text-slate-900">
          Complete billing on revenant.dev
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-slate-600">
          {trialExpired || canceled
            ? `Your ${plan.name} trial ended. Set up autopay on the marketing site (₹1 card check) to reopen the cloud dashboard.`
            : `Before using Revenant Cloud, complete the ₹1 autopay setup on the marketing site. You stay signed in with the same account.`}
        </p>
        <ul className="mt-4 space-y-2 text-sm text-slate-600">
          <li>· ₹1 today — verifies your card (not the full {plan.priceLabel})</li>
          <li>· {plan.priceLabel} after your 30-day trial</li>
          <li>· Same login on website and cloud dashboard</li>
        </ul>
        <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          {user.role === "admin" ? (
            <button
              type="button"
              onClick={() => redirectToWebsiteBilling()}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-brand px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700"
            >
              <ExternalLink size={16} />
              Continue to billing
            </button>
          ) : (
            <a
              href={billingUrl}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-brand px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700"
            >
              Ask your admin to complete billing
            </a>
          )}
          <a
            href={site.pricingUrl}
            className="inline-flex items-center justify-center rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-800 hover:bg-slate-50"
          >
            View pricing
          </a>
        </div>
        <p className="mt-6 text-xs text-slate-500">
          Signed in as {user.email} · {user.organizationName}
        </p>
        <button
          type="button"
          onClick={onSignOut}
          className="mt-2 text-xs text-slate-500 underline hover:text-slate-800"
        >
          Sign out
        </button>
      </div>
    </div>
  );
}
