import "server-only";

import type { Stripe } from "@/lib/server/stripe";

/**
 * The slice of Stripe that checkout needs (docs/11 §3), behind an interface so the checkout and
 * webhook services are testable against the real DB with a fake gateway (no network). The real
 * adapter below is a thin mapping; every mutating call carries an idempotency key.
 */
export type SessionStatus = "open" | "complete" | "expired";

export type CheckoutSessionFacts = {
  id: string;
  status: SessionStatus;
  /** `paid` once money moved; async methods complete later (`async_payment_succeeded`). */
  paymentStatus: "paid" | "unpaid" | "no_payment_required" | (string & {});
  clientSecret: string | null;
  orderId: string | null;
  amountTotalCents: number | null;
  amountTaxCents: number;
  email: string | null;
  shippingAddress: Record<string, unknown> | null;
  billingAddress: Record<string, unknown> | null;
  paymentIntentId: string | null;
};

export type CheckoutLineItem = { priceId: string; quantity: number };

export type CreateSessionInput = {
  orderId: string;
  cartId: string;
  userId: string | null;
  customerId: string | null;
  lineItems: CheckoutLineItem[];
  couponId: string | null;
  shippingCents: number;
  expiresAt: Date;
  returnUrl: string;
  idempotencyKey: string;
};

export interface CheckoutGateway {
  createProduct(input: {
    name: string;
    variantId: string;
    sku: string;
    idempotencyKey: string;
  }): Promise<string>;
  createPrice(input: {
    productId: string;
    unitAmountCents: number;
    variantId: string;
    idempotencyKey: string;
  }): Promise<string>;
  createCustomer(input: { email: string; userId: string; idempotencyKey: string }): Promise<string>;
  createCoupon(input: {
    amountOffCents: number;
    orderId: string;
    redeemBy: Date;
    idempotencyKey: string;
  }): Promise<string>;
  createSession(input: CreateSessionInput): Promise<{ id: string; clientSecret: string }>;
  retrieveSession(id: string): Promise<CheckoutSessionFacts>;
}

export function sessionFacts(session: Stripe.Checkout.Session): CheckoutSessionFacts {
  const shipping = session.collected_information?.shipping_details ?? null;
  const details = session.customer_details;
  const paymentIntent = session.payment_intent;
  return {
    id: session.id,
    status: (session.status ?? "open") as SessionStatus,
    paymentStatus: session.payment_status,
    clientSecret: session.client_secret,
    orderId: session.metadata?.orderId ?? null,
    amountTotalCents: session.amount_total,
    amountTaxCents: session.total_details?.amount_tax ?? 0,
    email: details?.email ?? session.customer_email ?? null,
    shippingAddress: shipping ? { name: shipping.name, ...shipping.address } : null,
    billingAddress: details?.address ? { name: details.name, ...details.address } : null,
    paymentIntentId:
      typeof paymentIntent === "string" ? paymentIntent : (paymentIntent?.id ?? null),
  };
}

export function stripeGateway(stripe: Stripe): CheckoutGateway {
  return {
    async createProduct({ name, variantId, sku, idempotencyKey }) {
      const product = await stripe.products.create(
        { name, metadata: { variantId, sku } },
        { idempotencyKey },
      );
      return product.id;
    },
    async createPrice({ productId, unitAmountCents, variantId, idempotencyKey }) {
      const price = await stripe.prices.create(
        {
          product: productId,
          currency: "usd",
          unit_amount: unitAmountCents,
          metadata: { variantId, purchaseType: "ONE_TIME" },
        },
        { idempotencyKey },
      );
      return price.id;
    },
    async createCustomer({ email, userId, idempotencyKey }) {
      const customer = await stripe.customers.create(
        { email, metadata: { userId } },
        { idempotencyKey },
      );
      return customer.id;
    },
    async createCoupon({ amountOffCents, orderId, redeemBy, idempotencyKey }) {
      const coupon = await stripe.coupons.create(
        {
          amount_off: amountOffCents,
          currency: "usd",
          duration: "once",
          max_redemptions: 1,
          redeem_by: Math.floor(redeemBy.getTime() / 1000),
          name: "Your Nura savings",
          metadata: { orderId, ephemeral: "true" },
        },
        { idempotencyKey },
      );
      return coupon.id;
    },
    async createSession(input) {
      const session = await stripe.checkout.sessions.create(
        {
          ui_mode: "embedded_page",
          mode: "payment",
          line_items: input.lineItems.map((l) => ({ price: l.priceId, quantity: l.quantity })),
          ...(input.customerId
            ? { customer: input.customerId }
            : { customer_creation: "if_required" as const }),
          ...(input.couponId ? { discounts: [{ coupon: input.couponId }] } : {}),
          shipping_address_collection: { allowed_countries: ["US"] },
          shipping_options: [
            {
              shipping_rate_data: {
                type: "fixed_amount",
                display_name:
                  input.shippingCents === 0 ? "Free shipping" : "Standard (3–5 business days)",
                fixed_amount: { amount: input.shippingCents, currency: "usd" },
              },
            },
          ],
          payment_intent_data: { metadata: { orderId: input.orderId } },
          metadata: {
            orderId: input.orderId,
            cartId: input.cartId,
            ...(input.userId ? { userId: input.userId } : {}),
          },
          expires_at: Math.floor(input.expiresAt.getTime() / 1000),
          return_url: input.returnUrl,
          allow_promotion_codes: false,
        },
        { idempotencyKey: input.idempotencyKey },
      );
      if (!session.client_secret) throw new Error("Stripe returned no client_secret");
      return { id: session.id, clientSecret: session.client_secret };
    },
    async retrieveSession(id) {
      return sessionFacts(await stripe.checkout.sessions.retrieve(id));
    },
  };
}
