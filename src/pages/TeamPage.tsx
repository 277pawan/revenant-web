import { useCallback, useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { UserPlus } from "lucide-react";
import { AppShell } from "../components/AppShell";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { PaginationBar } from "../components/PaginationBar";
import { Field, Input, Select } from "../components/ui/Field";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import {
  roleHasPermission,
  type PaginationMeta,
  type TeamMemberResource,
  type UserRole,
} from "../types/api";

const inviteSchema = z.object({
  email: z.string().email("Enter a valid email"),
  password: z.string().min(8, "Password must be at least 8 characters").max(128),
  role: z.enum(["admin", "executor", "viewer"]),
});

type InviteValues = z.infer<typeof inviteSchema>;

export function TeamPage() {
  const { user } = useAuth();
  const canManage = user ? roleHasPermission(user.role, "team:manage") : false;

  const [members, setMembers] = useState<TeamMemberResource[]>([]);
  const [pagination, setPagination] = useState<PaginationMeta>({
    page: 1,
    pageSize: 20,
    total: 0,
    totalPages: 1,
  });
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showInvite, setShowInvite] = useState(false);
  const [saving, setSaving] = useState(false);
  const [removeTarget, setRemoveTarget] = useState<TeamMemberResource | null>(null);
  const [removing, setRemoving] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<InviteValues>({
    resolver: zodResolver(inviteSchema),
    defaultValues: { email: "", password: "", role: "executor" },
  });

  const load = useCallback(async (nextPage: number) => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.listTeamMembers(nextPage, 20);
      setMembers(res.data);
      setPagination(res.pagination);
      setPage(res.pagination.page);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load team");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(page);
  }, [load, page]);

  async function onInvite(values: InviteValues) {
    setSaving(true);
    setError(null);
    try {
      await api.inviteTeamMember(values);
      reset({ email: "", password: "", role: "executor" });
      setShowInvite(false);
      await load(1);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to invite");
    } finally {
      setSaving(false);
    }
  }

  async function onRoleChange(member: TeamMemberResource, role: UserRole) {
    if (!canManage || member.id === user?.id) return;
    setError(null);
    try {
      await api.updateTeamMember(member.id, { role });
      await load(page);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update role");
    }
  }

  async function confirmRemove() {
    if (!removeTarget) return;
    setRemoving(true);
    try {
      await api.removeTeamMember(removeTarget.id);
      setRemoveTarget(null);
      await load(page);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to remove member");
    } finally {
      setRemoving(false);
    }
  }

  return (
    <AppShell>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Team & roles</h1>
          <p className="mt-1 text-sm text-slate-600">
            Same website for everyone in {user?.organizationName}. Access is controlled by role
            (admin / executor / viewer).
          </p>
        </div>
        {canManage && (
          <button
            type="button"
            onClick={() => setShowInvite((v) => !v)}
            className="inline-flex items-center gap-2 rounded-md bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            <UserPlus size={16} />
            {showInvite ? "Close" : "Invite member"}
          </button>
        )}
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      )}

      {showInvite && canManage && (
        <form
          onSubmit={handleSubmit(onInvite)}
          noValidate
          className="mb-6 grid gap-4 rounded-lg border border-slate-200 bg-white p-4 shadow-sm sm:grid-cols-3"
        >
          <Field label="Email" htmlFor="email" required error={errors.email?.message}>
            <Input id="email" type="email" invalid={!!errors.email} {...register("email")} />
          </Field>
          <Field
            label="Temporary password"
            htmlFor="password"
            required
            error={errors.password?.message}
            hint="They sign in on the same login page"
          >
            <Input
              id="password"
              type="password"
              invalid={!!errors.password}
              autoComplete="new-password"
              {...register("password")}
            />
          </Field>
          <Field label="Role" htmlFor="role" required error={errors.role?.message}>
            <Select id="role" invalid={!!errors.role} {...register("role")}>
              <option value="executor">Executor — run jobs</option>
              <option value="viewer">Viewer — read only</option>
              <option value="admin">Admin — full access</option>
            </Select>
          </Field>
          <div className="sm:col-span-3">
            <button
              type="submit"
              disabled={saving}
              className="rounded-md bg-brand px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              {saving ? "Inviting…" : "Create member"}
            </button>
          </div>
        </form>
      )}

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        {loading ? (
          <div className="space-y-3 p-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-10 animate-pulse rounded bg-slate-100" />
            ))}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-medium">Email</th>
                  <th className="px-4 py-3 font-medium">Role</th>
                  <th className="px-4 py-3 font-medium">Joined</th>
                  {canManage && <th className="px-4 py-3 font-medium text-right">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {members.map((member) => {
                  const isSelf = member.id === user?.id;
                  return (
                    <tr key={member.id} className="hover:bg-slate-50/80">
                      <td className="px-4 py-3">
                        <div className="font-medium text-slate-900">{member.email}</div>
                        {isSelf && (
                          <div className="text-xs text-slate-500">You</div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {canManage && !isSelf ? (
                          <select
                            className="rounded border border-slate-300 px-2 py-1 text-sm capitalize"
                            value={member.role}
                            onChange={(e) =>
                              void onRoleChange(member, e.target.value as UserRole)
                            }
                          >
                            <option value="admin">admin</option>
                            <option value="executor">executor</option>
                            <option value="viewer">viewer</option>
                          </select>
                        ) : (
                          <span className="capitalize text-slate-700">{member.role}</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-slate-500">
                        {new Date(member.createdAt).toLocaleDateString()}
                      </td>
                      {canManage && (
                        <td className="px-4 py-3 text-right">
                          {!isSelf && (
                            <button
                              type="button"
                              onClick={() => setRemoveTarget(member)}
                              className="text-xs text-red-600 hover:underline"
                            >
                              Remove
                            </button>
                          )}
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {!loading && pagination.total > 0 && (
          <PaginationBar pagination={pagination} onPageChange={setPage} />
        )}
      </div>

      <ConfirmDialog
        open={!!removeTarget}
        danger
        loading={removing}
        title="Remove team member?"
        description={
          removeTarget
            ? `Remove ${removeTarget.email} from this organization? They will no longer be able to sign in.`
            : ""
        }
        confirmLabel="Remove member"
        onCancel={() => !removing && setRemoveTarget(null)}
        onConfirm={() => void confirmRemove()}
      />
    </AppShell>
  );
}
