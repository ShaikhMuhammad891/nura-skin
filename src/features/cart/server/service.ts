import "server-only";

import { validateCoupon, type CouponRejection } from "@/features/coupons/validate";
import { availabilityFor } from "@/features/inventory/server/service";
import {
  isCouponEligible,
  quote,
  type ApplicableCoupon,
  type PurchaseType,
  type Quote,
  type QuoteLineInput,
} from "@/features/pricing/engine";
import { getPricingSettings } from "@/features/settings/server/settings";
import type { Coupon, RoutineTier } from "@/generated/prisma/client";
import { AppError } from "@/lib/errors";
import { inTransaction, type DbClient } from "@/lib/server/db-types";
import { enqueueOutbox } from "@/lib/server/outbox";

import { PLAN_INTERVALS, suggestedQuantity, suggestPlanInterval, type PlanInterval } from "../plan";

/**
 * Cart service (docs/04 C6, docs/09 §6, FR-CART-*). The server is the price authority: the
 * client never sends prices, and every view is re-quoted from the database.
 */
export const MAX_LINE_QUANTITY = 10;

/** Who owns the cart: a signed-in user, or a guest identified by the signed cookie's cart id. */
export type CartOwner = { userId: string } | { guestCartId: string | null };

export async function findActiveCart(db: DbClient, owner: CartOwner) {
  if ("userId" in owner)
    return db.cart.findFirst({ where: { userId: owner.userId, status: "ACTIVE" } });
  if (!owner.guestCartId) return null;
  return db.cart.findFirst({ where: { id: owner.guestCartId, status: "ACTIVE", userId: null } });
}

export async function ensureCart(db: DbClient, owner: CartOwner) {
  const existing = await findActiveCart(db, owner);
  if (existing) return existing;
  return db.cart.create({ data: { userId: "userId" in owner ? owner.userId : null } });
}

async function loadVariantForCart(db: DbClient, variantId: string) {
  const variant = await db.productVariant.findUnique({
    where: { id: variantId },
    select: {
      id: true,
      priceCents: true,
      replenishDays: true,
      subscriptionEligible: true,
      archivedAt: true,
      product: { select: { status: true, archivedAt: true, type: true } },
    },
  });
  if (
    !variant ||
    variant.archivedAt ||
    variant.product.archivedAt ||
    variant.product.status !== "PUBLISHED"
  ) {
    throw new AppError("NOT_FOUND", "This product isn't available.");
  }
  return variant;
}

export type AddItemInput = {
  variantId: string;
  quantity: number;
  purchaseType: PurchaseType;
  consultationId?: string | null;
  routineTier?: RoutineTier | null;
};

export async function addItem(db: DbClient, cartId: string, input: AddItemInput) {
  if (
    !Number.isInteger(input.quantity) ||
    input.quantity < 1 ||
    input.quantity > MAX_LINE_QUANTITY
  ) {
    throw new AppError("VALIDATION", `Quantity must be between 1 and ${MAX_LINE_QUANTITY}.`);
  }
  return inTransaction(db, async (tx) => {
    const variant = await loadVariantForCart(tx, input.variantId);
    if (
      input.purchaseType === "SUBSCRIPTION" &&
      (!variant.subscriptionEligible || variant.product.type === "BUNDLE")
    ) {
      throw new AppError("VALIDATION", "This item can't be added to a Routine Plan.", {
        details: { code: "NOT_SUBSCRIBABLE" },
      });
    }

    const existing = await tx.cartItem.findUnique({
      where: {
        cartId_variantId_purchaseType: {
          cartId,
          variantId: input.variantId,
          purchaseType: input.purchaseType,
        },
      },
    });
    const available = (await availabilityFor(tx, [input.variantId])).get(input.variantId) ?? 0;
    const wanted = (existing?.quantity ?? 0) + input.quantity;
    const limit = Math.min(MAX_LINE_QUANTITY, available);
    if (limit < 1)
      throw new AppError("OUT_OF_STOCK", "Sorry, that's no longer in stock.", {
        details: { available: 0 },
      });
    if (wanted > limit) {
      throw new AppError("OUT_OF_STOCK", `Only ${limit} can be added.`, {
        details: { available, maxQuantity: limit, inCart: existing?.quantity ?? 0 },
      });
    }

    const item = existing
      ? await tx.cartItem.update({
          where: { id: existing.id },
          data: {
            quantity: wanted,
            seenPriceCents: variant.priceCents,
            // Routine attribution wins when lines merge (review R-32).
            consultationId: existing.consultationId ?? input.consultationId ?? null,
            routineTier: existing.routineTier ?? input.routineTier ?? null,
          },
        })
      : await tx.cartItem.create({
          data: {
            cartId,
            variantId: input.variantId,
            quantity: input.quantity,
            purchaseType: input.purchaseType,
            consultationId: input.consultationId ?? null,
            routineTier: input.routineTier ?? null,
            seenPriceCents: variant.priceCents,
          },
        });

    // The first subscription line sets the plan interval (review R-07).
    if (input.purchaseType === "SUBSCRIPTION") {
      const cart = await tx.cart.findUniqueOrThrow({
        where: { id: cartId },
        select: { subscriptionIntervalWeeks: true },
      });
      if (!cart.subscriptionIntervalWeeks) {
        await tx.cart.update({
          where: { id: cartId },
          data: { subscriptionIntervalWeeks: suggestPlanInterval([variant.replenishDays]) },
        });
      }
    }
    await tx.cart.update({ where: { id: cartId }, data: { lastActivityAt: new Date() } });
    return item;
  });
}

async function ownedItem(db: DbClient, cartId: string, itemId: string) {
  const item = await db.cartItem.findFirst({ where: { id: itemId, cartId } });
  if (!item) throw new AppError("NOT_FOUND", "That item isn't in your cart.");
  return item;
}

export async function updateItem(
  db: DbClient,
  cartId: string,
  itemId: string,
  patch: { quantity?: number; purchaseType?: PurchaseType },
) {
  return inTransaction(db, async (tx) => {
    const item = await ownedItem(tx, cartId, itemId);
    const nextType = patch.purchaseType ?? item.purchaseType;
    const nextQty = patch.quantity ?? item.quantity;
    if (nextType !== item.purchaseType) {
      // Switching type may collide with an existing line of the other type: merge via addItem.
      await tx.cartItem.delete({ where: { id: item.id } });
      return addItem(tx, cartId, {
        variantId: item.variantId,
        quantity: nextQty,
        purchaseType: nextType,
        consultationId: item.consultationId,
        routineTier: item.routineTier,
      });
    }
    if (!Number.isInteger(nextQty) || nextQty < 1 || nextQty > MAX_LINE_QUANTITY) {
      throw new AppError("VALIDATION", `Quantity must be between 1 and ${MAX_LINE_QUANTITY}.`);
    }
    const available = (await availabilityFor(tx, [item.variantId])).get(item.variantId) ?? 0;
    if (nextQty > available)
      throw new AppError("OUT_OF_STOCK", `Only ${available} left.`, { details: { available } });
    return tx.cartItem.update({ where: { id: item.id }, data: { quantity: nextQty } });
  });
}

export async function removeItem(db: DbClient, cartId: string, itemId: string) {
  await ownedItem(db, cartId, itemId);
  await db.cartItem.delete({ where: { id: itemId } });
}

export async function setPlanInterval(db: DbClient, cartId: string, weeks: number) {
  if (!(PLAN_INTERVALS as readonly number[]).includes(weeks)) {
    throw new AppError("VALIDATION", "Choose delivery every 4, 8 or 12 weeks.");
  }
  const subscriptionLines = await db.cartItem.count({
    where: { cartId, purchaseType: "SUBSCRIPTION" },
  });
  if (!subscriptionLines)
    throw new AppError("CONFLICT", "There are no Routine Plan items in your cart.");
  await db.cart.update({ where: { id: cartId }, data: { subscriptionIntervalWeeks: weeks } });
}

/**
 * Merges a guest cart into the user's cart at sign-in (docs/04 C2). Quantities sum and are
 * clamped to stock and the per-line max; routine attribution is preserved. Idempotent: an
 * already-merged guest cart is ignored.
 */
export async function mergeGuestCart(db: DbClient, guestCartId: string, userId: string) {
  return inTransaction(db, async (tx) => {
    const guest = await tx.cart.findFirst({
      where: { id: guestCartId, status: "ACTIVE", userId: null },
      include: { items: true },
    });
    if (!guest) return { merged: 0, clamped: 0 };

    const target = await ensureCart(tx, { userId });
    const availability = await availabilityFor(
      tx,
      guest.items.map((i) => i.variantId),
    );
    let merged = 0;
    let clamped = 0;

    for (const item of guest.items) {
      const existing = await tx.cartItem.findUnique({
        where: {
          cartId_variantId_purchaseType: {
            cartId: target.id,
            variantId: item.variantId,
            purchaseType: item.purchaseType,
          },
        },
      });
      const limit = Math.min(MAX_LINE_QUANTITY, availability.get(item.variantId) ?? 0);
      const wanted = (existing?.quantity ?? 0) + item.quantity;
      const quantity = Math.min(wanted, limit);
      if (quantity < wanted) clamped += 1;
      if (quantity < 1) continue;
      if (existing) {
        await tx.cartItem.update({
          where: { id: existing.id },
          data: {
            quantity,
            consultationId: existing.consultationId ?? item.consultationId,
            routineTier: existing.routineTier ?? item.routineTier,
          },
        });
      } else {
        await tx.cartItem.create({
          data: {
            cartId: target.id,
            variantId: item.variantId,
            quantity,
            purchaseType: item.purchaseType,
            consultationId: item.consultationId,
            routineTier: item.routineTier,
            seenPriceCents: item.seenPriceCents,
          },
        });
      }
      merged += 1;
    }

    await tx.cart.update({
      where: { id: target.id },
      data: {
        subscriptionIntervalWeeks:
          target.subscriptionIntervalWeeks ?? guest.subscriptionIntervalWeeks,
        couponId: target.couponId ?? guest.couponId,
        lastActivityAt: new Date(),
      },
    });
    await tx.cart.update({ where: { id: guest.id }, data: { status: "MERGED" } });
    await enqueueOutbox(tx, "cart.merged", { guestCartId, userId, merged, clamped });
    return { merged, clamped };
  });
}

// ── Coupons ─────────────────────────────────────────────────────────────────

export function toApplicableCoupon(c: Coupon): ApplicableCoupon {
  return {
    code: c.code,
    type: c.type,
    valueBp: c.valueBp,
    valueCents: c.valueCents,
    maxDiscountCents: c.maxDiscountCents,
    appliesTo: c.appliesTo as ApplicableCoupon["appliesTo"],
    eligibleCategoryIds: c.eligibleCategoryIds,
    eligibleProductIds: c.eligibleProductIds,
    appliesToSubscriptions: c.appliesToSubscriptions,
    exclusive: c.exclusive,
  };
}

export type CustomerRef = { userId: string | null; email: string | null };

async function customerCouponHistory(db: DbClient, couponId: string, customer: CustomerRef) {
  const or = [
    ...(customer.userId ? [{ userId: customer.userId }] : []),
    ...(customer.email ? [{ email: customer.email }] : []),
  ];
  const [redemptions, paidOrders] = await Promise.all([
    or.length ? db.couponRedemption.count({ where: { couponId, OR: or } }) : 0,
    or.length ? db.order.count({ where: { paidAt: { not: null }, OR: or } }) : 0,
  ]);
  return { redemptions, hasPaidOrders: paidOrders > 0 };
}

export async function applyCoupon(
  db: DbClient,
  cartId: string,
  code: string,
  customer: CustomerRef,
  now = new Date(),
) {
  const normalized = code.trim().toUpperCase();
  if (!/^[A-Z0-9-]{3,32}$/.test(normalized))
    throw couponError("inactive", "This code isn't valid.");
  const coupon = await db.coupon.findUnique({ where: { code: normalized } });
  // Unknown and inactive codes get the same message (no probing, docs/09 §6).
  if (!coupon) throw couponError("inactive", "This code isn't valid.");

  const inputs = await quoteInputs(db, cartId);
  const applicable = toApplicableCoupon(coupon);
  const eligible = inputs.lines.filter((l) => isCouponEligible(l, applicable));
  const preview = quote(eligible, { settings: inputs.settings, isFirstOrder: inputs.isFirstOrder });
  const history = await customerCouponHistory(db, coupon.id, customer);
  const result = validateCoupon(coupon, {
    now,
    eligibleSubtotalCents: preview.subtotalCents - preview.discountCents,
    eligibleLineCount: eligible.length,
    customerRedemptions: history.redemptions,
    customerHasPaidOrders: history.hasPaidOrders,
  });
  if (!result.ok) throw couponError(result.reason, result.message);
  await db.cart.update({ where: { id: cartId }, data: { couponId: coupon.id } });
  return coupon;
}

export async function removeCoupon(db: DbClient, cartId: string) {
  await db.cart.update({ where: { id: cartId }, data: { couponId: null } });
}

function couponError(reason: CouponRejection, message: string) {
  return new AppError("COUPON_INVALID", message, { details: { reason } });
}

// ── Views & quotes ──────────────────────────────────────────────────────────

async function quoteInputs(db: DbClient, cartId: string) {
  const cart = await db.cart.findUniqueOrThrow({
    where: { id: cartId },
    include: {
      coupon: true,
      items: {
        orderBy: { addedAt: "asc" },
        include: {
          variant: {
            select: {
              id: true,
              sku: true,
              name: true,
              priceCents: true,
              replenishDays: true,
              archivedAt: true,
              product: {
                select: {
                  id: true,
                  slug: true,
                  name: true,
                  status: true,
                  archivedAt: true,
                  type: true,
                  categoryId: true,
                  images: { take: 1, orderBy: { position: "asc" } },
                },
              },
            },
          },
        },
      },
    },
  });
  const settings = await getPricingSettings(db);
  const isFirstOrder = cart.userId
    ? (await db.order.count({ where: { userId: cart.userId, paidAt: { not: null } } })) === 0
    : true;
  const lines: QuoteLineInput[] = cart.items.map((item) => ({
    id: item.id,
    productId: item.variant.product.id,
    categoryId: item.variant.product.categoryId,
    isBundle: item.variant.product.type === "BUNDLE",
    unitPriceCents: item.variant.priceCents,
    quantity: item.quantity,
    purchaseType: item.purchaseType,
    consultationId: item.consultationId,
  }));
  return { cart, settings, isFirstOrder, lines };
}

export type CartWarning =
  | { type: "item_unavailable"; lineId: string }
  | { type: "stock_reduced"; lineId: string; available: number }
  | { type: "price_changed"; lineId: string; previousCents: number; currentCents: number }
  | { type: "coupon_removed"; reason: string };

export type CartView = {
  id: string;
  lines: {
    id: string;
    variantId: string;
    sku: string;
    variantName: string;
    product: { id: string; slug: string; name: string; imagePublicId: string | null };
    quantity: number;
    maxQuantity: number;
    purchaseType: PurchaseType;
    consultationId: string | null;
    routineTier: RoutineTier | null;
    suggestedQuantity: number | null;
  }[];
  planIntervalWeeks: PlanInterval | null;
  coupon: { code: string; description: string | null } | null;
  quote: Quote;
  warnings: CartWarning[];
};

/**
 * Builds the authoritative cart view. Unavailable lines are excluded from the quote (and
 * reported), quantities above stock are quoted at what's available, and an applied coupon that
 * no longer validates is dropped with a warning.
 */
export async function getCartView(
  db: DbClient,
  cartId: string,
  customer: CustomerRef,
  now = new Date(),
): Promise<CartView> {
  const { cart, settings, isFirstOrder, lines } = await quoteInputs(db, cartId);
  const availability = await availabilityFor(
    db,
    cart.items.map((i) => i.variantId),
  );
  const warnings: CartWarning[] = [];
  const quotable: QuoteLineInput[] = [];

  for (const [i, item] of cart.items.entries()) {
    const available = availability.get(item.variantId) ?? 0;
    const p = item.variant.product;
    if (item.variant.archivedAt || p.archivedAt || p.status !== "PUBLISHED" || available < 1) {
      warnings.push({ type: "item_unavailable", lineId: item.id });
      continue;
    }
    const quantity = Math.min(item.quantity, available);
    if (quantity < item.quantity)
      warnings.push({ type: "stock_reduced", lineId: item.id, available });
    if (item.seenPriceCents != null && item.seenPriceCents !== item.variant.priceCents) {
      warnings.push({
        type: "price_changed",
        lineId: item.id,
        previousCents: item.seenPriceCents,
        currentCents: item.variant.priceCents,
      });
    }
    quotable.push({ ...lines[i]!, quantity });
  }

  let coupon: ApplicableCoupon | null = null;
  if (cart.coupon) {
    const applicable = toApplicableCoupon(cart.coupon);
    const eligible = quotable.filter((l) => isCouponEligible(l, applicable));
    const preview = quote(eligible, { settings, isFirstOrder });
    const history = await customerCouponHistory(db, cart.coupon.id, customer);
    const check = validateCoupon(cart.coupon, {
      now,
      eligibleSubtotalCents: preview.subtotalCents - preview.discountCents,
      eligibleLineCount: eligible.length,
      customerRedemptions: history.redemptions,
      customerHasPaidOrders: history.hasPaidOrders,
    });
    if (check.ok) coupon = applicable;
    else warnings.push({ type: "coupon_removed", reason: check.message });
  }

  const planIntervalWeeks = (cart.subscriptionIntervalWeeks as PlanInterval | null) ?? null;
  return {
    id: cart.id,
    lines: cart.items.map((item) => ({
      id: item.id,
      variantId: item.variantId,
      sku: item.variant.sku,
      variantName: item.variant.name,
      product: {
        id: item.variant.product.id,
        slug: item.variant.product.slug,
        name: item.variant.product.name,
        imagePublicId: item.variant.product.images[0]?.publicId ?? null,
      },
      quantity: item.quantity,
      maxQuantity: Math.min(MAX_LINE_QUANTITY, availability.get(item.variantId) ?? 0),
      purchaseType: item.purchaseType,
      consultationId: item.consultationId,
      routineTier: item.routineTier,
      suggestedQuantity:
        item.purchaseType === "SUBSCRIPTION" && planIntervalWeeks
          ? suggestedQuantity(planIntervalWeeks, item.variant.replenishDays)
          : null,
    })),
    planIntervalWeeks,
    coupon:
      cart.coupon && coupon
        ? { code: cart.coupon.code, description: cart.coupon.description }
        : null,
    quote: quote(quotable, { settings, coupon, isFirstOrder }),
    warnings,
  };
}
