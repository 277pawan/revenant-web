import { useState } from "react";
import { CheckCircle2, Copy, ShieldAlert } from "lucide-react";
import { useToast } from "../toast/ToastProvider";
import { evaluateRecoveryGateClient } from "../../lib/recovery-gate";
import { site } from "../../lib/site";
import type { RecoveryReadinessResource } from "../../types/api";

export function RecoveryGatePanel({
  databaseId,
  readiness,
}: {
  databaseId: string;
  readiness: RecoveryReadinessResource | null;
}) {
  const toast = useToast();
  const [minScore, setMinScore] = useState(70);

  const gate =
    readiness != null
      ? evaluateRecoveryGateClient(readiness.readiness, { minScore })
      : null;

  const curl = `curl -fsS -H "Authorization: Bearer $REVENANT_TOKEN" \\
  "${site.apiUrl}/api/v1/databases/${databaseId}/recovery-gate?minScore=${minScore}"`;

  async function copyCurl() {
    try {
      await navigator.clipboard.writeText(curl);
      toast.success("Copied", "CI gate curl command copied.");
    } catch {
      toast.error("Copy failed", "Could not copy to clipboard.");
    }
  }

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            CI recovery gate
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            Block deploys when recovery readiness falls below your floor. Returns HTTP 200 when
            allowed, 412 when blocked.
          </p>
        </div>
        {gate && (
          <span
            className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${
              gate.allowed
                ? "bg-emerald-50 text-emerald-800 ring-emerald-200"
                : "bg-amber-50 text-amber-900 ring-amber-200"
            }`}
          >
            {gate.allowed ? <CheckCircle2 size={14} /> : <ShieldAlert size={14} />}
            {gate.allowed ? "Would pass" : "Would block"}
          </span>
        )}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
        <label className="flex items-center gap-2 text-slate-600">
          Min score
          <input
            type="number"
            min={0}
            max={100}
            value={minScore}
            onChange={(e) => setMinScore(Number(e.target.value) || 70)}
            className="w-16 rounded border border-slate-300 px-2 py-1 text-slate-900"
          />
        </label>
        <a
          href={`${site.docsUrl}/integrations/ci-gate`}
          className="text-brand hover:underline"
          target="_blank"
          rel="noreferrer"
        >
          CI setup guide →
        </a>
      </div>

      {gate && gate.blockers.length > 0 && (
        <ul className="mt-3 space-y-1 text-xs text-amber-900">
          {gate.blockers.map((b) => (
            <li key={b}>• {b}</li>
          ))}
        </ul>
      )}

      <div className="relative mt-3">
        <pre className="overflow-x-auto rounded-lg bg-slate-900 p-3 text-xs text-slate-100">
          {curl}
        </pre>
        <button
          type="button"
          onClick={() => void copyCurl()}
          className="absolute right-2 top-2 rounded bg-slate-700 p-1.5 text-slate-200 hover:bg-slate-600"
          title="Copy curl"
        >
          <Copy size={14} />
        </button>
      </div>
    </section>
  );
}
