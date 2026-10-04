import type { Permission } from "@/lib/permissions";

/**
 * Admin navigation (docs/10 §7, docs/15 §5). Each item declares the permission required to see
 * it; filtering is UX only, every admin page and action re-checks on the server.
 * Icons are lucide names resolved by the sidebar so this module stays isomorphic and testable.
 */
export type AdminNavIcon =
  | "dashboard"
  | "products"
  | "routines"
  | "ingredients"
  | "inventory"
  | "orders"
  | "customers"
  | "subscriptions"
  | "reviews"
  | "coupons"
  | "support"
  | "analytics"
  | "audit"
  | "team"
  | "settings";

export type AdminNavItem = {
  label: string;
  href: string;
  icon: AdminNavIcon;
  /** Required permission; `null` = any staff member. */
  permission: Permission | null;
};

export type AdminNavGroup = { title: string; items: AdminNavItem[] };

export const ADMIN_NAV: readonly AdminNavGroup[] = [
  {
    title: "Overview",
    items: [{ label: "Dashboard", href: "/admin", icon: "dashboard", permission: null }],
  },
  {
    title: "Catalogue",
    items: [
      { label: "Products", href: "/admin/products", icon: "products", permission: "product:read" },
      { label: "Routines", href: "/admin/routines", icon: "routines", permission: "product:read" },
      {
        label: "Ingredients",
        href: "/admin/ingredients",
        icon: "ingredients",
        permission: "ingredient:read",
      },
      {
        label: "Inventory",
        href: "/admin/inventory",
        icon: "inventory",
        permission: "inventory:read",
      },
    ],
  },
  {
    title: "Sales",
    items: [
      { label: "Orders", href: "/admin/orders", icon: "orders", permission: "order:read" },
      {
        label: "Customers",
        href: "/admin/customers",
        icon: "customers",
        permission: "customer:read",
      },
      {
        label: "Subscriptions",
        href: "/admin/subscriptions",
        icon: "subscriptions",
        permission: "subscription:read",
      },
      { label: "Support", href: "/admin/support", icon: "support", permission: "order:read" },
    ],
  },
  {
    title: "Marketing",
    items: [
      { label: "Reviews", href: "/admin/reviews", icon: "reviews", permission: "review:moderate" },
      { label: "Coupons", href: "/admin/coupons", icon: "coupons", permission: "coupon:read" },
      {
        label: "Analytics",
        href: "/admin/analytics",
        icon: "analytics",
        permission: "analytics:read",
      },
    ],
  },
  {
    title: "System",
    items: [
      { label: "Audit log", href: "/admin/audit-log", icon: "audit", permission: "audit:read" },
      { label: "Team", href: "/admin/team", icon: "team", permission: "team:manage" },
      {
        label: "Settings",
        href: "/admin/settings",
        icon: "settings",
        permission: "settings:read",
      },
    ],
  },
];

/** The nav groups visible to a permission set; empty groups are dropped. */
export function visibleAdminNav(permissions: ReadonlySet<Permission>): AdminNavGroup[] {
  return ADMIN_NAV.map((group) => ({
    title: group.title,
    items: group.items.filter(
      (item) => item.permission === null || permissions.has(item.permission),
    ),
  })).filter((group) => group.items.length > 0);
}

/** Longest-prefix match so `/admin/orders/NS-1` highlights Orders, and `/admin` only itself. */
export function activeAdminHref(pathname: string, groups: readonly AdminNavGroup[]): string | null {
  let best: string | null = null;
  for (const { items } of groups) {
    for (const { href } of items) {
      const matches =
        href === "/admin"
          ? pathname === href
          : pathname === href || pathname.startsWith(`${href}/`);
      if (matches && (!best || href.length > best.length)) best = href;
    }
  }
  return best;
}

const SEGMENT_LABELS: Record<string, string> = Object.fromEntries(
  ADMIN_NAV.flatMap((g) => g.items).map((i) => [i.href.split("/").pop() ?? "", i.label]),
);
SEGMENT_LABELS["admin"] = "Admin";
SEGMENT_LABELS["new"] = "New";
SEGMENT_LABELS["mfa-required"] = "Two-step verification";
SEGMENT_LABELS["finder"] = "Finder insights";

export type Crumb = { label: string; href: string };

/** Breadcrumbs for an admin path; unknown segments (ids, order numbers) are shown verbatim. */
export function adminBreadcrumbs(pathname: string): Crumb[] {
  const segments = pathname.split("/").filter(Boolean);
  return segments.map((segment, i) => ({
    label: SEGMENT_LABELS[segment] ?? decodeURIComponent(segment),
    href: `/${segments.slice(0, i + 1).join("/")}`,
  }));
}
