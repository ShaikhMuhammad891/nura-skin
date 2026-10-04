"use client";

import {
  BarChart3,
  Boxes,
  FlaskConical,
  LayoutDashboard,
  Layers,
  LifeBuoy,
  type LucideIcon,
  MessageSquareText,
  Package,
  Repeat,
  ScrollText,
  Settings,
  ShoppingBag,
  TicketPercent,
  Users,
  UsersRound,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

import { activeAdminHref, type AdminNavGroup, type AdminNavIcon } from "../nav";

const ICONS: Record<AdminNavIcon, LucideIcon> = {
  dashboard: LayoutDashboard,
  products: Package,
  routines: Layers,
  ingredients: FlaskConical,
  inventory: Boxes,
  orders: ShoppingBag,
  customers: Users,
  subscriptions: Repeat,
  support: LifeBuoy,
  reviews: MessageSquareText,
  coupons: TicketPercent,
  analytics: BarChart3,
  audit: ScrollText,
  team: UsersRound,
  settings: Settings,
};

/** The grouped nav list shared by the desktop sidebar and the mobile sheet. */
export function AdminNavLinks({
  groups,
  collapsed = false,
  onNavigate,
}: {
  groups: AdminNavGroup[];
  collapsed?: boolean;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const active = activeAdminHref(pathname, groups);

  return (
    <div className="flex flex-col gap-5">
      {groups.map((group) => (
        <div key={group.title} className="flex flex-col gap-1">
          <p
            className={cn(
              "px-3 text-overline font-semibold text-subtle-foreground uppercase",
              collapsed && "sr-only",
            )}
          >
            {group.title}
          </p>
          <ul className="flex flex-col gap-0.5">
            {group.items.map((item) => {
              const Icon = ICONS[item.icon];
              const current = item.href === active;
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={onNavigate}
                    aria-current={current ? "page" : undefined}
                    title={collapsed ? item.label : undefined}
                    className={cn(
                      "flex h-10 items-center gap-3 rounded-md px-3 text-body-sm font-medium text-muted-foreground transition-colors duration-100",
                      "hover:bg-surface-alt hover:text-foreground",
                      current && "bg-surface-alt text-foreground",
                      collapsed && "justify-center px-0",
                    )}
                  >
                    <Icon aria-hidden className="size-4 shrink-0" />
                    <span className={cn(collapsed && "sr-only")}>{item.label}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </div>
  );
}
