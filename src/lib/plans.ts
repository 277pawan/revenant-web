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
  /** Redis instances the org may register (0 = CLI-only plan) */
  redisResources: number | null;
  /** Restore proofs allowed per calendar month */
  redisRestoreProofsPerMonth: number | null;
  /** Hard TTL ceiling for opt-in Redis snapshot artifacts, in hours */
  redisSnapshotRetentionHours: number | null;
  redisSnapshotEnabled: boolean;
}

export const PLAN_DEFINITIONS: Record<OrganizationPlan, PlanDefinition> = {
  starter: {
    id: "starter",
    name: "Starter",
    priceLabel: "₹499 / month",
    tagline: "One production workflow — Revenant runs restore drills for you.",
    trialDays: 30,
    selfHostedAgent: false,
    managedCloudDrills: true,
    parallelRestoreDrills: 1,
    redisResources: 1,
    redisRestoreProofsPerMonth: 4,
    redisSnapshotRetentionHours: 24,
    redisSnapshotEnabled: true,
    highlights: [
      "30-day free trial, then ₹499 / month",
      "1 production RDS workflow — managed AWS restore drill",
      "No Docker — Revenant cloud executes drills",
      "1 Redis instance — 4 restore proofs/mo, opt-in snapshots up to 24h",
      "Evidence (30 days), schedules, Proof Composer, email",
    ],
  },
  pro: {
    id: "pro",
    name: "Pro",
    priceLabel: "₹1,499 / month",
    tagline: "Fleet DR proof — Revenant still runs AWS drills automatically.",
    trialDays: null,
    selfHostedAgent: true,
    managedCloudDrills: true,
    parallelRestoreDrills: 3,
    redisResources: 10,
    redisRestoreProofsPerMonth: 30,
    redisSnapshotRetentionHours: 168,
    redisSnapshotEnabled: true,
    highlights: [
      "Up to 10 production workflows",
      "Revenant-managed AWS drills (no Docker by default)",
      "3 parallel restore drills across the fleet",
      "Optional agent for private-network Postgres only",
      "MongoDB read-only validation checks — separate from SQL and AWS restore drills",
      "10 Redis instances — 30 restore proofs/mo, opt-in snapshots up to 7 days",
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
    redisResources: null,
    redisRestoreProofsPerMonth: null,
    redisSnapshotRetentionHours: null,
    redisSnapshotEnabled: true,
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

/**
 * Redis snapshot TTL helpers.
 *
 * The UI mirrors the API's clamp so the form can explain the ceiling BEFORE
 * the user hits Save. The API still clamps server-side — this is never the
 * thing that enforces the limit.
 */
export const REDIS_DEFAULT_SNAPSHOT_RETENTION_HOURS = 24;

/** What a user asking for `requested` will ACTUALLY get on this plan. */
export function resolveRedisRetentionHours(
  plan: OrganizationPlan,
  requested: number | null | undefined
): number {
  const ceiling = getPlanDefinition(plan).redisSnapshotRetentionHours;
  const wanted =
    typeof requested === "number" && Number.isFinite(requested) && requested > 0
      ? Math.floor(requested)
      : REDIS_DEFAULT_SNAPSHOT_RETENTION_HOURS;

  if (ceiling == null) return wanted;
  return Math.min(wanted, ceiling);
}

/** True when the plan will silently shorten what the user asked for. */
export function redisRetentionWillBeClamped(
  plan: OrganizationPlan,
  requested: number | null | undefined
): boolean {
  const ceiling = getPlanDefinition(plan).redisSnapshotRetentionHours;
  if (ceiling == null) return false;
  const wanted =
    typeof requested === "number" && Number.isFinite(requested) && requested > 0
      ? Math.floor(requested)
      : REDIS_DEFAULT_SNAPSHOT_RETENTION_HOURS;
  return wanted > ceiling;
}

/** Human label for a TTL in hours: 24 → "24 hours", 168 → "7 days". */
export function formatRedisRetention(hours: number | null | undefined): string {
  if (hours == null) return "—";
  if (hours % 24 === 0 && hours >= 24) {
    const days = hours / 24;
    return days === 1 ? "24 hours" : `${days} days`;
  }
  return `${hours} hour${hours === 1 ? "" : "s"}`;
}

/** Storage choices offered in the UI, clamped by plan. */
export const REDIS_RETENTION_OPTIONS: Array<{ hours: number; label: string }> = [
  { hours: 1, label: "1 hour" },
  { hours: 6, label: "6 hours" },
  { hours: 24, label: "24 hours (1 day)" },
  { hours: 72, label: "3 days" },
  { hours: 168, label: "7 days" },
];

export function trialDaysRemaining(trialEndsAt: string | null | undefined): number | null {
  if (!trialEndsAt) return null;
  const ms = new Date(trialEndsAt).getTime() - Date.now();
  if (ms <= 0) return 0;
  return Math.ceil(ms / (24 * 60 * 60 * 1000));
}
