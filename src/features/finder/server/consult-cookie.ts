import "server-only";

import { cookies } from "next/headers";

import { GUEST_CONSULT_COOKIE } from "@/lib/auth-gate";
import { env } from "@/lib/env";
import { signValue, verifySignedValue } from "@/lib/server/signed-token";

/**
 * Guest finder identity (docs/10 §4.2): a signed, httpOnly anonymous id shared by a guest's
 * consultations. Claimed into the account by `/auth/complete` at sign-in.
 */
const NINETY_DAYS = 90 * 24 * 60 * 60;

export async function readAnonymousId(): Promise<string | null> {
  const raw = (await cookies()).get(GUEST_CONSULT_COOKIE)?.value;
  return verifySignedValue(raw, [env.COOKIE_SECRET, env.COOKIE_SECRET_PREVIOUS]);
}

/** The existing anonymous id, or a new one persisted in the cookie (Server Actions only). */
export async function ensureAnonymousId(): Promise<string> {
  const existing = await readAnonymousId();
  if (existing) return existing;
  const id = crypto.randomUUID();
  (await cookies()).set(GUEST_CONSULT_COOKIE, signValue(id, env.COOKIE_SECRET), {
    httpOnly: true,
    secure: env.NEXT_PUBLIC_SITE_URL.startsWith("https://"),
    sameSite: "lax",
    path: "/",
    maxAge: NINETY_DAYS,
  });
  return id;
}
