import { useCallback, useEffect, useState } from "react";
import { ChevronDown, ChevronUp, Save, Shield } from "lucide-react";
import { Link } from "react-router-dom";
import { api } from "../lib/api";
import {
  RECOVERY_CONTRACT_EXAMPLE,
  VALIDATION_PLAN_HTTP_HEALTH_EXAMPLE,
} from "../lib/recovery-contract-help";
import { useToast } from "./toast/ToastProvider";
import type { RecoveryContractResource } from "../types/api";
import { roleHasPermission } from "../types/api";
import { useAuth } from "../lib/auth";

export function RecoveryContractPanel({ databaseId }: { databaseId: string }) {
  const { user } = useAuth();
  const toast = useToast();
  const canEdit = user ? roleHasPermission(user.role, "plans:write") : false;

  const [contract, setContract] = useState<RecoveryContractResource | null>(null);
  const [yamlText, setYamlText] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showReference, setShowReference] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { contract: data } = await api.getRecoveryContract(databaseId);
      setContract(data);
      setYamlText(data.yamlText);
    } catch (err) {
      toast.error(
        "Could not load recovery contract",
        err instanceof Error ? err.message : "Request failed"
      );
    } finally {
      setLoading(false);
    }
  }, [databaseId, toast]);

  useEffect(() => {
    void load();
  }, [load]);

  async function save() {
    if (!canEdit) return;
    setSaving(true);
    try {
      const { contract: data } = await api.upsertRecoveryContract(databaseId, {
        yamlText,
      });
      setContract(data);
      setYamlText(data.yamlText);
      const wantsHealth =
        data.definition.recovery.required.healthcheck === true ||
        data.definition.recovery.required.api === true;
      const hasUrl = Boolean(data.definition.recovery.application?.healthcheck);
      if (wantsHealth && !hasUrl) {
        toast.success(
          "Contract saved",
          "Set recovery.application.healthcheck to a full https:// URL."
        );
      } else if (wantsHealth && hasUrl) {
        toast.success(
          "Contract saved",
          "HTTP health check will run on the next drill."
        );
      } else {
        toast.success("Recovery contract saved", `Version ${data.version}`);
      }
    } catch (err) {
      toast.error(
        "Save failed",
        err instanceof Error ? err.message : "Invalid contract YAML"
      );
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <div className="h-48 animate-pulse rounded-xl bg-slate-100" />;
  }

  return (
    <section
      id="recovery-contract"
      className="scroll-mt-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
    >
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
            <Shield size={14} />
            Recovery contract
          </div>
          <p className="mt-1 text-sm text-slate-600">
            RTO/RPO targets and recovery expectations. Scores readiness and signs passports —
            does not replace your validation plan checks.
          </p>
        </div>
        {contract && (
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
            v{contract.version}
          </span>
        )}
      </div>

      <button
        type="button"
        onClick={() => setShowReference((open) => !open)}
        className="mb-3 flex w-full items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-left text-xs font-medium text-slate-700 hover:bg-slate-100"
      >
        <span>Syntax reference — how to add application health</span>
        {showReference ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
      </button>

      {showReference && (
        <div className="mb-4 space-y-3 rounded-lg border border-blue-100 bg-blue-50/60 p-4 text-xs text-slate-700">
          <div>
            <p className="mb-1 font-semibold text-slate-800">1. Recovery contract (this editor)</p>
            <p className="mb-2 text-slate-600">
              Set <code className="rounded bg-white px-1">required.healthcheck: true</code> and
              add a URL under <code className="rounded bg-white px-1">application.healthcheck</code>.
              Durations use <code className="rounded bg-white px-1">15m</code>,{" "}
              <code className="rounded bg-white px-1">1h</code>, <code className="rounded bg-white px-1">90s</code>.
            </p>
            <pre className="overflow-x-auto rounded-md border border-slate-200 bg-white p-3 font-mono text-[11px] leading-relaxed">
              {RECOVERY_CONTRACT_EXAMPLE}
            </pre>
            {canEdit && (
              <button
                type="button"
                onClick={() => setYamlText(RECOVERY_CONTRACT_EXAMPLE)}
                className="mt-2 text-brand hover:underline"
              >
                Insert example into editor
              </button>
            )}
          </div>
          <div>
            <p className="mb-1 font-semibold text-slate-800">
              2. Validation plan (runs during drill)
            </p>
            <p className="mb-2 text-slate-600">
              Database checks (schema, SQL, row counts) live in{" "}
              <Link
                to={`/settings/validation-plans?databaseId=${databaseId}`}
                className="font-medium text-brand hover:underline"
              >
                revenant.yaml
              </Link>
              . You can also add <code className="rounded bg-white px-1">http_health</code> there
              directly:
            </p>
            <pre className="overflow-x-auto rounded-md border border-slate-200 bg-white p-3 font-mono text-[11px] leading-relaxed">
              checks:
              {"\n"}
              {VALIDATION_PLAN_HTTP_HEALTH_EXAMPLE}
            </pre>
          </div>
          <p className="text-slate-600">
            When <code className="rounded bg-white px-1">required.healthcheck</code> is true and a
            URL is set here, Revenant runs an HTTP health check on the next drill (via the agent,
            not the Go CLI — works even on older <code className="rounded bg-white px-1">revenant</code>{" "}
            binaries).
          </p>
        </div>
      )}

      <textarea
        value={yamlText}
        onChange={(e) => setYamlText(e.target.value)}
        readOnly={!canEdit}
        rows={16}
        className="w-full rounded-lg border border-slate-200 bg-slate-50 p-3 font-mono text-xs text-slate-800 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
        spellCheck={false}
      />

      {canEdit && (
        <div className="mt-3 flex justify-end">
          <button
            type="button"
            onClick={() => void save()}
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand/90 disabled:opacity-60"
          >
            <Save size={16} />
            {saving ? "Saving…" : "Save contract"}
          </button>
        </div>
      )}
    </section>
  );
}
