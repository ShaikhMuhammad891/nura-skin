import "server-only";

import { cookies } from "next/headers";

import { GUEST_CART_COOKIE } from "@/lib/auth-gate";
import { env } from "@/lib/env";
import { signValue, verifySignedValue } from "@/lib/server/signed-token";

/** Guest cart identity: signed, httpOnly cookie (docs/10 §4.2). */
export const CART_COOKIE = GUEST_CART_COOKIE;
const SIXTY_DAYS = 60 * 24 * 60 * 60;

export async function readGuestCartId(): Promise<string | null> {
  const raw = (await cookies()).get(CART_COOKIE)?.value;
  return verifySignedValue(raw, [env.COOKIE_SECRET, env.COOKIE_SECRET_PREVIOUS]);
}

export async function writeGuestCartId(cartId: string): Promise<void> {
  (await cookies()).set(CART_COOKIE, signValue(cartId, env.COOKIE_SECRET), {
    httpOnly: true,
    secure: env.NEXT_PUBLIC_SITE_URL.startsWith("https://"),
    sameSite: "lax",
    path: "/",
    maxAge: SIXTY_DAYS,
  });
}

export async function clearGuestCartId(): Promise<void> {
  (await cookies()).delete(CART_COOKIE);
}
