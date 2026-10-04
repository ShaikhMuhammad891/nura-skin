import type { RoleKey } from "@/lib/permissions";

/**
 * Custom session claims (docs/10 §2). Requires the Clerk session token template
 * `{ "metadata": "{{user.public_metadata}}" }` (Dashboard → Sessions → Customize session token).
 * The role claim is a mirror used only by the coarse proxy gate; the DB role is authoritative.
 */
declare global {
  interface CustomJwtSessionClaims {
    metadata?: { role?: RoleKey };
  }
}

export {};
