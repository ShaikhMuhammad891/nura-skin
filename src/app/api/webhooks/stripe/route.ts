import { processStripeEvent } from "@/features/checkout/server/webhook";
import { env } from "@/lib/env";
import { db } from "@/lib/server/db";
import { logger } from "@/lib/server/logger";
import { getStripe, type Stripe } from "@/lib/server/stripe";

/**
 * Stripe → app state (docs/11 §5.1, ADR-0003). Public in the proxy; authenticity comes from the
 * signature (300 s tolerance). Non-2xx makes Stripe retry for up to 3 days.
 */
export async function POST(request: Request) {
  const log = logger.child({ route: "webhooks.stripe" });
  const secret = env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    log.error("STRIPE_WEBHOOK_SECRET is not set");
    return new Response("Webhook not configured", { status: 503 });
  }

  let event: Stripe.Event;
  try {
    const signature = request.headers.get("stripe-signature") ?? "";
    event = getStripe().webhooks.constructEvent(await request.text(), signature, secret, 300);
  } catch {
    log.warn("rejected: invalid signature");
    return new Response("Invalid signature", { status: 400 });
  }

  try {
    const result = await processStripeEvent(db, event);
    log.info({ eventId: event.id, type: event.type, result }, "stripe webhook");
    return Response.json({ received: true, result });
  } catch (error) {
    log.error({ err: error, eventId: event.id, type: event.type }, "processing failed");
    return new Response("Processing failed", { status: 500 });
  }
}
