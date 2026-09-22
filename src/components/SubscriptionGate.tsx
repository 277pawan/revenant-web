import { AlertTriangle, Sparkles } from "lucide-react";
import type { AuthUser } from "../types/api";
import { site } from "../lib/site";
import { trialDaysRemaining, getPlanDefinition } from "../lib/plans";

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

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 px-4 py-12">
      <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 text-amber-700">
          {trialExpired || canceled ? (
            <AlertTriangle size={24} />
          ) : (
            <Sparkles size={24} />
          )}
        </div>
        <h1 className="text-2xl font-bold text-slate-900">
          {trialExpired || canceled
            ? "Starter plan required"
            : "Activate Starter to use the cloud"}
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-slate-600">
          {trialExpired
            ? `Your ${plan.name} trial has ended. Managed AWS restore drills and the evidence vault are paused until you subscribe.`
            : canceled
              ? "Your subscription was canceled. Restart Starter to run restore drills in the cloud again."
              : "Revenant Cloud runs managed restore drills for you. Start a free 30-day Starter trial on the marketing site — no credit card at signup (Razorpay billing coming soon)."}
        </p>
        <ul className="mt-4 space-y-2 text-sm text-slate-600">
          <li>· 30-day free trial on new organizations</li>
          <li>· ₹999/month after trial (Starter)</li>
          <li>· Free CLI + GitHub Action always available without cloud</li>
        </ul>
        <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          <a
            href={`${site.marketingUrl}/register`}
            className="inline-flex items-center justify-center rounded-lg bg-brand px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand/90"
          >
            Start free trial
          </a>
          <a
            href={site.pricingUrl}
            className="inline-flex items-center justify-center rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-800 hover:bg-slate-50"
          >
            View pricing
          </a>
          <a
            href={site.cliUrl}
            className="inline-flex items-center justify-center rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50"
          >
            Use free CLI
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
