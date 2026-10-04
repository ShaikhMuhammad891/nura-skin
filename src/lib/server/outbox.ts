import "server-only";

import type { Prisma } from "@/generated/prisma/client";

import type { Tx } from "./db-types";

/**
 * Transactional outbox (ADR-0007). Write the event in the SAME transaction as the state change;
 * a dispatcher (Inngest, M5) delivers it at least once. Consumers must be idempotent.
 */
export type OutboxEventName =
  | "order.paid"
  | "order.expired"
  | "order.canceled"
  | "order.needs_attention"
  | "inventory.low_stock"
  | "cart.merged"
  | "user.role_changed";

export async function enqueueOutbox(
  tx: Tx,
  name: OutboxEventName,
  payload: Prisma.InputJsonValue,
  options: { availableAt?: Date } = {},
): Promise<string> {
  const event = await tx.outboxEvent.create({
    data: { name, payload, availableAt: options.availableAt ?? new Date() },
    select: { id: true },
  });
  return event.id;
}
