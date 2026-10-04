import "server-only";

import type { InventoryMovementType } from "@/generated/prisma/client";
import { AppError } from "@/lib/errors";
import { inTransaction, type DbClient, type Tx } from "@/lib/server/db-types";
import { enqueueOutbox } from "@/lib/server/outbox";

/**
 * Inventory: reservations + append-only ledger with row locks (ADR-0004, docs/08 §4.3).
 * Every function that changes stock locks the affected `inventory_items` rows with
 * `SELECT … FOR UPDATE` in a consistent order (by variant_id) to avoid deadlocks.
 */

export type StockLine = { variantId: string; quantity: number };

type LockedRow = {
  id: string;
  variant_id: string;
  on_hand: number;
  reserved: number;
  low_stock_threshold: number;
};

/** Sums duplicate variants so each row is locked and checked once. */
export function mergeStockLines(lines: readonly StockLine[]): StockLine[] {
  const totals = new Map<string, number>();
  for (const l of lines) {
    if (!Number.isInteger(l.quantity) || l.quantity <= 0)
      throw new RangeError(`invalid quantity for ${l.variantId}`);
    totals.set(l.variantId, (totals.get(l.variantId) ?? 0) + l.quantity);
  }
  return [...totals.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([variantId, quantity]) => ({ variantId, quantity }));
}

async function lockRows(tx: Tx, variantIds: string[]): Promise<Map<string, LockedRow>> {
  const rows = await tx.$queryRaw<LockedRow[]>`
    SELECT id, variant_id, on_hand, reserved, low_stock_threshold
    FROM inventory_items
    WHERE variant_id = ANY(${variantIds}::text[])
    ORDER BY variant_id
    FOR UPDATE`;
  return new Map(rows.map((r) => [r.variant_id, r]));
}

/**
 * Reserves stock for a checkout (docs/11 §3). All-or-nothing: if any line is short, nothing is
 * reserved and OUT_OF_STOCK lists every short line with what is available.
 */
export async function reserveForOrder(
  db: DbClient,
  orderId: string,
  lines: readonly StockLine[],
  expiresAt: Date,
): Promise<void> {
  const merged = mergeStockLines(lines);
  await inTransaction(db, async (tx) => {
    const rows = await lockRows(
      tx,
      merged.map((l) => l.variantId),
    );
    const short = merged
      .map((l) => {
        const row = rows.get(l.variantId);
        const available = row ? row.on_hand - row.reserved : 0;
        return { variantId: l.variantId, requested: l.quantity, available };
      })
      .filter((l) => l.available < l.requested);
    if (short.length) {
      throw new AppError("OUT_OF_STOCK", "Some items are no longer available in that quantity.", {
        details: {
          lines: short.map(({ variantId, available }) => ({
            variantId,
            available: Math.max(0, available),
          })),
        },
      });
    }

    for (const l of merged) {
      await tx.inventoryItem.update({
        where: { variantId: l.variantId },
        data: { reserved: { increment: l.quantity }, version: { increment: 1 } },
      });
    }
    await tx.inventoryReservation.createMany({
      data: merged.map((l) => ({
        variantId: l.variantId,
        orderId,
        quantity: l.quantity,
        expiresAt,
      })),
    });
  });
}

/** Releases ACTIVE reservations (session expired / checkout abandoned). Idempotent. */
export async function releaseForOrder(
  db: DbClient,
  orderId: string,
  now = new Date(),
): Promise<number> {
  return inTransaction(db, async (tx) => {
    const active = await tx.inventoryReservation.findMany({
      where: { orderId, status: "ACTIVE" },
      select: { id: true, variantId: true, quantity: true },
    });
    if (!active.length) return 0;
    await lockRows(tx, [...new Set(active.map((r) => r.variantId))].sort());
    for (const r of active) {
      await tx.inventoryItem.update({
        where: { variantId: r.variantId },
        data: { reserved: { decrement: r.quantity }, version: { increment: 1 } },
      });
    }
    await tx.inventoryReservation.updateMany({
      where: { id: { in: active.map((r) => r.id) } },
      data: { status: "RELEASED", resolvedAt: now },
    });
    return active.length;
  });
}

export type CommitResult = { shortfalls: { variantId: string; missing: number }[] };

/**
 * Converts an order's reservations into SALE movements at payment (docs/11 §5.2).
 * Lines whose reservation was already released (late payment) are taken from available stock
 * if possible. Anything still missing is reported as a shortfall: the caller flags the order
 * `needsAttention`. A paid order is never auto-cancelled.
 */
export async function commitForOrder(
  db: DbClient,
  orderId: string,
  lines: readonly StockLine[],
  orderReference: string,
  now = new Date(),
): Promise<CommitResult> {
  const merged = mergeStockLines(lines);
  return inTransaction(db, async (tx) => {
    const rows = await lockRows(
      tx,
      merged.map((l) => l.variantId),
    );
    const reservations = await tx.inventoryReservation.findMany({
      where: { orderId, status: "ACTIVE" },
      select: { id: true, variantId: true, quantity: true },
    });
    const reservedBy = new Map(reservations.map((r) => [r.variantId, r]));
    const shortfalls: CommitResult["shortfalls"] = [];

    for (const line of merged) {
      const row = rows.get(line.variantId);
      if (!row) {
        shortfalls.push({ variantId: line.variantId, missing: line.quantity });
        continue;
      }
      const reservation = reservedBy.get(line.variantId);
      const fromReservation = Math.min(reservation?.quantity ?? 0, line.quantity);
      const needed = line.quantity - fromReservation;
      const freeAvailable = row.on_hand - row.reserved;
      const fromFree = Math.min(needed, Math.max(0, freeAvailable));
      const taken = fromReservation + fromFree;
      if (taken < line.quantity)
        shortfalls.push({ variantId: line.variantId, missing: line.quantity - taken });
      if (taken === 0) continue;

      const updated = await tx.inventoryItem.update({
        where: { variantId: line.variantId },
        data: {
          onHand: { decrement: taken },
          // The whole reservation is resolved, even if it covered more than this line needs.
          reserved: { decrement: reservation?.quantity ?? 0 },
          version: { increment: 1 },
        },
        select: { id: true, onHand: true, reserved: true, lowStockThreshold: true },
      });
      await tx.inventoryMovement.create({
        data: {
          inventoryItemId: updated.id,
          type: "SALE",
          quantity: -taken,
          balanceAfter: updated.onHand,
          reference: orderReference,
          orderId,
        },
      });
      // Alert on PHYSICAL stock crossing the threshold: reservations are transient and would
      // otherwise fire (and re-fire) alerts for checkouts that never complete.
      if (row.on_hand > row.low_stock_threshold && updated.onHand <= updated.lowStockThreshold) {
        await enqueueOutbox(tx, "inventory.low_stock", {
          variantId: line.variantId,
          onHand: updated.onHand,
          available: updated.onHand - updated.reserved,
        });
      }
    }

    if (reservations.length) {
      await tx.inventoryReservation.updateMany({
        where: { id: { in: reservations.map((r) => r.id) } },
        data: { status: "COMMITTED", resolvedAt: now },
      });
    }
    return { shortfalls };
  });
}

export type AdjustmentInput = {
  variantId: string;
  type: Extract<InventoryMovementType, "RECEIVE" | "ADJUSTMENT" | "DAMAGE" | "RETURN_RESTOCK">;
  quantity: number;
  reason: string;
  reference?: string | null;
  actorId: string | null;
  /** Optimistic lock from the admin form (docs/04 A3). */
  expectedVersion?: number;
};

/** Staff stock adjustment (FR-ADM-03): ledger entry, never below reserved stock. */
export async function adjustStock(db: DbClient, input: AdjustmentInput) {
  if (!Number.isInteger(input.quantity) || input.quantity === 0)
    throw new AppError("VALIDATION", "Quantity must be a non-zero whole number.");
  if (input.type === "RECEIVE" && input.quantity < 0)
    throw new AppError("VALIDATION", "Received stock must be positive.");
  if (input.type === "DAMAGE" && input.quantity > 0)
    throw new AppError("VALIDATION", "Damaged stock must be negative.");
  if (input.reason.trim().length < 3)
    throw new AppError("VALIDATION", "Please give a reason (at least 3 characters).");

  return inTransaction(db, async (tx) => {
    const rows = await lockRows(tx, [input.variantId]);
    const row = rows.get(input.variantId);
    if (!row) throw new AppError("NOT_FOUND", "No inventory record for this variant.");
    const current = await tx.inventoryItem.findUniqueOrThrow({
      where: { variantId: input.variantId },
      select: { version: true },
    });
    if (input.expectedVersion !== undefined && current.version !== input.expectedVersion) {
      throw new AppError("CONFLICT", "Stock changed since you opened this. Review and try again.", {
        details: { expectedVersion: input.expectedVersion, currentVersion: current.version },
      });
    }
    const nextOnHand = row.on_hand + input.quantity;
    if (nextOnHand < row.reserved) {
      throw new AppError(
        "CONFLICT",
        `Can't go below the ${row.reserved} units reserved by open checkouts.`,
        {
          details: { code: "BELOW_RESERVED", reserved: row.reserved, onHand: row.on_hand },
        },
      );
    }
    const item = await tx.inventoryItem.update({
      where: { variantId: input.variantId },
      data: { onHand: nextOnHand, version: { increment: 1 } },
    });
    const movement = await tx.inventoryMovement.create({
      data: {
        inventoryItemId: item.id,
        type: input.type,
        quantity: input.quantity,
        balanceAfter: nextOnHand,
        reason: input.reason.trim(),
        reference: input.reference ?? null,
        actorId: input.actorId,
      },
    });
    return { item, movement };
  });
}

/**
 * Sweeper (Inngest cron, docs/06 §13): releases reservations past expiry. The `isSessionOpen`
 * check lets the caller confirm with Stripe first for recent orders (docs/11 §5.3).
 */
export async function releaseExpiredReservations(
  db: DbClient,
  now = new Date(),
  isSessionOpen: (orderId: string) => Promise<boolean> = async () => false,
): Promise<{ orders: number; reservations: number }> {
  const expired = await db.inventoryReservation.findMany({
    where: { status: "ACTIVE", expiresAt: { lt: now }, orderId: { not: null } },
    select: { orderId: true },
    distinct: ["orderId"],
  });
  let orders = 0;
  let reservations = 0;
  for (const { orderId } of expired) {
    if (!orderId || (await isSessionOpen(orderId))) continue;
    reservations += await releaseForOrder(db, orderId, now);
    orders += 1;
  }
  return { orders, reservations };
}

/** Available units per variant (bundles: the minimum across components). */
export async function availabilityFor(
  db: DbClient,
  variantIds: string[],
): Promise<Map<string, number>> {
  const result = new Map<string, number>();
  if (!variantIds.length) return result;
  const items = await db.inventoryItem.findMany({
    where: { variantId: { in: variantIds } },
    select: { variantId: true, onHand: true, reserved: true },
  });
  for (const i of items) result.set(i.variantId, Math.max(0, i.onHand - i.reserved));

  const missing = variantIds.filter((id) => !result.has(id));
  if (missing.length) {
    const bundles = await db.bundleItem.findMany({
      where: { bundleProduct: { variants: { some: { id: { in: missing } } } } },
      select: {
        quantity: true,
        bundleProduct: { select: { variants: { select: { id: true } } } },
        variant: { select: { inventory: { select: { onHand: true, reserved: true } } } },
      },
    });
    for (const b of bundles) {
      const bundleVariantId = b.bundleProduct.variants[0]?.id;
      if (!bundleVariantId) continue;
      const inv = b.variant.inventory;
      const possible = inv ? Math.floor(Math.max(0, inv.onHand - inv.reserved) / b.quantity) : 0;
      result.set(
        bundleVariantId,
        Math.min(result.get(bundleVariantId) ?? Number.MAX_SAFE_INTEGER, possible),
      );
    }
    for (const id of missing) if (!result.has(id)) result.set(id, 0);
  }
  return result;
}
