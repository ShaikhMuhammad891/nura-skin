/**
 * Coupon eligibility rules (docs/11 §6). Pure: the caller loads the coupon, the customer's
 * redemption count and order history; this decides. Checked at apply time, again at checkout
 * session creation (with the coupon row locked), and again at markPaid.
 */
import { formatMoney } from "@/features/pricing/money";

export type CouponForValidation = {
  isActive: boolean;
  archivedAt: Date | null;
  startsAt: Date | null;
  expiresAt: Date | null;
  maxRedemptions: number | null;
  redemptionCount: number;
  perCustomerLimit: number;
  firstOrderOnly: boolean;
  minSubtotalCents: number | null;
};

export type CouponValidationContext = {
  now: Date;
  /** Subtotal of lines the coupon is eligible for (after subscription/routine discounts). */
  eligibleSubtotalCents: number;
  eligibleLineCount: number;
  /** Prior redemptions by this customer (by user id, or by email for guests). */
  customerRedemptions: number;
  customerHasPaidOrders: boolean;
};

export type CouponRejection =
  | "inactive"
  | "not_started"
  | "expired"
  | "usage_limit"
  | "per_customer_limit"
  | "first_order_only"
  | "not_eligible"
  | "min_subtotal";

export type CouponValidation =
  { ok: true } | { ok: false; reason: CouponRejection; message: string };

const MESSAGES: Record<Exclude<CouponRejection, "min_subtotal">, string> = {
  // Deliberately identical to "doesn't exist" so codes can't be probed (docs/09 §6).
  inactive: "This code isn't valid.",
  not_started: "This code isn't active yet.",
  expired: "This code has expired.",
  usage_limit: "This code has reached its limit.",
  per_customer_limit: "You've already used this code.",
  first_order_only: "This code is for first orders only.",
  not_eligible: "This code doesn't apply to the items in your cart.",
};

const reject = (reason: CouponRejection, message?: string): CouponValidation => ({
  ok: false,
  reason,
  message: message ?? MESSAGES[reason as keyof typeof MESSAGES],
});

export function validateCoupon(
  coupon: CouponForValidation,
  ctx: CouponValidationContext,
): CouponValidation {
  if (!coupon.isActive || coupon.archivedAt) return reject("inactive");
  if (coupon.startsAt && ctx.now < coupon.startsAt) return reject("not_started");
  if (coupon.expiresAt && ctx.now >= coupon.expiresAt) return reject("expired");
  if (coupon.maxRedemptions !== null && coupon.redemptionCount >= coupon.maxRedemptions)
    return reject("usage_limit");
  if (ctx.customerRedemptions >= coupon.perCustomerLimit) return reject("per_customer_limit");
  if (coupon.firstOrderOnly && ctx.customerHasPaidOrders) return reject("first_order_only");
  if (ctx.eligibleLineCount === 0) return reject("not_eligible");
  if (coupon.minSubtotalCents !== null && ctx.eligibleSubtotalCents < coupon.minSubtotalCents) {
    const missing = coupon.minSubtotalCents - ctx.eligibleSubtotalCents;
    return reject("min_subtotal", `Add ${formatMoney(missing)} more to use this code.`);
  }
  return { ok: true };
}
