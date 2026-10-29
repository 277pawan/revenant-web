/**
 * Presentation helpers for the Redis provider.
 *
 * Kept out of the page so the wording about TTL, secrets and snapshot state is
 * identical everywhere it appears.
 */
import type {
  RedisFingerprint,
  RedisResource,
  RedisSnapshotResource,
  RedisSnapshotStatus,
  RedisVerificationStatus,
} from "../types/api";

/** Bytes → human. Binary units, because RDB files are binary. */
export function formatBytes(bytes: number | null | undefined): string {
  if (bytes == null || !Number.isFinite(bytes)) return "—";
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / 1024 ** i;
  return `${value >= 100 || i === 0 ? Math.round(value) : value.toFixed(1)} ${units[i]}`;
}

export function formatNumber(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return value.toLocaleString("en-IN");
}

/** Seconds → "4m 12s". Used for RTO/RPO where precision matters. */
export function formatDuration(seconds: number | null | undefined): string {
  if (seconds == null || !Number.isFinite(seconds)) return "—";
  if (seconds < 60) return `${Math.round(seconds)}s`;
  if (seconds < 3600) {
    const m = Math.floor(seconds / 60);
    const s = Math.round(seconds % 60);
    return s ? `${m}m ${s}s` : `${m}m`;
  }
  const h = Math.floor(seconds / 3600);
  const m = Math.round((seconds % 3600) / 60);
  return m ? `${h}h ${m}m` : `${h}h`;
}

/**
 * Countdown to a TTL deadline, for the "expires in" column.
 * Returns null once expired — the sweeper will delete it imminently.
 */
export function timeUntil(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return "expiring";
  return `expires in ${formatDuration(ms / 1000)}`;
}

/** RDB TTL is enforced server-side, so the UI must always show it. */
export function redisTtlTone(hours: number | null): "short" | "normal" | "none" {
  if (hours == null) return "none";
  return hours <= 24 ? "short" : "normal";
}

export const SNAPSHOT_STATUS_LABEL: Record<RedisSnapshotStatus, string> = {
  capturing: "Capturing",
  stored: "Stored",
  expired: "Expired",
  deleted: "Deleted",
  failed: "Failed",
};

export const SNAPSHOT_STATUS_TONE: Record<RedisSnapshotStatus, string> = {
  capturing: "bg-sky-100 text-sky-800",
  stored: "bg-emerald-100 text-emerald-800",
  expired: "bg-slate-100 text-slate-600",
  deleted: "bg-slate-100 text-slate-500",
  failed: "bg-red-100 text-red-800",
};

export const VERIFICATION_LABEL: Record<RedisVerificationStatus, string> = {
  verified: "Verified",
  failed: "Failed",
  never: "Not yet proven",
  pending: "In progress",
};

export const VERIFICATION_TONE: Record<RedisVerificationStatus, string> = {
  verified: "bg-emerald-100 text-emerald-800",
  failed: "bg-red-100 text-red-800",
  never: "bg-amber-100 text-amber-800",
  pending: "bg-sky-100 text-sky-800",
};

/** Rows of key/value pairs from a fingerprint. */
export function fingerprintRows(
  fingerprint: RedisFingerprint | null
): Array<{ label: string; value: string }> {
  if (!fingerprint) return [];

  const rows: Array<{ label: string; value: string }> = [
    { label: "Version", value: fingerprint.version ?? "unknown" },
    { label: "Mode", value: fingerprint.mode ?? "unknown" },
    { label: "Keys", value: formatNumber(fingerprint.totalKeys) },
    { label: "Keys with expiry", value: formatNumber(fingerprint.totalExpires) },
    { label: "Memory used", value: formatBytes(fingerprint.usedMemoryBytes) },
    {
      label: "maxmemory",
      value: fingerprint.maxmemoryBytes
        ? formatBytes(fingerprint.maxmemoryBytes)
        : "unlimited",
    },
    { label: "Eviction policy", value: fingerprint.maxmemoryPolicy ?? "—" },
    { label: "AOF", value: fingerprint.appendOnly ?? "unknown" },
    { label: "RDB save policy", value: fingerprint.savePolicy || "disabled" },
    {
      label: "requirepass",
      // Never render a password — the API only ever sends SET / NOT SET.
      value: fingerprint.requirepass === "SET" ? "SET (masked)" : "not set",
    },
  ];
  return rows;
}

/** Non-blocking guidance for what to do after a failed/unreachable test. */
export function redisTestAdvice(unreachable: boolean, error: string | null): string {
  if (unreachable) {
    return "Revenant could not reach this Redis. If it sits on a private network, run `revenant redis-prove --url …` from inside it, or attach the Revenant agent.";
  }
  return error ?? "Could not verify this Redis URL.";
}

// ─── Proof state ────────────────────────────────────────────────────────────

/**
 * Proof statuses, in the customer's language.
 *
 * The distinction that matters: `fail` means the backup was tested and did
 * not restore. `error` means the check could not be run. Collapsing them
 * sends customers hunting for a broken backup they do not have.
 */
export const PROOF_STATUS_LABEL: Record<string, string> = {
  pending: "Queued",
  running: "Running",
  pass: "Restored",
  fail: "Restore failed",
  error: "Could not run",
};

export const PROOF_STATUS_TONE: Record<string, string> = {
  pending: "bg-amber-100 text-amber-800",
  running: "bg-sky-100 text-sky-800",
  pass: "bg-emerald-100 text-emerald-800",
  fail: "bg-red-100 text-red-800",
  error: "bg-red-100 text-red-700",
};

/** Who is executing this run. */
export function proofExecutorLabel(claimedBy: string | null | undefined): string | null {
  if (!claimedBy) return null;
  if (claimedBy.startsWith("cloud:")) return "Revenant cloud runner";
  if (claimedBy === "agent") return "Revenant agent";
  return claimedBy;
}

/**
 * Why a proof is still waiting, when we know.
 *
 * The old copy told every customer that "an online Redis proof worker must
 * claim this run" — which was true of the old architecture and is not true
 * now. Revenant's cloud runner claims proofs itself; an agent is only
 * involved when the Redis is on a network the cloud cannot reach.
 */
export function proofWaitingNote(proof: {
  status: string;
  lastErrorKind?: string | null;
  lastError?: string | null;
}): string | null {
  if (proof.status !== "pending") return null;
  if (proof.lastErrorKind === "unreachable") {
    return (
      proof.lastError ??
      "Revenant's cloud runner could not reach this Redis, so the run is waiting for the Revenant agent on your network."
    );
  }
  return "Revenant's cloud runner picks this up automatically — usually within a few seconds.";
}

/** Snapshot rows sorted so live artifacts float to the top. */
export function sortSnapshots(
  snapshots: RedisSnapshotResource[]
): RedisSnapshotResource[] {
  return [...snapshots].sort((a, b) => {
    const rank = (s: RedisSnapshotResource) =>
      s.status === "stored" ? 0 : s.status === "capturing" ? 1 : 2;
    const byRank = rank(a) - rank(b);
    if (byRank !== 0) return byRank;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });
}

/** A resource is "proven" only once a proof actually restored an RDB. */
export function isRedisProven(resource: RedisResource): boolean {
  return resource.lastVerificationStatus === "verified";
}