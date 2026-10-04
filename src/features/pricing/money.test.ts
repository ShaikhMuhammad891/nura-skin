import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { allocate, applyBp, formatMoney } from "./money";

describe("applyBp", () => {
  it.each([
    [4899, 1500, 735], // 734.85 → 735
    [4800, 1500, 720],
    [3400, 1000, 340],
    [1, 5000, 1], // 0.5 rounds half-up
    [1, 4999, 0],
    [0, 1500, 0],
  ])("applyBp(%i, %i) = %i", (amount, bp, expected) => {
    expect(applyBp(amount, bp)).toBe(expected);
  });

  it("rejects non-integer cents", () => {
    expect(() => applyBp(10.5, 100)).toThrow(RangeError);
  });
});

describe("allocate (largest remainder)", () => {
  it("distributes remainders deterministically", () => {
    expect(allocate(100, [1, 1, 1])).toEqual([34, 33, 33]);
    expect(allocate(1000, [2400, 3400, 3800])).toEqual([250, 354, 396]);
    expect(allocate(0, [5, 5])).toEqual([0, 0]);
  });

  it("property: parts are integers that sum exactly to the total and never go negative", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 1_000_000 }),
        fc.array(fc.integer({ min: 0, max: 100_000 }), { minLength: 1, maxLength: 12 }),
        (total, weights) => {
          const parts = allocate(total, weights);
          expect(parts).toHaveLength(weights.length);
          expect(parts.reduce((s, p) => s + p, 0)).toBe(total);
          for (const p of parts) {
            expect(Number.isInteger(p)).toBe(true);
            expect(p).toBeGreaterThanOrEqual(0);
          }
        },
      ),
    );
  });

  it("property: each part stays within 1 cent of its exact share", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 100_000 }),
        fc.array(fc.integer({ min: 1, max: 10_000 }), { minLength: 1, maxLength: 8 }),
        (total, weights) => {
          const sum = weights.reduce((s, w) => s + w, 0);
          allocate(total, weights).forEach((part, i) => {
            expect(Math.abs(part - (total * weights[i]!) / sum)).toBeLessThan(1);
          });
        },
      ),
    );
  });
});

describe("formatMoney", () => {
  it("formats cents as USD", () => {
    expect(formatMoney(11800)).toBe("$118.00");
    expect(formatMoney(735)).toBe("$7.35");
  });
});
