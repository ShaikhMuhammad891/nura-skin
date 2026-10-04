/** Checkout orchestration + Stripe webhook convergence against the real DB (docs/11 §3, §5). */
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { addItem, ensureCart } from "../../src/features/cart/server/service";
import type {
  CheckoutGateway,
  CheckoutSessionFacts,
  CreateSessionInput,
} from "../../src/features/checkout/server/gateway";
import { markPaidFromSession, startCheckout } from "../../src/features/checkout/server/service";
import { processStripeEvent } from "../../src/features/checkout/server/webhook";
import type { PrismaClient } from "../../src/generated/prisma/client";
import type { Stripe } from "../../src/lib/server/stripe";

import { createTestVariant, uid } from "./factories";
import { createTestPrisma } from "./helpers";

let prisma: PrismaClient;
beforeAll(() => {
  prisma = createTestPrisma();
});
afterAll(async () => {
  await prisma.$disconnect();
});

const SITE = "http://localhost:3000";
const guest = { userId: null, email: null };

/** In-memory Stripe: records calls, honours idempotency keys like Stripe does. */
function fakeGateway(options: { failSession?: boolean } = {}) {
  const byKey = new Map<string, string>();
  const sessions = new Map<string, CheckoutSessionFacts & { input: CreateSessionInput }>();
  const calls = { products: 0, prices: 0, coupons: [] as number[], sessions: 0, customers: 0 };
  const idem = (key: string, prefix: string, count: () => void) => {
    let id = byKey.get(key);
    if (!id) {
      id = `${prefix}_${uid()}`;
      byKey.set(key, id);
      count();
    }
    return id;
  };

  const gateway: CheckoutGateway = {
    async createProduct({ idempotencyKey }) {
      return idem(idempotencyKey, "prod", () => calls.products++);
    },
    async createPrice({ idempotencyKey }) {
      return idem(idempotencyKey, "price", () => calls.prices++);
    },
    async createCustomer({ idempotencyKey }) {
      return idem(idempotencyKey, "cus", () => calls.customers++);
    },
    async createCoupon({ idempotencyKey, amountOffCents }) {
      return idem(idempotencyKey, "coupon", () => calls.coupons.push(amountOffCents));
    },
    async createSession(input) {
      if (options.failSession) throw new Error("Stripe is down");
      const id = idem(input.idempotencyKey, "cs_test", () => calls.sessions++);
      if (!sessions.has(id)) {
        sessions.set(id, {
          id,
          input,
          status: "open",
          paymentStatus: "unpaid",
          clientSecret: `${id}_secret`,
          orderId: input.orderId,
          amountTotalCents: null,
          amountTaxCents: 0,
          email: null,
          shippingAddress: null,
          billingAddress: null,
          paymentIntentId: null,
        });
      }
      return { id, clientSecret: `${id}_secret` };
    },
    async retrieveSession(id) {
      const session = sessions.get(id);
      if (!session) throw new Error(`No such session ${id}`);
      return session;
    },
  };

  /** Simulates the customer paying: returns the session as Stripe would report it. */
  function pay(sessionId: string, amountTotalCents: number, paymentStatus = "paid") {
    const session = sessions.get(sessionId)!;
    Object.assign(session, {
      status: "complete",
      paymentStatus,
      amountTotalCents,
      email: "buyer@example.test",
      paymentIntentId: `pi_${uid()}`,
      shippingAddress: { name: "Maya Chen", line1: "1 Main St", country: "US" },
    });
    return session;
  }
  return { gateway, calls, sessions, pay };
}

async function cartWith(onHand = 10, quantity = 2, priceCents = 3000) {
  const { variant } = await createTestVariant(prisma, { onHand, priceCents });
  const cart = await ensureCart(prisma, { guestCartId: null });
  await addItem(prisma, cart.id, { variantId: variant.id, quantity, purchaseType: "ONE_TIME" });
  return { cart, variant };
}

const stockOf = (variantId: string) =>
  prisma.inventoryItem.findUniqueOrThrow({ where: { variantId } });

/** A Stripe event carrying a checkout session (only the fields our handlers read). */
function sessionEvent(type: string, facts: CheckoutSessionFacts, paymentStatus?: string) {
  return {
    id: `evt_${uid()}`,
    type,
    data: {
      object: {
        id: facts.id,
        object: "checkout.session",
        status: facts.status,
        payment_status: paymentStatus ?? facts.paymentStatus,
        client_secret: facts.clientSecret,
        metadata: { orderId: facts.orderId },
        amount_total: facts.amountTotalCents,
        total_details: { amount_tax: 0 },
        customer_details: { email: facts.email, name: "Maya Chen", address: null },
        customer_email: null,
        collected_information: null,
        payment_intent: facts.paymentIntentId,
      },
    },
  } as unknown as Stripe.Event;
}

describe("startCheckout", () => {
  it("reserves stock, prices lines in Stripe and opens one embedded session", async () => {
    const { cart, variant } = await cartWith(10, 2, 3000);
    const fake = fakeGateway();

    const result = await startCheckout(prisma, fake.gateway, {
      cartId: cart.id,
      customer: guest,
      siteUrl: SITE,
    });

    expect(result.clientSecret).toMatch(/_secret$/);
    const order = await prisma.order.findUniqueOrThrow({ where: { id: result.orderId } });
    expect(order).toMatchObject({ status: "PENDING_PAYMENT", subtotalCents: 6000 });
    expect(order.stripeCheckoutSessionId).toMatch(/^cs_test_/);
    expect((await stockOf(variant.id)).reserved).toBe(2);

    const session = fake.sessions.get(order.stripeCheckoutSessionId!)!;
    expect(session.input.lineItems).toEqual([{ priceId: expect.any(String), quantity: 2 }]);
    expect(session.input.returnUrl).toBe(
      `${SITE}/checkout/return?session_id={CHECKOUT_SESSION_ID}`,
    );
    expect(session.input.shippingCents).toBe(order.shippingCents);
    const price = await prisma.stripePrice.findFirstOrThrow({ where: { variantId: variant.id } });
    expect(price).toMatchObject({ unitAmountCents: 3000, purchaseType: "ONE_TIME", active: true });
  });

  it("reuses the pending order and its open session for an unchanged cart", async () => {
    const { cart, variant } = await cartWith();
    const fake = fakeGateway();
    const input = { cartId: cart.id, customer: guest, siteUrl: SITE };

    const first = await startCheckout(prisma, fake.gateway, input);
    const second = await startCheckout(prisma, fake.gateway, input);

    expect(second).toEqual(first);
    expect(fake.calls.sessions).toBe(1);
    expect((await stockOf(variant.id)).reserved).toBe(2); // not double-reserved
  });

  it("creates Stripe products/prices once per variant and amount", async () => {
    const { variant } = await createTestVariant(prisma, { onHand: 20, priceCents: 2500 });
    const fake = fakeGateway();
    for (let i = 0; i < 2; i++) {
      const cart = await ensureCart(prisma, { guestCartId: null });
      await addItem(prisma, cart.id, {
        variantId: variant.id,
        quantity: 1,
        purchaseType: "ONE_TIME",
      });
      await startCheckout(prisma, fake.gateway, {
        cartId: cart.id,
        customer: guest,
        siteUrl: SITE,
      });
    }
    expect(fake.calls.products).toBe(1);
    expect(fake.calls.prices).toBe(1);
  });

  it("retires the old price row when the catalogue price changes", async () => {
    const { cart, variant } = await cartWith(10, 1, 3000);
    const fake = fakeGateway();
    await startCheckout(prisma, fake.gateway, { cartId: cart.id, customer: guest, siteUrl: SITE });

    await prisma.productVariant.update({ where: { id: variant.id }, data: { priceCents: 3200 } });
    const cart2 = await ensureCart(prisma, { guestCartId: null });
    await addItem(prisma, cart2.id, {
      variantId: variant.id,
      quantity: 1,
      purchaseType: "ONE_TIME",
    });
    await startCheckout(prisma, fake.gateway, { cartId: cart2.id, customer: guest, siteUrl: SITE });

    const rows = await prisma.stripePrice.findMany({
      where: { variantId: variant.id },
      orderBy: { createdAt: "asc" },
    });
    expect(rows.map((r) => [r.unitAmountCents, r.active])).toEqual([
      [3000, false],
      [3200, true],
    ]);
    expect(new Set(rows.map((r) => r.stripeProductId)).size).toBe(1);
  });

  it("compensates when Stripe fails: order canceled, stock released, PAYMENT_PROVIDER", async () => {
    const { cart, variant } = await cartWith(10, 3);
    const fake = fakeGateway({ failSession: true });

    await expect(
      startCheckout(prisma, fake.gateway, { cartId: cart.id, customer: guest, siteUrl: SITE }),
    ).rejects.toMatchObject({ code: "PAYMENT_PROVIDER" });

    const order = await prisma.order.findFirstOrThrow({
      where: { cartId: cart.id },
      orderBy: { createdAt: "desc" },
    });
    expect(order.status).toBe("CANCELED");
    expect((await stockOf(variant.id)).reserved).toBe(0);
  });

  it("rejects Routine Plan lines until subscription checkout ships", async () => {
    const { variant } = await createTestVariant(prisma, { onHand: 10 });
    const cart = await ensureCart(prisma, { guestCartId: null });
    await addItem(prisma, cart.id, {
      variantId: variant.id,
      quantity: 1,
      purchaseType: "SUBSCRIPTION",
    });
    await expect(
      startCheckout(prisma, fakeGateway().gateway, {
        cartId: cart.id,
        customer: guest,
        siteUrl: SITE,
      }),
    ).rejects.toMatchObject({ code: "CONFLICT" });
  });

  it("creates the Stripe customer once for signed-in shoppers", async () => {
    const role = await prisma.role.findUniqueOrThrow({ where: { key: "CUSTOMER" } });
    const user = await prisma.user.create({
      data: { clerkId: `user_${uid()}`, email: `c-${uid()}@example.test`, roleId: role.id },
    });
    const { variant } = await createTestVariant(prisma, { onHand: 10 });
    const fake = fakeGateway();
    const cart = await ensureCart(prisma, { userId: user.id });
    await addItem(prisma, cart.id, {
      variantId: variant.id,
      quantity: 1,
      purchaseType: "ONE_TIME",
    });

    await startCheckout(prisma, fake.gateway, {
      cartId: cart.id,
      customer: { userId: user.id, email: user.email },
      siteUrl: SITE,
    });
    const saved = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(saved.stripeCustomerId).toMatch(/^cus_/);
    const session = [...fake.sessions.values()][0]!;
    expect(session.input.customerId).toBe(saved.stripeCustomerId);
    expect(fake.calls.customers).toBe(1);
  });
});

describe("Stripe webhook + return page convergence (docs/11 §5.3)", () => {
  async function openCheckout() {
    const { cart, variant } = await cartWith(10, 2, 3000);
    const fake = fakeGateway();
    const { orderId } = await startCheckout(prisma, fake.gateway, {
      cartId: cart.id,
      customer: guest,
      siteUrl: SITE,
    });
    const order = await prisma.order.findUniqueOrThrow({ where: { id: orderId } });
    return { fake, order, variant, cart };
  }

  it("marks the order paid once, commits stock, and treats redeliveries as duplicates", async () => {
    const { fake, order, variant } = await openCheckout();
    const paid = fake.pay(order.stripeCheckoutSessionId!, order.totalCents);
    const event = sessionEvent("checkout.session.completed", paid);

    expect(await processStripeEvent(prisma, event)).toBe("processed");
    expect(await processStripeEvent(prisma, event)).toBe("duplicate");

    const after = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(after).toMatchObject({
      status: "PAID",
      paymentStatus: "SUCCEEDED",
      email: "buyer@example.test",
      needsAttention: false,
    });
    expect(after.number).not.toBeNull();
    const stock = await stockOf(variant.id);
    expect(stock).toMatchObject({ onHand: 8, reserved: 0 });

    // The return page arriving later is a no-op.
    const fromReturn = await markPaidFromSession(prisma, paid, "return_page");
    expect(fromReturn?.alreadyPaid).toBe(true);
  });

  it("the return page can win the race; the webhook then converges", async () => {
    const { fake, order } = await openCheckout();
    const paid = fake.pay(order.stripeCheckoutSessionId!, order.totalCents);

    const first = await markPaidFromSession(prisma, paid, "return_page");
    expect(first?.alreadyPaid).toBe(false);
    expect(await processStripeEvent(prisma, sessionEvent("checkout.session.completed", paid))).toBe(
      "processed",
    );
    expect(await prisma.payment.count({ where: { orderId: order.id } })).toBe(1);
  });

  it("flags an amount mismatch for staff instead of failing the paid order", async () => {
    const { fake, order } = await openCheckout();
    const paid = fake.pay(order.stripeCheckoutSessionId!, order.totalCents + 100);
    await processStripeEvent(prisma, sessionEvent("checkout.session.completed", paid));
    const after = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(after).toMatchObject({ status: "PAID", needsAttention: true });
    expect(after.attentionReason).toContain("amount_mismatch");
  });

  it("waits for async payments: unpaid completion is a no-op until async_payment_succeeded", async () => {
    const { fake, order } = await openCheckout();
    const pending = fake.pay(order.stripeCheckoutSessionId!, order.totalCents, "unpaid");
    await processStripeEvent(prisma, sessionEvent("checkout.session.completed", pending));
    expect((await prisma.order.findUniqueOrThrow({ where: { id: order.id } })).paidAt).toBeNull();

    await processStripeEvent(
      prisma,
      sessionEvent("checkout.session.async_payment_succeeded", pending, "paid"),
    );
    expect((await prisma.order.findUniqueOrThrow({ where: { id: order.id } })).status).toBe("PAID");
  });

  it("expires the order and releases stock on checkout.session.expired", async () => {
    const { fake, order, variant } = await openCheckout();
    const session = await fake.gateway.retrieveSession(order.stripeCheckoutSessionId!);
    await processStripeEvent(
      prisma,
      sessionEvent("checkout.session.expired", { ...session, status: "expired" }),
    );
    expect((await prisma.order.findUniqueOrThrow({ where: { id: order.id } })).status).toBe(
      "EXPIRED",
    );
    expect((await stockOf(variant.id)).reserved).toBe(0);
  });

  it("never opens a second session for an order that was already paid", async () => {
    const { fake, order, cart } = await openCheckout();
    fake.pay(order.stripeCheckoutSessionId!, order.totalCents); // paid, webhook not yet delivered

    await expect(
      startCheckout(prisma, fake.gateway, { cartId: cart.id, customer: guest, siteUrl: SITE }),
    ).rejects.toMatchObject({ code: "CONFLICT" });
    expect(fake.calls.sessions).toBe(1);
    expect((await prisma.order.findUniqueOrThrow({ where: { id: order.id } })).status).toBe("PAID");
  });

  it("records unrelated event types as ignored", async () => {
    const event = { id: `evt_${uid()}`, type: "customer.created", data: { object: {} } };
    expect(await processStripeEvent(prisma, event as unknown as Stripe.Event)).toBe("ignored");
  });
});
