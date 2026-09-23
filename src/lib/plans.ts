import type { OrganizationPlan } from "../types/api";

export interface PlanDefinition {
  id: OrganizationPlan;
  name: string;
  priceLabel: string;
  tagline: string;
  highlights: string[];
  trialDays: number | null;
  /** Optional private-VPC agent — not required for managed AWS drills */
  selfHostedAgent: boolean;
  managedCloudDrills: boolean;
  parallelRestoreDrills: number | null;
}

export const PLAN_DEFINITIONS: Record<OrganizationPlan, PlanDefinition> = {
  starter: {
    id: "starter",
    name: "Starter",
    priceLabel: "₹499 / month",
    tagline: "One production workflow — we run the restore drill for you.",
    trialDays: 30,
    selfHostedAgent: false,
    managedCloudDrills: true,
    parallelRestoreDrills: 1,
    highlights: [
      "30-day free trial (Razorpay after)",
      "1 production RDS workflow — Revenant runs the drill automatically",
      "No Docker — same managed path as Pro, smaller fleet",
      "Evidence (30 days), schedules, Proof Composer, email",
    ],
  },
  pro: {
    id: "pro",
    name: "Pro",
    priceLabel: "₹1,499 / month",
    tagline: "Fleet DR proof — Revenant still runs AWS drills for you.",
    trialDays: null,
    selfHostedAgent: true,
    managedCloudDrills: true,
    parallelRestoreDrills: 3,
    highlights: [
      "Up to 10 workflows — Revenant-managed AWS restores (no Docker by default)",
      "3 parallel restore drills across the fleet",
      "Docker/agent only if Postgres is private inside your VPC",
      "Slack, email, HTTP · 1-year evidence + audit",
    ],
  },
  enterprise: {
    id: "enterprise",
    name: "Enterprise",
    priceLabel: "Contact us",
    tagline: "SSO, custom SLAs, and compliance packaging.",
    trialDays: null,
    selfHostedAgent: true,
    managedCloudDrills: true,
    parallelRestoreDrills: null,
    highlights: [
      "Unlimited production workflows (fair use)",
      "Managed drills + optional private-network agents",
      "SSO, dedicated support, custom retention",
    ],
  },
};

export function getPlanDefinition(plan: OrganizationPlan): PlanDefinition {
  return PLAN_DEFINITIONS[plan] ?? PLAN_DEFINITIONS.starter;
}

/** Agent token UI + private-network Docker — Pro and Enterprise only */
export function planAllowsSelfHostedAgent(plan: OrganizationPlan): boolean {
  return getPlanDefinition(plan).selfHostedAgent;
}

export function trialDaysRemaining(trialEndsAt: string | null | undefined): number | null {
  if (!trialEndsAt) return null;
  const ms = new Date(trialEndsAt).getTime() - Date.now();
  if (ms <= 0) return 0;
  return Math.ceil(ms / (24 * 60 * 60 * 1000));
}
