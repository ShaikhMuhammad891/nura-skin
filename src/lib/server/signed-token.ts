import "server-only";

import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

/**
 * HMAC-signed values for cookies (cart, consultation) and hashed single-use tokens for email
 * links (docs/10 §4.2, §4.5). Signing supports key rotation: sign with the current secret,
 * verify against current and previous (18 §12 key rotation).
 */

const b64url = (buf: Buffer) => buf.toString("base64url");

function hmac(value: string, secret: string): string {
  return b64url(createHmac("sha256", secret).update(value).digest());
}

/** `value.signature` */
export function signValue(value: string, secret: string): string {
  if (!secret || secret.length < 32)
    throw new Error("signing secret must be at least 32 characters");
  if (value.includes(".")) throw new Error("signed values must not contain '.'");
  return `${value}.${hmac(value, secret)}`;
}

/** Returns the original value when the signature matches any accepted secret, else null. */
export function verifySignedValue(
  signed: string | undefined | null,
  secrets: readonly (string | undefined)[],
): string | null {
  if (!signed) return null;
  const dot = signed.lastIndexOf(".");
  if (dot <= 0) return null;
  const value = signed.slice(0, dot);
  const given = Buffer.from(signed.slice(dot + 1));
  for (const secret of secrets) {
    if (!secret) continue;
    const expected = Buffer.from(hmac(value, secret));
    if (expected.length === given.length && timingSafeEqual(expected, given)) return value;
  }
  return null;
}

/** 256-bit random token for email links; only its hash is stored (SignedActionToken.tokenHash). */
export function generateToken(): string {
  return b64url(randomBytes(32));
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** Stable, non-reversible hash for logs/analytics (never log raw emails). */
export function hashIdentifier(value: string): string {
  return createHash("sha256").update(value.trim().toLowerCase()).digest("hex");
}
