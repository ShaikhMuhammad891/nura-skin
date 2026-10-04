import { describe, expect, it } from "vitest";

import { redactForAudit } from "./log";

describe("redactForAudit", () => {
  it("redacts PII and secrets at any depth, keeps business fields", () => {
    const out = redactForAudit({
      email: "maya@example.com",
      priceCents: 4800,
      shippingAddress: { line1: "1 Main St" },
      nested: [{ token: "abc", status: "PAID" }],
      at: new Date("2026-01-01T00:00:00Z"),
    });
    expect(out).toEqual({
      email: "[redacted]",
      priceCents: 4800,
      shippingAddress: "[redacted]",
      nested: [{ token: "[redacted]", status: "PAID" }],
      at: "2026-01-01T00:00:00.000Z",
    });
  });
});
