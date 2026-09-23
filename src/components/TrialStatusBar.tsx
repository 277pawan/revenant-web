import { Sparkles } from "lucide-react";
import { useAuth } from "../lib/auth";
import { getPlanDefinition, trialDaysRemaining } from "../lib/plans";

/** Visible on every cloud page while the org is in Starter trial. */
export function TrialStatusBar() {
  const { user } = useAuth();
  if (!user) return null;

  const plan = getPlanDefinition(user.organizationPlan);
  const trialing = user.subscriptionStatus === "trialing";
  const daysLeft = trialDaysRemaining(user.trialEndsAt);
  if (!trialing || daysLeft == null) return null;

  const urgent = daysLeft <= 7;

  return (
    <div
      className={`mb-4 flex flex-wrap items-center justify-between gap-2 rounded-lg border px-4 py-2.5 text-sm ${
        urgent
          ? "border-amber-200 bg-amber-50 text-amber-950"
          : "border-blue-200 bg-blue-50 text-blue-900"
      }`}
      role="status"
    >
      <div className="flex items-center gap-2">
        <Sparkles size={16} className={urgent ? "text-amber-600" : "text-blue-600"} />
        <span className="font-medium">
          {plan.name} trial · {daysLeft} day{daysLeft === 1 ? "" : "s"} left
        </span>
        <span className="hidden text-xs opacity-80 sm:inline">
          {user.autopaySetup
            ? `· ${plan.priceLabel} starts after trial`
            : "· Complete autopay on the marketing site"}
        </span>
      </div>
    </div>
  );
}
