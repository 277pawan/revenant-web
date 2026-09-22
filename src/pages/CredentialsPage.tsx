import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { KeyRound, Lock } from "lucide-react";
import { AppShell } from "../components/AppShell";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { PaginationBar } from "../components/PaginationBar";
import { TableSearchBar } from "../components/TableSearchBar";
import { Field, Input } from "../components/ui/Field";
import { useToast } from "../components/toast/ToastProvider";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import {
  roleHasPermission,
  type DatabaseResource,
  type PaginationMeta,
} from "../types/api";

type RotateKind = "database" | "aws";

export function CredentialsPage() {
  const { user } = useAuth();
  const toast = useToast();
  const canWrite = user ? roleHasPermission(user.role, "credentials:write") : false;

  const [databases, setDatabases] = useState<DatabaseResource[]>([]);
  const [pagination, setPagination] = useState<PaginationMeta>({
    page: 1,
    pageSize: 20,
    total: 0,
    totalPages: 1,
  });
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [rotateTarget, setRotateTarget] = useState<DatabaseResource | null>(null);
  const [rotateKind, setRotateKind] = useState<RotateKind>("database");
  const [password, setPassword] = useState("");
  const [awsAccessKeyId, setAwsAccessKeyId] = useState("");
  const [awsSecretAccessKey, setAwsSecretAccessKey] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(
    async (nextPage: number, term: string) => {
      setLoading(true);
      setError(null);
      try {
        const res = await api.listDatabases(nextPage, 20, term || undefined);
        setDatabases(res.data);
        setPagination(res.pagination);
        setPage(res.pagination.page);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load databases");
      } finally {
        setLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    void load(page, search);
  }, [load, page, search]);

  function openRotate(db: DatabaseResource, kind: RotateKind) {
    setRotateTarget(db);
    setRotateKind(kind);
    setPassword("");
    setAwsAccessKeyId("");
    setAwsSecretAccessKey("");
  }

  function closeRotate() {
    setRotateTarget(null);
    setPassword("");
    setAwsAccessKeyId("");
    setAwsSecretAccessKey("");
  }

  async function onRotateConfirm() {
    if (!rotateTarget) return;
    setSaving(true);
    setError(null);
    try {
      if (rotateKind === "database") {
        if (!password.trim()) {
          setError("Enter the new database password");
          setSaving(false);
          return;
        }
        await api.updateDatabase(rotateTarget.id, { password });
        toast.success("Credentials updated", `Password rotated for ${rotateTarget.name}.`);
      } else {
        if (!awsAccessKeyId.trim() || !awsSecretAccessKey.trim()) {
          setError("Enter both AWS access key ID and secret access key");
          setSaving(false);
          return;
        }
        await api.updateDatabase(rotateTarget.id, {
          awsAccessKeyId,
          awsSecretAccessKey,
        });
        toast.success("AWS keys updated", `Keys rotated for ${rotateTarget.name}.`);
      }
      closeRotate();
      void load(page, search);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update credentials");
    } finally {
      setSaving(false);
    }
  }

  return (
    <AppShell>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Credentials</h1>
          <p className="text-sm text-slate-500">
            Encrypted at rest — rotate secrets without viewing stored values.
          </p>
        </div>
      </div>

      {error && !rotateTarget && (
        <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      )}

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <TableSearchBar
          value={search}
          onChange={(v) => {
            setSearch(v);
            setPage(1);
          }}
          placeholder="Search databases…"
        />
      </div>

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-left text-slate-600">
            <tr>
              <th className="px-4 py-3 font-medium">Database</th>
              <th className="px-4 py-3 font-medium">Mode</th>
              <th className="px-4 py-3 font-medium">DB password</th>
              <th className="px-4 py-3 font-medium">AWS keys</th>
              <th className="px-4 py-3 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                  Loading…
                </td>
              </tr>
            ) : databases.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                  No databases found.
                </td>
              </tr>
            ) : (
              databases.map((db) => (
                <tr key={db.id} className="border-t border-slate-100">
                  <td className="px-4 py-3">
                    <div className="font-medium text-slate-900">{db.name}</div>
                    <div className="text-xs text-slate-500">{db.host ?? db.rdsSourceIdentifier}</div>
                  </td>
                  <td className="px-4 py-3 capitalize text-slate-600">
                    {db.recoveryMode === "aws-rds" ? "AWS RDS" : "Direct"}
                  </td>
                  <td className="px-4 py-3">
                    {db.hasCredentials ? (
                      <span className="inline-flex items-center gap-1 text-emerald-700">
                        <Lock size={14} /> Stored
                      </span>
                    ) : (
                      <span className="text-amber-700">Missing</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {db.recoveryMode === "aws-rds" ? (
                      db.hasAwsCredentials ? (
                        <span className="inline-flex items-center gap-1 text-emerald-700">
                          <Lock size={14} /> Stored
                        </span>
                      ) : (
                        <span className="text-amber-700">Missing</span>
                      )
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex flex-wrap justify-end gap-2">
                      {canWrite && (
                        <button
                          type="button"
                          onClick={() => openRotate(db, "database")}
                          className="inline-flex items-center gap-1 rounded border border-slate-300 px-2 py-1 text-xs hover:bg-slate-50"
                        >
                          <KeyRound size={12} />
                          {db.hasCredentials ? "Rotate password" : "Set password"}
                        </button>
                      )}
                      {canWrite && db.recoveryMode === "aws-rds" && (
                        <button
                          type="button"
                          onClick={() => openRotate(db, "aws")}
                          className="inline-flex items-center gap-1 rounded border border-slate-300 px-2 py-1 text-xs hover:bg-slate-50"
                        >
                          <KeyRound size={12} />
                          {db.hasAwsCredentials ? "Rotate AWS keys" : "Set AWS keys"}
                        </button>
                      )}
                      <Link
                        to={`/databases/${db.id}/edit`}
                        className="rounded border border-slate-300 px-2 py-1 text-xs hover:bg-slate-50"
                      >
                        Edit connection
                      </Link>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <PaginationBar pagination={pagination} onPageChange={setPage} />

      <ConfirmDialog
        open={rotateTarget != null}
        title={
          rotateKind === "database"
            ? `${rotateTarget?.hasCredentials ? "Rotate" : "Set"} database password`
            : `${rotateTarget?.hasAwsCredentials ? "Rotate" : "Set"} AWS credentials`
        }
        description={
          rotateKind === "database"
            ? `New password for “${rotateTarget?.name}”. The previous value cannot be viewed — only replaced.`
            : `New IAM keys for “${rotateTarget?.name}”. Used only for snapshot/restore API calls during drills.`
        }
        confirmLabel={saving ? "Saving…" : "Save credentials"}
        onConfirm={() => void onRotateConfirm()}
        onCancel={closeRotate}
      >
        {error && rotateTarget && (
          <p className="mb-3 text-sm text-red-700">{error}</p>
        )}
        {rotateKind === "database" ? (
          <Field label="New database password">
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
            />
          </Field>
        ) : (
          <div className="space-y-3">
            <Field label="AWS access key ID">
              <Input
                value={awsAccessKeyId}
                onChange={(e) => setAwsAccessKeyId(e.target.value)}
                autoComplete="off"
              />
            </Field>
            <Field label="AWS secret access key">
              <Input
                type="password"
                value={awsSecretAccessKey}
                onChange={(e) => setAwsSecretAccessKey(e.target.value)}
                autoComplete="new-password"
              />
            </Field>
          </div>
        )}
      </ConfirmDialog>
    </AppShell>
  );
}
