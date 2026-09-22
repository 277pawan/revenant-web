import { Field, Input, Select } from "./ui/Field";
import {
  SCHEDULE_FREQUENCIES,
  TIMEZONE_OPTIONS,
  WEEKDAYS,
  defaultTimezone,
  formatTime12h,
  formatTime24hValue,
  parseTime24hValue,
  type ScheduleFrequency,
} from "../lib/schedule";

export type ScheduleTimingValues = {
  frequency: ScheduleFrequency;
  hour: number;
  minute: number;
  dayOfWeek: number;
  dayOfMonth: number;
  timezone: string;
};

type Props = {
  values: ScheduleTimingValues;
  onChange: (patch: Partial<ScheduleTimingValues>) => void;
  errors?: Partial<Record<keyof ScheduleTimingValues | "timing", string>>;
};

const DAYS_OF_MONTH = Array.from({ length: 28 }, (_, i) => i + 1);

export function scheduleTimingDefaults(): ScheduleTimingValues {
  return {
    frequency: "daily",
    hour: 2,
    minute: 0,
    dayOfWeek: 1,
    dayOfMonth: 1,
    timezone: defaultTimezone(),
  };
}

export function ScheduleTimingFields({ values, onChange, errors }: Props) {
  const preview = formatTime12h(values.hour, values.minute);
  const tzLabel =
    TIMEZONE_OPTIONS.find((t) => t.value === values.timezone)?.label ??
    values.timezone;

  return (
    <div className="space-y-4">
      <Field label="How often?" error={errors?.frequency}>
        <div className="grid gap-2 sm:grid-cols-3">
          {SCHEDULE_FREQUENCIES.map((f) => (
            <label
              key={f.value}
              className={`flex cursor-pointer flex-col rounded-lg border px-3 py-2.5 text-sm transition-colors ${
                values.frequency === f.value
                  ? "border-brand bg-blue-50 ring-1 ring-brand/30"
                  : "border-slate-200 hover:border-slate-300"
              }`}
            >
              <input
                type="radio"
                name="schedule-frequency"
                value={f.value}
                checked={values.frequency === f.value}
                onChange={() => onChange({ frequency: f.value })}
                className="sr-only"
              />
              <span className="font-medium text-slate-900">{f.label}</span>
              <span className="mt-0.5 text-xs text-slate-500">{f.description}</span>
            </label>
          ))}
        </div>
      </Field>

      {values.frequency === "weekly" && (
        <Field label="Day of week" error={errors?.dayOfWeek}>
          <Select
            value={String(values.dayOfWeek)}
            onChange={(e) => onChange({ dayOfWeek: Number(e.target.value) })}
          >
            {WEEKDAYS.map((d) => (
              <option key={d.value} value={String(d.value)}>{d.label}</option>
            ))}
          </Select>
        </Field>
      )}

      {values.frequency === "monthly" && (
        <Field
          label="Day of month"
          hint="Runs on this date each month (days 1–28 for consistency)"
          error={errors?.dayOfMonth}
        >
          <Select
            value={String(values.dayOfMonth)}
            onChange={(e) => onChange({ dayOfMonth: Number(e.target.value) })}
          >
            {DAYS_OF_MONTH.map((d) => (
              <option key={d} value={String(d)}>
                Day {d}
              </option>
            ))}
          </Select>
        </Field>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="Time"
          hint={`Selected: ${preview}`}
          error={errors?.hour ?? errors?.minute}
        >
          <Input
            type="time"
            step={900}
            value={formatTime24hValue(values.hour, values.minute)}
            onChange={(e) => {
              const parsed = parseTime24hValue(e.target.value);
              if (parsed) onChange(parsed);
            }}
            className="max-w-[11rem]"
          />
        </Field>

        <Field label="Timezone" error={errors?.timezone}>
          <Select
            value={values.timezone}
            onChange={(e) => onChange({ timezone: e.target.value })}
          >
            {!TIMEZONE_OPTIONS.some((t) => t.value === values.timezone) && (
              <option value={values.timezone}>{values.timezone}</option>
            )}
            {TIMEZONE_OPTIONS.map((tz) => (
              <option key={tz.value} value={tz.value}>{tz.label}</option>
            ))}
          </Select>
        </Field>
      </div>

      <p className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
        <span className="font-medium text-slate-800">Preview: </span>
        {values.frequency === "daily" && `Every day at ${preview}`}
        {values.frequency === "weekly" &&
          `Every ${WEEKDAYS.find((d) => d.value === values.dayOfWeek)?.label ?? "week"} at ${preview}`}
        {values.frequency === "monthly" &&
          `Day ${values.dayOfMonth} of each month at ${preview}`}
        {" · "}
        {tzLabel}
      </p>
    </div>
  );
}
