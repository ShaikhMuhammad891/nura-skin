import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { MAIN_CONTENT_ID, SkipLink } from "@/components/layout/skip-link";
import { AdminSidebar } from "@/features/admin/components/admin-sidebar";
import { AdminTopbar } from "@/features/admin/components/admin-topbar";
import { visibleAdminNav } from "@/features/admin/nav";
import { isStaffRole } from "@/lib/permissions";
import { getActor } from "@/lib/server/actor";

/** Per-user, session-dependent: a blocking dynamic route (keeps real 404/redirect statuses). */
export const instant = false;

export const metadata: Metadata = {
  title: { default: "Admin", template: "%s · Nura Admin" },
  robots: { index: false, follow: false },
};

/**
 * Admin shell (docs/10 §5, §7). The proxy already hides /admin from non-staff via the session
 * claim; this re-checks against the **DB** role, so a stale claim never renders admin UI.
 * The sidebar is filtered by the actor's permissions (UX only, pages re-check).
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const actor = await getActor();
  if (!isStaffRole(actor.role)) notFound();
  const groups = visibleAdminNav(actor.permissions);

  return (
    <>
      <SkipLink />
      <div className="flex min-h-dvh">
        <AdminSidebar groups={groups} />
        <div className="flex min-w-0 flex-1 flex-col">
          <AdminTopbar groups={groups} />
          <main id={MAIN_CONTENT_ID} tabIndex={-1} className="flex-1 outline-none">
            {children}
          </main>
        </div>
      </div>
    </>
  );
}
