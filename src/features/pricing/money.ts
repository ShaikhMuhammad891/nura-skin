/**
 * Money helpers (ADR-0008). All amounts are integer minor units (cents); percentages are
 * integer basis points (1500 = 15%). Isomorphic and dependency-free.
 */

export type Currency = "USD";
export type Money = { amount: number; currency: Currency };

export const BP_SCALE = 10_000;

export function assertCents(value: number, label = "amount"): number {
  if (!Number.isSafeInteger(value))
    throw new RangeError(`${label} must be an integer number of cents, got ${value}`);
  return value;
}

/** `amount × bp / 10000`, rounded half-up. E.g. applyBp(4899, 1500) = 735. */
export function applyBp(amountCents: number, bp: number): number {
  assertCents(amountCents);
  assertCents(bp, "bp");
  if (amountCents < 0 || bp < 0) throw new RangeError("applyBp expects non-negative inputs");
  return Math.floor((amountCents * bp + BP_SCALE / 2) / BP_SCALE);
}

/**
 * Splits `total` across `weights` proportionally using the largest-remainder method, so the
 * parts are integers that sum exactly to `total` (needed for exact per-line refunds).
 * Ties go to the earlier index, which keeps the result deterministic.
 */
export function allocate(total: number, weights: number[]): number[] {
  assertCents(total, "total");
  if (weights.length === 0) {
    if (total !== 0) throw new RangeError("cannot allocate a non-zero total across zero weights");
    return [];
  }
  const weightSum = weights.reduce((s, w) => s + w, 0);
  if (weightSum <= 0) {
    // No basis for proportion: spread evenly.
    return allocate(
      total,
      weights.map(() => 1),
    );
  }
  const exact = weights.map((w) => (total * w) / weightSum);
  const floored = exact.map(Math.floor);
  let remainder = total - floored.reduce((s, v) => s + v, 0);
  const order = exact
    .map((value, index) => ({ index, fraction: value - Math.floor(value) }))
    .sort((a, b) => b.fraction - a.fraction || a.index - b.index);
  for (const { index } of order) {
    if (remainder <= 0) break;
    floored[index]! += 1;
    remainder -= 1;
  }
  return floored;
}

const formatters = new Map<string, Intl.NumberFormat>();

export function formatMoney(
  amountCents: number,
  currency: Currency = "USD",
  locale = "en-US",
): string {
  const key = `${locale}:${currency}`;
  let formatter = formatters.get(key);
  if (!formatter) {
    formatter = new Intl.NumberFormat(locale, { style: "currency", currency });
    formatters.set(key, formatter);
  }
  return formatter.format(amountCents / 100);
}

export const money = (amount: number, currency: Currency = "USD"): Money => ({
  amount: assertCents(amount),
  currency,
});
