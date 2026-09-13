import { useCallback, useEffect, useState } from "react";
import { Copy, Eye, ScrollText } from "lucide-react";
import { AppShell } from "../components/AppShell";
import { AuditEventDetailDialog } from "../components/AuditEventDetailDialog";
import { DateTimeText } from "../components/DateTimeText";
import { PaginationBar } from "../components/PaginationBar";
import { TableSearchBar } from "../components/TableSearchBar";
import { useToast } from "../components/toast/ToastProvider";
import { useDebouncedValue } from "../hooks/useDebouncedValue";
import { auditResourceLabel, formatAuditAction } from "../lib/audit";
import { api } from "../lib/api";
import { getUserTimezone } from "../lib/datetime";
import type { AuditEventResource, PaginationMeta } from "../types/api";

export function AuditLogPage() {
  const toast = useToast();
  const [events, setEvents] = useState<AuditEventResource[]>([]);
  const [pagination, setPagination] = useState<PaginationMeta>({
    page: 1,
    pageSize: 20,
    total: 0,
    totalPages: 1,
  });
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search, 300);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewEvent, setViewEvent] = useState<AuditEventResource | null>(null);

  const load = useCallback(async (nextPage: number, searchTerm: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.listAuditEvents(
        nextPage,
        20,
        searchTerm.trim() || undefined
      );
      setEvents(res.data);
      setPagination(res.pagination);
      setPage(res.pagination.page);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load audit log");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch]);

  useEffect(() => {
    void load(page, debouncedSearch);
  }, [load, page, debouncedSearch]);

  async function copyValue(label: string, value: string) {
    try {
      await navigator.clipboard.writeText(value);
      toast.success("Copied", `${label} copied to clipboard.`);
    } catch {
      toast.error("Copy failed", "Could not copy to clipboard.");
    }
  }

  return (
    <AppShell>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-slate-900">Audit Log</h1>
        <p className="mt-1 text-sm text-slate-600">
          Append-only record of changes in your organization. Times shown in{" "}
          <span className="font-medium text-slate-800">{getUserTimezone()}</span>.
          Search by action, resource type, event ID, resource ID, actor ID, or metadata.
        </p>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <TableSearchBar
          value={search}
          onChange={setSearch}
          placeholder="Search event ID, resource ID, actor ID, action, type…"
        />
        <div className="overflow-x-auto">
          <table className="min-w-[900px] w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-left text-slate-600">
              <tr>
                <th className="px-4 py-3 font-medium">Time</th>
                <th className="px-4 py-3 font-medium">Action</th>
                <th className="px-4 py-3 font-medium">Resource</th>
                <th className="px-4 py-3 font-medium">Resource ID</th>
                <th className="px-4 py-3 font-medium">Event ID</th>
                <th className="px-4 py-3 font-medium text-right">View</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                    Loading…
                  </td>
                </tr>
              ) : events.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-slate-500">
                    <ScrollText className="mx-auto mb-2 text-slate-300" size={32} />
                    {debouncedSearch.trim()
                      ? `No audit events match “${debouncedSearch.trim()}”.`
                      : "No audit events yet."}
                  </td>
                </tr>
              ) : (
                events.map((e) => (
                  <tr key={e.id} className="hover:bg-slate-50">
                    <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                      <DateTimeText value={e.createdAt} />
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-900">
                        {formatAuditAction(e.action)}
                      </div>
                      <div className="font-mono text-[10px] text-slate-400">{e.action}</div>
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {auditResourceLabel(e.resourceType)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <code
                          className="max-w-[200px] truncate font-mono text-xs text-slate-700"
                          title={e.resourceId}
                        >
                          {e.resourceId}
                        </code>
                        <button
                          type="button"
                          onClick={() => void copyValue("Resource ID", e.resourceId)}
                          className="shrink-0 rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                          title="Copy resource ID"
                        >
                          <Copy size={12} />
                        </button>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <code
                          className="max-w-[160px] truncate font-mono text-xs text-slate-500"
                          title={e.id}
                        >
                          {e.id}
                        </code>
                        <button
                          type="button"
                          onClick={() => void copyValue("Event ID", e.id)}
                          className="shrink-0 rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                          title="Copy event ID"
                        >
                          <Copy size={12} />
                        </button>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => setViewEvent(e)}
                        className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
                        title="View full details"
                      >
                        <Eye size={14} />
                        View
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <PaginationBar pagination={pagination} onPageChange={setPage} />

      <AuditEventDetailDialog
        event={viewEvent}
        onClose={() => setViewEvent(null)}
        onCopy={(label, value) => void copyValue(label, value)}
      />
    </AppShell>
  );
}
