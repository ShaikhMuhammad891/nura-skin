"use client";

import { EmbeddedCheckout, EmbeddedCheckoutProvider } from "@stripe/react-stripe-js";
import { loadStripe } from "@stripe/stripe-js";
import Link from "next/link";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

import { createCheckoutSession } from "../server/actions";

// Module scope: Stripe.js loads once per page, not per render.
const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? "");

type State =
  | { kind: "loading" }
  | { kind: "ready"; clientSecret: string }
  | { kind: "error"; message: string };

/**
 * Stripe Embedded Checkout (ADR-0002). The session is created server-side from the cart; the
 * client only mounts Stripe's iframe, so card data never touches our code (SAQ A, docs/11 §1).
 */
export function CheckoutForm() {
  const [state, setState] = useState<State>({ kind: "loading" });

  useEffect(() => {
    let cancelled = false;
    void createCheckoutSession({}).then((result) => {
      if (cancelled) return;
      setState(
        result.ok
          ? { kind: "ready", clientSecret: result.data.clientSecret }
          : { kind: "error", message: result.error.message },
      );
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (state.kind === "loading") {
    return (
      <div aria-busy="true" aria-live="polite" className="flex flex-col gap-4">
        <span className="sr-only">Preparing secure checkout…</span>
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }
  if (state.kind === "error") {
    return (
      <div role="alert" className="flex flex-col items-start gap-4">
        <p className="text-body-lg">{state.message}</p>
        <Button asChild variant="secondary">
          <Link href="/cart">Back to your cart</Link>
        </Button>
      </div>
    );
  }
  return (
    <EmbeddedCheckoutProvider stripe={stripePromise} options={{ clientSecret: state.clientSecret }}>
      <EmbeddedCheckout />
    </EmbeddedCheckoutProvider>
  );
}
