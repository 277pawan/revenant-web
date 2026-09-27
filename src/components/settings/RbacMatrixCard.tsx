import { ROLE_PERMISSIONS, type Permission, type UserRole } from "../../types/api";

const PERMISSION_LABELS: Record<Permission, string> = {
  "databases:read": "View workflows & databases",
  "databases:write": "Create/edit databases",
  "credentials:write": "Manage credentials",
  "plans:read": "View validation plans",
  "plans:write": "Edit validation plans & contracts",
  "jobs:read": "View drill runs",
  "jobs:run": "Run drills & challenges",
  "schedules:read": "View schedules",
  "schedules:write": "Manage schedules",
  "evidence:read": "Download evidence & passports",
  "webhooks:read": "View integrations",
  "webhooks:write": "Manage integrations",
  "audit:read": "View & export audit log",
  "team:manage": "Invite users & billing",
  "team:read": "View team members",
};

const ROLES: UserRole[] = ["admin", "executor", "viewer"];

export function RbacMatrixCard() {
  const permissions = Object.keys(PERMISSION_LABELS) as Permission[];

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-sm font-semibold text-slate-900">Role permissions</h2>
      <p className="mt-1 text-sm text-slate-600">
        Advanced RBAC (custom roles, SAML) is on the Enterprise roadmap. Today, every member gets
        one of three built-in roles.
      </p>
      <div className="mt-4 overflow-x-auto">
        <table className="min-w-[640px] w-full text-left text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-slate-500">
              <th className="py-2 pr-4 font-medium">Permission</th>
              {ROLES.map((role) => (
                <th key={role} className="px-2 py-2 text-center font-medium capitalize">
                  {role}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {permissions.map((perm) => (
              <tr key={perm}>
                <td className="py-2 pr-4 text-slate-700">{PERMISSION_LABELS[perm]}</td>
                {ROLES.map((role) => (
                  <td key={role} className="px-2 py-2 text-center">
                    {ROLE_PERMISSIONS[role].includes(perm) ? (
                      <span className="text-emerald-600" aria-label="allowed">✓</span>
                    ) : (
                      <span className="text-slate-300" aria-label="denied">—</span>
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
