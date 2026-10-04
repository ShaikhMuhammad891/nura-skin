import type { Metadata } from "next";
import Link from "next/link";

import { Container, Section } from "@/components/layout/container";
import { Button } from "@/components/ui/button";
import { readGuestCartId } from "@/features/cart/server/cart-cookie";
import { addSampleItemForm, removeCartItemForm } from "@/features/cart/server/form-actions";
import { findActiveCart, getCartView } from "@/features/cart/server/service";
import { formatMoney } from "@/features/pricing/money";
import { env } from "@/lib/env";
import { getActor } from "@/lib/server/actor";
import { db } from "@/lib/server/db";

/** Per-visitor cart: a blocking dynamic route (cookies / session). */
export const instant = false;

export const metadata: Metadata = { title: "Your cart" };

/**
 * Interim cart page (docs/15 P9). Server-rendered and form-driven so checkout can be exercised now;
 * the designed cart drawer, quantity steppers and Routine Plan controls arrive with the M4 UI.
 */
export default async function CartPage() {
  const actor = await getActor();
  const owner = actor.userId ? { userId: actor.userId } : { guestCartId: await readGuestCartId() };
  const cart = await findActiveCart(db, owner);
  const view = cart ? await getCartView(db, cart.id, { userId: actor.userId, email: null }) : null;
  const lines = view?.lines ?? [];
  const quoteLines = new Map(view?.quote.lines.map((l) => [l.id, l]));

  return (
    <Section>
      <Container className="flex max-w-3xl flex-col gap-8">
        <h1 className="font-display text-display-lg font-light">Your cart</h1>

        {lines.length === 0 ? (
          <p className="text-body-lg text-muted-foreground">Your cart is empty.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-border border-y border-border">
            {lines.map((line) => (
              <li key={line.id} className="flex items-center justify-between gap-4 py-4">
                <div>
                  <p className="font-medium">{line.product.name}</p>
                  <p className="text-body-sm text-muted-foreground">
                    {line.variantName} · Qty {line.quantity}
                    {line.purchaseType === "SUBSCRIPTION" ? " · Routine Plan" : ""}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="tabular">
                    {formatMoney(quoteLines.get(line.id)?.totalCents ?? 0)}
                  </span>
                  <form action={removeCartItemForm}>
                    <input type="hidden" name="itemId" value={line.id} />
                    <Button type="submit" variant="ghost" size="sm">
                      Remove
                    </Button>
                  </form>
                </div>
              </li>
            ))}
          </ul>
        )}

        {view && lines.length > 0 && (
          <dl className="grid grid-cols-[1fr_auto] gap-x-6 gap-y-2 text-body">
            <dt className="text-muted-foreground">Subtotal</dt>
            <dd className="tabular text-right">{formatMoney(view.quote.subtotalCents)}</dd>
            {view.quote.discountCents > 0 && (
              <>
                <dt className="text-muted-foreground">Savings</dt>
                <dd className="tabular text-right">−{formatMoney(view.quote.discountCents)}</dd>
              </>
            )}
            <dt className="text-muted-foreground">Shipping</dt>
            <dd className="tabular text-right">
              {view.quote.shippingCents === 0 ? "Free" : formatMoney(view.quote.shippingCents)}
            </dd>
            <dt className="text-muted-foreground">Tax</dt>
            <dd className="text-right text-muted-foreground">Calculated at checkout</dd>
            <dt className="font-semibold">Total</dt>
            <dd className="tabular text-right font-semibold">
              {formatMoney(view.quote.totalCents)}
            </dd>
          </dl>
        )}

        <div className="flex flex-wrap gap-3">
          {lines.length > 0 && (
            <Button asChild>
              <Link href="/checkout">Checkout</Link>
            </Button>
          )}
          {env.NEXT_PUBLIC_APP_ENV === "local" && (
            <form action={addSampleItemForm}>
              <Button type="submit" variant="secondary">
                Add a sample product (dev)
              </Button>
            </form>
          )}
        </div>
      </Container>
    </Section>
  );
}
