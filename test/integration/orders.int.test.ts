/**
 * Checkout core without the payment provider (docs/11 §3, §5.2): pending orders, idempotent
 * payment, expiry and compensation, all against the real database.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { addItem, applyCoupon, ensureCart } from "../../src/features/cart/server/service";
import {
  cancelPendingOrder,
  createPendingOrder,
  expirePendingOrder,
  markOrderPaid,
  type PaymentFacts,
} from "../../src/features/orders/server/service";
import type { PrismaClient } from "../../src/generated/prisma/client";

import { createTestVariant, uid } from "./factories";
import { createTestPrisma } from "./helpers";

let prisma: PrismaClient;
const guest = (email = `guest-${uid()}@example.test`) => ({ userId: null, email });
const facts = (patch: Partial<PaymentFacts> = {}): PaymentFacts => ({
  paidAt: new Date(),
  email: `buyer-${uid()}@example.test`,
  taxCents: 0,
  source: "webhook",
  stripePaymentIntentId: `pi_${uid()}`,
  ...patch,
});
const stockOf = (variantId: string) =>
  prisma.inventoryItem.findUniqueOrThrow({
    where: { variantId },
    select: { onHand: true, reserved: true },
  });

async function cartWith(onHand: number, quantity: number, priceCents = 3000) {
  const { variant } = await createTestVariant(prisma, { onHand, priceCents });
  const cart = await ensureCart(prisma, { guestCartId: null });
  await addItem(prisma, cart.id, { variantId: variant.id, quantity, purchaseType: "ONE_TIME" });
  return { cart, variant };
}

beforeAll(() => {
  prisma = createTestPrisma();
});
afterAll(async () => {
  await prisma.$disconnect();
});

describe("createPendingOrder", () => {
  it("snapshots prices, reserves stock and has no number yet (review R-12)", async () => {
    const { cart, variant } = await cartWith(10, 2);
    const { order, reused } = await createPendingOrder(prisma, {
      cartId: cart.id,
      customer: guest(),
    });
    expect(reused).toBe(false);
    expect(order).toMatchObject({
      status: "PENDING_PAYMENT",
      number: null,
      subtotalCents: 6000,
      shippingCents: 0,
      totalCents: 6000,
    });
    const items = await prisma.orderItem.findMany({ where: { orderId: order.id } });
    expect(items).toEqual([
      expect.objectContaining({
        sku: variant.sku,
        quantity: 2,
        unitPriceCents: 3000,
        totalCents: 6000,
      }),
    ]);
    expect(await stockOf(variant.id)).toEqual({ onHand: 10, reserved: 2 });
  });

  it("reuses the pending order when the cart hasn't changed, and not when it has", async () => {
    const { cart, variant } = await cartWith(10, 1);
    const first = await createPendingOrder(prisma, { cartId: cart.id, customer: guest() });
    const again = await createPendingOrder(prisma, { cartId: cart.id, customer: guest() });
    expect(again).toMatchObject({ reused: true, order: { id: first.order.id } });
    expect(await stockOf(variant.id)).toEqual({ onHand: 10, reserved: 1 }); // not reserved twice

    await addItem(prisma, cart.id, {
      variantId: variant.id,
      quantity: 1,
      purchaseType: "ONE_TIME",
    });
    const changed = await createPendingOrder(prisma, { cartId: cart.id, customer: guest() });
    expect(changed.reused).toBe(false);
  });

  it("expands bundles into component lines and reserves each component", async () => {
    const bundle = await prisma.productVariant.findUniqueOrThrow({
      where: { sku: "NURA-RTN-DUO" },
    });
    const cart = await ensureCart(prisma, { guestCartId: null });
    await addItem(prisma, cart.id, { variantId: bundle.id, quantity: 1, purchaseType: "ONE_TIME" });
    const { order } = await createPendingOrder(prisma, { cartId: cart.id, customer: guest() });
    const items = await prisma.orderItem.findMany({
      where: { orderId: order.id },
      orderBy: { sku: "asc" },
    });
    const parent = items.find((i) => i.sku === "NURA-RTN-DUO")!;
    expect(parent.totalCents).toBe(5400);
    const components = items
      .filter((i) => i.bundleParentId === parent.id)
      .map((i) => i.sku)
      .sort();
    expect(components).toEqual(["NURA-CLN-CLOUD-150", "NURA-SPF-VEIL-50"]);
    const reservations = await prisma.inventoryReservation.count({ where: { orderId: order.id } });
    expect(reservations).toBe(2);
  });

  it("refuses an empty cart, and subscriptions for guests (account required)", async () => {
    const empty = await ensureCart(prisma, { guestCartId: null });
    await expect(
      createPendingOrder(prisma, { cartId: empty.id, customer: guest() }),
    ).rejects.toMatchObject({ code: "VALIDATION" });

    const cart = await ensureCart(prisma, { guestCartId: null });
    const dew = await prisma.productVariant.findUniqueOrThrow({
      where: { sku: "NURA-SER-DEW-30" },
    });
    await addItem(prisma, cart.id, {
      variantId: dew.id,
      quantity: 1,
      purchaseType: "SUBSCRIPTION",
    });
    await expect(
      createPendingOrder(prisma, { cartId: cart.id, customer: guest() }),
    ).rejects.toMatchObject({
      code: "CONFLICT",
      details: { code: "ACCOUNT_REQUIRED_FOR_SUBSCRIPTION" },
    });
  });

  it("refuses when stock dropped since the item was added", async () => {
    const { cart, variant } = await cartWith(5, 3);
    await prisma.inventoryItem.update({ where: { variantId: variant.id }, data: { onHand: 2 } });
    await expect(
      createPendingOrder(prisma, { cartId: cart.id, customer: guest() }),
    ).rejects.toMatchObject({
      code: "OUT_OF_STOCK",
    });
  });
});

describe("markOrderPaid", () => {
  it("assigns a number, commits stock, converts the cart and emits order.paid", async () => {
    const { cart, variant } = await cartWith(10, 2);
    const { order } = await createPendingOrder(prisma, { cartId: cart.id, customer: guest() });
    const result = await markOrderPaid(prisma, order.id, facts({ amountTotalCents: 6000 }));
    expect(result).toMatchObject({ alreadyPaid: false, needsAttention: false });
    expect(result.orderNumber).toMatch(/^NURA-\d{6}$/);

    const paid = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(paid).toMatchObject({ status: "PAID", paymentStatus: "SUCCEEDED" });
    expect(await stockOf(variant.id)).toEqual({ onHand: 8, reserved: 0 });
    expect((await prisma.cart.findUniqueOrThrow({ where: { id: cart.id } })).status).toBe(
      "CONVERTED",
    );
    const outbox = await prisma.outboxEvent.findMany({ where: { name: "order.paid" } });
    expect(outbox.some((e) => (e.payload as { orderId: string }).orderId === order.id)).toBe(true);
  });

  it("is idempotent under duplicate delivery, even concurrently (webhook + return page)", async () => {
    const { cart, variant } = await cartWith(10, 1);
    const { order } = await createPendingOrder(prisma, { cartId: cart.id, customer: guest() });
    const payment = facts();
    const [a, b] = await Promise.all([
      markOrderPaid(prisma, order.id, payment),
      markOrderPaid(prisma, order.id, { ...payment, source: "return_page" }),
    ]);
    expect([a.alreadyPaid, b.alreadyPaid].sort()).toEqual([false, true]);
    expect(a.orderNumber).toBe(b.orderNumber);
    expect(await prisma.payment.count({ where: { orderId: order.id } })).toBe(1);
    expect(await stockOf(variant.id)).toEqual({ onHand: 9, reserved: 0 });
  });

  it("adds tax to the total and flags amount mismatches without refusing the payment", async () => {
    const { cart } = await cartWith(10, 1);
    const { order } = await createPendingOrder(prisma, { cartId: cart.id, customer: guest() });
    const result = await markOrderPaid(
      prisma,
      order.id,
      facts({ taxCents: 240, amountTotalCents: 9999 }),
    );
    expect(result).toMatchObject({ needsAttention: true, attentionReasons: ["amount_mismatch"] });
    const paid = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(paid.totalCents).toBe(3000 + 650 + 240);
  });

  it("late payment after expiry: honoured, stock taken if possible, shortfall flagged", async () => {
    const { cart, variant } = await cartWith(1, 1);
    const { order } = await createPendingOrder(prisma, { cartId: cart.id, customer: guest() });
    await expirePendingOrder(prisma, order.id);
    // Someone else buys the last unit in the meantime.
    await prisma.inventoryItem.update({ where: { variantId: variant.id }, data: { onHand: 0 } });
    const result = await markOrderPaid(prisma, order.id, facts());
    expect(result).toMatchObject({
      alreadyPaid: false,
      needsAttention: true,
      attentionReasons: ["stock_shortfall_after_payment"],
    });
  });

  it("records coupon redemptions at payment", async () => {
    const coupon = await prisma.coupon.create({
      data: {
        code: `PAY${uid().toUpperCase()}`,
        type: "PERCENTAGE",
        valueBp: 1000,
        maxRedemptions: 5,
      },
    });
    const { cart } = await cartWith(10, 2);
    await applyCoupon(prisma, cart.id, coupon.code, { userId: null, email: null });
    const { order } = await createPendingOrder(prisma, { cartId: cart.id, customer: guest() });
    expect(order.couponId).toBe(coupon.id);
    await markOrderPaid(prisma, order.id, facts());
    expect(
      (await prisma.coupon.findUniqueOrThrow({ where: { id: coupon.id } })).redemptionCount,
    ).toBe(1);
    expect(await prisma.couponRedemption.count({ where: { couponId: coupon.id } })).toBe(1);
  });
});

describe("expiry & compensation", () => {
  it("expiring releases stock once; paid orders can't be expired", async () => {
    const { cart, variant } = await cartWith(10, 3);
    const { order } = await createPendingOrder(prisma, { cartId: cart.id, customer: guest() });
    expect(await expirePendingOrder(prisma, order.id)).toBe(true);
    expect(await expirePendingOrder(prisma, order.id)).toBe(false);
    expect(await stockOf(variant.id)).toEqual({ onHand: 10, reserved: 0 });

    const other = await cartWith(10, 1);
    const pending = await createPendingOrder(prisma, { cartId: other.cart.id, customer: guest() });
    await markOrderPaid(prisma, pending.order.id, facts());
    expect(await expirePendingOrder(prisma, pending.order.id)).toBe(false);
  });

  it("cancel compensation (payment session creation failed) releases the reservation", async () => {
    const { cart, variant } = await cartWith(10, 2);
    const { order } = await createPendingOrder(prisma, { cartId: cart.id, customer: guest() });
    expect(await cancelPendingOrder(prisma, order.id)).toBe(true);
    expect((await prisma.order.findUniqueOrThrow({ where: { id: order.id } })).status).toBe(
      "CANCELED",
    );
    expect(await stockOf(variant.id)).toEqual({ onHand: 10, reserved: 0 });
  });
});
