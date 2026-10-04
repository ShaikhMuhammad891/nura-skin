import { NextResponse, type NextRequest } from "next/server";

import { readGuestCartId } from "@/features/cart/server/cart-cookie";
import { mergeGuestCart } from "@/features/cart/server/service";
import { readAnonymousId } from "@/features/finder/server/consult-cookie";
import { claimGuestConsultations } from "@/features/finder/server/service";
import { claimOrdersByVerifiedEmail, upsertFromClerk } from "@/features/users/server/service";
import { GUEST_COOKIES, safeNextPath } from "@/lib/auth-gate";
import { getCurrentClerkIdentity } from "@/lib/server/clerk";
import { db } from "@/lib/server/db";
import { logger } from "@/lib/server/logger";

/**
 * Post sign-in/sign-up hop (docs/10 §4.1, ADR-0015). A Route Handler because claiming guest data
 * must delete cookies, which Server Components can't. Every step is idempotent, so a reload or a
 * second tab is harmless.
 */
export async function GET(request: NextRequest) {
  const next = safeNextPath(request.nextUrl.searchParams.get("next"));
  const redirectTo = (path: string) => NextResponse.redirect(new URL(path, request.url), 303);

  const identity = await getCurrentClerkIdentity();
  if (!identity) {
    return redirectTo(`/sign-in?redirect_url=${encodeURIComponent(next)}`);
  }

  const log = logger.child({ route: "auth.complete" });
  try {
    const user = await upsertFromClerk(db, identity);
    if (!user.deletedAt) {
      const guestCartId = await readGuestCartId();
      if (guestCartId) {
        const result = await mergeGuestCart(db, guestCartId, user.id);
        log.info({ userId: user.id, ...result }, "guest cart claimed");
      }
      const anonymousId = await readAnonymousId();
      if (anonymousId) {
        const claimed = await claimGuestConsultations(db, anonymousId, user.id);
        if (claimed > 0) log.info({ userId: user.id, claimed }, "guest consultations claimed");
      }
      // Only a verified email may claim guest orders (prevents order-history takeover, 10 §4.3).
      if (identity.emailVerified && identity.email) {
        const claimed = await claimOrdersByVerifiedEmail(db, user.id, identity.email);
        if (claimed > 0) log.info({ userId: user.id, claimed }, "guest orders claimed");
      }
    }
  } catch (error) {
    // Don't strand the user on an error page: the claim is best-effort and retried by the webhook
    // (user sync) or a later sign-in (orders). Losing a guest cart beats a redirect loop.
    log.error({ err: error }, "guest data claim failed");
  }

  // Always clear guest cookies, even invalid ones, so the proxy's claim detour can't loop.
  const response = redirectTo(next);
  for (const name of GUEST_COOKIES) {
    if (request.cookies.has(name)) response.cookies.delete(name);
  }
  return response;
}
