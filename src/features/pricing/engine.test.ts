import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { quote, subscriptionUnitPrice, type ApplicableCoupon, type QuoteLineInput } from "./engine";

const line = (
  overrides: Partial<QuoteLineInput> & { id: string; unitPriceCents: number },
): QuoteLineInput => ({
  productId: `p_${overrides.id}`,
  categoryId: "serums",
  isBundle: false,
  quantity: 1,
  purchaseType: "ONE_TIME",
  consultationId: null,
  ...overrides,
});

const coupon = (overrides: Partial<ApplicableCoupon>): ApplicableCoupon => ({
  code: "TEST",
  type: "PERCENTAGE",
  valueBp: 1000,
  appliesTo: "all",
  appliesToSubscriptions: false,
  exclusive: false,
  ...overrides,
});

describe("base pricing & shipping", () => {
  it("charges flat-rate shipping under the threshold", () => {
    const q = quote([line({ id: "a", unitPriceCents: 3400 })]);
    expect(q).toMatchObject({
      subtotalCents: 3400,
      discountCents: 0,
      shippingCents: 650,
      totalCents: 4050,
    });
    expect(q.freeShippingRemainingCents).toBe(2600);
  });

  it("ships free at exactly the $60.00 threshold (after discounts)", () => {
    const q = quote([line({ id: "a", unitPriceCents: 3000, quantity: 2 })]);
    expect(q.shippingCents).toBe(0);
    expect(q.freeShippingRemainingCents).toBeNull();
  });

  it("an empty cart costs nothing", () => {
    expect(quote([])).toMatchObject({ subtotalCents: 0, shippingCents: 0, totalCents: 0 });
  });

  it("rejects invalid quantities and prices", () => {
    expect(() => quote([line({ id: "a", unitPriceCents: 3400, quantity: 11 })])).toThrow(
      RangeError,
    );
    expect(() => quote([line({ id: "a", unitPriceCents: 0 })])).toThrow(RangeError);
  });
});

describe("subscription discount", () => {
  it("takes 15% per unit, matching the Stripe recurring price", () => {
    expect(subscriptionUnitPrice(4800)).toBe(4080);
    expect(subscriptionUnitPrice(4899)).toBe(4164); // 734.85 → 735 off
    const q = quote([
      line({ id: "a", unitPriceCents: 4800, quantity: 2, purchaseType: "SUBSCRIPTION" }),
    ]);
    expect(q.lines[0]).toMatchObject({
      effectiveUnitPriceCents: 4080,
      discountCents: 1440,
      totalCents: 8160,
    });
  });

  it("any subscription line ships free", () => {
    const q = quote([line({ id: "a", unitPriceCents: 2400, purchaseType: "SUBSCRIPTION" })]);
    expect(q).toMatchObject({
      shippingCents: 0,
      hasSubscription: true,
      freeShippingRemainingCents: null,
    });
  });

  it("is not part of the order-level (Stripe coupon) discount", () => {
    const q = quote([line({ id: "a", unitPriceCents: 4800, purchaseType: "SUBSCRIPTION" })]);
    expect(q.orderLevelDiscountCents).toBe(0);
  });
});

describe("routine discount", () => {
  const routine = (purchaseType: "ONE_TIME" | "SUBSCRIPTION" = "ONE_TIME") => [
    line({ id: "cleanser", unitPriceCents: 2400, consultationId: "c1", purchaseType }),
    line({ id: "serum", unitPriceCents: 3400, consultationId: "c1", purchaseType }),
    line({ id: "cream", unitPriceCents: 3800, consultationId: "c1", purchaseType }),
  ];

  it("gives 10% off when ≥ 3 lines from one consultation", () => {
    const q = quote(routine());
    expect(q.discounts).toEqual([{ kind: "routine", amountCents: 960 }]);
    expect(q.notices).toContain("routine_discount_applied");
    expect(q.orderLevelDiscountCents).toBe(960);
  });

  it("does not apply with fewer than 3 routine lines", () => {
    expect(quote(routine().slice(0, 2)).discountCents).toBe(0);
  });

  it("does not combine lines from different consultations", () => {
    const [a, b, c] = routine();
    expect(quote([a!, b!, { ...c!, consultationId: "c2" }]).discountCents).toBe(0);
  });

  it("is first-order only", () => {
    expect(quote(routine(), { isFirstOrder: false }).discountCents).toBe(0);
  });

  it("stacks with the subscription discount but caps the combined line discount at 25%", () => {
    const q = quote(routine("SUBSCRIPTION"));
    // Line 2400: sub 360; routine 10% of 2040 = 204 → 564 total (23.5% < 25% cap).
    expect(q.lines[0]!.discounts).toEqual([
      { kind: "subscription", amountCents: 360 },
      { kind: "routine", amountCents: 204 },
    ]);
    const lowCap = quote(routine("SUBSCRIPTION"), {
      settings: {
        subscriptionDiscountBp: 1500,
        routineDiscountBp: 1000,
        routineMinLines: 3,
        maxLineDiscountBp: 2000,
        shippingFlatRateCents: 650,
        freeShippingThresholdCents: 6000,
      },
    });
    // Cap 20% of 2400 = 480 → routine limited to 120.
    expect(lowCap.lines[0]!.discounts.find((d) => d.kind === "routine")?.amountCents).toBe(120);
  });
});

describe("coupons", () => {
  it("percentage coupon on eligible lines, allocated exactly across them", () => {
    const q = quote(
      [
        line({ id: "a", unitPriceCents: 2400 }),
        line({ id: "b", unitPriceCents: 3400 }),
        line({ id: "c", unitPriceCents: 3800 }),
      ],
      { coupon: coupon({ valueBp: 1500 }) },
    );
    expect(q.discounts).toEqual([{ kind: "coupon", amountCents: 1440 }]);
    const allocated = q.lines.flatMap((l) => l.discounts).reduce((s, d) => s + d.amountCents, 0);
    expect(allocated).toBe(1440);
  });

  it("respects maxDiscountCents", () => {
    const q = quote([line({ id: "a", unitPriceCents: 9000 })], {
      coupon: coupon({ valueBp: 5000, maxDiscountCents: 2000 }),
    });
    expect(q.discountCents).toBe(2000);
  });

  it("fixed coupon never exceeds the eligible subtotal", () => {
    const q = quote([line({ id: "a", unitPriceCents: 900 })], {
      coupon: coupon({ type: "FIXED_AMOUNT", valueCents: 2000 }),
    });
    expect(q.discountCents).toBe(900);
    expect(q.totalCents).toBe(650); // shipping only
  });

  it("skips subscription lines unless appliesToSubscriptions", () => {
    const lines = [line({ id: "a", unitPriceCents: 4000, purchaseType: "SUBSCRIPTION" })];
    const off = quote(lines, { coupon: coupon({ valueBp: 1000 }) });
    expect(off.discounts.find((d) => d.kind === "coupon")).toBeUndefined();
    expect(off.notices).toContain("coupon_not_applicable");
    const on = quote(lines, { coupon: coupon({ valueBp: 1000, appliesToSubscriptions: true }) });
    // 10% of the subscription price 3400.
    expect(on.discounts.find((d) => d.kind === "coupon")?.amountCents).toBe(340);
  });

  it("category-scoped coupons only touch that category", () => {
    const q = quote(
      [
        line({ id: "a", unitPriceCents: 4000, categoryId: "serums" }),
        line({ id: "b", unitPriceCents: 4000, categoryId: "cleansers" }),
      ],
      {
        coupon: coupon({
          appliesTo: "categories",
          eligibleCategoryIds: ["cleansers"],
          valueBp: 1000,
        }),
      },
    );
    expect(q.lines[0]!.discountCents).toBe(0);
    expect(q.lines[1]!.discountCents).toBe(400);
  });

  it("routines_only coupons apply to bundle and routine lines only", () => {
    const q = quote(
      [
        line({ id: "bundle", unitPriceCents: 11800, isBundle: true }),
        line({ id: "single", unitPriceCents: 3000 }),
      ],
      { coupon: coupon({ appliesTo: "routines_only", valueBp: 1000 }) },
    );
    expect(q.lines.map((l) => l.discountCents)).toEqual([1180, 0]);
  });

  it("free-shipping coupon waives shipping without a line discount", () => {
    const q = quote([line({ id: "a", unitPriceCents: 2400 })], {
      coupon: coupon({ type: "FREE_SHIPPING" }),
    });
    expect(q).toMatchObject({ discountCents: 0, shippingCents: 0, totalCents: 2400 });
  });

  describe("exclusive coupons vs the routine discount", () => {
    const routineLines = [
      line({ id: "a", unitPriceCents: 2400, consultationId: "c1" }),
      line({ id: "b", unitPriceCents: 3400, consultationId: "c1" }),
      line({ id: "c", unitPriceCents: 3800, consultationId: "c1" }),
    ];

    it("keeps the routine discount when it saves more", () => {
      const q = quote(routineLines, { coupon: coupon({ exclusive: true, valueBp: 500 }) });
      expect(q.discounts).toEqual([{ kind: "routine", amountCents: 960 }]);
      expect(q.notices).toContain("routine_discount_better_than_coupon");
    });

    it("replaces the routine discount when the coupon saves more", () => {
      const q = quote(routineLines, { coupon: coupon({ exclusive: true, valueBp: 2000 }) });
      expect(q.discounts).toEqual([{ kind: "coupon", amountCents: 1920 }]);
      expect(q.notices).toContain("coupon_replaced_routine_discount");
    });

    it("non-exclusive coupons stack on top of the routine discount", () => {
      const q = quote(routineLines, { coupon: coupon({ valueBp: 1000 }) });
      expect(q.discounts).toEqual([
        { kind: "routine", amountCents: 960 },
        { kind: "coupon", amountCents: 864 },
      ]);
    });
  });
});

describe("invariants (property-based)", () => {
  const lineArb = fc.record({
    id: fc.uuid(),
    unitPriceCents: fc.integer({ min: 1, max: 30_000 }),
    quantity: fc.integer({ min: 1, max: 10 }),
    purchaseType: fc.constantFrom<"ONE_TIME" | "SUBSCRIPTION">("ONE_TIME", "SUBSCRIPTION"),
    consultationId: fc.constantFrom<string | null>(null, "c1", "c2"),
    categoryId: fc.constantFrom("serums", "cleansers"),
    isBundle: fc.boolean(),
  });
  const couponArb = fc.option(
    fc.record({
      code: fc.constant("P"),
      type: fc.constantFrom<"PERCENTAGE" | "FIXED_AMOUNT" | "FREE_SHIPPING">(
        "PERCENTAGE",
        "FIXED_AMOUNT",
        "FREE_SHIPPING",
      ),
      valueBp: fc.integer({ min: 1, max: 10_000 }),
      valueCents: fc.integer({ min: 1, max: 50_000 }),
      maxDiscountCents: fc.option(fc.integer({ min: 1, max: 20_000 }), { nil: null }),
      appliesTo: fc.constantFrom<"all" | "routines_only">("all", "routines_only"),
      appliesToSubscriptions: fc.boolean(),
      exclusive: fc.boolean(),
    }),
    { nil: null },
  );

  it("totals are consistent, non-negative and line discounts sum to the order discount", () => {
    fc.assert(
      fc.property(
        fc
          .array(lineArb, { maxLength: 8 })
          .map((ls) => ls.map((l) => ({ ...l, productId: `p_${l.id}` }))),
        couponArb,
        fc.boolean(),
        (lines, c, isFirstOrder) => {
          const q = quote(lines, { coupon: c, isFirstOrder });
          const lineDiscounts = q.lines.reduce((s, l) => s + l.discountCents, 0);
          expect(lineDiscounts).toBe(q.discountCents);
          expect(q.totalCents).toBe(q.subtotalCents - q.discountCents + q.shippingCents);
          expect(q.totalCents).toBeGreaterThanOrEqual(0);
          for (const l of q.lines) {
            expect(l.totalCents).toBeGreaterThanOrEqual(0);
            expect(Number.isInteger(l.totalCents)).toBe(true);
            // Subscription + routine never exceed 25% of the base; coupons come on top.
            const nonCoupon = l.discounts
              .filter((d) => d.kind !== "coupon")
              .reduce((s, d) => s + d.amountCents, 0);
            expect(nonCoupon).toBeLessThanOrEqual(Math.floor((l.baseCents * 2500 + 5000) / 10000));
          }
        },
      ),
      { numRuns: 500 },
    );
  });
});
