import type { OrganizationPlan } from "../types/api";

export interface PlanDefinition {
  id: OrganizationPlan;
  name: string;
  priceLabel: string;
  tagline: string;
  highlights: string[];
}

export const PLAN_DEFINITIONS: Record<OrganizationPlan, PlanDefinition> = {
  starter: {
    id: "starter",
    name: "Starter",
    priceLabel: "₹999 / month",
    tagline: "Prove restore works for one critical database.",
    highlights: [
      "1 database workflow",
      "Manual + scheduled drills",
      "Evidence vault (30 days)",
      "Email alerts",
    ],
  },
  pro: {
    id: "pro",
    name: "Pro",
    priceLabel: "₹4,999 / month",
    tagline: "Fleet-wide DR proof for growing teams.",
    highlights: [
      "Up to 10 workflows",
      "AWS snapshot restore drills",
      "1-year evidence retention",
      "Slack + email + HTTP",
    ],
  },
  enterprise: {
    id: "enterprise",
    name: "Enterprise",
    priceLabel: "Contact us",
    tagline: "SSO, billing site, and compliance packaging.",
    highlights: [
      "Unlimited workflows",
      "SSO across marketing + app",
      "Custom retention & SLAs",
      "Dedicated support",
    ],
  },
};

export function getPlanDefinition(plan: OrganizationPlan): PlanDefinition {
  return PLAN_DEFINITIONS[plan] ?? PLAN_DEFINITIONS.starter;
}
