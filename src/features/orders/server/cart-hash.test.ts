import { describe, expect, it } from "vitest";

import { cartHash } from "./service";

const lines = [
  { variantId: "v1", quantity: 1, purchaseType: "ONE_TIME", consultationId: null },
  { variantId: "v2", quantity: 2, purchaseType: "SUBSCRIPTION", consultationId: "c1" },
];

describe("cartHash", () => {
  it("is independent of line order", () => {
    expect(cartHash(lines, null, 8)).toBe(cartHash([...lines].reverse(), null, 8));
  });

  it("changes with quantity, coupon or plan interval", () => {
    const base = cartHash(lines, null, 8);
    expect(cartHash([{ ...lines[0]!, quantity: 2 }, lines[1]!], null, 8)).not.toBe(base);
    expect(cartHash(lines, "coupon_1", 8)).not.toBe(base);
    expect(cartHash(lines, null, 12)).not.toBe(base);
  });
});
