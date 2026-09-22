import { Link } from "react-router-dom";
import { AlertTriangle, Sparkles } from "lucide-react";
import type { AuthUser } from "../types/api";
import { getPlanDefinition, trialDaysRemaining } from "../lib/plans";
import { site } from "../lib/site";

export function SubscriptionBanner({ user }: { user: AuthUser }) {
  const plan = getPlanDefinition(user.organizationPlan);
  const daysLeft = trialDaysRemaining(user.trialEndsAt);
  const trialing = user.subscriptionStatus === "trialing";
  const active = user.subscriptionActive !== false;

  if (active && !trialing) return null;

  if (!active) {
    return (
      <div
        className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900"
        role="status"
      >
        <div className="flex items-start gap-2">
          <AlertTriangle size={18} className="mt-0.5 shrink-0 text-red-600" />
          <div>
            <p className="font-medium">Trial ended — cloud drills are paused</p>
            <p className="mt-0.5 text-red-800">
              Upgrade to {plan.name} ({plan.priceLabel}) to keep managed AWS restore drills. Developer
              CLI + GitHub Action stay free forever.
            </p>
          </div>
        </div>
        <a
          href={site.pricingUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="shrink-0 rounded-md bg-red-700 px-3 py-2 text-xs font-semibold text-white hover:bg-red-800"
        >
          Upgrade on website
        </a>
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
              No card required yet. After 30 days, subscribe on the website (Razorpay) or use the free
              Developer CLI in your own pipeline.
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
