/** User-friendly schedule builder → standard 5-field cron (minute hour dom month dow) */

export type ScheduleFrequency = "daily" | "weekly" | "monthly";

export const SCHEDULE_FREQUENCIES: {
  value: ScheduleFrequency;
  label: string;
  description: string;
}[] = [
  { value: "daily", label: "Daily", description: "Every day at the chosen time" },
  { value: "weekly", label: "Weekly", description: "Once a week on a specific day" },
  { value: "monthly", label: "Monthly", description: "Once a month on a specific date" },
];

export const WEEKDAYS: { value: number; label: string; short: string }[] = [
  { value: 0, label: "Sunday", short: "Sun" },
  { value: 1, label: "Monday", short: "Mon" },
  { value: 2, label: "Tuesday", short: "Tue" },
  { value: 3, label: "Wednesday", short: "Wed" },
  { value: 4, label: "Thursday", short: "Thu" },
  { value: 5, label: "Friday", short: "Fri" },
  { value: 6, label: "Saturday", short: "Sat" },
];

export const MINUTE_OPTIONS = [0, 15, 30, 45];

/** Common IANA zones — default comes from browser when possible */
export const TIMEZONE_OPTIONS: { value: string; label: string }[] = [
  { value: "UTC", label: "UTC — Coordinated Universal Time" },
  { value: "Asia/Kolkata", label: "Asia/Kolkata — India (IST)" },
  { value: "Asia/Dubai", label: "Asia/Dubai — UAE (GST)" },
  { value: "Asia/Singapore", label: "Asia/Singapore — Singapore (SGT)" },
  { value: "Asia/Tokyo", label: "Asia/Tokyo — Japan (JST)" },
  { value: "Europe/London", label: "Europe/London — UK (GMT/BST)" },
  { value: "Europe/Paris", label: "Europe/Paris — Central Europe (CET)" },
  { value: "Europe/Berlin", label: "Europe/Berlin — Germany (CET)" },
  { value: "America/New_York", label: "America/New_York — US Eastern" },
  { value: "America/Chicago", label: "America/Chicago — US Central" },
  { value: "America/Denver", label: "America/Denver — US Mountain" },
  { value: "America/Los_Angeles", label: "America/Los_Angeles — US Pacific" },
  { value: "Australia/Sydney", label: "Australia/Sydney — Sydney (AEST)" },
];

export function defaultTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

export function buildCronExpression(input: {
  frequency: ScheduleFrequency;
  hour: number;
  minute: number;
  dayOfWeek?: number;
  dayOfMonth?: number;
}): string {
  const minute = Math.min(59, Math.max(0, input.minute));
  const hour = Math.min(23, Math.max(0, input.hour));

  switch (input.frequency) {
    case "daily":
      return `${minute} ${hour} * * *`;
    case "weekly": {
      const dow = input.dayOfWeek ?? 1;
      return `${minute} ${hour} * * ${dow}`;
    }
    case "monthly": {
      const dom = input.dayOfMonth ?? 1;
      return `${minute} ${hour} ${dom} * *`;
    }
    default:
      return `${minute} ${hour} * * *`;
  }
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

export function formatTime12h(hour: number, minute: number): string {
  const h = hour % 12 === 0 ? 12 : hour % 12;
  const ampm = hour < 12 ? "AM" : "PM";
  return `${h}:${pad2(minute)} ${ampm}`;
}

export function describeCronExpression(
  cronExpression: string,
  timezone: string
): string {
  const parts = cronExpression.trim().split(/\s+/);
  if (parts.length < 5) return cronExpression;

  const minute = Number(parts[0]);
  const hour = Number(parts[1]);
  const dom = parts[2];
  const month = parts[3];
  const dow = parts[4];

  if (Number.isNaN(minute) || Number.isNaN(hour)) {
    return `${cronExpression} (${timezone})`;
  }

  const time = formatTime12h(hour, minute);

  if (dom === "*" && month === "*" && dow === "*") {
    return `Daily at ${time} (${timezone})`;
  }

  if (dom === "*" && month === "*" && dow !== "*") {
    const day = WEEKDAYS.find((d) => String(d.value) === dow);
    return `Every ${day?.label ?? dow} at ${time} (${timezone})`;
  }

  if (dom !== "*" && month === "*" && dow === "*") {
    return `Monthly on day ${dom} at ${time} (${timezone})`;
  }

  return `${cronExpression} (${timezone})`;
}

export function suggestScheduleName(input: {
  frequency: ScheduleFrequency;
  hour: number;
  minute: number;
  dayOfWeek?: number;
  dayOfMonth?: number;
}): string {
  const time = formatTime12h(input.hour, input.minute);
  switch (input.frequency) {
    case "daily":
      return `Daily validation at ${time}`;
    case "weekly": {
      const day = WEEKDAYS.find((d) => d.value === input.dayOfWeek)?.label ?? "weekday";
      return `Weekly ${day} at ${time}`;
    }
    case "monthly":
      return `Monthly day ${input.dayOfMonth ?? 1} at ${time}`;
    default:
      return "Scheduled validation";
  }
}
