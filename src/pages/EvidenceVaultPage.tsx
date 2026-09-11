import { useCallback, useEffect, useState } from "react";
import { Download, FileCheck } from "lucide-react";
import { AppShell } from "../components/AppShell";
import { PaginationBar } from "../components/PaginationBar";
import { useToast } from "../components/toast/ToastProvider";
import { api } from "../lib/api";
import type { EvidenceArtifactResource, PaginationMeta } from "../types/api";

export function EvidenceVaultPage() {
  const toast = useToast();
  const [artifacts, setArtifacts] = useState<EvidenceArtifactResource[]>([]);
  const [pagination, setPagination] = useState<PaginationMeta>({
    page: 1,
    pageSize: 20,
    total: 0,
    totalPages: 1,
  });
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (nextPage: number) => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.listEvidence(nextPage, 20);
      setArtifacts(res.data);
      setPagination(res.pagination);
      setPage(res.pagination.page);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load evidence");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(page);
  }, [load, page]);

  async function download(id: string) {
    try {
      await api.downloadEvidence(id);
      toast.success("Download started", "Evidence JSON saved.");
    } catch (err) {
      toast.error(
        "Download failed",
        err instanceof Error ? err.message : "Could not download"
      );
    }
  }

  return (
    <AppShell>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-slate-900">Evidence Vault</h1>
        <p className="mt-1 text-sm text-slate-600">
          Signed JSON reports from completed validation runs.
        </p>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50 text-left text-slate-600">
            <tr>
              <th className="px-4 py-3 font-medium">Workflow</th>
              <th className="px-4 py-3 font-medium">Job</th>
              <th className="px-4 py-3 font-medium">SHA-256</th>
              <th className="px-4 py-3 font-medium">Size</th>
              <th className="px-4 py-3 font-medium">Signed</th>
              <th className="px-4 py-3 font-medium" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                  Loading…
                </td>
              </tr>
            ) : artifacts.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center text-slate-500">
                  <FileCheck className="mx-auto mb-2 text-slate-300" size={32} />
                  No evidence yet. Reports appear when jobs complete.
                </td>
              </tr>
            ) : (
              artifacts.map((a) => (
                <tr key={a.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 text-slate-900">{a.databaseName}</td>
                  <td className="px-4 py-3 font-mono text-xs text-slate-600">
                    {a.jobId.slice(0, 8)}…
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-slate-500">
                    {a.sha256.slice(0, 12)}…
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {(a.byteSize / 1024).toFixed(1)} KB
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {new Date(a.signedAt).toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => void download(a.id)}
                      className="inline-flex items-center gap-1 text-xs text-brand hover:underline"
                    >
                      <Download size={14} />
                      Download
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <PaginationBar pagination={pagination} onPageChange={setPage} />
    </AppShell>
  );
}
