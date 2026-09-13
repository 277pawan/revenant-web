/**
 * All API timestamps are UTC ISO strings. Always parse and display in the user's local timezone.
 */

const USER_TIMEZONE = Intl.DateTimeFormat().resolvedOptions().timeZone;

/** Parse API date strings — treats timezone-less ISO as UTC. */
export function parseApiDate(value: string | Date | null | undefined): Date | null {
  if (value == null || value === "") return null;
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  const trimmed = value.trim();
  if (!trimmed) return null;

  // Postgres / JSON sometimes omits Z — still UTC from the API
  const hasZone = /[zZ]$/.test(trimmed) || /[+-]\d{2}:\d{2}$/.test(trimmed);
  const normalized = hasZone ? trimmed : `${trimmed}Z`;
  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? null : date;
}

function timezoneAbbreviation(date: Date): string {
  try {
    const part = new Intl.DateTimeFormat(undefined, {
      timeZone: USER_TIMEZONE,
      timeZoneName: "short",
    })
      .formatToParts(date)
      .find((p) => p.type === "timeZoneName");
    return part?.value ?? USER_TIMEZONE;
  } catch {
    return USER_TIMEZONE;
  }
}

const localDateTimeFormatter = new Intl.DateTimeFormat(undefined, {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: USER_TIMEZONE,
});

const utcDateTimeFormatter = new Intl.DateTimeFormat(undefined, {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "UTC",
});

/** Local date + time with timezone label, e.g. "12 Sept 2026, 10:44 pm IST" */
export function formatDateTime(value: string | Date | null | undefined): string {
  const date = parseApiDate(value);
  if (!date) return "—";
  const tz = timezoneAbbreviation(date);
  return `${localDateTimeFormatter.format(date)} ${tz}`;
}

/** UTC reference for tooltips */
export function formatDateTimeUtc(value: string | Date | null | undefined): string {
  const date = parseApiDate(value);
  if (!date) return "—";
  return `${utcDateTimeFormatter.format(date)} UTC`;
}

export function formatDate(value: string | Date | null | undefined): string {
  const date = parseApiDate(value);
  if (!date) return "—";
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeZone: USER_TIMEZONE,
  }).format(date);
}

/** Relative time in user's clock, e.g. "5 min ago" */
export function formatRelativeTime(value: string | Date | null | undefined): string {
  const date = parseApiDate(value);
  if (!date) return "—";

  const diffMs = Date.now() - date.getTime();
  const min = Math.floor(diffMs / 60_000);
  if (min < 1) return "Just now";
  if (min < 60) return `${min} min ago`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  return formatDateTime(value);
}

export function getUserTimezone(): string {
  return USER_TIMEZONE;
}
