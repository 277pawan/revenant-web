import { statusBadgeClass, statusLabel } from "./jobStatus";

export function StatusBadge({
  status,
  className = "",
}: {
  status: string;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ring-1 ring-inset ${statusBadgeClass(status)} ${className}`}
    >
      {statusLabel(status)}
    </span>
  );
}
