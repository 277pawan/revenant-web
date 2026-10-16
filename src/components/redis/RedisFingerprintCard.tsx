import { Activity, KeyRound, Timer } from "lucide-react";

import { DateTimeText } from "../DateTimeText";
import { fingerprintRows, formatDuration } from "../../lib/redis-format";
import type { RedisResource } from "../../types/api";

/**
 * What Revenant knows about this Redis right now.
 *
 * Deliberately shows `requirepass` as SET / not set and never renders a value,
 * a key name or a sample value — the API does not send them in the first place,
 * and this panel must not become a place they could leak from.
 */
export function RedisFingerprintCard({ resource }: { resource: RedisResource }) {
  const rows = fingerprintRows(resource.fingerprint);

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <header className="mb-3 flex items-center gap-2">
        <Activity size={16} className="text-slate-400" />
        <h3 className="text-sm font-medium text-slate-900">Fingerprint</h3>
      </header>

      {!resource.fingerprint ? (
        <p className="rounded-lg bg-amber-50 px-3 py-3 text-sm text-amber-800">
          Not captured yet. Run a restore proof — or paste the URL into a fresh form with
          <span className="font-medium"> Test connection</span> — to see what Revenant can
          observe.
        </p>
      ) : (
        <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm sm:grid-cols-3">
          {rows.map((row) => (
            <div key={row.label} className="min-w-0">
              <dt className="text-xs text-slate-500">{row.label}</dt>
              <dd className="truncate font-medium text-slate-900" title={row.value}>
                {row.value}
              </dd>
            </div>
          ))}
        </dl>
      )}

      <footer className="mt-4 grid gap-2 border-t border-slate-100 pt-3 text-xs text-slate-600 sm:grid-cols-3">
        <div className="flex items-center gap-1.5">
          <Timer size={13} className="text-slate-400" />
          <span>
            Last proven:{" "}
            {resource.lastVerifiedAt ? (
              <DateTimeText value={resource.lastVerifiedAt} />
            ) : (
              "never"
            )}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <Timer size={13} className="text-slate-400" />
          <span>Restore time: {formatDuration(resource.lastRestoreProofSeconds)}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <KeyRound size={13} className="text-slate-400" />
          <span>
            Keyspace digest:{" "}
            {resource.fingerprint?.sampleDigest
              ? `${resource.fingerprint.sampleDigest.slice(0, 12)}…`
              : "not sampled"}
          </span>
        </div>
      </footer>

      <p className="mt-3 text-[11px] leading-relaxed text-slate-400">
        Sampled keys and values are hashed with SHA-256 on the Redis server itself. Raw
        keys and values never reach Revenant.
      </p>
    </section>
  );
}