import { describe, expect, it } from "vitest";

import { AppError } from "@/lib/errors";

import {
  assertOrderTransition,
  canTransitionOrder,
  canTransitionPayment,
  formatOrderNumber,
  isCancelable,
  parseOrderNumber,
  paymentStatusAfterRefunds,
} from "./state-machine";

describe("order fulfilment state machine", () => {
  it.each([
    ["PENDING_PAYMENT", "PAID", true],
    ["PENDING_PAYMENT", "EXPIRED", true],
    ["PAID", "PROCESSING", true],
    ["PROCESSING", "SHIPPED", true],
    ["SHIPPED", "DELIVERED", true],
    ["PAID", "SHIPPED", false], // must process first
    ["SHIPPED", "CANCELED", false], // too late to cancel
    ["DELIVERED", "PROCESSING", false],
    ["EXPIRED", "PAID", false],
  ] as const)("%s → %s = %s", (from, to, expected) => {
    expect(canTransitionOrder(from, to)).toBe(expected);
  });

  it("throws a CONFLICT AppError with the allowed transitions", () => {
    try {
      assertOrderTransition("SHIPPED", "CANCELED");
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(AppError);
      expect((error as AppError).code).toBe("CONFLICT");
      expect((error as AppError).details).toMatchObject({ allowed: ["DELIVERED"] });
    }
  });

  it("orders are cancelable only before shipping", () => {
    expect(isCancelable("PAID")).toBe(true);
    expect(isCancelable("PROCESSING")).toBe(true);
    expect(isCancelable("SHIPPED")).toBe(false);
  });
});

describe("payment state machine", () => {
  it("allows repeated partial refunds and forbids un-refunding", () => {
    expect(canTransitionPayment("SUCCEEDED", "PARTIALLY_REFUNDED")).toBe(true);
    expect(canTransitionPayment("PARTIALLY_REFUNDED", "PARTIALLY_REFUNDED")).toBe(true);
    expect(canTransitionPayment("REFUNDED", "SUCCEEDED")).toBe(false);
  });

  it("derives status from refunded totals", () => {
    expect(paymentStatusAfterRefunds(11800, 0)).toBe("SUCCEEDED");
    expect(paymentStatusAfterRefunds(11800, 2400)).toBe("PARTIALLY_REFUNDED");
    expect(paymentStatusAfterRefunds(11800, 11800)).toBe("REFUNDED");
  });
});

describe("order numbers", () => {
  it("formats and parses NURA-XXXXXX", () => {
    expect(formatOrderNumber(100234)).toBe("NURA-100234");
    expect(parseOrderNumber("nura-100234")).toBe(100234);
    expect(parseOrderNumber("NURA-12")).toBeNull();
    expect(parseOrderNumber("100234")).toBeNull();
  });
});
