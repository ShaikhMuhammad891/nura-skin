import "server-only";

import { cache } from "react";

import { env } from "@/lib/env";
import { permissionsFor, type Permission, type RoleKey } from "@/lib/permissions";

import { getCurrentUser } from "./clerk";

/**
 * The authenticated principal for a request: the domain User id and the **DB** role
 * (docs/10 §3: the session-token role is only used by the proxy gate).
 */
export type Actor = {
  userId: string | null;
  role: RoleKey | null;
  permissions: ReadonlySet<Permission>;
  isDemo: boolean;
};

export const ANONYMOUS: Actor = {
  userId: null,
  role: null,
  permissions: new Set(),
  isDemo: false,
};

export function actorFor(userId: string, role: RoleKey): Actor {
  return { userId, role, permissions: permissionsFor(role), isDemo: role === "DEMO_STAFF" };
}

/**
 * Resolves the actor once per request. DEMO_STAFF outside a demo deployment gets no permissions
 * at all (ADR-0016): the role must never work where mutations would be real.
 */
export const getActor = cache(async (): Promise<Actor> => {
  const user = await getCurrentUser();
  if (!user) return ANONYMOUS;
  const role = user.role.key;
  if (role === "DEMO_STAFF" && !env.DEMO_MODE_ENABLED) return ANONYMOUS;
  return actorFor(user.id, role);
});
