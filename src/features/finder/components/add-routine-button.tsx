"use client";

import { Check, ShoppingBag } from "lucide-react";
import Link from "next/link";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";

import type { Tier } from "../types";
import { addRoutineToCartAction } from "../server/actions";

/** Adds a whole tier to the cart, tagged with the consultation (routine discount). */
export function AddRoutineButton({ consultationId, tier }: { consultationId: string; tier: Tier }) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  function add() {
    startTransition(async () => {
      const result = await addRoutineToCartAction({ consultationId, tier });
      if (!result.ok) {
        setMessage({ ok: false, text: result.error.message });
        return;
      }
      const { added, skipped } = result.data;
      setMessage({
        ok: true,
        text:
          skipped > 0
            ? `Added ${added} products. ${skipped} ${skipped === 1 ? "is" : "are"} out of stock right now.`
            : `Added all ${added} products to your cart.`,
      });
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <Button type="button" size="lg" onClick={add} loading={pending} className="w-full sm:w-auto">
        <ShoppingBag aria-hidden />
        Add this routine to cart
      </Button>
      <div role="status" aria-live="polite" className="min-h-5 text-body-sm">
        {message ? (
          message.ok ? (
            <span className="inline-flex items-center gap-2 text-success">
              <Check aria-hidden className="size-4" />
              {message.text}{" "}
              <Link href="/cart" className="text-link underline underline-offset-4">
                View cart
              </Link>
            </span>
          ) : (
            <span className="text-danger">{message.text}</span>
          )
        ) : null}
      </div>
    </div>
  );
}
