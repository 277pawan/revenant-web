import { useCallback, useEffect, useRef, useState } from "react";
import {
  CheckCircle2,
  CircleHelp,
  Loader2,
  Sparkles,
  Upload,
  XCircle,
} from "lucide-react";
import { api } from "../lib/api";
import {
  SchemaPasteGuide,
  SchemaSourceTabs,
  type SchemaGuideTab,
} from "./SchemaPasteGuide";
import type {
  GenerateValidationYamlResponse,
  YamlComposerStatus,
} from "../types/api";

const LAYERS: Array<{ id: string; label: string }> = [
  { id: "schema", label: "Tables" },
  { id: "foreign_key", label: "FKs" },
  { id: "row_count", label: "Not empty" },
  { id: "freshness", label: "Fresh" },
  { id: "index", label: "Indexes" },
  { id: "golden_query", label: "Rules" },
];

type ProofComposerProps = {
  planName: string;
  disabled?: boolean;
  onApply: (yamlText: string) => void;
  onStatusChange?: (status: YamlComposerStatus) => void;
  /** Parent should open the composer accordion */
  onRequestOpen?: () => void;
};

function lineCount(text: string): number {
  if (!text.trim()) return 0;
  return text.split("\n").length;
}

export function ProofComposer({
  planName,
  disabled,
  onApply,
  onStatusChange,
  onRequestOpen,
}: ProofComposerProps) {
  const [guideTab, setGuideTab] = useState<SchemaGuideTab>("prisma");
  const [status, setStatus] = useState<YamlComposerStatus | null>(null);
  const [schemaText, setSchemaText] = useState("");
  const [fileName, setFileName] = useState<string | null>(null);
  const [intent, setIntent] = useState("");
  const [layers, setLayers] = useState<string[]>([
    "schema",
    "foreign_key",
    "row_count",
  ]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<GenerateValidationYamlResponse | null>(null);
  const [showForm, setShowForm] = useState(true);
  const inputRef = useRef<HTMLInputElement>(null);
  const guideRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    void api
      .getYamlComposerStatus()
      .then((s) => {
        setStatus(s);
        onStatusChange?.(s);
      })
      .catch(() => {
        const off = { enabled: false, provider: null, model: null };
        setStatus(off);
        onStatusChange?.(off);
      });
  }, [onStatusChange]);

  const onFiles = useCallback(
    async (file: File | undefined) => {
      if (!file) return;
      const text = await file.text();
      if (text.length > 80_000) {
        setError("Over 80KB — paste core tables only.");
        return;
      }
      setFileName(file.name);
      setSchemaText(text);
      setError(null);
      setResult(null);
      setShowForm(true);
      onRequestOpen?.();
    },
    [onRequestOpen]
  );

  function toggleLayer(id: string) {
    setLayers((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  function clearFile() {
    setFileName(null);
    setSchemaText("");
    setResult(null);
  }

  function resetComposer() {
    clearFile();
    setIntent("");
    setError(null);
    setResult(null);
    setShowForm(true);
    onRequestOpen?.();
  }

  function openHelp() {
    onRequestOpen?.();
    requestAnimationFrame(() => {
      guideRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    });
  }

  async function compose() {
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const res = await api.composeValidationYaml({
        schemaText,
        intent: intent.trim() || undefined,
        planName: planName.trim() || undefined,
        layers,
      });
      setResult(res);
      onApply(res.yamlText);
      setShowForm(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not compose YAML");
    } finally {
      setBusy(false);
    }
  }

  const enabled = status?.enabled && !disabled;
  const ready = schemaText.trim().length >= 20;
  const lines = lineCount(schemaText);

  const layerSummary = result
    ? Object.keys(result.summary.byType)
        .slice(0, 3)
        .join(" · ")
    : "";

  if (result && !showForm) {
    return (
      <div className="flex h-full flex-col px-3 py-3">
        <div className="rounded-lg border border-emerald-100 bg-emerald-50/60 px-3 py-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-sm text-slate-800">
              <CheckCircle2 size={18} className="shrink-0 text-emerald-600" />
              <span>
                <span className="font-medium">{result.summary.total} checks composed</span>
                {layerSummary ? (
                  <span className="text-slate-500"> — {layerSummary}</span>
                ) : null}
              </span>
            </div>
            <div className="flex items-center gap-3 text-xs font-medium">
              <button
                type="button"
                onClick={() => setShowForm(true)}
                className="text-brand hover:underline"
              >
                Edit again
              </button>
              <button
                type="button"
                onClick={resetComposer}
                className="text-slate-500 hover:text-slate-800"
              >
                Reset
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="scrollbar-thin flex h-full min-h-0 flex-col overflow-y-auto px-3 pb-3 pt-2">
      <div className="mb-2 flex justify-end">
        <button
          type="button"
          onClick={openHelp}
          className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-slate-500 hover:bg-white hover:text-slate-700"
        >
          <CircleHelp size={14} />
          Schema help
        </button>
      </div>

      <div className="flex flex-col gap-3">
        <div className="min-w-0">
          <div className="mb-2 flex items-center justify-between gap-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Schema Source
            </span>
            <SchemaSourceTabs active={guideTab} onChange={setGuideTab} />
          </div>

          <div
            className={`rounded-lg border border-dashed border-brand bg-white p-3 ${
              busy ? "proof-drop-busy relative" : ""
            }`}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              void onFiles(e.dataTransfer.files[0]);
            }}
          >
            <input
              ref={inputRef}
              type="file"
              accept=".sql,.prisma,.ts,.js,.rb,.txt,.schema"
              className="sr-only"
              disabled={!enabled || busy}
              onChange={(e) => void onFiles(e.target.files?.[0])}
            />

            {(fileName || schemaText) && (
              <div className="mb-2 flex items-center justify-between gap-2">
                <div className="inline-flex items-center gap-1.5 rounded border border-slate-100 bg-slate-50 px-2 py-1">
                  <span className="font-mono text-[11px] text-slate-700">
                    {fileName ?? "pasted-schema"}
                  </span>
                  <button
                    type="button"
                    onClick={clearFile}
                    className="text-slate-400 hover:text-slate-600"
                    aria-label="Clear schema"
                  >
                    <XCircle size={12} />
                  </button>
                </div>
                {lines > 0 && (
                  <span className="font-mono text-[11px] text-slate-400">
                    {lines} lines
                  </span>
                )}
              </div>
            )}

            <textarea
              value={schemaText}
              onChange={(e) => {
                setSchemaText(e.target.value);
                if (fileName) setFileName(null);
                setResult(null);
              }}
              disabled={!enabled || busy}
              rows={3}
              placeholder={`datasource db { provider = "postgresql" … }\nmodel User { id Int @id … }`}
              className="w-full resize-y border-0 bg-transparent font-mono text-[11px] leading-relaxed text-slate-600 placeholder:text-slate-400 focus:outline-none"
            />
          </div>

          <button
            type="button"
            disabled={!enabled || busy}
            onClick={() => inputRef.current?.click()}
            className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-brand underline-offset-2 hover:underline"
          >
            <Upload size={12} />
            Upload another schema file
          </button>
        </div>

        <div className="w-full">
          <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            Proof Layers
          </p>
          <div className="flex flex-wrap gap-1.5">
            {LAYERS.map((layer) => {
              const on = layers.includes(layer.id);
              return (
                <button
                  key={layer.id}
                  type="button"
                  disabled={!enabled || busy}
                  onClick={() => toggleLayer(layer.id)}
                  className={`rounded-md px-2.5 py-1.5 text-xs font-medium transition ${
                    on
                      ? "border border-brand bg-brand text-white"
                      : "border border-slate-100 bg-slate-100 text-slate-700 hover:bg-slate-200"
                  }`}
                >
                  {layer.label}
                </button>
              );
            })}
          </div>

          <p className="mb-1.5 mt-3 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            Optional Rules
          </p>
          <input
            type="text"
            value={intent}
            onChange={(e) => setIntent(e.target.value)}
            disabled={!enabled || busy}
            placeholder="paid orders last 7d ≥ 1"
            className="w-full rounded-md border border-slate-100 bg-white px-2.5 py-2 text-xs text-slate-700 placeholder:text-slate-400 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand/30"
          />

          <button
            type="button"
            disabled={!enabled || busy || !ready}
            onClick={() => void compose()}
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-md bg-brand px-4 py-2.5 text-[13px] font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {busy ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Sparkles size={14} />
            )}
            Compose YAML
          </button>

          {!status?.enabled && status != null && (
            <p className="mt-2 text-[10px] text-amber-700">
              Set MISTRAL_API_KEY on the API to enable.
            </p>
          )}
        </div>
      </div>

      <div ref={guideRef} className="mt-3">
        <SchemaPasteGuide activeTab={guideTab} onTabChange={setGuideTab} />
      </div>

      {error && (
        <p className="mt-2 text-xs text-red-600" role="alert">{error}</p>
      )}
    </div>
  );
}
