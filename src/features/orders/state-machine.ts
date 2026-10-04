/**
 * Order state machines (docs/08 §4.6). Fulfilment (`status`) and money (`paymentStatus`)
 * are orthogonal, so there are no ambiguous states like "shipped but partially refunded".
 */
import { AppError } from "@/lib/errors";

export type OrderStatus =
  "PENDING_PAYMENT" | "PAID" | "PROCESSING" | "SHIPPED" | "DELIVERED" | "CANCELED" | "EXPIRED";
export type PaymentStatus = "PENDING" | "SUCCEEDED" | "FAILED" | "PARTIALLY_REFUNDED" | "REFUNDED";

const ORDER_TRANSITIONS: Record<OrderStatus, readonly OrderStatus[]> = {
  PENDING_PAYMENT: ["PAID", "EXPIRED", "CANCELED"],
  // Canceling a paid order requires a full refund (enforced by the service, not here).
  PAID: ["PROCESSING", "CANCELED"],
  PROCESSING: ["SHIPPED", "CANCELED"],
  SHIPPED: ["DELIVERED"],
  DELIVERED: [],
  CANCELED: [],
  EXPIRED: [],
};

const PAYMENT_TRANSITIONS: Record<PaymentStatus, readonly PaymentStatus[]> = {
  PENDING: ["SUCCEEDED", "FAILED"],
  FAILED: ["SUCCEEDED"], // a retried payment can still succeed
  SUCCEEDED: ["PARTIALLY_REFUNDED", "REFUNDED"],
  PARTIALLY_REFUNDED: ["PARTIALLY_REFUNDED", "REFUNDED"],
  REFUNDED: [],
};

export function canTransitionOrder(from: OrderStatus, to: OrderStatus): boolean {
  return ORDER_TRANSITIONS[from].includes(to);
}

export function assertOrderTransition(from: OrderStatus, to: OrderStatus): void {
  if (!canTransitionOrder(from, to)) {
    throw new AppError("CONFLICT", `An order can't move from ${from} to ${to}.`, {
      details: { from, to, allowed: ORDER_TRANSITIONS[from] },
    });
  }
}

export function allowedOrderTransitions(from: OrderStatus): readonly OrderStatus[] {
  return ORDER_TRANSITIONS[from];
}

export function canTransitionPayment(from: PaymentStatus, to: PaymentStatus): boolean {
  return PAYMENT_TRANSITIONS[from].includes(to);
}

/** Money state after a successful refund, derived from totals (idempotent, convergent). */
export function paymentStatusAfterRefunds(
  totalCents: number,
  refundedCents: number,
): PaymentStatus {
  if (refundedCents <= 0) return "SUCCEEDED";
  return refundedCents >= totalCents ? "REFUNDED" : "PARTIALLY_REFUNDED";
}

export function isCancelable(status: OrderStatus): boolean {
  return canTransitionOrder(status, "CANCELED");
}

/** Customer-facing order number (FR-CHK-06). */
export function formatOrderNumber(number: number): string {
  return `NURA-${String(number).padStart(6, "0")}`;
}

export function parseOrderNumber(value: string): number | null {
  const match = /^NURA-(\d{6,})$/i.exec(value.trim());
  return match ? Number(match[1]) : null;
}
