"use server";

import { findActiveCart } from "@/features/cart/server/service";
import { readGuestCartId } from "@/features/cart/server/cart-cookie";
import { emptySchema } from "@/features/cart/schemas";
import { AppError } from "@/lib/errors";
import { env } from "@/lib/env";
import { createAction } from "@/lib/server/action";
import { db } from "@/lib/server/db";
import { getStripe } from "@/lib/server/stripe";

import { stripeGateway } from "./gateway";
import { startCheckout } from "./service";

/**
 * Creates (or reuses) the Embedded Checkout session for the caller's cart (docs/09 §7, 11 §3).
 * The client sends nothing but intent: the cart is resolved server-side and priced from the DB.
 * Rate limiting joins with Upstash (M4).
 */
export const createCheckoutSession = createAction({
  name: "checkout.createSession",
  auth: "guest-or-user",
  schema: emptySchema,
  handler: async (_input, { actor }) => {
    const owner = actor.userId
      ? { userId: actor.userId }
      : { guestCartId: await readGuestCartId() };
    const cart = await findActiveCart(db, owner);
    if (!cart) throw new AppError("VALIDATION", "Your cart is empty.");

    const email = actor.userId
      ? ((await db.user.findUnique({ where: { id: actor.userId }, select: { email: true } }))
          ?.email ?? null)
      : null;
    return startCheckout(db, stripeGateway(getStripe()), {
      cartId: cart.id,
      customer: { userId: actor.userId, email },
      siteUrl: env.NEXT_PUBLIC_SITE_URL,
    });
  },
});
