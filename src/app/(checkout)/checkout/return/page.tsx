import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { Button } from "@/components/ui/button";
import { stripeGateway } from "@/features/checkout/server/gateway";
import { markPaidFromSession } from "@/features/checkout/server/service";
import { db } from "@/lib/server/db";
import { logger } from "@/lib/server/logger";
import { getStripe } from "@/lib/server/stripe";

/** Session-dependent: a blocking dynamic route. */
export const instant = false;

export const metadata: Metadata = { title: "Order confirmed" };

/**
 * Checkout return (docs/11 §5.3, docs/04 C7). The redirect is UX, not state: the page verifies the
 * session with Stripe and converges through the same idempotent path as the webhook, so it never
 * waits for (or races) webhook delivery.
 */
export default async function CheckoutReturnPage({
  searchParams,
}: {
  searchParams: Promise<{ session_id?: string }>;
}) {
  const { session_id: sessionId } = await searchParams;
  if (!sessionId || !/^cs_[A-Za-z0-9_]+$/.test(sessionId)) redirect("/cart");

  const facts = await stripeGateway(getStripe()).retrieveSession(sessionId);
  if (facts.status === "open") redirect("/checkout");
  if (facts.status === "expired") redirect("/cart");

  let orderNumber: string | null = null;
  try {
    orderNumber = (await markPaidFromSession(db, facts, "return_page"))?.orderNumber ?? null;
  } catch (error) {
    // The webhook will converge; the customer still sees a confirmation.
    logger.error({ err: error, sessionId }, "return page could not confirm the order");
  }
  const pending = facts.paymentStatus !== "paid";

  return (
    <div className="flex w-full max-w-2xl flex-col items-start gap-6">
      <p className="text-overline font-semibold text-muted-foreground uppercase">
        {pending ? "Payment processing" : "Thank you"}
      </p>
      <h1 className="font-display text-display-lg font-light">
        {pending ? "We're confirming your payment." : "Your order is confirmed."}
      </h1>
      <p className="max-w-prose text-body-lg text-muted-foreground">
        {orderNumber ? (
          <>
            Order <strong className="text-foreground">{orderNumber}</strong>.{" "}
          </>
        ) : null}
        A confirmation email is on its way. We&apos;ll let you know when it ships.
      </p>
      <Button asChild>
        <Link href="/">Continue shopping</Link>
      </Button>
    </div>
  );
}
