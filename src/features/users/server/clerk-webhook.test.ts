import { Webhook } from "svix";
import { describe, expect, it } from "vitest";

import { verifyClerkWebhook } from "./clerk-webhook";

// Svix secrets are base64 after the `whsec_` prefix.
const SECRET = `whsec_${Buffer.from("test-secret-0123456789abcdef").toString("base64")}`;
const body = JSON.stringify({ type: "user.deleted", data: { id: "user_1", deleted: true } });

function signedHeaders(payload: string, secret = SECRET, at = new Date()) {
  const id = "msg_test_1";
  const signature = new Webhook(secret).sign(id, at, payload);
  return new Headers({
    "svix-id": id,
    "svix-timestamp": String(Math.floor(at.getTime() / 1000)),
    "svix-signature": signature,
  });
}

describe("verifyClerkWebhook (docs/10 §8)", () => {
  it("accepts a correctly signed payload and returns the svix id + parsed event", () => {
    const result = verifyClerkWebhook(body, signedHeaders(body), SECRET);
    expect(result.id).toBe("msg_test_1");
    expect(result.event.type).toBe("user.deleted");
  });

  it("rejects a tampered body", () => {
    const headers = signedHeaders(body);
    const tampered = body.replace("user_1", "user_2");
    expect(() => verifyClerkWebhook(tampered, headers, SECRET)).toThrow(/signature/i);
  });

  it("rejects a signature made with another secret", () => {
    const other = `whsec_${Buffer.from("another-secret-abcdef012345").toString("base64")}`;
    expect(() => verifyClerkWebhook(body, signedHeaders(body, other), SECRET)).toThrow(
      /signature/i,
    );
  });

  it("rejects stale timestamps (replay window)", () => {
    const anHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    expect(() => verifyClerkWebhook(body, signedHeaders(body, SECRET, anHourAgo), SECRET)).toThrow(
      /signature/i,
    );
  });

  it("rejects requests without svix headers", () => {
    expect(() => verifyClerkWebhook(body, new Headers(), SECRET)).toThrow(/svix headers/i);
  });
});
