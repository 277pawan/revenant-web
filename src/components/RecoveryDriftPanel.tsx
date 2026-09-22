import { useCallback, useEffect, useState } from "react";
import { AlertTriangle } from "lucide-react";
import { Link } from "react-router-dom";
import { api } from "../lib/api";
import type { DriftEventResource } from "../types/api";

function severityStyle(severity: string) {
  switch (severity) {
    case "recovery_invalidated":
    case "recovery_at_risk":
      return "border-red-200 bg-red-50 text-red-900";
    case "minor_drift":
      return "border-amber-200 bg-amber-50 text-amber-900";
    default:
      return "border-slate-200 bg-slate-50 text-slate-700";
  }
}

export function RecoveryDriftPanel({
  databaseId,
  onRunDrill,
  runningDrill = false,
  refreshToken = 0,
}: {
  databaseId: string;
  /** When already on the workflow page, start a drill instead of linking to the same URL */
  onRunDrill?: () => void;
  runningDrill?: boolean;
  /** Increment to reload drift events after parent refresh */
  refreshToken?: number;
}) {
  const [events, setEvents] = useState<DriftEventResource[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { drift } = await api.getRecoveryDrift(databaseId);
      setEvents(drift.events);
    } catch {
      setEvents([]);
    } finally {
      setLoading(false);
    }
  }, [databaseId]);

  useEffect(() => {
    void load();
  }, [load, refreshToken]);

  if (loading) {
    return <div className="h-24 animate-pulse rounded-xl bg-slate-100" />;
  }

  if (events.length === 0) {
    return (
      <section className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
        Recovery drift: stable — no open recovery-impacting changes detected.
      </section>
    );
  }

  return (
    <section className="rounded-xl border border-amber-200 bg-white p-5 shadow-sm">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm font-semibold text-amber-900">
          <AlertTriangle size={16} />
          Recovery drift ({events.length} open)
        </div>
        {onRunDrill ? (
          <button
            type="button"
            disabled={runningDrill}
            onClick={onRunDrill}
            className="text-xs font-medium text-brand hover:underline disabled:opacity-50"
          >
            {runningDrill ? "Queuing drill…" : "Run restore drill to clear →"}
          </button>
        ) : (
          <Link
            to={`/workflows/${databaseId}`}
            className="text-xs font-medium text-brand hover:underline"
          >
            Run restore drill to clear →
          </Link>
        )}
      </div>
      <p className="mb-3 text-xs text-slate-600">
        Drift opens when your validation plan or schema changes after the last{" "}
        <strong>Pass</strong> drill. It clears automatically when the next drill finishes with{" "}
        <strong>Pass</strong> — that run becomes the new verified baseline.
      </p>
      <ul className="space-y-2">
        {events.map((event) => (
          <li
            key={event.id}
            className={`rounded-lg border px-3 py-2 text-sm ${severityStyle(event.severity)}`}
          >
            <div className="font-medium">{event.description}</div>
            <div className="mt-1 text-xs opacity-75">
              {event.changeType} · {new Date(event.createdAt).toLocaleString()}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
