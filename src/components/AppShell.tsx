import { NavLink } from "react-router-dom";
import {
  LayoutDashboard,
  Database,
  PlayCircle,
  Calendar,
  FileCheck,
  Server,
  Settings,
  BookOpen,
  Github,
} from "lucide-react";
import { useAuth } from "../lib/auth";

const mainNav = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/databases", label: "Databases", icon: Database },
  { to: "/jobs", label: "Jobs", icon: PlayCircle },
  { to: "/schedules", label: "Schedules", icon: Calendar },
  { to: "/evidence", label: "Evidence Vault", icon: FileCheck },
  { to: "/runners", label: "Runners", icon: Server },
];

const settingsNav = [
  "General",
  "Credentials",
  "Validation Plans",
  "Team & Roles",
  "API Tokens",
  "Webhooks",
  "Audit Log",
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();

  return (
    <div className="flex min-h-screen">
      <aside className="flex w-56 shrink-0 flex-col bg-sidebar text-slate-200">
        <div className="flex items-center gap-2 px-4 py-5">
          <div className="flex h-7 w-7 items-center justify-center rounded bg-brand text-sm font-bold text-white">
            R
          </div>
          <span className="font-semibold text-white">Revenant Cloud</span>
        </div>

        <div className="mx-3 mb-4 rounded-lg border border-slate-700 bg-slate-900/50 px-3 py-2 text-xs">
          <div className="font-medium text-white">{user?.organizationName ?? "Organization"}</div>
          <div className="text-slate-400">Starter plan</div>
        </div>

        <nav className="flex-1 space-y-1 px-2">
          {mainNav.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === "/"}
              className={({ isActive }) =>
                `flex items-center gap-2 rounded-md px-3 py-2 text-sm ${
                  isActive ? "bg-slate-800 text-white" : "text-slate-300 hover:bg-slate-800/60"
                }`
              }
            >
              <Icon size={16} />
              {label}
            </NavLink>
          ))}

          <div className="mt-4 px-3 text-[10px] uppercase tracking-wide text-slate-500">Settings</div>
          {settingsNav.map((label) => (
            <div
              key={label}
              className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-slate-400"
            >
              <Settings size={16} />
              {label}
            </div>
          ))}
        </nav>

        <div className="border-t border-slate-700 px-2 py-3 text-sm text-slate-400">
          <div className="flex items-center gap-2 px-3 py-1">
            <BookOpen size={16} />
            Docs + CLI setup
          </div>
          <div className="flex items-center gap-2 px-3 py-1">
            <Github size={16} />
            GitHub Action
          </div>
        </div>

        <div className="border-t border-slate-700 p-3">
          <div className="text-sm text-white">{user?.email}</div>
          <div className="text-xs capitalize text-slate-400">{user?.role}</div>
          <button
            type="button"
            onClick={logout}
            className="mt-2 text-xs text-slate-400 underline hover:text-white"
          >
            Sign out
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-auto p-6">{children}</main>
    </div>
  );
}
