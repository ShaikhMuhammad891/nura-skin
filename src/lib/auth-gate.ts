import { isStaffRole, ROLE_KEYS, type RoleKey } from "./permissions";

/**
 * Proxy gate decisions (docs/10 §5). Pure so the whole route table is unit-testable; `src/proxy.ts`
 * only maps a decision to a response. This is the coarse first gate: every page, action and route
 * re-checks against the DB role (10 §7).
 */
export type GateInput = {
  pathname: string;
  method: string;
  signedIn: boolean;
  /** Role mirrored into the session token (`metadata.role`); untrusted beyond this gate. */
  claimRole: unknown;
  /** Clerk `fva`: minutes since first/second factor verification; second is -1 when none. */
  fva?: readonly [number, number];
  /** A signed-in page request still carrying a guest cookie (claimed via /auth/complete). */
  hasGuestCookie: boolean;
};

export type GateDecision =
  | { kind: "allow" }
  | { kind: "sign-in" }
  | { kind: "unauthenticated-json" }
  | { kind: "not-found" }
  | { kind: "not-found-json" }
  | { kind: "mfa-required" }
  | { kind: "reauth-required" }
  | { kind: "claim-guest-data" };

/** Admin sessions must have verified the first factor within 12 h (10 §2, review R-14). */
export const ADMIN_FIRST_FACTOR_MAX_MINUTES = 720;

export const MFA_REQUIRED_PATH = "/admin/mfa-required";
export const AUTH_COMPLETE_PATH = "/auth/complete";

/** Guest identity cookies claimed into the account at sign-in (10 §4.2). */
export const GUEST_CART_COOKIE = "nura_cart";
export const GUEST_CONSULT_COOKIE = "nura_consult";
export const GUEST_COOKIES = [GUEST_CART_COOKIE, GUEST_CONSULT_COOKIE] as const;

const ALLOW: GateDecision = { kind: "allow" };

const matches = (pathname: string, prefix: string) =>
  pathname === prefix || pathname.startsWith(`${prefix}/`);

const isApi = (pathname: string) => matches(pathname, "/api");

function isProtectedRoute(pathname: string, method: string): boolean {
  if (matches(pathname, "/api/v1/subscriptions/actions")) return false; // signed email tokens
  return (
    matches(pathname, "/account") ||
    matches(pathname, "/api/v1/me") ||
    matches(pathname, "/api/v1/wishlist") ||
    matches(pathname, "/api/v1/subscriptions") ||
    (pathname === "/api/v1/reviews" && method === "POST")
  );
}

const isAdminRoute = (pathname: string) =>
  matches(pathname, "/admin") || matches(pathname, "/api/v1/admin");

/** Paths where a guest-claim detour would loop or break a flow. */
function isClaimExempt(pathname: string): boolean {
  return (
    isApi(pathname) ||
    matches(pathname, AUTH_COMPLETE_PATH) ||
    matches(pathname, "/sign-in") ||
    matches(pathname, "/sign-up")
  );
}

export function parseClaimRole(value: unknown): RoleKey | null {
  return typeof value === "string" && (ROLE_KEYS as readonly string[]).includes(value)
    ? (value as RoleKey)
    : null;
}

export function gate(input: GateInput): GateDecision {
  const { pathname, method, signedIn } = input;
  const api = isApi(pathname);

  if (isAdminRoute(pathname)) {
    const role = parseClaimRole(input.claimRole);
    if (!signedIn || !isStaffRole(role)) return { kind: api ? "not-found-json" : "not-found" };
    // Demo staff can't mutate anything real, so they're exempt from MFA (ADR-0016).
    if (role === "DEMO_STAFF" || matches(pathname, MFA_REQUIRED_PATH)) return ALLOW;
    const [firstFactorAge, secondFactorAge] = input.fva ?? [-1, -1];
    const stale = firstFactorAge === -1 || firstFactorAge > ADMIN_FIRST_FACTOR_MAX_MINUTES;
    if (api) return secondFactorAge === -1 || stale ? { kind: "not-found-json" } : ALLOW;
    if (secondFactorAge === -1) return { kind: "mfa-required" };
    if (stale) return { kind: "reauth-required" };
    return ALLOW;
  }

  if (isProtectedRoute(pathname, method) && !signedIn) {
    return { kind: api ? "unauthenticated-json" : "sign-in" };
  }

  if (signedIn && input.hasGuestCookie && method === "GET" && !isClaimExempt(pathname)) {
    return { kind: "claim-guest-data" };
  }

  return ALLOW;
}

/**
 * Post-auth redirect target: same-origin relative paths only (no open redirects, no loops).
 */
export function safeNextPath(value: string | null | undefined, fallback = "/"): string {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) {
    return fallback;
  }
  if (matches(value.split(/[?#]/)[0] ?? "", AUTH_COMPLETE_PATH)) return fallback;
  return value;
}

/**
 * Clerk passes `redirect_url` as an absolute URL; keep only same-origin targets, as a path.
 */
export function nextFromRedirectUrl(value: string | null | undefined, origin: string): string {
  if (!value) return "/";
  try {
    const url = new URL(value, origin);
    if (url.origin !== new URL(origin).origin) return "/";
    return safeNextPath(`${url.pathname}${url.search}`);
  } catch {
    return "/";
  }
}

/** Where Clerk sends the user after sign-in/up: always through the claim hop. */
export function authCompleteUrl(next: string): string {
  return `${AUTH_COMPLETE_PATH}?next=${encodeURIComponent(safeNextPath(next))}`;
}
