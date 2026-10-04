import { clerkMiddleware } from "@clerk/nextjs/server";
import { type NextFetchEvent, type NextRequest, NextResponse } from "next/server";

import { LEGAL_DOCS } from "@/features/marketing/legal";
import { catalogDecision, catalogPath } from "@/lib/catalog-gate";
import {
  AUTH_COMPLETE_PATH,
  gate,
  GUEST_COOKIES,
  MFA_REQUIRED_PATH,
  type GateDecision,
} from "@/lib/auth-gate";
import { getSlugIndex } from "@/lib/server/slug-index";

const LEGAL_SLUGS = new Set(LEGAL_DOCS.map((d) => d.slug));
const DISCONTINUED_PATH = "/discontinued";

/**
 * Catalogue status gate (ADR-0020): real 404 / 410 / 308 for catalogue slugs, decided before the
 * page streams its static shell. GET/HEAD only (Server Actions POST to these paths). Fails open.
 */
/**
 * 410 Gone with the static ER2 page as the body (docs/15 §8). Next ignores a custom status on
 * rewrites, so the proxy produces the response itself; retired URLs are rare, and the target is a
 * prerendered static page. Falls back to a plain rewrite (200 + noindex) if the fetch fails.
 */
async function goneResponse(request: NextRequest): Promise<NextResponse> {
  const target = new URL(DISCONTINUED_PATH, request.url);
  try {
    const page = await fetch(target, { headers: { accept: "text/html" }, cache: "no-store" });
    if (page.ok) {
      return new NextResponse(request.method === "HEAD" ? null : page.body, {
        status: 410,
        headers: {
          "content-type": page.headers.get("content-type") ?? "text/html; charset=utf-8",
          "cache-control": "public, max-age=0, s-maxage=3600",
        },
      });
    }
  } catch {
    // fall through
  }
  return NextResponse.rewrite(target);
}

async function catalogResponse(request: NextRequest): Promise<NextResponse | null> {
  if (request.method !== "GET" && request.method !== "HEAD") return null;
  if (!catalogPath(request.nextUrl.pathname)) return null;
  const index = await getSlugIndex();
  if (!index) return null;
  const decision = catalogDecision(request.nextUrl.pathname, { ...index, legal: LEGAL_SLUGS });
  switch (decision.kind) {
    case "allow":
      return null;
    case "not-found":
      return NextResponse.rewrite(new URL("/404", request.url), { status: 404 });
    case "gone":
      return goneResponse(request);
    case "redirect": {
      const target = new URL(decision.to, request.url);
      target.search = request.nextUrl.search;
      return NextResponse.redirect(target, 308);
    }
  }
}

/**
 * Edge gate (docs/10 §5). Clerk resolves the session; `gate()` decides; this file only maps the
 * decision to a response. Not the security boundary for data: every entry point re-checks (10 §7).
 * Security headers / CSP nonce (18 §6) and consent-aware analytics cookies land in M9 / M4.
 */
const clerkProxy = clerkMiddleware(
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
        return (await catalogResponse(request)) ?? NextResponse.next();
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

export default function proxy(request: NextRequest, event: NextFetchEvent) {
  // The static ER2 page needs no session. Skipping Clerk also lets `goneResponse` fetch it: a
  // Clerk development instance answers cookie-less HTML requests with a handshake redirect.
  if (request.nextUrl.pathname === DISCONTINUED_PATH) return NextResponse.next();
  return clerkProxy(request, event);
}

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
