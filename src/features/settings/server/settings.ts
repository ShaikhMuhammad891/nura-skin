import "server-only";

import { z } from "zod";

import { DEFAULT_PRICING_SETTINGS, type PricingSettings } from "@/features/pricing/engine";
import type { DbClient } from "@/lib/server/db-types";

/**
 * Store settings (08 §4.13 StoreSetting). Each key is validated. A malformed value falls back
 * to the default instead of breaking checkout, and the fallback is visible in the returned
 * `invalidKeys` for the admin to fix.
 */
const PRICING_KEYS = {
  "subscription.discount_bp": ["subscriptionDiscountBp", z.number().int().min(0).max(5000)],
  "routine.discount_bp": ["routineDiscountBp", z.number().int().min(0).max(5000)],
  "routine.min_lines": ["routineMinLines", z.number().int().min(2).max(10)],
  "pricing.max_line_discount_bp": ["maxLineDiscountBp", z.number().int().min(0).max(9000)],
  "shipping.flat_rate_cents": ["shippingFlatRateCents", z.number().int().min(0).max(10_000)],
  "shipping.free_threshold_cents": [
    "freeShippingThresholdCents",
    z.number().int().min(0).max(100_000),
  ],
} as const satisfies Record<string, [keyof PricingSettings, z.ZodType<number>]>;

export async function getPricingSettings(
  db: DbClient,
): Promise<PricingSettings & { invalidKeys: string[] }> {
  const rows = await db.storeSetting.findMany({
    where: { key: { in: Object.keys(PRICING_KEYS) } },
  });
  const settings: PricingSettings = { ...DEFAULT_PRICING_SETTINGS };
  const invalidKeys: string[] = [];
  for (const row of rows) {
    const [field, schema] = PRICING_KEYS[row.key as keyof typeof PRICING_KEYS];
    const parsed = schema.safeParse(row.value);
    if (parsed.success) settings[field] = parsed.data;
    else invalidKeys.push(row.key);
  }
  return { ...settings, invalidKeys };
}

export const SUBSCRIPTION_INTERVALS_WEEKS = [4, 8, 12] as const;
export type IntervalWeeks = (typeof SUBSCRIPTION_INTERVALS_WEEKS)[number];
