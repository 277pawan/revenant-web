import { useCallback, useEffect, useState } from "react";
import { useLocation } from "react-router-dom";

const STORAGE_KEY = "revenant.sidebar.collapsed";

function readStored(): Record<string, boolean> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, boolean>;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function writeStored(value: Record<string, boolean>) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
  } catch {
    // ignore quota / private mode
  }
}

function routeMatches(pathname: string, route: string): boolean {
  return route === "/"
    ? pathname === "/"
    : pathname === route || pathname.startsWith(`${route}/`);
}

/** Groups collapsed by default to keep the sidebar shorter on first visit. */
const DEFAULT_COLLAPSED: Record<string, boolean> = {
  resources: true,
  "settings-platform": true,
};

export function useSidebarCollapse(groupRoutes: Record<string, string[]>) {
  const { pathname } = useLocation();
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>(() => ({
    ...DEFAULT_COLLAPSED,
    ...readStored(),
  }));

  useEffect(() => {
    setCollapsed((prev) => {
      const next = { ...prev };
      let changed = false;
      for (const [groupId, routes] of Object.entries(groupRoutes)) {
        const active = routes.some((route) => routeMatches(pathname, route));
        if (active && next[groupId]) {
          delete next[groupId];
          changed = true;
        }
      }
      if (changed) writeStored(next);
      return changed ? next : prev;
    });
  }, [groupRoutes, pathname]);

  const isOpen = useCallback((groupId: string) => !collapsed[groupId], [collapsed]);

  const toggle = useCallback((groupId: string) => {
    setCollapsed((prev) => {
      const next = { ...prev };
      if (next[groupId]) delete next[groupId];
      else next[groupId] = true;
      writeStored(next);
      return next;
    });
  }, []);

  return { isOpen, toggle };
}
