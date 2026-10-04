import "server-only";

import { AppError } from "@/lib/errors";
import { isStaffRole, type Permission } from "@/lib/permissions";

import type { Actor } from "./actor";

/**
 * Auth levels (docs/09 §2.2). Every Server Action and route MUST declare one;
 * there is deliberately no default.
 *  - public:        anyone
 *  - guest-or-user: anonymous allowed; ownership is checked by the handler (signed cookies)
 *  - user:          signed-in customer or staff
 *  - staff:         staff role required; non-staff get NOT_FOUND (admin concealment, 10 §7.1)
 */
export type AuthLevel = "public" | "guest-or-user" | "user" | "staff";

export type AuthPolicy =
  | { auth: "public" | "guest-or-user" | "user"; permission?: never }
  | { auth: "staff"; permission: Permission };

export function authorize(policy: AuthPolicy, actor: Actor): void {
  switch (policy.auth) {
    case "public":
    case "guest-or-user":
      return;
    case "user":
      if (!actor.userId) throw new AppError("UNAUTHENTICATED");
      return;
    case "staff":
      if (!actor.userId || !isStaffRole(actor.role)) throw new AppError("NOT_FOUND");
      if (!actor.permissions.has(policy.permission)) throw new AppError("FORBIDDEN");
      return;
  }
}
