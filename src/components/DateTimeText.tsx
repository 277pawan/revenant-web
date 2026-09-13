import {
  formatDateTime,
  formatDateTimeUtc,
  parseApiDate,
} from "../lib/datetime";

type DateTimeTextProps = {
  value: string | Date | null | undefined;
  className?: string;
};

/** Renders a local datetime with UTC in the hover title. */
export function DateTimeText({ value, className }: DateTimeTextProps) {
  const date = parseApiDate(value);
  if (!date) {
    return <span className={className}>—</span>;
  }

  return (
    <time
      dateTime={date.toISOString()}
      title={`UTC: ${formatDateTimeUtc(value)}`}
      className={className}
    >
      {formatDateTime(value)}
    </time>
  );
}
