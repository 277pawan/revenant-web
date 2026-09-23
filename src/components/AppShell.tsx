import { NavLink } from "react-router-dom";
import {
  LayoutDashboard,
  Database,
  PlayCircle,
  Calendar,
  FileCheck,
  Server,
  BookOpen,
  Github,
  FileCode2,
  Users,
  Building2,
  Shield,
  Bell,
  ScrollText,
  KeyRound,
} from "lucide-react";
import { RevenantMark } from "./auth/RevenantMark";
import { TrialStatusBar } from "./TrialStatusBar";
import { useAuth } from "../lib/auth";
import { getPlanDefinition, planAllowsSelfHostedAgent } from "../lib/plans";
import { site } from "../lib/site";

type NavItem = {
  to: string;
  label: string;
  icon: typeof LayoutDashboard;
};

type NavGroup = {
  label: string;
  items: NavItem[];
};

const navGroups: NavGroup[] = [
  {
    label: "Overview",
    items: [{ to: "/", label: "Dashboard", icon: LayoutDashboard }],
  },
  {
    label: "Recovery operations",
    items: [
      { to: "/workflows", label: "Workflows", icon: PlayCircle },
      { to: "/schedules", label: "Schedules", icon: Calendar },
      { to: "/evidence", label: "Evidence Vault", icon: FileCheck },
    ],
  },
  {
    label: "Infrastructure",
    items: [{ to: "/databases", label: "Databases", icon: Database }],
  },
];

const settingsGroups: Array<{
  label: string;
  items: Array<NavItem | { label: string; soon: true }>;
}> = [
  {
    label: "Organization",
    items: [
      { to: "/settings/general", label: "General", icon: Building2 },
      { to: "/settings/credentials", label: "Credentials", icon: Shield },
      { to: "/settings/team", label: "Team & Roles", icon: Users },
    ],
  },
  {
    label: "Recovery",
    items: [
      { to: "/settings/validation-plans", label: "Validation Plans", icon: FileCode2 },
    ],
  },
  {
    label: "Platform",
    items: [
      { to: "/settings/webhooks", label: "Integrations", icon: Bell },
      { to: "/settings/audit-log", label: "Audit Log", icon: ScrollText },
      { to: "/settings/runners", label: "Agent (Pro+)", icon: Server },
      { label: "API Tokens", soon: true },
    ],
  },
];

function NavItemLink({ item }: { item: NavItem }) {
  return (
    <NavLink
      to={item.to}
      end={item.to === "/"}
      className={({ isActive }) =>
        `flex items-center gap-2 rounded-md px-3 py-2 text-sm ${
          isActive ? "bg-slate-800 text-white" : "text-slate-300 hover:bg-slate-800/60"
        }`
      }
    >
      <item.icon size={16} />
      {item.label}
    </NavLink>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();

  return (
    <div className="min-h-screen bg-slate-100">
      <aside
        className="fixed inset-y-0 left-0 z-40 flex w-56 flex-col overflow-hidden bg-sidebar text-slate-200"
      >
        <div className="flex items-center gap-2.5 px-4 py-5">
          <RevenantMark size="xs" alt="" />
          <span className="font-semibold text-white">Revenant Cloud</span>
        </div>

        <div className="mx-3 mb-4 rounded-lg border border-slate-700 bg-slate-900/50 px-3 py-2 text-xs">
          <div className="font-medium text-white">{user?.organizationName ?? "Organization"}</div>
          <div className="text-slate-400">
            {getPlanDefinition(user?.organizationPlan ?? "starter").name} plan
          </div>
        </div>

        <nav className="scrollbar-thin scrollbar-sidebar min-h-0 flex-1 space-y-4 overflow-y-auto px-2">
          {navGroups.map((group) => (
            <div key={group.label}>
              <div className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                {group.label}
              </div>
              <div className="space-y-0.5">
                {group.items.map((item) => (
                  <NavItemLink key={item.to} item={item} />
                ))}
              </div>
            </div>
          ))}

          <div>
            <div className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
              Settings
            </div>
            <div className="space-y-3">
              {settingsGroups.map((group) => (
                <div key={group.label}>
                  <div className="px-3 pb-0.5 text-[9px] font-medium uppercase tracking-wide text-slate-600">
                    {group.label}
                  </div>
                  <div className="space-y-0.5">
                    {group.items.map((item) => {
                      if ("soon" in item && item.soon) {
                        return (
                          <div
                            key={item.label}
                            className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-slate-500"
                            title="Coming in a later release"
                          >
                            <KeyRound size={16} />
                            <span className="flex-1">{item.label}</span>
                            <span className="text-[10px] uppercase tracking-wide text-slate-600">
                              Soon
                            </span>
                          </div>
                        );
                      }

                      const navItem = item as NavItem;
                      if (
                        navItem.to === "/settings/runners" &&
                        user &&
                        !planAllowsSelfHostedAgent(user.organizationPlan)
                      ) {
                        return null;
                      }

                      return <NavItemLink key={navItem.to} item={navItem} />;
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </nav>

        <div className="border-t border-slate-700 px-2 py-3 text-sm text-slate-400">
          <a
            href={site.docsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 rounded-md px-3 py-1.5 hover:bg-slate-800/60 hover:text-white"
          >
            <BookOpen size={16} />
            Docs + CLI setup
          </a>
          <a
            href={site.cliUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 rounded-md px-3 py-1.5 hover:bg-slate-800/60 hover:text-white"
          >
            <BookOpen size={16} className="opacity-70" />
            CLI reference
          </a>
          <a
            href={site.githubAction}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 rounded-md px-3 py-1.5 hover:bg-slate-800/60 hover:text-white"
          >
            <Github size={16} />
            GitHub Action
          </a>
          <a
            href={site.marketingUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 rounded-md px-3 py-1.5 hover:bg-slate-800/60 hover:text-white"
          >
            <span className="flex h-4 w-4 items-center justify-center text-[10px] font-bold text-slate-500">
              ↗
            </span>
            Marketing site
          </a>
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

      <main className="ml-56 min-h-screen min-w-0">
        <div className="mx-auto w-full max-w-[1400px] p-6 lg:p-8">
          <TrialStatusBar />
          {children}
        </div>
      </main>
    </div>
  );
}
