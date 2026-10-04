"use client";

import { Check, Plus } from "lucide-react";
import { useState, useTransition } from "react";

import { addToCart } from "@/features/cart/server/actions";
import { cn } from "@/lib/utils";

/**
 * Quick add (docs/16 QuickAddButton): adds the default variant, one-time. Sits outside the card
 * link (overlay pattern), so there is no interactive element nested inside a link.
 */
export function QuickAddButton({
  variantId,
  productName,
  className,
}: {
  variantId: string;
  productName: string;
  className?: string;
}) {
  const [pending, startTransition] = useTransition();
  const [status, setStatus] = useState<"idle" | "added" | "error">("idle");
  const [message, setMessage] = useState("");

  function add() {
    startTransition(async () => {
      const result = await addToCart({ variantId, quantity: 1, purchaseType: "ONE_TIME" });
      if (result.ok) {
        setStatus("added");
        setMessage(`${productName} added to your cart.`);
        setTimeout(() => setStatus("idle"), 2500);
      } else {
        setStatus("error");
        setMessage(result.error.message);
      }
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={add}
        disabled={pending}
        aria-label={`Add ${productName} to cart`}
        className={cn(
          "inline-flex size-11 items-center justify-center rounded-full border border-border bg-surface text-foreground shadow-xs transition-colors",
          "hover:bg-primary hover:text-primary-foreground disabled:opacity-60",
          status === "added" && "bg-primary text-primary-foreground",
          className,
        )}
      >
        {status === "added" ? (
          <Check aria-hidden className="size-4" />
        ) : (
          <Plus aria-hidden className="size-4" />
        )}
      </button>
      <span role="status" className="sr-only">
        {message}
      </span>
    </>
  );
}
