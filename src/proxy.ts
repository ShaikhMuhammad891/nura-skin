import { clerkMiddleware } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

import {
  AUTH_COMPLETE_PATH,
  gate,
  GUEST_COOKIES,
  MFA_REQUIRED_PATH,
  type GateDecision,
} from "@/lib/auth-gate";

/**
 * Edge gate (docs/10 §5). Clerk resolves the session; `gate()` decides; this file only maps the
 * decision to a response. Not the security boundary for data: every entry point re-checks (10 §7).
 * Security headers / CSP nonce (18 §6) and consent-aware analytics cookies land in M9 / M4.
 */
export default clerkMiddleware(
  async (auth, request) => {
    const { pathname, search } = request.nextUrl;
    const session = await auth();

    const decision: GateDecision = gate({
      pathname,
      method: request.method,
      signedIn: session.userId !== null,
      claimRole: session.sessionClaims?.metadata?.role,
      fva: session.sessionClaims?.fva,
      hasGuestCookie: GUEST_COOKIES.some((name) => request.cookies.has(name)),
    });

    switch (decision.kind) {
      case "allow":
        return NextResponse.next();
      case "sign-in":
        return session.redirectToSignIn({ returnBackUrl: request.url });
      case "unauthenticated-json":
        return jsonError(401, "UNAUTHENTICATED", "Please sign in to continue.");
      case "not-found":
        // Rewrite (not redirect) to an unmatched path: non-staff see the designed 404, and the URL
        // doesn't reveal that an admin area exists.
        return NextResponse.rewrite(new URL("/404", request.url), { status: 404 });
      case "not-found-json":
        return jsonError(404, "NOT_FOUND", "We couldn't find what you were looking for.");
      case "mfa-required":
        return NextResponse.redirect(new URL(MFA_REQUIRED_PATH, request.url));
      case "reauth-required":
        return NextResponse.redirect(new URL(`${MFA_REQUIRED_PATH}?reason=reauth`, request.url));
      case "claim-guest-data": {
        const target = new URL(AUTH_COMPLETE_PATH, request.url);
        target.searchParams.set("next", `${pathname}${search}`);
        return NextResponse.redirect(target);
      }
    }
  },
  // Our own pages (not Clerk's hosted ones) for `redirectToSignIn`.
  { signInUrl: "/sign-in", signUpUrl: "/sign-up" },
);

function jsonError(status: number, code: string, message: string) {
  return NextResponse.json(
    { error: { code, message, requestId: crypto.randomUUID() } },
    { status, headers: { "cache-control": "no-store" } },
  );
}

export const config = {
  matcher: [
    // Skip Next.js internals and static files, unless found in search params.
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always run for API routes.
    "/(api|trpc)(.*)",
    // Clerk's Frontend API proxy path.
    "/__clerk/:path*",
  ],
};
