import type { Metadata } from "next";

import { CheckoutForm } from "@/features/checkout/components/embedded-checkout";

export const metadata: Metadata = { title: "Checkout" };

/** Checkout (docs/15 P10): Stripe Embedded Checkout for the visitor's cart. */
export default function CheckoutPage() {
  return (
    <div className="w-full max-w-4xl">
      <h1 className="sr-only">Checkout</h1>
      <CheckoutForm />
    </div>
  );
}
