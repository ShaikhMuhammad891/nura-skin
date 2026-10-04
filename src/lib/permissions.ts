/**
 * Role → permission matrix (docs/10 §7). Isomorphic: used server-side for enforcement
 * and client-side for UI gating only. Changes require security-owner review (CODEOWNERS).
 */

export const ROLE_KEYS = [
  "CUSTOMER",
  "SUPPORT",
  "MARKETING_MANAGER",
  "INVENTORY_MANAGER",
  "ADMIN",
  "DEMO_STAFF",
] as const;
export type RoleKey = (typeof ROLE_KEYS)[number];

export const STAFF_ROLES = [
  "SUPPORT",
  "MARKETING_MANAGER",
  "INVENTORY_MANAGER",
  "ADMIN",
  "DEMO_STAFF",
] as const satisfies readonly RoleKey[];

export const PERMISSIONS = [
  "product:read",
  "product:create",
  "product:update",
  "product:publish",
  "product:archive",
  "product:merchandise",
  "price:update",
  "ingredient:read",
  "ingredient:write",
  "inventory:read",
  "inventory:update",
  "order:read",
  "order:fulfil",
  "order:note",
  "order:cancel",
  "order:refund",
  "order:refund_limited",
  "order:export",
  "customer:read",
  "customer:read_sensitive",
  "subscription:read",
  "subscription:manage",
  "review:moderate",
  "coupon:read",
  "coupon:write",
  "analytics:read",
  "analytics:revenue",
  "analytics:export",
  "audit:read",
  "team:manage",
  "settings:read",
  "settings:write",
] as const;
export type Permission = (typeof PERMISSIONS)[number];

const ADMIN: readonly Permission[] = PERMISSIONS.filter((p) => p !== "order:refund_limited");

const ROLE_PERMISSIONS: Record<RoleKey, readonly Permission[]> = {
  CUSTOMER: [],
  ADMIN,
  INVENTORY_MANAGER: [
    "product:read",
    "ingredient:read",
    "inventory:read",
    "inventory:update",
    "order:read",
    "order:fulfil",
    "order:note",
    "subscription:read",
    "analytics:read",
    "settings:read",
  ],
  MARKETING_MANAGER: [
    "product:read",
    "product:merchandise",
    "ingredient:read",
    "customer:read",
    "subscription:read",
    "review:moderate",
    "coupon:read",
    "coupon:write",
    "analytics:read",
    "analytics:revenue",
    "analytics:export",
    "settings:read",
  ],
  SUPPORT: [
    "product:read",
    "ingredient:read",
    "inventory:read",
    "order:read",
    "order:note",
    "order:refund_limited",
    "customer:read",
    "subscription:read",
    "subscription:manage",
    "review:moderate",
    "coupon:read",
    "settings:read",
  ],
  // Portfolio demo (ADR-0016): the permission set lets the UI render every workflow;
  // mutations are always rolled back by createAction's demo mode, never persisted.
  DEMO_STAFF: PERMISSIONS.filter(
    (p) =>
      p !== "customer:read_sensitive" &&
      p !== "team:manage" &&
      p !== "order:refund_limited" &&
      p !== "order:export" &&
      p !== "analytics:export",
  ),
};

const PERMISSION_SETS = ((): Record<RoleKey, ReadonlySet<Permission>> => {
  const sets: Partial<Record<RoleKey, ReadonlySet<Permission>>> = {};
  for (const role of ROLE_KEYS) sets[role] = new Set(ROLE_PERMISSIONS[role]);
  return sets as Record<RoleKey, ReadonlySet<Permission>>;
})();

export function permissionsFor(role: RoleKey): ReadonlySet<Permission> {
  return PERMISSION_SETS[role];
}

export function can(role: RoleKey | null | undefined, permission: Permission): boolean {
  return role ? PERMISSION_SETS[role].has(permission) : false;
}

export function isStaffRole(role: RoleKey | null | undefined): boolean {
  return role ? (STAFF_ROLES as readonly RoleKey[]).includes(role) : false;
}

/** Support refund cap (docs/10 §7.2), in cents. */
export const SUPPORT_REFUND_LIMIT_CENTS = 5_000;
