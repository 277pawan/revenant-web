import { Link } from "react-router-dom";
import { AlertTriangle, ExternalLink, Sparkles } from "lucide-react";
import type { AuthUser } from "../types/api";
import { getPlanDefinition, trialDaysRemaining } from "../lib/plans";
import { redirectToWebsiteBilling } from "../lib/subscription-access";

export function SubscriptionBanner({ user }: { user: AuthUser }) {
  const plan = getPlanDefinition(user.organizationPlan);
  const daysLeft = trialDaysRemaining(user.trialEndsAt);
  const trialing = user.subscriptionStatus === "trialing";

  if (user.autopaySetup && !trialing) return null;

  if (!user.autopaySetup) {
    return (
      <div
        className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950"
        role="status"
      >
        <div className="flex items-start gap-2">
          <AlertTriangle size={18} className="mt-0.5 shrink-0 text-amber-600" />
          <div>
            <p className="font-medium">Autopay setup required</p>
            <p className="mt-0.5 text-amber-900">
              Complete the ₹1 card check on the marketing site to use the cloud dashboard.
            </p>
          </div>
        </div>
        {user.role === "admin" ? (
          <button
            type="button"
            onClick={() => redirectToWebsiteBilling()}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-md bg-amber-700 px-3 py-2 text-xs font-semibold text-white hover:bg-amber-800"
          >
            <ExternalLink size={14} />
            Go to billing
          </button>
        ) : (
          <span className="text-xs text-amber-800">Ask an admin to complete billing</span>
        )}
      </div>
    );
  }

  if (trialing && daysLeft != null) {
    return (
      <div
        className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900"
        role="status"
      >
        <div className="flex items-start gap-2">
          <Sparkles size={18} className="mt-0.5 shrink-0 text-blue-600" />
          <div>
            <p className="font-medium">
              {plan.name} trial · {daysLeft} day{daysLeft === 1 ? "" : "s"} left
            </p>
            <p className="mt-0.5 text-blue-800">
              Recurring billing is active. {plan.priceLabel} charges automatically when your trial ends.
            </p>
          </div>
        </div>
        <Link
          to="/databases/new"
          className="shrink-0 rounded-md border border-blue-300 bg-white px-3 py-2 text-xs font-semibold text-blue-900 hover:bg-blue-100"
        >
          Run first drill
        </Link>
      </div>
    );
  }

  return null;
}
