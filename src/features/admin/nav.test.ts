import { PERMISSIONS, permissionsFor, ROLE_KEYS, STAFF_ROLES } from "@/lib/permissions";

import { activeAdminHref, ADMIN_NAV, adminBreadcrumbs, visibleAdminNav } from "./nav";

const hrefs = (groups: ReturnType<typeof visibleAdminNav>) =>
  groups.flatMap((g) => g.items.map((i) => i.href));

describe("admin nav", () => {
  it("only references known permissions and unique hrefs", () => {
    const all = ADMIN_NAV.flatMap((g) => g.items);
    for (const item of all) {
      if (item.permission) expect(PERMISSIONS).toContain(item.permission);
    }
    expect(new Set(all.map((i) => i.href)).size).toBe(all.length);
  });

  it("shows everything to ADMIN", () => {
    expect(hrefs(visibleAdminNav(permissionsFor("ADMIN")))).toEqual(
      ADMIN_NAV.flatMap((g) => g.items.map((i) => i.href)),
    );
  });

  it("hides items and empty groups the role cannot use", () => {
    const inventory = visibleAdminNav(permissionsFor("INVENTORY_MANAGER"));
    expect(hrefs(inventory)).toContain("/admin/inventory");
    expect(hrefs(inventory)).not.toContain("/admin/coupons");
    expect(hrefs(inventory)).not.toContain("/admin/team");
    expect(hrefs(inventory)).toContain("/admin/analytics");
    expect(visibleAdminNav(new Set(["order:read"])).map((g) => g.title)).toEqual([
      "Overview",
      "Sales",
    ]);
  });

  it("gives every staff role the dashboard, and customers nothing but it", () => {
    for (const role of STAFF_ROLES)
      expect(hrefs(visibleAdminNav(permissionsFor(role)))).toContain("/admin");
    expect(hrefs(visibleAdminNav(permissionsFor("CUSTOMER")))).toEqual(["/admin"]);
  });

  it("matches the per-role nav snapshot", () => {
    const byRole = Object.fromEntries(
      ROLE_KEYS.map((r) => [r, hrefs(visibleAdminNav(permissionsFor(r)))]),
    );
    expect(byRole).toMatchSnapshot();
  });

  it("highlights the longest matching item", () => {
    expect(activeAdminHref("/admin", ADMIN_NAV)).toBe("/admin");
    expect(activeAdminHref("/admin/orders/NS-1001", ADMIN_NAV)).toBe("/admin/orders");
    expect(activeAdminHref("/admin/ordersx", ADMIN_NAV)).toBeNull();
    expect(activeAdminHref("/admin/mfa-required", ADMIN_NAV)).toBeNull();
  });

  it("builds breadcrumbs with labels and verbatim ids", () => {
    expect(adminBreadcrumbs("/admin/orders/NS-1001")).toEqual([
      { label: "Admin", href: "/admin" },
      { label: "Orders", href: "/admin/orders" },
      { label: "NS-1001", href: "/admin/orders/NS-1001" },
    ]);
    expect(adminBreadcrumbs("/admin/audit-log")[1]?.label).toBe("Audit log");
  });
});
