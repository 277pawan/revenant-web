import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, Play, Search } from "lucide-react";
import { api } from "../lib/api";
import type { DatabaseResource } from "../types/api";

type Props = {
  value: string;
  onChange: (databaseId: string, database: DatabaseResource | null) => void;
  /** Workflows already on a schedule — hidden from list */
  excludeIds?: string[];
  disabled?: boolean;
  invalid?: boolean;
  error?: string;
};

/**
 * Searchable workflow picker (shadcn Combobox-style, no extra deps).
 * Only lists databases that have a validation plan.
 */
export function WorkflowPicker({
  value,
  onChange,
  excludeIds = [],
  disabled,
  invalid,
  error,
}: Props) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [workflows, setWorkflows] = useState<DatabaseResource[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedLabel, setSelectedLabel] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const excludeSet = useMemo(() => new Set(excludeIds), [excludeIds]);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.listDatabases(1, 50, debouncedSearch || undefined);
      setWorkflows(
        res.data.filter((d) => d.hasValidationPlan && !excludeSet.has(d.id))
      );
      if (value) {
        const match = res.data.find((d) => d.id === value);
        if (match) setSelectedLabel(match.name);
      }
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, value, excludeSet]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!value) {
      setSelectedLabel(null);
      return;
    }
    const match = workflows.find((d) => d.id === value);
    if (match) setSelectedLabel(match.name);
    else if (!selectedLabel) {
      void api.getDatabase(value).then((res) => setSelectedLabel(res.database.name));
    }
  }, [value, workflows, selectedLabel]);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!containerRef.current?.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  const selected = useMemo(
    () => workflows.find((d) => d.id === value) ?? null,
    [workflows, value]
  );

  function pick(db: DatabaseResource) {
    setSelectedLabel(db.name);
    onChange(db.id, db);
    setOpen(false);
    setSearch("");
  }

  const borderClass = invalid
    ? "border-red-400 focus-within:ring-red-200"
    : "border-slate-300 focus-within:ring-brand/20 focus-within:border-brand";

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        className={`flex w-full items-center justify-between gap-2 rounded-md border bg-white px-3 py-2 text-left text-sm disabled:bg-slate-50 ${borderClass}`}
        aria-expanded={open}
        aria-haspopup="listbox"
      >
        <span className="flex min-w-0 items-center gap-2">
          <Play size={16} className="shrink-0 text-slate-400" />
          <span className={selectedLabel ? "text-slate-900" : "text-slate-400"}>
            {selectedLabel ?? "Search workflows…"}
          </span>
          {selected?.validationPlanVersion != null && (
            <span className="hidden rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-medium text-emerald-800 sm:inline">
              Plan v{selected.validationPlanVersion}
            </span>
          )}
        </span>
        <ChevronDown size={16} className="shrink-0 text-slate-400" />
      </button>

      {open && !disabled && (
        <div
          className="absolute z-20 mt-1 w-full rounded-lg border border-slate-200 bg-white shadow-lg"
          role="listbox"
        >
          <div className="border-b border-slate-100 p-2">
            <div className="relative">
              <Search
                size={14}
                className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400"
              />
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by workflow or database name…"
                className="w-full rounded-md border border-slate-200 py-2 pl-8 pr-3 text-sm focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
                autoFocus
              />
            </div>
          </div>
          <ul className="max-h-56 overflow-y-auto py-1">
            {loading ? (
              <li className="px-3 py-4 text-center text-sm text-slate-500">Loading…</li>
            ) : workflows.length === 0 ? (
              <li className="px-3 py-4 text-center text-sm text-slate-500">
                {debouncedSearch
                  ? "No workflows match your search."
                  : "No workflows available. Add a validation plan first."}
              </li>
            ) : (
              workflows.map((db) => {
                const isSelected = db.id === value;
                return (
                  <li key={db.id}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={isSelected}
                      onClick={() => pick(db)}
                      className={`flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left text-sm hover:bg-slate-50 ${
                        isSelected ? "bg-slate-50" : ""
                      }`}
                    >
                      <span className="min-w-0 flex-1">
                        <span className="font-medium text-slate-900">{db.name}</span>
                        {db.validationPlanName && (
                          <span className="mt-0.5 block truncate text-xs text-slate-500">
                            Plan: {db.validationPlanName}
                            {db.recoveryMode === "aws-rds" ? " · AWS restore" : ""}
                          </span>
                        )}
                      </span>
                      <span className="flex shrink-0 items-center gap-1.5">
                        <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-medium text-emerald-800">
                          v{db.validationPlanVersion}
                        </span>
                        {isSelected && <Check size={14} className="text-brand" />}
                      </span>
                    </button>
                  </li>
                );
              })
            )}
          </ul>
        </div>
      )}

      {error && (
        <p className="mt-1 text-xs text-red-600" role="alert">{error}</p>
      )}
    </div>
  );
}
