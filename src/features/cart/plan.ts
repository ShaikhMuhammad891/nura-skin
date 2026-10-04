/**
 * Routine Plan interval & quantity suggestions (docs/02 §3, review R-07). Pure.
 * A Stripe Checkout session holds one subscription with one interval, so a cart has ONE plan
 * interval. Products that run out faster get a quantity suggestion, not a different interval.
 */
export const PLAN_INTERVALS = [4, 8, 12] as const;
export type PlanInterval = (typeof PLAN_INTERVALS)[number];

/** Nearest allowed interval to the median replenishment cycle of the plan's products. */
export function suggestPlanInterval(replenishDays: readonly number[]): PlanInterval {
  if (!replenishDays.length) return 8;
  const sorted = [...replenishDays].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const median = sorted.length % 2 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
  const weeks = median / 7;
  return PLAN_INTERVALS.reduce(
    (best, w) => (Math.abs(w - weeks) < Math.abs(best - weeks) ? w : best),
    PLAN_INTERVALS[0],
  );
}

/** Units needed per delivery so the product doesn't run out before the next box (max 3). */
export function suggestedQuantity(intervalWeeks: number, replenishDays: number): number {
  return Math.min(3, Math.max(1, Math.ceil((intervalWeeks * 7) / replenishDays - 0.15)));
}
