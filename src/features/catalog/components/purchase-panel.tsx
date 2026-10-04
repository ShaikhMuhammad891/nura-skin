"use client";

import { Check, Minus, Plus, Repeat } from "lucide-react";
import Link from "next/link";
import { useState, useTransition } from "react";

import { Price } from "./price";
import { Button } from "@/components/ui/button";
import { addToCart } from "@/features/cart/server/actions";
import { applyBp } from "@/features/pricing/money";
import { cn } from "@/lib/utils";

import type { VariantDTO } from "../types";

const MAX_QTY = 10;
const LOW_STOCK = 5;

/**
 * PDP purchase panel (docs/16 VariantSelector, PurchaseOptions, AddToCartForm, StockIndicator).
 * The selected variant mirrors to `?variant=` (replaceState, no navigation) so the URL is shareable.
 * Availability comes from the uncached server wrapper; prices are re-quoted at checkout regardless.
 */
export function PurchasePanel({
  productName,
  variants,
  initialVariantId,
  availability,
  subscriptionDiscountBp,
  subscribable,
}: {
  productName: string;
  variants: VariantDTO[];
  initialVariantId: string;
  availability: Record<string, number>;
  subscriptionDiscountBp: number;
  /** Routines are one-time only (subscribing adds their components, review R-08). */
  subscribable: boolean;
}) {
  const [variantId, setVariantId] = useState(initialVariantId);
  const [purchaseType, setPurchaseType] = useState<"ONE_TIME" | "SUBSCRIPTION">("ONE_TIME");
  const [quantity, setQuantity] = useState(1);
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  const variant = variants.find((v) => v.id === variantId) ?? variants[0]!;
  const available = availability[variant.id] ?? 0;
  const canSubscribe = subscribable && variant.subscriptionEligible;
  const type = canSubscribe ? purchaseType : "ONE_TIME";
  const subscribePrice = variant.priceCents - applyBp(variant.priceCents, subscriptionDiscountBp);
  const discountPct = Math.round(subscriptionDiscountBp / 100);

  function selectVariant(id: string) {
    setVariantId(id);
    setResult(null);
    setQuantity(1);
    const url = new URL(window.location.href);
    url.searchParams.set("variant", id);
    window.history.replaceState(null, "", url);
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const res = await addToCart({ variantId: variant.id, quantity, purchaseType: type });
      setResult(
        res.ok
          ? { ok: true, message: `Added ${quantity} × ${productName} to your cart.` }
          : { ok: false, message: res.error.message },
      );
    });
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-6">
      <Price
        cents={type === "SUBSCRIPTION" ? subscribePrice : variant.priceCents}
        compareAtCents={type === "SUBSCRIPTION" ? variant.priceCents : variant.compareAtPriceCents}
        className="text-heading-lg"
      />

      {variants.length > 1 ? (
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 text-body-sm font-medium">
            {variant.optionType === "shade" ? "Shade" : "Size"}:{" "}
            <span className="text-muted-foreground">{variant.name}</span>
          </legend>
          <div className="flex flex-wrap gap-2">
            {variants.map((v) => {
              const out = (availability[v.id] ?? 0) <= 0;
              return (
                <label
                  key={v.id}
                  className={cn(
                    "relative inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-full border border-border-strong px-4 text-body-sm",
                    "has-[:checked]:border-primary has-[:checked]:bg-primary has-[:checked]:text-primary-foreground",
                    "has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ring",
                    out && "text-muted-foreground line-through",
                  )}
                >
                  <input
                    type="radio"
                    name="variant"
                    value={v.id}
                    checked={v.id === variant.id}
                    onChange={() => selectVariant(v.id)}
                    className="sr-only"
                  />
                  {v.shadeHex ? (
                    <span
                      aria-hidden
                      className="size-4 rounded-full border border-border"
                      style={{ backgroundColor: v.shadeHex }}
                    />
                  ) : null}
                  {v.name}
                  {out ? <span className="sr-only">(out of stock)</span> : null}
                </label>
              );
            })}
          </div>
        </fieldset>
      ) : null}

      {canSubscribe ? (
        <fieldset className="flex flex-col gap-2">
          <legend className="sr-only">Purchase type</legend>
          {(
            [
              {
                value: "ONE_TIME",
                label: "One-time purchase",
                price: variant.priceCents,
                note: null,
              },
              {
                value: "SUBSCRIPTION",
                label: `Subscribe & save ${discountPct}%`,
                price: subscribePrice,
                note: `Delivered every ${Math.round(variant.replenishDays / 7)} weeks. Skip, swap or cancel anytime.`,
              },
            ] as const
          ).map((option) => (
            <label
              key={option.value}
              className={cn(
                "flex cursor-pointer items-start gap-3 rounded-lg border border-border-strong p-4",
                "has-[:checked]:border-primary has-[:checked]:shadow-glow",
                "has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ring",
              )}
            >
              <input
                type="radio"
                name="purchaseType"
                value={option.value}
                checked={type === option.value}
                onChange={() => setPurchaseType(option.value)}
                className="mt-1 size-4 accent-primary"
              />
              <span className="flex flex-1 flex-col gap-1">
                <span className="flex items-center justify-between gap-2 text-body-sm font-medium">
                  <span className="inline-flex items-center gap-1.5">
                    {option.value === "SUBSCRIPTION" ? (
                      <Repeat aria-hidden className="size-4" />
                    ) : null}
                    {option.label}
                  </span>
                  <Price cents={option.price} className="text-body-sm" />
                </span>
                {option.note ? (
                  <span className="text-caption text-muted-foreground">{option.note}</span>
                ) : null}
              </span>
            </label>
          ))}
        </fieldset>
      ) : null}

      <p
        className={cn(
          "text-body-sm font-medium",
          available <= 0 ? "text-danger" : available <= LOW_STOCK ? "text-warning" : "text-success",
        )}
      >
        {available <= 0
          ? "Out of stock"
          : available <= LOW_STOCK
            ? `Only ${available} left`
            : "In stock, ships in 1–2 days"}
      </p>

      <div className="flex gap-3">
        <div className="inline-flex h-13 items-center rounded-md border border-border-strong">
          <button
            type="button"
            onClick={() => setQuantity((q) => Math.max(1, q - 1))}
            disabled={quantity <= 1}
            aria-label="Decrease quantity"
            className="inline-flex size-11 items-center justify-center disabled:opacity-40"
          >
            <Minus aria-hidden className="size-4" />
          </button>
          <output aria-live="polite" aria-label="Quantity" className="tabular w-8 text-center">
            {quantity}
          </output>
          <button
            type="button"
            onClick={() => setQuantity((q) => Math.min(MAX_QTY, Math.max(1, available), q + 1))}
            disabled={quantity >= Math.min(MAX_QTY, available)}
            aria-label="Increase quantity"
            className="inline-flex size-11 items-center justify-center disabled:opacity-40"
          >
            <Plus aria-hidden className="size-4" />
          </button>
        </div>
        <Button
          type="submit"
          size="lg"
          className="flex-1"
          loading={pending}
          disabled={available <= 0}
        >
          {available <= 0 ? "Out of stock" : "Add to cart"}
        </Button>
      </div>

      <div role="status" aria-live="polite" className="min-h-6 text-body-sm">
        {result ? (
          result.ok ? (
            <span className="inline-flex items-center gap-2 text-success">
              <Check aria-hidden className="size-4" />
              {result.message}{" "}
              <Link href="/cart" className="text-link underline underline-offset-4">
                View cart
              </Link>
            </span>
          ) : (
            <span className="text-danger">{result.message}</span>
          )
        ) : null}
      </div>
    </form>
  );
}
