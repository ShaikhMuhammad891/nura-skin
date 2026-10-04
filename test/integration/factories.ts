/** Test data factories: each call creates isolated rows with unique slugs/SKUs. */
import { randomUUID } from "node:crypto";

import type { PrismaClient } from "../../src/generated/prisma/client";

export const uid = () => randomUUID().slice(0, 8);

export async function createTestVariant(
  prisma: PrismaClient,
  opts: {
    onHand: number;
    priceCents?: number;
    subscriptionEligible?: boolean;
    status?: "PUBLISHED" | "DRAFT";
    replenishDays?: number;
  },
) {
  const id = uid();
  const category = await prisma.category.findUniqueOrThrow({ where: { slug: "serums" } });
  const product = await prisma.product.create({
    data: {
      slug: `test-serum-${id}`,
      name: `Test Serum ${id}`,
      categoryId: category.id,
      status: opts.status ?? "PUBLISHED",
      publishedAt: opts.status === "DRAFT" ? null : new Date(),
      shortDescription: "Test product",
      description: "Test product",
      howToUse: "Apply.",
      routineSlot: "TREAT",
      skinTypes: ["DRY", "OILY", "COMBINATION", "NORMAL"],
    },
  });
  const variant = await prisma.productVariant.create({
    data: {
      productId: product.id,
      sku: `TEST-${id}`,
      name: "30 ml",
      optionType: "size",
      priceCents: opts.priceCents ?? 3000,
      subscriptionEligible: opts.subscriptionEligible ?? true,
      replenishDays: opts.replenishDays ?? 56,
      weightGrams: 100,
      isDefault: true,
      inventory: { create: { onHand: opts.onHand } },
    },
  });
  return { product, variant };
}

export async function createPendingOrderRow(prisma: PrismaClient, totalCents = 3000) {
  return prisma.order.create({
    data: { subtotalCents: totalCents, shippingCents: 0, totalCents },
  });
}
