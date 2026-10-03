import { useEffect, useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  Database,
  PlayCircle,
  Calendar,
  FileCheck,
  Server,
  History,
  BookOpen,
  Github,
  FileCode2,
  Users,
  Building2,
  Shield,
  SlidersHorizontal,
  Bell,
  ScrollText,
  KeyRound,
  CreditCard,
  ChevronRight,
} from "lucide-react";
import { RevenantMark } from "./auth/RevenantMark";
import { ProductGuideLauncher, ProductGuideWizard } from "./guide/ProductGuideWizard";
import { TrialStatusBar } from "./TrialStatusBar";
import { BackgroundWorkDrawer } from "./BackgroundWorkDrawer";
import { SidebarNavGroup } from "./layout/SidebarNavGroup";
import { useSidebarCollapse } from "../hooks/useSidebarCollapse";
import { useAuth } from "../lib/auth";
import { getPlanDefinition, planAllowsSelfHostedAgent } from "../lib/plans";
import { site } from "../lib/site";

type NavItem = {
  to: string;
  label: string;
  icon: typeof LayoutDashboard;
};

type NavGroup = {
  id: string;
  label: string;
  items: NavItem[];
};

const navGroups: NavGroup[] = [
  {
    id: "overview",
    label: "Overview",
    items: [{ to: "/", label: "Dashboard", icon: LayoutDashboard }],
  },
  {
    id: "recovery-operations",
    label: "Recovery operations",
    items: [
      { to: "/workflows", label: "Restore drills", icon: PlayCircle },
      { to: "/schedules", label: "Schedules", icon: Calendar },
      { to: "/evidence", label: "Evidence Vault", icon: FileCheck },
      { to: "/recovery-instances", label: "Recovered instances", icon: History },
      { to: "/recovery-operations", label: "Recovery operations", icon: SlidersHorizontal },
    ],
  },
  {
    id: "infrastructure",
    label: "Infrastructure",
    items: [{ to: "/databases", label: "Databases", icon: Database }],
  },
];

/** Flat settings list — no nested Organization / Platform groups */
const settingsItems: Array<NavItem | { label: string; soon: true }> = [
  { to: "/settings/general", label: "General", icon: Building2 },
  { to: "/settings/billing", label: "Plan & billing", icon: CreditCard },
  { to: "/settings/credentials", label: "Credentials", icon: Shield },
  { to: "/settings/team", label: "Team & roles", icon: Users },
  { to: "/settings/validation-plans", label: "Validation plans", icon: FileCode2 },
  { to: "/settings/webhooks", label: "Webhooks", icon: Bell },
  { to: "/settings/audit-log", label: "Audit log", icon: ScrollText },
  { to: "/settings/runners", label: "Agent (Pro+)", icon: Server },
  { label: "API tokens", soon: true },
];

const resourceLinks: Array<{
  href: string;
  label: string;
  icon: typeof BookOpen | typeof Github | null;
  muted?: boolean;
}> = [
  { href: site.docsUrl, label: "Docs + CLI setup", icon: BookOpen },
  { href: site.cliUrl, label: "CLI reference", icon: BookOpen, muted: true },
  { href: site.githubAction, label: "GitHub Action", icon: Github },
  { href: site.marketingUrl, label: "Marketing site", icon: null },
];

const sidebarGroupRoutes: Record<string, string[]> = {
  overview: ["/"],
  "recovery-operations": ["/workflows", "/schedules", "/evidence", "/recovery-instances", "/recovery-operations"],
  infrastructure: ["/databases"],
  settings: [
    "/settings/general",
    "/settings/billing",
    "/settings/credentials",
    "/settings/team",
    "/settings/validation-plans",
    "/settings/webhooks",
    "/settings/audit-log",
    "/settings/runners",
  ],
  resources: [],
};

function NavItemLink({ item }: { item: NavItem }) {
  const tourTargets: Record<string, string> = {
    "/": "nav-dashboard",
    "/workflows": "nav-workflows",
    "/schedules": "nav-schedules",
    "/evidence": "nav-evidence",
    "/recovery-instances": "nav-recovered-instances",
    "/recovery-operations": "nav-recovery-operations",
    "/databases": "nav-databases",
    "/settings/validation-plans": "nav-validation-plans",
    "/settings/webhooks": "nav-webhooks",
  };
  return (
    <NavLink
      to={item.to}
      end={item.to === "/"}
      data-tour={tourTargets[item.to]}
      className={({ isActive }) =>
        `flex items-center gap-2 rounded-md px-3 py-2 text-sm ${
          isActive
            ? "bg-slate-800 text-white"
            : "text-slate-300 hover:bg-slate-800/60"
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
  const { pathname } = useLocation();
  const { isOpen, toggle } = useSidebarCollapse(sidebarGroupRoutes);
  const [guideOpen, setGuideOpen] = useState(false);

  useEffect(() => {
    const open = () => setGuideOpen(true);
    window.addEventListener("revenant:open-guide", open);
    return () => window.removeEventListener("revenant:open-guide", open);
  }, []);

  const settingsActive = pathname.startsWith("/settings");

  return (
    <div className="min-h-screen bg-slate-100">
      <aside className="fixed inset-y-0 left-0 z-40 flex w-56 flex-col overflow-hidden bg-sidebar text-slate-200">
        <div className="flex items-center gap-2.5 px-4 py-5">
          <RevenantMark size="xs" alt="" />
          <span className="font-semibold text-white">Revenant Cloud</span>
        </div>

        <div className="mx-3 mb-4 rounded-lg border border-slate-700 bg-slate-900/50 px-3 py-2 text-xs">
          <div className="font-medium text-white">
            {user?.organizationName ?? "Organization"}
          </div>
          <div className="text-slate-400">
            {getPlanDefinition(user?.organizationPlan ?? "starter").name} plan
          </div>
        </div>

        <nav className="scrollbar-thin scrollbar-sidebar min-h-0 flex-1 space-y-3 overflow-y-auto px-2 pb-2">
          {navGroups.map((group) => (
            <SidebarNavGroup
              key={group.id}
              label={group.label}
              open={isOpen(group.id)}
              onToggle={() => toggle(group.id)}
            >
              {group.items.map((item) => (
                <NavItemLink key={item.to} item={item} />
              ))}
            </SidebarNavGroup>
          ))}

          <ProductGuideLauncher onOpen={() => setGuideOpen(true)} />

          <SidebarNavGroup
            label="Settings"
            open={isOpen("settings")}
            onToggle={() => toggle("settings")}
          >
            {settingsItems.map((item) => {
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
          </SidebarNavGroup>

          <SidebarNavGroup
            label="Resources"
            open={isOpen("resources")}
            onToggle={() => toggle("resources")}
          >
            {resourceLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-slate-400 hover:bg-slate-800/60 hover:text-white"
              >
                {link.icon ? (
                  <link.icon size={16} className={link.muted ? "opacity-70" : undefined} />
                ) : (
                  <span className="flex h-4 w-4 items-center justify-center text-[10px] font-bold text-slate-500">
                    ↗
                  </span>
                )}
                {link.label}
              </a>
            ))}
          </SidebarNavGroup>
        </nav>

        <div className="border-t border-slate-700 p-3">
          <div className="text-sm text-white">{user?.email}</div>
          <div className="flex items-center gap-2 text-xs capitalize text-slate-400">
            <span>{user?.role}</span>
            {settingsActive && (
              <span className="inline-flex items-center gap-0.5 text-slate-500">
                <ChevronRight size={12} />
                Settings
              </span>
            )}
          </div>
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

      <ProductGuideWizard open={guideOpen} onClose={() => setGuideOpen(false)} />
      <BackgroundWorkDrawer />
    </div>
  );
}
