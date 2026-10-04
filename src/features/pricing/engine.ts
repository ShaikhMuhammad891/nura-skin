/**
 * Pricing engine (docs/11 §4). Pure: `quote(lines, context) → Quote`. The server is the only
 * price authority; this function is the single implementation used by the cart, checkout
 * and admin previews. All math is integer cents / basis points (ADR-0008).
 *
 * Rule pipeline (fixed order):
 *  1. Base price           unit × qty
 *  2. Subscription         15% off SUBSCRIPTION lines (per unit, matches the Stripe recurring price)
 *  3. Routine              10% off lines from one consultation when ≥ 3 such lines (first order only)
 *                          combined 2+3 capped at 25% of the line's base
 *  4. Coupon               percentage / fixed / free shipping on eligible lines; exclusive coupons
 *                          are compared with the routine discount and the better one wins
 *  5. Shipping             free with any subscription line, over the threshold, or with a coupon
 */
import { allocate, applyBp } from "./money";

export type PurchaseType = "ONE_TIME" | "SUBSCRIPTION";

export type QuoteLineInput = {
  id: string;
  productId: string;
  categoryId: string;
  isBundle: boolean;
  unitPriceCents: number;
  quantity: number;
  purchaseType: PurchaseType;
  consultationId?: string | null;
};

export type PricingSettings = {
  subscriptionDiscountBp: number;
  routineDiscountBp: number;
  routineMinLines: number;
  maxLineDiscountBp: number;
  shippingFlatRateCents: number;
  freeShippingThresholdCents: number;
};

export const DEFAULT_PRICING_SETTINGS: PricingSettings = {
  subscriptionDiscountBp: 1500,
  routineDiscountBp: 1000,
  routineMinLines: 3,
  maxLineDiscountBp: 2500,
  shippingFlatRateCents: 650,
  freeShippingThresholdCents: 6000,
};

/** A coupon that has already passed eligibility validation (features/coupons). */
export type ApplicableCoupon = {
  code: string;
  type: "PERCENTAGE" | "FIXED_AMOUNT" | "FREE_SHIPPING";
  valueBp?: number | null;
  valueCents?: number | null;
  maxDiscountCents?: number | null;
  appliesTo: "all" | "categories" | "products" | "routines_only";
  eligibleCategoryIds?: string[];
  eligibleProductIds?: string[];
  appliesToSubscriptions: boolean;
  exclusive: boolean;
};

export type QuoteContext = {
  settings?: PricingSettings;
  coupon?: ApplicableCoupon | null;
  /** Routine discount applies to the first order only (never to renewals). */
  isFirstOrder?: boolean;
};

export type DiscountKind = "subscription" | "routine" | "coupon";

export type QuoteLine = {
  id: string;
  quantity: number;
  purchaseType: PurchaseType;
  unitPriceCents: number;
  /** Per-unit price after the subscription discount (what Stripe's recurring price charges). */
  effectiveUnitPriceCents: number;
  baseCents: number;
  discounts: { kind: DiscountKind; amountCents: number }[];
  discountCents: number;
  totalCents: number;
};

export type QuoteNotice =
  | "routine_discount_applied"
  | "coupon_replaced_routine_discount"
  | "routine_discount_better_than_coupon"
  | "coupon_not_applicable";

export type Quote = {
  lines: QuoteLine[];
  subtotalCents: number;
  discounts: { kind: DiscountKind; amountCents: number }[];
  discountCents: number;
  /** Routine + coupon: what Checkout passes as the single ephemeral amount_off coupon. */
  orderLevelDiscountCents: number;
  shippingCents: number;
  freeShipping: boolean;
  freeShippingRemainingCents: number | null;
  totalCents: number;
  hasSubscription: boolean;
  notices: QuoteNotice[];
};

type Working = QuoteLineInput & {
  baseCents: number;
  subscriptionCents: number;
  routineCents: number;
  couponCents: number;
};

export function subscriptionUnitPrice(
  unitPriceCents: number,
  settings = DEFAULT_PRICING_SETTINGS,
): number {
  return unitPriceCents - applyBp(unitPriceCents, settings.subscriptionDiscountBp);
}

function validateLine(line: QuoteLineInput): void {
  if (!Number.isSafeInteger(line.unitPriceCents) || line.unitPriceCents <= 0) {
    throw new RangeError(`line ${line.id}: unit price must be a positive integer of cents`);
  }
  if (!Number.isSafeInteger(line.quantity) || line.quantity < 1 || line.quantity > 10) {
    throw new RangeError(`line ${line.id}: quantity must be 1–10`);
  }
}

function applyRoutineDiscounts(lines: Working[], s: PricingSettings, enabled: boolean): boolean {
  if (!enabled) return false;
  const byConsultation = new Map<string, Working[]>();
  for (const line of lines) {
    if (!line.consultationId) continue;
    const group = byConsultation.get(line.consultationId) ?? [];
    group.push(line);
    byConsultation.set(line.consultationId, group);
  }
  let applied = false;
  for (const group of byConsultation.values()) {
    if (group.length < s.routineMinLines) continue;
    for (const line of group) {
      const afterSubscription = line.baseCents - line.subscriptionCents;
      const cap = applyBp(line.baseCents, s.maxLineDiscountBp) - line.subscriptionCents;
      line.routineCents = Math.max(
        0,
        Math.min(applyBp(afterSubscription, s.routineDiscountBp), cap),
      );
      applied ||= line.routineCents > 0;
    }
  }
  return applied;
}

export function isCouponEligible(
  line: Pick<
    QuoteLineInput,
    "purchaseType" | "categoryId" | "productId" | "isBundle" | "consultationId"
  >,
  coupon: ApplicableCoupon,
): boolean {
  if (line.purchaseType === "SUBSCRIPTION" && !coupon.appliesToSubscriptions) return false;
  switch (coupon.appliesTo) {
    case "all":
      return true;
    case "categories":
      return (coupon.eligibleCategoryIds ?? []).includes(line.categoryId);
    case "products":
      return (coupon.eligibleProductIds ?? []).includes(line.productId);
    case "routines_only":
      return line.isBundle || Boolean(line.consultationId);
  }
}

/** Returns the coupon discount (and allocates it onto lines), or 0 if nothing is eligible. */
function applyCoupon(lines: Working[], coupon: ApplicableCoupon): number {
  if (coupon.type === "FREE_SHIPPING") return 0;
  const eligible = lines.filter((l) => isCouponEligible(l, coupon));
  const lineTotals = eligible.map((l) => l.baseCents - l.subscriptionCents - l.routineCents);
  const eligibleSubtotal = lineTotals.reduce((s, v) => s + v, 0);
  if (eligibleSubtotal <= 0) return 0;

  let discount =
    coupon.type === "PERCENTAGE"
      ? applyBp(eligibleSubtotal, coupon.valueBp ?? 0)
      : Math.min(coupon.valueCents ?? 0, eligibleSubtotal);
  if (coupon.maxDiscountCents != null) discount = Math.min(discount, coupon.maxDiscountCents);

  allocate(discount, lineTotals).forEach((part, i) => {
    eligible[i]!.couponCents = part;
  });
  return discount;
}

export function quote(inputs: QuoteLineInput[], context: QuoteContext = {}): Quote {
  const s = context.settings ?? DEFAULT_PRICING_SETTINGS;
  const coupon = context.coupon ?? null;
  const routineEnabled = context.isFirstOrder ?? true;
  inputs.forEach(validateLine);

  const fresh = (): Working[] =>
    inputs.map((line) => {
      const baseCents = line.unitPriceCents * line.quantity;
      const subscriptionCents =
        line.purchaseType === "SUBSCRIPTION"
          ? (line.unitPriceCents - subscriptionUnitPrice(line.unitPriceCents, s)) * line.quantity
          : 0;
      return { ...line, baseCents, subscriptionCents, routineCents: 0, couponCents: 0 };
    });

  const notices: QuoteNotice[] = [];
  let lines = fresh();
  let routineApplied = applyRoutineDiscounts(lines, s, routineEnabled);
  let couponCents = 0;

  if (coupon && coupon.type !== "FREE_SHIPPING") {
    if (coupon.exclusive && routineApplied) {
      // Exclusive coupon: evaluate both worlds and give the customer the better one (11 §4.1).
      const withCoupon = fresh();
      const couponOnly = applyCoupon(withCoupon, coupon);
      const routineOnly = lines.reduce((sum, l) => sum + l.routineCents, 0);
      if (couponOnly > routineOnly) {
        lines = withCoupon;
        couponCents = couponOnly;
        routineApplied = false;
        notices.push("coupon_replaced_routine_discount");
      } else {
        notices.push("routine_discount_better_than_coupon");
      }
    } else {
      couponCents = applyCoupon(lines, coupon);
    }
    if (couponCents === 0 && !notices.includes("routine_discount_better_than_coupon")) {
      notices.push("coupon_not_applicable");
    }
  }
  if (routineApplied) notices.unshift("routine_discount_applied");

  const quoteLines: QuoteLine[] = lines.map((l) => {
    const discounts = (
      [
        ["subscription", l.subscriptionCents],
        ["routine", l.routineCents],
        ["coupon", l.couponCents],
      ] as const
    )
      .filter(([, amount]) => amount > 0)
      .map(([kind, amountCents]) => ({ kind, amountCents }));
    const discountCents = l.subscriptionCents + l.routineCents + l.couponCents;
    return {
      id: l.id,
      quantity: l.quantity,
      purchaseType: l.purchaseType,
      unitPriceCents: l.unitPriceCents,
      effectiveUnitPriceCents: l.unitPriceCents - l.subscriptionCents / l.quantity,
      baseCents: l.baseCents,
      discounts,
      discountCents,
      totalCents: l.baseCents - discountCents,
    };
  });

  const sum = (pick: (l: Working) => number) => lines.reduce((acc, l) => acc + pick(l), 0);
  const subscriptionTotal = sum((l) => l.subscriptionCents);
  const routineTotal = sum((l) => l.routineCents);
  const subtotalCents = sum((l) => l.baseCents);
  const discountCents = subscriptionTotal + routineTotal + couponCents;
  const merchandiseCents = subtotalCents - discountCents;

  const hasSubscription = lines.some((l) => l.purchaseType === "SUBSCRIPTION");
  const freeShipping =
    lines.length === 0 ||
    hasSubscription ||
    coupon?.type === "FREE_SHIPPING" ||
    merchandiseCents >= s.freeShippingThresholdCents;
  const shippingCents = freeShipping ? 0 : s.shippingFlatRateCents;

  return {
    lines: quoteLines,
    subtotalCents,
    discounts: (
      [
        ["subscription", subscriptionTotal],
        ["routine", routineTotal],
        ["coupon", couponCents],
      ] as const
    )
      .filter(([, amount]) => amount > 0)
      .map(([kind, amountCents]) => ({ kind, amountCents })),
    discountCents,
    orderLevelDiscountCents: routineTotal + couponCents,
    shippingCents,
    freeShipping,
    freeShippingRemainingCents:
      hasSubscription || freeShipping ? null : s.freeShippingThresholdCents - merchandiseCents,
    totalCents: merchandiseCents + shippingCents,
    hasSubscription,
    notices,
  };
}
