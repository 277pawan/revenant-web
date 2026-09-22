/** Human-readable duration for RPO / staleness (not job wall-clock RTO). */
export function formatStalenessSeconds(seconds: number | null): string {
  if (seconds == null) return "—";
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return s > 0 ? `${m}m ${s}s` : `${m}m`;
  }
  if (seconds < 86400) {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    return m > 0 ? `${h}h ${m}m` : `${h}h`;
  }
  const days = seconds / 86400;
  return days >= 10 ? `${Math.round(days)} days` : `${days.toFixed(1)} days`;
}

export type StalenessSeverity = "good" | "warn" | "bad";

export function stalenessSeverity(seconds: number): StalenessSeverity {
  if (seconds < 3600) return "good";
  if (seconds < 86400) return "warn";
  return "bad";
}

export function stalenessBarClass(severity: StalenessSeverity, active = false): string {
  switch (severity) {
    case "good":
      return active ? "bg-emerald-500 shadow-[0_0_0_2px_rgba(16,185,129,0.3)]" : "bg-emerald-500/80 group-hover:bg-emerald-500";
    case "warn":
      return active ? "bg-amber-500 shadow-[0_0_0_2px_rgba(245,158,11,0.3)]" : "bg-amber-500/80 group-hover:bg-amber-500";
    case "bad":
      return active ? "bg-red-500 shadow-[0_0_0_2px_rgba(239,68,68,0.3)]" : "bg-red-500/80 group-hover:bg-red-500";
  }
}
