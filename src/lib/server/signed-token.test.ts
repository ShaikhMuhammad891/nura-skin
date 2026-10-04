import { describe, expect, it } from "vitest";

import { generateToken, hashToken, signValue, verifySignedValue } from "./signed-token";

const current = "c".repeat(32);
const previous = "p".repeat(32);

describe("signed values", () => {
  it("round-trips a value with the current secret", () => {
    expect(verifySignedValue(signValue("cart_123", current), [current])).toBe("cart_123");
  });

  it("rejects tampered values and signatures", () => {
    const signed = signValue("cart_123", current);
    expect(verifySignedValue(signed.replace("cart_123", "cart_999"), [current])).toBeNull();
    expect(verifySignedValue(`${signed}x`, [current])).toBeNull();
    expect(verifySignedValue("cart_123", [current])).toBeNull();
    expect(verifySignedValue(undefined, [current])).toBeNull();
  });

  it("accepts the previous secret during rotation, and nothing else", () => {
    const old = signValue("cart_1", previous);
    expect(verifySignedValue(old, [current, previous])).toBe("cart_1");
    expect(verifySignedValue(old, [current])).toBeNull();
  });

  it("refuses weak secrets and ambiguous values", () => {
    expect(() => signValue("x", "short")).toThrow();
    expect(() => signValue("a.b", current)).toThrow();
  });
});

describe("tokens", () => {
  it("generates unique 256-bit tokens and stable hashes", () => {
    const a = generateToken();
    const b = generateToken();
    expect(a).not.toBe(b);
    expect(Buffer.from(a, "base64url")).toHaveLength(32);
    expect(hashToken(a)).toBe(hashToken(a));
    expect(hashToken(a)).toMatch(/^[0-9a-f]{64}$/);
  });
});
