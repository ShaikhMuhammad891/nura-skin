"use client";

import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { useSyncExternalStore } from "react";

import { cn } from "@/lib/utils";

import type { AdminNavGroup } from "../nav";
import { AdminNavLinks } from "./admin-nav-links";

const STORAGE_KEY = "nura.admin.sidebar-collapsed";

// Per-browser convenience preference; storage may throw (private mode), so every access is guarded.
const listeners = new Set<() => void>();
let memoryValue = false;

function getCollapsed(): boolean {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return memoryValue;
  }
}

function setCollapsed(value: boolean) {
  memoryValue = value;
  try {
    window.localStorage.setItem(STORAGE_KEY, value ? "1" : "0");
  } catch {
    // Falls back to the in-memory value for this page view.
  }
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/**
 * Desktop admin sidebar (docs/16 AdminSidebar): permission-filtered groups from the server,
 * collapsible to an icon rail.
 */
export function AdminSidebar({ groups }: { groups: AdminNavGroup[] }) {
  const collapsed = useSyncExternalStore(subscribe, getCollapsed, () => false);
  const ToggleIcon = collapsed ? PanelLeftOpen : PanelLeftClose;

  return (
    <aside
      className={cn(
        "sticky top-0 hidden h-dvh shrink-0 flex-col border-r border-border bg-surface lg:flex",
        collapsed ? "w-16" : "w-60",
      )}
    >
      <nav aria-label="Admin" className="flex-1 overflow-y-auto px-2 py-5">
        <AdminNavLinks groups={groups} collapsed={collapsed} />
      </nav>
      <div className="border-t border-border p-2">
        <button
          type="button"
          onClick={() => setCollapsed(!collapsed)}
          aria-expanded={!collapsed}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className={cn(
            "flex h-10 w-full items-center gap-3 rounded-md px-3 text-body-sm text-muted-foreground hover:bg-surface-alt hover:text-foreground",
            collapsed && "justify-center px-0",
          )}
        >
          <ToggleIcon aria-hidden className="size-4" />
          <span aria-hidden className={cn(collapsed && "sr-only")}>
            Collapse
          </span>
        </button>
      </div>
    </aside>
  );
}
