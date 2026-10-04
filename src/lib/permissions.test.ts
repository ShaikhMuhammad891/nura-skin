import { describe, expect, it } from "vitest";

import {
  can,
  isStaffRole,
  PERMISSIONS,
  permissionsFor,
  ROLE_KEYS,
  type Permission,
} from "./permissions";

describe("permission matrix (docs/10 §7.3)", () => {
  it("customers have no admin permissions", () => {
    expect(permissionsFor("CUSTOMER").size).toBe(0);
    expect(isStaffRole("CUSTOMER")).toBe(false);
  });

  it("only ADMIN can manage the team and see sensitive customer data", () => {
    const exclusive: Permission[] = ["team:manage", "customer:read_sensitive"];
    for (const role of ROLE_KEYS) {
      for (const permission of exclusive) {
        expect(can(role, permission), `${role} ${permission}`).toBe(role === "ADMIN");
      }
    }
  });

  it("unlimited refunds: ADMIN for real, DEMO_STAFF only as a rolled-back demo (ADR-0016)", () => {
    for (const role of ROLE_KEYS) {
      expect(can(role, "order:refund"), role).toBe(role === "ADMIN" || role === "DEMO_STAFF");
    }
  });

  it.each([
    ["INVENTORY_MANAGER", "inventory:update", true],
    ["INVENTORY_MANAGER", "analytics:revenue", false],
    ["INVENTORY_MANAGER", "price:update", false],
    ["MARKETING_MANAGER", "coupon:write", true],
    ["MARKETING_MANAGER", "inventory:update", false],
    ["MARKETING_MANAGER", "price:update", false],
    ["SUPPORT", "order:refund_limited", true],
    ["SUPPORT", "product:update", false],
  ] as const)("%s → %s = %s", (role, permission, expected) => {
    expect(can(role, permission)).toBe(expected);
  });

  it("DEMO_STAFF never gets sensitive, team or export permissions", () => {
    for (const p of [
      "customer:read_sensitive",
      "team:manage",
      "order:export",
      "analytics:export",
    ] as const) {
      expect(can("DEMO_STAFF", p)).toBe(false);
    }
  });

  it("every role maps only to known permissions", () => {
    const known = new Set<string>(PERMISSIONS);
    for (const role of ROLE_KEYS) {
      for (const p of permissionsFor(role)) expect(known.has(p)).toBe(true);
    }
  });

  it("matrix snapshot: changes must be deliberate and reviewed", () => {
    const matrix = Object.fromEntries(ROLE_KEYS.map((r) => [r, [...permissionsFor(r)].sort()]));
    expect(matrix).toMatchSnapshot();
  });

  it("null role has no permissions", () => {
    expect(can(null, "product:read")).toBe(false);
  });
});
