import { useState } from "react";
import { CheckCircle2, Loader2, Plug, ShieldAlert, WifiOff } from "lucide-react";

import { Field, Input } from "../ui/Field";
import { api } from "../../lib/api";
import { fingerprintRows, redisTestAdvice } from "../../lib/redis-format";
import type { RedisTestResult } from "../../types/api";

/**
 * Paste a Redis URL → find out whether Revenant can actually see it.
 *
 * This is the cheapest possible moment in the product: nothing is saved, no
 * resource is created, and the answer is immediate. A customer whose Redis is
 * on a private network gets a 200 with `unreachable: true` and is told to use
 * the CLI or the agent — which is a correct answer, not a failure.
 */
export function RedisUrlTestPanel({
  value,
  onChange,
  disabled,
}: {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState<RedisTestResult | null>(null);

  async function runTest() {
    const url = value.trim();
    if (!url) return;
    setTesting(true);
    setResult(null);
    try {
      const res = await api.testRedisUrl(url);
      setResult(res.test);
    } catch (err) {
      setResult({
        ok: false,
        redactedUrl: "redis://<invalid>",
        latencyMs: null,
        fingerprint: null,
        error:
          err instanceof Error ? err.message : "Could not reach the Revenant API.",
        unreachable: false,
      });
    } finally {
      setTesting(false);
    }
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
      <Field
        label="Redis URL"
        htmlFor="redis-url"
        required
        hint="redis://[:password]@host:port/db — or rediss:// for TLS. Stored encrypted; never shown again."
      >
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input
            id="redis-url"
            value={value}
            disabled={disabled}
            placeholder="redis://:password@localhost:6379"
            autoComplete="off"
            spellCheck={false}
            onChange={(e) => {
              onChange(e.target.value);
              setResult(null);
            }}
          />
          <button
            type="button"
            onClick={() => void runTest()}
            disabled={testing || disabled || !value.trim()}
            className="inline-flex shrink-0 items-center justify-center gap-2 rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
          >
            {testing ? <Loader2 size={16} className="animate-spin" /> : <Plug size={16} />}
            {testing ? "Testing…" : "Test connection"}
          </button>
        </div>
      </Field>

      {result && (
        <div
          className={`mt-3 rounded-lg border px-3 py-3 text-sm ${
            result.ok
              ? "border-emerald-200 bg-emerald-50"
              : result.unreachable
                ? "border-amber-200 bg-amber-50"
                : "border-red-200 bg-red-50"
          }`}
          role="status"
        >
          <div className="flex items-start gap-2">
            {result.ok ? (
              <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-emerald-700" />
            ) : result.unreachable ? (
              <WifiOff size={16} className="mt-0.5 shrink-0 text-amber-700" />
            ) : (
              <ShieldAlert size={16} className="mt-0.5 shrink-0 text-red-700" />
            )}
            <div className="min-w-0 flex-1">
              <p
                className={`font-medium ${
                  result.ok
                    ? "text-emerald-900"
                    : result.unreachable
                      ? "text-amber-900"
                      : "text-red-900"
                }`}
              >
                {result.ok
                  ? "Connected — Revenant can reach this Redis"
                  : result.unreachable
                    ? "Not reachable from Revenant"
                    : "Connection rejected"}
              </p>

              <p className="mt-0.5 font-mono text-xs break-all text-slate-600">
                {result.redactedUrl}
                {result.latencyMs != null && ` · ${result.latencyMs}ms`}
              </p>

              {!result.ok && (
                <p className="mt-2 text-xs leading-relaxed text-slate-700">
                  {redisTestAdvice(result.unreachable, result.error)}
                </p>
              )}

              {result.fingerprint && (
                <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 border-t border-black/5 pt-3 text-xs sm:grid-cols-3">
                  {fingerprintRows(result.fingerprint).map((row) => (
                    <div key={row.label} className="min-w-0">
                      <dt className="text-slate-500">{row.label}</dt>
                      <dd className="truncate font-medium text-slate-900" title={row.value}>
                        {row.value}
                      </dd>
                    </div>
                  ))}
                </dl>
              )}

              <p className="mt-3 border-t border-black/5 pt-2 text-[11px] text-slate-500">
                Revenant stores metadata only — keyspace counts and SHA-256 digests.
                No keys, no values, and never your password.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}