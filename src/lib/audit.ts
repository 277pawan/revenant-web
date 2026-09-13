import type { AuditEventResource } from "../types/api";

export function formatAuditAction(action: string): string {
  return action
    .split(".")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" · ");
}

export function auditResourceLabel(resourceType: string): string {
  const labels: Record<string, string> = {
    job: "Job",
    schedule: "Schedule",
    webhook: "Webhook",
    database: "Database",
    plan: "Validation plan",
  };
  return labels[resourceType] ?? resourceType;
}

/** Deep links when we have enough context in metadata */
export function auditEventLink(event: AuditEventResource): string | null {
  const meta = event.metadata;
  switch (event.resourceType) {
    case "job": {
      const databaseId =
        typeof meta?.databaseId === "string" ? meta.databaseId : null;
      if (databaseId) {
        return `/workflows/${databaseId}/runs/${event.resourceId}`;
      }
      return null;
    }
    case "schedule":
      return "/schedules";
    case "webhook":
      return "/settings/webhooks";
    default:
      return null;
  }
}

export function metadataEntries(
  metadata: Record<string, unknown> | null
): { key: string; value: string }[] {
  if (!metadata) return [];
  return Object.entries(metadata).map(([key, value]) => ({
    key,
    value:
      typeof value === "string"
        ? value
        : JSON.stringify(value, null, 2),
  }));
}
