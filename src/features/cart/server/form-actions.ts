"use server";

import { refresh } from "next/cache";

import { AppError } from "@/lib/errors";
import { env } from "@/lib/env";
import { db } from "@/lib/server/db";

import { addToCart, removeCartItem } from "./actions";

/**
 * Progressive-enhancement wrappers for the interim cart page: `<form action>` needs void actions.
 * The typed actions in ./actions.ts stay the API; the rich cart drawer (M4 UI) calls those.
 */
export async function removeCartItemForm(formData: FormData): Promise<void> {
  const itemId = String(formData.get("itemId") ?? "");
  await removeCartItem({ itemId });
  refresh();
}

/**
 * Local-only helper until product pages exist (M3): adds an in-stock seeded product so checkout
 * can be exercised end to end. Refuses outside local development.
 */
export async function addSampleItemForm(): Promise<void> {
  if (env.NEXT_PUBLIC_APP_ENV !== "local") throw new AppError("NOT_FOUND");
  const variant = await db.productVariant.findFirst({
    where: {
      product: { status: "PUBLISHED", type: { not: "BUNDLE" } },
      inventory: { onHand: { gt: 5 } },
    },
    orderBy: { sku: "asc" },
    select: { id: true },
  });
  if (!variant) throw new AppError("NOT_FOUND", "No in-stock products are seeded.");
  await addToCart({ variantId: variant.id, quantity: 1, purchaseType: "ONE_TIME" });
  refresh();
}
