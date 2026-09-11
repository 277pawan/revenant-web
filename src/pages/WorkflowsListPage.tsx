import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ChevronRight, Play, RefreshCw, Search } from "lucide-react";
import { AppShell } from "../components/AppShell";
import { StatusBadge } from "../components/workflow/StatusBadge";
import { api } from "../lib/api";
import {
  checksSummary,
  formatRelativeTime,
  workflowShortId,
  workflowSlug,
} from "../lib/workflow";
import type { PlanServiceResource } from "../types/api";

function WorkflowRow({ service }: { service: PlanServiceResource }) {
  const last = service.jobs[0];
  const slug = workflowSlug(service);

  return (
    <Link
      to={`/workflows/${service.databaseId}`}
      className="group flex items-center gap-4 border-b border-slate-100 px-4 py-3.5 transition-colors hover:bg-slate-50 last:border-b-0"
    >
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-50 text-brand">
        <Play size={16} fill="currentColor" />
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-semibold text-slate-900 group-hover:text-brand">
            {slug}
          </span>
          <span className="font-mono text-[10px] text-slate-400">
            {workflowShortId(service.databaseId)}
          </span>
        </div>
        <p className="mt-0.5 text-xs text-slate-500">
          {service.databaseName} · Validation plan
        </p>
      </div>

      <div className="hidden w-36 shrink-0 sm:block">
        {last ? (
          <div className="flex flex-col gap-1">
            <StatusBadge status={last.status} />
            <span className="text-[10px] text-slate-400">
              {formatRelativeTime(last.createdAt)}
            </span>
          </div>
        ) : (
          <span className="text-xs text-slate-400">No runs</span>
        )}
      </div>

      <div className="hidden w-32 shrink-0 text-xs text-slate-600 md:block">
        {last ? checksSummary(last) : "—"}
      </div>

      <div className="hidden w-28 shrink-0 text-xs text-slate-500 lg:block">
        Manual
      </div>

      <ChevronRight
        size={16}
        className="shrink-0 text-slate-300 group-hover:text-brand"
      />
    </Link>
  );
}

export function WorkflowsListPage() {
  const [services, setServices] = useState<PlanServiceResource[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.listPlanServices();
      setServices(res.services);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load workflows");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    return services.filter((s) => {
      const slug = workflowSlug(s);
      const matchSearch =
        !search ||
        slug.includes(search.toLowerCase()) ||
        s.databaseName.toLowerCase().includes(search.toLowerCase());
      const last = s.jobs[0];
      const matchStatus =
        statusFilter === "all" ||
        (last && last.status === statusFilter) ||
        (statusFilter === "none" && !last);
      return matchSearch && matchStatus;
    });
  }, [services, search, statusFilter]);

  return (
    <AppShell>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
            Workflows
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Validation plans and their execution history
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            to="/settings/validation-plans"
            className="rounded-md bg-brand px-3 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            + Create workflow
          </Link>
          <button
            type="button"
            onClick={() => void load()}
            className="inline-flex items-center gap-1 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
          >
            <RefreshCw size={14} />
            Refresh
          </button>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap gap-3">
        <div className="relative min-w-[200px] flex-1">
          <Search
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
          />
          <input
            type="search"
            placeholder="Search workflows…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-md border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
        >
          <option value="all">Status: All</option>
          <option value="pass">Pass</option>
          <option value="fail">Fail</option>
          <option value="running">Running</option>
          <option value="pending">Pending</option>
          <option value="none">No runs</option>
        </select>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      )}

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="hidden border-b border-slate-100 bg-slate-50 px-4 py-2 text-[10px] font-semibold uppercase tracking-wide text-slate-400 sm:grid sm:grid-cols-[1fr_9rem_8rem_7rem_1.5rem] sm:gap-4">
          <span>Workflow</span>
          <span>Last run</span>
          <span className="hidden md:block">Checks</span>
          <span className="hidden lg:block">Schedule</span>
          <span />
        </div>

        {loading && services.length === 0 ? (
          <div className="h-48 animate-pulse bg-slate-100" />
        ) : filtered.length === 0 ? (
          <p className="px-4 py-12 text-center text-sm text-slate-500">
            No workflows match your filters.
          </p>
        ) : (
          filtered.map((svc) => <WorkflowRow key={svc.databaseId} service={svc} />)
        )}

        {services.length > 0 && (
          <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3 text-xs text-slate-500">
            <span>
              Showing {filtered.length} of {services.length} workflows
            </span>
          </div>
        )}
      </section>
    </AppShell>
  );
}
