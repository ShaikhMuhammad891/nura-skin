import { describe, expect, it } from "vitest";

import { validateCoupon, type CouponForValidation, type CouponValidationContext } from "./validate";

const now = new Date("2026-10-15T12:00:00Z");
const base: CouponForValidation = {
  isActive: true,
  archivedAt: null,
  startsAt: null,
  expiresAt: null,
  maxRedemptions: null,
  redemptionCount: 0,
  perCustomerLimit: 1,
  firstOrderOnly: false,
  minSubtotalCents: null,
};
const ctx: CouponValidationContext = {
  now,
  eligibleSubtotalCents: 5000,
  eligibleLineCount: 2,
  customerRedemptions: 0,
  customerHasPaidOrders: false,
};

describe("validateCoupon", () => {
  it("accepts a valid coupon", () => {
    expect(validateCoupon(base, ctx)).toEqual({ ok: true });
  });

  it.each([
    ["inactive", { isActive: false }, {}],
    ["inactive", { archivedAt: now }, {}],
    ["not_started", { startsAt: new Date("2026-10-16T00:00:00Z") }, {}],
    ["expired", { expiresAt: now }, {}], // boundary: expires exactly now
    ["usage_limit", { maxRedemptions: 500, redemptionCount: 500 }, {}],
    ["per_customer_limit", {}, { customerRedemptions: 1 }],
    ["first_order_only", { firstOrderOnly: true }, { customerHasPaidOrders: true }],
    ["not_eligible", {}, { eligibleLineCount: 0 }],
  ] as const)("rejects: %s", (reason, couponPatch, ctxPatch) => {
    const result = validateCoupon({ ...base, ...couponPatch }, { ...ctx, ...ctxPatch });
    expect(result).toMatchObject({ ok: false, reason });
  });

  it("explains how much more is needed for a minimum subtotal", () => {
    const result = validateCoupon({ ...base, minSubtotalCents: 5800 }, ctx);
    expect(result).toEqual({
      ok: false,
      reason: "min_subtotal",
      message: "Add $8.00 more to use this code.",
    });
  });

  it("uses the same message for inactive codes as for unknown codes (no probing)", () => {
    const result = validateCoupon({ ...base, isActive: false }, ctx);
    expect(result.ok === false && result.message).toBe("This code isn't valid.");
  });
});
