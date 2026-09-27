import { Link } from "react-router-dom";
import { CheckCircle2, Download, ShieldCheck } from "lucide-react";
import { runShortId } from "../../lib/workflow";
import type { RecoveryReadinessResource } from "../../types/api";

function formatSeconds(seconds: number | null): string {
  if (seconds == null) return "—";
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return s > 0 ? `${m}m ${s}s` : `${m}m`;
}

export function LastRecoveryPointCard({
  databaseId,
  readiness,
  canDownload,
  onDownloadPassport,
  downloadingPassport,
}: {
  databaseId: string;
  readiness: RecoveryReadinessResource;
  canDownload: boolean;
  onDownloadPassport?: (jobId: string) => void;
  downloadingPassport?: boolean;
}) {
  const point = readiness.lastVerifiedRecoveryPoint;
  const latestFailed =
    readiness.readiness.latestDrillStatus != null &&
    readiness.readiness.latestDrillStatus !== "pass";

  if (!point) {
    return (
      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-400">
          Recovery point
        </h2>
        <p className="mt-2 text-sm text-slate-600">
          No drill has reached full recovery readiness yet (score ≥ 80, all contract checks met).
          Pass a restore drill to record a snapshot you can recover from.
        </p>
      </section>
    );
  }

  return (
    <section className="rounded-xl border border-emerald-200 bg-gradient-to-br from-emerald-50/80 to-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="flex gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700">
            <ShieldCheck size={20} />
          </div>
          <div>
            <h2 className="text-xs font-semibold uppercase tracking-wide text-emerald-800">
              Recover from this point
            </h2>
            <p className="mt-1 text-sm font-medium text-slate-900">{point.recoveryPointLabel}</p>
            <p className="mt-1 text-xs text-slate-600">
              Last drill with full readiness · {point.checksPassed}/{point.checksTotal} checks passed
              · score {point.score}%
            </p>
          </div>
        </div>
        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-800 ring-1 ring-inset ring-emerald-200">
          <CheckCircle2 size={12} />
          Verified
        </span>
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
        <div>
          <dt className="text-[10px] font-medium uppercase text-slate-500">Verified</dt>
          <dd className="font-medium text-slate-900">
            {new Date(point.verifiedAt).toLocaleString(undefined, {
              month: "short",
              day: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </dd>
        </div>
        <div>
          <dt className="text-[10px] font-medium uppercase text-slate-500">RTO</dt>
          <dd className="font-mono font-medium text-slate-900">{formatSeconds(point.rtoSeconds)}</dd>
        </div>
        <div>
          <dt className="text-[10px] font-medium uppercase text-slate-500">RPO lag</dt>
          <dd className="font-mono font-medium text-slate-900">
            {formatSeconds(point.rpoObservedSeconds)}
          </dd>
        </div>
        <div>
          <dt className="text-[10px] font-medium uppercase text-slate-500">Drill</dt>
          <dd className="font-mono text-slate-900">{runShortId(point.jobId)}</dd>
        </div>
      </dl>

      {latestFailed && (
        <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-950">
          Your <strong>latest drill failed</strong> — use this older verified snapshot for recovery,
          not the most recent run. Fix validation issues, then drill again to refresh this point.
        </p>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        <Link
          to={`/workflows/${databaseId}/runs/${point.jobId}`}
          className="rounded-lg bg-emerald-700 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-800"
        >
          View verified run →
        </Link>
        {canDownload && onDownloadPassport && (
          <button
            type="button"
            disabled={downloadingPassport}
            onClick={() => onDownloadPassport(point.jobId)}
            className="inline-flex items-center gap-2 rounded-lg border border-emerald-300 bg-white px-3 py-2 text-sm font-medium text-emerald-900 hover:bg-emerald-50 disabled:opacity-50"
          >
            <Download size={14} />
            Recovery passport
          </button>
        )}
      </div>

      {!latestFailed && (
        <p className="mt-2 text-xs text-slate-500">
          Latest drill matches this verified recovery point.
        </p>
      )}
    </section>
  );
}
