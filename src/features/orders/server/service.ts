import "server-only";

import { createHash } from "node:crypto";

import { getCartView, type CustomerRef } from "@/features/cart/server/service";
import {
  commitForOrder,
  releaseForOrder,
  reserveForOrder,
  type StockLine,
} from "@/features/inventory/server/service";
import type { Order, Prisma } from "@/generated/prisma/client";
import { AppError } from "@/lib/errors";
import { inTransaction, type DbClient, type Tx } from "@/lib/server/db-types";
import { enqueueOutbox } from "@/lib/server/outbox";

import { formatOrderNumber } from "../state-machine";

/**
 * Order lifecycle core (docs/11 §3, §5.2; ADR-0003/0004). Payment-provider agnostic: the Stripe
 * layer (M5) creates the Checkout Session for a pending order and calls `markOrderPaid` from the
 * verified webhook (or the return page). Both paths are idempotent and converge.
 */
export const CHECKOUT_SESSION_TTL_MINUTES = 30;
/** Reservations outlive the Stripe session by 5 minutes (docs/08 §4.3). */
const RESERVATION_BUFFER_MINUTES = 5;

export type CartLineForHash = {
  variantId: string;
  quantity: number;
  purchaseType: string;
  consultationId: string | null;
};

/** Stable fingerprint of what's being bought: identical carts reuse the pending order (docs/04 C7). */
export function cartHash(
  lines: readonly CartLineForHash[],
  couponId: string | null,
  intervalWeeks: number | null,
): string {
  const canonical = [...lines]
    .map((l) => `${l.variantId}|${l.quantity}|${l.purchaseType}|${l.consultationId ?? ""}`)
    .sort()
    .join(";");
  return createHash("sha256")
    .update(`${canonical}#${couponId ?? ""}#${intervalWeeks ?? ""}`)
    .digest("hex");
}

export type CreatePendingOrderInput = {
  cartId: string;
  customer: CustomerRef;
  attribution?: Prisma.InputJsonValue;
  now?: Date;
};

export type PendingOrderResult = { order: Order; reused: boolean };

export async function createPendingOrder(
  db: DbClient,
  input: CreatePendingOrderInput,
): Promise<PendingOrderResult> {
  const now = input.now ?? new Date();
  const view = await getCartView(db, input.cartId, input.customer, now);

  if (!view.lines.length) throw new AppError("VALIDATION", "Your cart is empty.");
  const blocking = view.warnings.filter(
    (w) => w.type === "item_unavailable" || w.type === "stock_reduced",
  );
  if (blocking.length) {
    throw new AppError("OUT_OF_STOCK", "Some items changed. Please review your cart.", {
      details: { warnings: blocking },
    });
  }
  const hasSubscription = view.lines.some((l) => l.purchaseType === "SUBSCRIPTION");
  if (hasSubscription && !input.customer.userId) {
    throw new AppError("CONFLICT", "Create a free account to manage your Routine Plan.", {
      details: { code: "ACCOUNT_REQUIRED_FOR_SUBSCRIPTION" },
    });
  }

  const cart = await db.cart.findUniqueOrThrow({
    where: { id: input.cartId },
    select: { couponId: true },
  });
  const couponId = view.coupon ? cart.couponId : null;
  const hash = cartHash(view.lines, couponId, view.planIntervalWeeks);

  return inTransaction(db, async (tx) => {
    const reusable = await tx.order.findFirst({
      where: {
        cartId: input.cartId,
        cartHash: hash,
        status: "PENDING_PAYMENT",
        createdAt: { gt: new Date(now.getTime() - CHECKOUT_SESSION_TTL_MINUTES * 60_000) },
      },
      orderBy: { createdAt: "desc" },
    });
    if (reusable) return { order: reusable, reused: true };

    const quoteLines = new Map(view.quote.lines.map((l) => [l.id, l]));
    const variants = await tx.productVariant.findMany({
      where: { id: { in: view.lines.map((l) => l.variantId) } },
      select: {
        id: true,
        product: {
          select: {
            type: true,
            bundleItems: {
              select: {
                quantity: true,
                variant: {
                  select: {
                    id: true,
                    sku: true,
                    name: true,
                    product: { select: { id: true, name: true } },
                  },
                },
              },
            },
          },
        },
      },
    });
    const variantInfo = new Map(variants.map((v) => [v.id, v]));

    const order = await tx.order.create({
      data: {
        userId: input.customer.userId,
        email: input.customer.email,
        cartId: input.cartId,
        cartHash: hash,
        couponId,
        currency: "USD",
        subtotalCents: view.quote.subtotalCents,
        discountCents: view.quote.discountCents,
        shippingCents: view.quote.shippingCents,
        taxCents: 0,
        totalCents: view.quote.totalCents,
        attribution: input.attribution,
        isDemo: false,
        placedAt: now,
      },
    });

    const stock: StockLine[] = [];
    for (const line of view.lines) {
      const q = quoteLines.get(line.id)!;
      const parent = await tx.orderItem.create({
        data: {
          orderId: order.id,
          variantId: line.variantId,
          productId: line.product.id,
          productName: line.product.name,
          variantName: line.variantName,
          sku: line.sku,
          imagePublicId: line.product.imagePublicId,
          purchaseType: line.purchaseType,
          intervalWeeks: line.purchaseType === "SUBSCRIPTION" ? view.planIntervalWeeks : null,
          quantity: line.quantity,
          unitPriceCents: q.unitPriceCents,
          discountCents: q.discountCents,
          totalCents: q.totalCents,
          consultationId: line.consultationId,
        },
      });

      const info = variantInfo.get(line.variantId);
      if (info?.product.type === "BUNDLE") {
        // Components are listed for fulfilment and stock; the price lives on the bundle line.
        for (const component of info.product.bundleItems) {
          const quantity = component.quantity * line.quantity;
          await tx.orderItem.create({
            data: {
              orderId: order.id,
              variantId: component.variant.id,
              productId: component.variant.product.id,
              productName: component.variant.product.name,
              variantName: component.variant.name,
              sku: component.variant.sku,
              purchaseType: "ONE_TIME",
              quantity,
              unitPriceCents: 0,
              totalCents: 0,
              bundleParentId: parent.id,
            },
          });
          stock.push({ variantId: component.variant.id, quantity });
        }
      } else {
        stock.push({ variantId: line.variantId, quantity: line.quantity });
      }
    }

    const expiresAt = new Date(
      now.getTime() + (CHECKOUT_SESSION_TTL_MINUTES + RESERVATION_BUFFER_MINUTES) * 60_000,
    );
    await reserveForOrder(tx, order.id, stock, expiresAt);
    await tx.orderStatusEvent.create({
      data: { orderId: order.id, toStatus: "PENDING_PAYMENT", source: "customer" },
    });
    return { order, reused: false };
  });
}

/** Stock lines of an order: non-bundle lines plus bundle components. */
async function stockLinesForOrder(tx: Tx, orderId: string): Promise<StockLine[]> {
  const items = await tx.orderItem.findMany({
    where: { orderId },
    select: {
      variantId: true,
      quantity: true,
      bundleParentId: true,
      bundleComponents: { select: { id: true } },
    },
  });
  return items
    .filter((i) => i.variantId && i.bundleComponents.length === 0)
    .map((i) => ({ variantId: i.variantId!, quantity: i.quantity }));
}

export type PaymentFacts = {
  paidAt: Date;
  email: string;
  taxCents: number;
  /** Amount the provider actually charged (integrity check, docs/11 §3.2). */
  amountTotalCents?: number;
  shippingAddress?: Prisma.InputJsonValue;
  billingAddress?: Prisma.InputJsonValue;
  shippingMethod?: string;
  stripeCheckoutSessionId?: string;
  stripePaymentIntentId?: string;
  stripeInvoiceId?: string;
  method?: string;
  cardBrand?: string;
  cardLast4?: string;
  receiptUrl?: string;
  source: "webhook" | "return_page" | "system";
};

export type MarkPaidResult = {
  alreadyPaid: boolean;
  orderId: string;
  orderNumber: string;
  needsAttention: boolean;
  attentionReasons: string[];
};

/**
 * Marks an order paid (docs/11 §5.2). Idempotent and race-safe: the order row is locked, and a
 * second caller (duplicate webhook, return page) observes `alreadyPaid`. A paid order is never
 * auto-cancelled; problems set `needsAttention` for staff instead.
 */
export async function markOrderPaid(
  db: DbClient,
  orderId: string,
  facts: PaymentFacts,
): Promise<MarkPaidResult> {
  return inTransaction(db, async (tx) => {
    const [locked] = await tx.$queryRaw<
      { id: string }[]
    >`SELECT id FROM orders WHERE id = ${orderId} FOR UPDATE`;
    if (!locked) throw new AppError("NOT_FOUND", "Order not found.");
    const order = await tx.order.findUniqueOrThrow({ where: { id: orderId } });

    if (order.paidAt) {
      return {
        alreadyPaid: true,
        orderId,
        orderNumber: formatOrderNumber(order.number!),
        needsAttention: order.needsAttention,
        attentionReasons: order.attentionReason ? order.attentionReason.split(",") : [],
      };
    }

    const reasons: string[] = [];
    if (order.status === "CANCELED") reasons.push("paid_after_cancel");

    const [seq] = await tx.$queryRaw<{ n: bigint }[]>`SELECT nextval('order_number_seq') AS n`;
    const number = Number(seq!.n);
    const orderNumber = formatOrderNumber(number);
    const totalCents =
      order.subtotalCents - order.discountCents + order.shippingCents + facts.taxCents;
    if (facts.amountTotalCents !== undefined && facts.amountTotalCents !== totalCents)
      reasons.push("amount_mismatch");

    const { shortfalls } = await commitForOrder(
      tx,
      orderId,
      await stockLinesForOrder(tx, orderId),
      orderNumber,
      facts.paidAt,
    );
    if (shortfalls.length) reasons.push("stock_shortfall_after_payment");

    if (order.couponId) {
      const [coupon] = await tx.$queryRaw<
        { max_redemptions: number | null; redemption_count: number; per_customer_limit: number }[]
      >`
        SELECT max_redemptions, redemption_count, per_customer_limit FROM coupons WHERE id = ${order.couponId} FOR UPDATE`;
      if (coupon) {
        const priorByCustomer = await tx.couponRedemption.count({
          where: {
            couponId: order.couponId,
            OR: [{ email: facts.email }, ...(order.userId ? [{ userId: order.userId }] : [])],
          },
        });
        if (priorByCustomer >= coupon.per_customer_limit) reasons.push("coupon_limit_exceeded");
        const atGlobalLimit =
          coupon.max_redemptions !== null && coupon.redemption_count >= coupon.max_redemptions;
        if (atGlobalLimit) reasons.push("coupon_limit_exceeded");
        else
          await tx.coupon.update({
            where: { id: order.couponId },
            data: { redemptionCount: { increment: 1 } },
          });
        await tx.couponRedemption.create({
          data: {
            couponId: order.couponId,
            orderId,
            userId: order.userId,
            email: facts.email,
            discountCents: order.discountCents,
          },
        });
      }
    }

    const attention = [...new Set(reasons)];
    await tx.order.update({
      where: { id: orderId },
      data: {
        number,
        status: "PAID",
        paymentStatus: "SUCCEEDED",
        paidAt: facts.paidAt,
        email: facts.email,
        taxCents: facts.taxCents,
        totalCents,
        shippingAddress: facts.shippingAddress,
        billingAddress: facts.billingAddress,
        shippingMethod: facts.shippingMethod,
        stripeCheckoutSessionId: facts.stripeCheckoutSessionId ?? order.stripeCheckoutSessionId,
        stripePaymentIntentId: facts.stripePaymentIntentId ?? order.stripePaymentIntentId,
        stripeInvoiceId: facts.stripeInvoiceId ?? order.stripeInvoiceId,
        needsAttention: attention.length > 0,
        attentionReason: attention.length ? attention.join(",") : null,
        version: { increment: 1 },
      },
    });
    await tx.payment.create({
      data: {
        orderId,
        stripePaymentIntentId: facts.stripePaymentIntentId,
        stripeInvoiceId: facts.stripeInvoiceId,
        amountCents: facts.amountTotalCents ?? totalCents,
        currency: order.currency,
        status: "SUCCEEDED",
        method: facts.method,
        cardBrand: facts.cardBrand,
        cardLast4: facts.cardLast4,
        receiptUrl: facts.receiptUrl,
      },
    });
    if (order.cartId)
      await tx.cart.update({ where: { id: order.cartId }, data: { status: "CONVERTED" } });
    await tx.orderStatusEvent.create({
      data: {
        orderId,
        fromStatus: order.status,
        toStatus: "PAID",
        source: facts.source === "webhook" ? "webhook" : "system",
      },
    });
    await enqueueOutbox(tx, "order.paid", {
      orderId,
      orderNumber,
      totalCents,
      hasAttention: attention.length > 0,
    });
    if (attention.length)
      await enqueueOutbox(tx, "order.needs_attention", {
        orderId,
        orderNumber,
        reasons: attention,
      });

    return {
      alreadyPaid: false,
      orderId,
      orderNumber,
      needsAttention: attention.length > 0,
      attentionReasons: attention,
    };
  });
}

/** Checkout session expired (docs/11 §5.2): release stock. Idempotent; paid orders are untouched. */
export async function expirePendingOrder(
  db: DbClient,
  orderId: string,
  now = new Date(),
): Promise<boolean> {
  return transitionUnpaid(db, orderId, "EXPIRED", "order.expired", now);
}

/** Compensation when the payment session can't be created (docs/11 §3). */
export async function cancelPendingOrder(
  db: DbClient,
  orderId: string,
  now = new Date(),
): Promise<boolean> {
  return transitionUnpaid(db, orderId, "CANCELED", "order.canceled", now);
}

async function transitionUnpaid(
  db: DbClient,
  orderId: string,
  to: "EXPIRED" | "CANCELED",
  event: "order.expired" | "order.canceled",
  now: Date,
): Promise<boolean> {
  return inTransaction(db, async (tx) => {
    const [row] = await tx.$queryRaw<{ status: string; paid_at: Date | null }[]>`
      SELECT status, paid_at FROM orders WHERE id = ${orderId} FOR UPDATE`;
    if (!row || row.paid_at || row.status !== "PENDING_PAYMENT") return false;
    await releaseForOrder(tx, orderId, now);
    await tx.order.update({
      where: { id: orderId },
      data: { status: to, canceledAt: to === "CANCELED" ? now : null, version: { increment: 1 } },
    });
    await tx.orderStatusEvent.create({
      data: { orderId, fromStatus: "PENDING_PAYMENT", toStatus: to, source: "system" },
    });
    await enqueueOutbox(tx, event, { orderId });
    return true;
  });
}
