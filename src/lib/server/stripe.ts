import "server-only";

import Stripe from "stripe";

import { env } from "@/lib/env";

/**
 * Stripe client (docs/11 §2, review R-05, ADR-0011). The API version is pinned explicitly and must
 * match the webhook endpoint's version; upgrading it is a deliberate change with re-captured
 * webhook fixtures. The SDK retries idempotent requests; we pass idempotency keys everywhere.
 */
export const STRIPE_API_VERSION = "2026-08-26.dahlia" as const;

const globalForStripe = globalThis as unknown as { __nuraStripe?: Stripe };

export function getStripe(): Stripe {
  globalForStripe.__nuraStripe ??= new Stripe(env.STRIPE_SECRET_KEY, {
    apiVersion: STRIPE_API_VERSION,
    maxNetworkRetries: 2,
    timeout: 20_000,
    appInfo: { name: "nura-skin" },
  });
  return globalForStripe.__nuraStripe;
}

export type { Stripe };
