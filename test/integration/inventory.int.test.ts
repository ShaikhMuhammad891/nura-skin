/**
 * Inventory correctness under concurrency (ADR-0004, docs/19 §4 "Concurrency", review item:
 * "50 concurrent checkouts against 20 units → exactly 20 reservations, no oversell").
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { PrismaClient } from "../../src/generated/prisma/client";
import {
  adjustStock,
  availabilityFor,
  commitForOrder,
  releaseExpiredReservations,
  releaseForOrder,
  reserveForOrder,
} from "../../src/features/inventory/server/service";
import { AppError } from "../../src/lib/errors";

import { createPendingOrderRow, createTestVariant } from "./factories";
import { createTestPrisma } from "./helpers";

let prisma: PrismaClient;
const inFuture = () => new Date(Date.now() + 35 * 60_000);

beforeAll(() => {
  prisma = createTestPrisma();
});
afterAll(async () => {
  await prisma.$disconnect();
});

const stockOf = (variantId: string) =>
  prisma.inventoryItem.findUniqueOrThrow({
    where: { variantId },
    select: { onHand: true, reserved: true },
  });

describe("reservations", () => {
  it("reserves, then releases idempotently", async () => {
    const { variant } = await createTestVariant(prisma, { onHand: 10 });
    const order = await createPendingOrderRow(prisma);
    await reserveForOrder(prisma, order.id, [{ variantId: variant.id, quantity: 3 }], inFuture());
    expect(await stockOf(variant.id)).toEqual({ onHand: 10, reserved: 3 });

    expect(await releaseForOrder(prisma, order.id)).toBe(1);
    expect(await releaseForOrder(prisma, order.id)).toBe(0);
    expect(await stockOf(variant.id)).toEqual({ onHand: 10, reserved: 0 });
  });

  it("is all-or-nothing and reports every short line", async () => {
    const a = await createTestVariant(prisma, { onHand: 5 });
    const b = await createTestVariant(prisma, { onHand: 1 });
    const order = await createPendingOrderRow(prisma);
    const error = await reserveForOrder(
      prisma,
      order.id,
      [
        { variantId: a.variant.id, quantity: 2 },
        { variantId: b.variant.id, quantity: 2 },
      ],
      inFuture(),
    ).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(AppError);
    expect((error as AppError).code).toBe("OUT_OF_STOCK");
    expect((error as AppError).details).toEqual({
      lines: [{ variantId: b.variant.id, available: 1 }],
    });
    expect(await stockOf(a.variant.id)).toEqual({ onHand: 5, reserved: 0 }); // nothing partially reserved
  });

  it("merges duplicate lines for the same variant", async () => {
    const { variant } = await createTestVariant(prisma, { onHand: 3 });
    const order = await createPendingOrderRow(prisma);
    await expect(
      reserveForOrder(
        prisma,
        order.id,
        [
          { variantId: variant.id, quantity: 2 },
          { variantId: variant.id, quantity: 2 },
        ],
        inFuture(),
      ),
    ).rejects.toMatchObject({ code: "OUT_OF_STOCK" });
  });

  it("50 concurrent buyers for 20 units → exactly 20 succeed, never oversold", async () => {
    const { variant } = await createTestVariant(prisma, { onHand: 20 });
    const orders = await Promise.all(
      Array.from({ length: 50 }, () => createPendingOrderRow(prisma)),
    );
    const results = await Promise.allSettled(
      orders.map((o) =>
        reserveForOrder(prisma, o.id, [{ variantId: variant.id, quantity: 1 }], inFuture()),
      ),
    );
    const fulfilled = results.filter((r) => r.status === "fulfilled").length;
    const outOfStock = results.filter(
      (r) => r.status === "rejected" && (r.reason as AppError).code === "OUT_OF_STOCK",
    ).length;
    expect(fulfilled).toBe(20);
    expect(outOfStock).toBe(30);
    expect(await stockOf(variant.id)).toEqual({ onHand: 20, reserved: 20 });
    expect(
      await prisma.inventoryReservation.count({
        where: { variantId: variant.id, status: "ACTIVE" },
      }),
    ).toBe(20);
  });
});

describe("commit at payment", () => {
  it("turns reservations into SALE movements", async () => {
    const { variant } = await createTestVariant(prisma, { onHand: 10 });
    const order = await createPendingOrderRow(prisma);
    await reserveForOrder(prisma, order.id, [{ variantId: variant.id, quantity: 2 }], inFuture());
    const result = await commitForOrder(
      prisma,
      order.id,
      [{ variantId: variant.id, quantity: 2 }],
      "NURA-100001",
    );
    expect(result.shortfalls).toEqual([]);
    expect(await stockOf(variant.id)).toEqual({ onHand: 8, reserved: 0 });
    const movement = await prisma.inventoryMovement.findFirstOrThrow({
      where: { orderId: order.id },
    });
    expect(movement).toMatchObject({
      type: "SALE",
      quantity: -2,
      balanceAfter: 8,
      reference: "NURA-100001",
    });
  });

  it("late payment after release: takes free stock, reports what's missing", async () => {
    const { variant } = await createTestVariant(prisma, { onHand: 1 });
    const order = await createPendingOrderRow(prisma);
    await reserveForOrder(prisma, order.id, [{ variantId: variant.id, quantity: 1 }], inFuture());
    await releaseForOrder(prisma, order.id); // sweeper ran before the webhook
    const result = await commitForOrder(
      prisma,
      order.id,
      [{ variantId: variant.id, quantity: 2 }],
      "NURA-100002",
    );
    expect(result.shortfalls).toEqual([{ variantId: variant.id, missing: 1 }]);
    expect(await stockOf(variant.id)).toEqual({ onHand: 0, reserved: 0 });
  });

  it("emits a low-stock outbox event when crossing the threshold", async () => {
    const { variant } = await createTestVariant(prisma, { onHand: 21 }); // threshold 20
    const order = await createPendingOrderRow(prisma);
    await reserveForOrder(prisma, order.id, [{ variantId: variant.id, quantity: 2 }], inFuture());
    await commitForOrder(prisma, order.id, [{ variantId: variant.id, quantity: 2 }], "NURA-100003");
    const events = await prisma.outboxEvent.findMany({ where: { name: "inventory.low_stock" } });
    expect(events.some((e) => (e.payload as { variantId: string }).variantId === variant.id)).toBe(
      true,
    );
  });
});

describe("staff adjustments", () => {
  it("records a RECEIVE in the ledger and bumps the version", async () => {
    const { variant } = await createTestVariant(prisma, { onHand: 5 });
    const { item, movement } = await adjustStock(prisma, {
      variantId: variant.id,
      type: "RECEIVE",
      quantity: 240,
      reason: "PO-1042",
      actorId: "staff_1",
      expectedVersion: 0,
    });
    expect(item.onHand).toBe(245);
    expect(item.version).toBe(1);
    expect(movement).toMatchObject({
      type: "RECEIVE",
      quantity: 240,
      balanceAfter: 245,
      actorId: "staff_1",
    });
  });

  it("rejects a stale form (optimistic lock)", async () => {
    const { variant } = await createTestVariant(prisma, { onHand: 5 });
    await adjustStock(prisma, {
      variantId: variant.id,
      type: "RECEIVE",
      quantity: 1,
      reason: "count",
      actorId: null,
    });
    await expect(
      adjustStock(prisma, {
        variantId: variant.id,
        type: "ADJUSTMENT",
        quantity: -1,
        reason: "recount",
        actorId: null,
        expectedVersion: 0,
      }),
    ).rejects.toMatchObject({ code: "CONFLICT" });
  });

  it("never goes below units reserved by open checkouts", async () => {
    const { variant } = await createTestVariant(prisma, { onHand: 5 });
    const order = await createPendingOrderRow(prisma);
    await reserveForOrder(prisma, order.id, [{ variantId: variant.id, quantity: 4 }], inFuture());
    await expect(
      adjustStock(prisma, {
        variantId: variant.id,
        type: "DAMAGE",
        quantity: -2,
        reason: "broken bottles",
        actorId: null,
      }),
    ).rejects.toMatchObject({ code: "CONFLICT", details: { code: "BELOW_RESERVED" } });
  });

  it("validates direction and reason", async () => {
    const { variant } = await createTestVariant(prisma, { onHand: 5 });
    await expect(
      adjustStock(prisma, {
        variantId: variant.id,
        type: "RECEIVE",
        quantity: -1,
        reason: "x",
        actorId: null,
      }),
    ).rejects.toMatchObject({
      code: "VALIDATION",
    });
  });
});

describe("sweeper & availability", () => {
  it("releases only expired reservations, and respects open sessions", async () => {
    const { variant } = await createTestVariant(prisma, { onHand: 10 });
    const expiredOrder = await createPendingOrderRow(prisma);
    const openOrder = await createPendingOrderRow(prisma);
    const past = new Date(Date.now() - 60_000);
    await reserveForOrder(prisma, expiredOrder.id, [{ variantId: variant.id, quantity: 1 }], past);
    await reserveForOrder(prisma, openOrder.id, [{ variantId: variant.id, quantity: 1 }], past);

    await releaseExpiredReservations(
      prisma,
      new Date(),
      async (orderId) => orderId === openOrder.id,
    );
    expect(await stockOf(variant.id)).toEqual({ onHand: 10, reserved: 1 });
  });

  it("computes bundle availability as the minimum of its components", async () => {
    const bundleVariant = await prisma.productVariant.findUniqueOrThrow({
      where: { sku: "NURA-RTN-BARRIER" },
    });
    const components = await prisma.bundleItem.findMany({
      where: { bundleProduct: { variants: { some: { id: bundleVariant.id } } } },
      select: { variantId: true },
    });
    const availability = await availabilityFor(prisma, [
      bundleVariant.id,
      ...components.map((c) => c.variantId),
    ]);
    const min = Math.min(...components.map((c) => availability.get(c.variantId)!));
    expect(availability.get(bundleVariant.id)).toBe(min);
  });
});
