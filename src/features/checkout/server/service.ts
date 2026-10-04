import "server-only";

import type { CustomerRef } from "@/features/cart/server/service";
import {
  cancelPendingOrder,
  CHECKOUT_SESSION_TTL_MINUTES,
  createPendingOrder,
  markOrderPaid,
  type MarkPaidResult,
} from "@/features/orders/server/service";
import type { Prisma } from "@/generated/prisma/client";
import { AppError } from "@/lib/errors";
import type { DbClient } from "@/lib/server/db-types";

import type { CheckoutGateway, CheckoutSessionFacts } from "./gateway";

/**
 * Checkout orchestration (docs/11 §3, ADR-0002/0004/0015). Order + stock reservation commit first;
 * Stripe calls happen after the transaction, with a compensation step if they fail.
 *
 * Scope: one-time (payment mode) checkout. Routine Plan (subscription mode) checkout lands with the
 * subscription sync in M7; until then subscription lines are rejected with a clear message.
 */
export type StartCheckoutInput = {
  cartId: string;
  customer: CustomerRef;
  siteUrl: string;
  now?: Date;
};

export type StartCheckoutResult = { orderId: string; clientSecret: string };

export async function startCheckout(
  db: DbClient,
  gateway: CheckoutGateway,
  input: StartCheckoutInput,
): Promise<StartCheckoutResult> {
  const now = input.now ?? new Date();
  const subscriptionLines = await db.cartItem.count({
    where: { cartId: input.cartId, purchaseType: "SUBSCRIPTION" },
  });
  if (subscriptionLines > 0) {
    throw new AppError(
      "CONFLICT",
      "Routine Plan checkout is coming soon. Switch those items to one-time to check out today.",
      { details: { code: "SUBSCRIPTION_CHECKOUT_UNAVAILABLE" } },
    );
  }

  const { order, reused } = await createPendingOrder(db, {
    cartId: input.cartId,
    customer: input.customer,
    now,
  });

  // Same cart, same contents, still-open session: hand back the existing session (docs/04 C7).
  if (reused && order.stripeCheckoutSessionId) {
    const existing = await gateway.retrieveSession(order.stripeCheckoutSessionId);
    if (existing.status === "open" && existing.clientSecret) {
      return { orderId: order.id, clientSecret: existing.clientSecret };
    }
    if (existing.status === "complete") {
      // Paid but the webhook hasn't landed: converge now, and never open a second session.
      await markPaidFromSession(db, existing, "return_page");
      throw new AppError("CONFLICT", "This order has already been paid.", {
        details: { code: "ORDER_ALREADY_PAID", sessionId: existing.id },
      });
    }
  }

  try {
    const lineItems = await lineItemsFor(db, gateway, order.id);
    const customerId = input.customer.userId
      ? await ensureCustomer(db, gateway, input.customer.userId)
      : null;
    // Session expiry is measured from now (a reused order may be minutes old); Stripe's minimum is 30.
    const expiresAt = new Date(now.getTime() + CHECKOUT_SESSION_TTL_MINUTES * 60_000 + 60_000);
    // New key per session attempt: the key embeds the session it replaces (none on the first try).
    const attempt = order.stripeCheckoutSessionId ?? "first";
    const couponId =
      order.discountCents > 0
        ? await gateway.createCoupon({
            amountOffCents: order.discountCents,
            orderId: order.id,
            redeemBy: new Date(expiresAt.getTime() + 60 * 60_000),
            idempotencyKey: `order:${order.id}:coupon:${attempt}`,
          })
        : null;

    const session = await gateway.createSession({
      orderId: order.id,
      cartId: input.cartId,
      userId: input.customer.userId,
      customerId,
      lineItems,
      couponId,
      shippingCents: order.shippingCents,
      expiresAt,
      returnUrl: `${input.siteUrl}/checkout/return?session_id={CHECKOUT_SESSION_ID}`,
      idempotencyKey: `order:${order.id}:session:${attempt}`,
    });
    await db.order.update({
      where: { id: order.id },
      data: { stripeCheckoutSessionId: session.id },
    });
    return { orderId: order.id, clientSecret: session.clientSecret };
  } catch (error) {
    // Compensation (docs/11 §3): free the reserved stock so a failed session never strands it.
    await cancelPendingOrder(db, order.id, now);
    throw new AppError("PAYMENT_PROVIDER", undefined, { cause: error });
  }
}

/** Priced lines only: bundle components are fulfilment detail, charged via the bundle line. */
async function lineItemsFor(db: DbClient, gateway: CheckoutGateway, orderId: string) {
  const items = await db.orderItem.findMany({
    where: { orderId, bundleParentId: null },
    select: {
      variantId: true,
      quantity: true,
      unitPriceCents: true,
      productName: true,
      variantName: true,
      sku: true,
    },
    orderBy: { id: "asc" },
  });
  const lineItems = [];
  for (const item of items) {
    if (!item.variantId) throw new Error("Order item without a variant");
    const priceId = await ensureOneTimePrice(db, gateway, {
      variantId: item.variantId,
      unitAmountCents: item.unitPriceCents,
      name: `${item.productName} · ${item.variantName}`,
      sku: item.sku,
    });
    lineItems.push({ priceId, quantity: item.quantity });
  }
  return lineItems;
}

/**
 * Safety net of the catalogue sync (docs/11 §2.1): an active Stripe Price for exactly this amount,
 * created on demand. Prices are immutable, so a price change creates a new one and retires the old
 * row locally (deactivating it in Stripe is the sync job's work, never inside checkout).
 */
export async function ensureOneTimePrice(
  db: DbClient,
  gateway: CheckoutGateway,
  input: { variantId: string; unitAmountCents: number; name: string; sku: string },
): Promise<string> {
  const scope = {
    variantId: input.variantId,
    purchaseType: "ONE_TIME" as const,
    intervalWeeks: null,
  };
  const existing = await db.stripePrice.findFirst({
    where: { ...scope, unitAmountCents: input.unitAmountCents, active: true },
  });
  if (existing) return existing.stripePriceId;

  const anyForVariant = await db.stripePrice.findFirst({
    where: { variantId: input.variantId },
    select: { stripeProductId: true },
  });
  const productId =
    anyForVariant?.stripeProductId ??
    (await gateway.createProduct({
      name: input.name,
      variantId: input.variantId,
      sku: input.sku,
      idempotencyKey: `product:${input.variantId}`,
    }));
  const priceId = await gateway.createPrice({
    productId,
    unitAmountCents: input.unitAmountCents,
    variantId: input.variantId,
    idempotencyKey: `price:${input.variantId}:ONE_TIME::${input.unitAmountCents}`,
  });

  await db.stripePrice.updateMany({ where: { ...scope, active: true }, data: { active: false } });
  await db.stripePrice.upsert({
    where: { stripePriceId: priceId },
    create: {
      ...scope,
      unitAmountCents: input.unitAmountCents,
      stripeProductId: productId,
      stripePriceId: priceId,
    },
    update: { active: true },
  });
  return priceId;
}

/** Lazily creates the Stripe Customer for a signed-in user (docs/11 §2). */
async function ensureCustomer(db: DbClient, gateway: CheckoutGateway, userId: string) {
  const user = await db.user.findUniqueOrThrow({
    where: { id: userId },
    select: { email: true, stripeCustomerId: true },
  });
  if (user.stripeCustomerId) return user.stripeCustomerId;
  const customerId = await gateway.createCustomer({
    email: user.email,
    userId,
    idempotencyKey: `customer:${userId}`,
  });
  await db.user.update({ where: { id: userId }, data: { stripeCustomerId: customerId } });
  return customerId;
}

/**
 * Marks the session's order paid. Shared by the webhook and the return page (docs/11 §5.3): both
 * pass Stripe-verified facts, and `markOrderPaid` makes the second caller a no-op.
 */
export async function markPaidFromSession(
  db: DbClient,
  facts: CheckoutSessionFacts,
  source: "webhook" | "return_page",
): Promise<MarkPaidResult | null> {
  if (facts.status !== "complete" || facts.paymentStatus !== "paid" || !facts.orderId) return null;
  if (!facts.email) throw new Error(`Session ${facts.id} completed without an email`);
  return markOrderPaid(db, facts.orderId, {
    paidAt: new Date(),
    email: facts.email,
    taxCents: facts.amountTaxCents,
    amountTotalCents: facts.amountTotalCents ?? undefined,
    shippingAddress: (facts.shippingAddress ?? undefined) as Prisma.InputJsonValue | undefined,
    billingAddress: (facts.billingAddress ?? undefined) as Prisma.InputJsonValue | undefined,
    shippingMethod: "standard",
    stripeCheckoutSessionId: facts.id,
    stripePaymentIntentId: facts.paymentIntentId ?? undefined,
    source,
  });
}
