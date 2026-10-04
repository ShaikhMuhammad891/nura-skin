import "server-only";

import { expirePendingOrder } from "@/features/orders/server/service";
import type { Prisma } from "@/generated/prisma/client";
import type { DbClient } from "@/lib/server/db-types";
import type { Stripe } from "@/lib/server/stripe";

import { sessionFacts } from "./gateway";
import { markPaidFromSession } from "./service";

/**
 * Stripe webhook processing (docs/11 §5, ADR-0003). Deduplicated by `WebhookEvent.id = event.id`;
 * handlers are convergent because Stripe retries and doesn't guarantee order.
 * Subscription and refund events join the registry in M7/M8.
 */
export type StripeProcessResult = "processed" | "duplicate" | "ignored";

export async function processStripeEvent(
  db: DbClient,
  event: Stripe.Event,
): Promise<StripeProcessResult> {
  const existing = await db.webhookEvent.findUnique({ where: { id: event.id } });
  if (existing?.status === "processed" || existing?.status === "ignored") return "duplicate";
  if (!existing) {
    await db.webhookEvent.create({
      data: {
        id: event.id,
        provider: "stripe",
        type: event.type,
        payload: event.data.object as unknown as Prisma.InputJsonValue,
      },
    });
  }

  try {
    const handled = await dispatch(db, event);
    const status = handled ? "processed" : "ignored";
    await db.webhookEvent.update({
      where: { id: event.id },
      data: { status, attempts: { increment: 1 }, processedAt: new Date(), error: null },
    });
    return status;
  } catch (error) {
    await db.webhookEvent.update({
      where: { id: event.id },
      data: {
        status: "failed",
        attempts: { increment: 1 },
        error: error instanceof Error ? error.message : String(error),
      },
    });
    throw error;
  }
}

async function dispatch(db: DbClient, event: Stripe.Event): Promise<boolean> {
  switch (event.type) {
    case "checkout.session.completed":
    case "checkout.session.async_payment_succeeded":
      // Async methods complete with payment_status "unpaid"; the later event carries "paid".
      await markPaidFromSession(db, sessionFacts(event.data.object), "webhook");
      return true;
    case "checkout.session.expired": {
      const orderId = event.data.object.metadata?.orderId;
      if (orderId) await expirePendingOrder(db, orderId);
      return true;
    }
    default:
      return false;
  }
}
