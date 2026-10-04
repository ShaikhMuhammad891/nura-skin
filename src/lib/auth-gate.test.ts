import { describe, expect, it } from "vitest";

import {
  authCompleteUrl,
  gate,
  nextFromRedirectUrl,
  safeNextPath,
  type GateInput,
} from "./auth-gate";

const base: GateInput = {
  pathname: "/",
  method: "GET",
  signedIn: false,
  claimRole: undefined,
  fva: undefined,
  hasGuestCookie: false,
};
const decide = (overrides: Partial<GateInput>) => gate({ ...base, ...overrides }).kind;

const MFA_OK = [5, 5] as const;
const NO_MFA = [5, -1] as const;

describe("gate: public and protected routes (docs/10 §5)", () => {
  it.each(["/", "/shop", "/products/x", "/sign-in", "/api/health", "/api/webhooks/clerk"])(
    "%s is public for guests",
    (pathname) => expect(decide({ pathname })).toBe("allow"),
  );

  it.each(["/account", "/account/orders/1"])("%s sends guests to sign-in", (pathname) => {
    expect(decide({ pathname })).toBe("sign-in");
    expect(decide({ pathname, signedIn: true, claimRole: "CUSTOMER" })).toBe("allow");
  });

  it.each(["/api/v1/me", "/api/v1/wishlist/items", "/api/v1/subscriptions/sub_1"])(
    "%s returns 401 JSON for guests",
    (pathname) => expect(decide({ pathname })).toBe("unauthenticated-json"),
  );

  it("keeps signed email-token subscription actions public", () => {
    expect(decide({ pathname: "/api/v1/subscriptions/actions/tok_123" })).toBe("allow");
  });

  it("protects review creation but not review reads", () => {
    expect(decide({ pathname: "/api/v1/reviews", method: "POST" })).toBe("unauthenticated-json");
    expect(decide({ pathname: "/api/v1/reviews" })).toBe("allow");
  });

  it("does not treat look-alike prefixes as protected", () => {
    expect(decide({ pathname: "/accounting" })).toBe("allow");
    expect(decide({ pathname: "/administrators" })).toBe("allow");
  });
});

describe("gate: admin concealment and MFA (docs/10 §5–6)", () => {
  it("hides admin from guests and customers as a 404", () => {
    expect(decide({ pathname: "/admin" })).toBe("not-found");
    expect(decide({ pathname: "/admin/orders", signedIn: true, claimRole: "CUSTOMER" })).toBe(
      "not-found",
    );
    expect(decide({ pathname: "/api/v1/admin/orders", signedIn: true })).toBe("not-found-json");
  });

  it("ignores unknown or malformed role claims", () => {
    for (const claimRole of ["SUPERUSER", "admin", 42, { key: "ADMIN" }, null]) {
      expect(decide({ pathname: "/admin", signedIn: true, claimRole, fva: MFA_OK })).toBe(
        "not-found",
      );
    }
  });

  it.each(["ADMIN", "SUPPORT", "MARKETING_MANAGER", "INVENTORY_MANAGER"])(
    "%s needs a verified second factor",
    (claimRole) => {
      const staff = { pathname: "/admin", signedIn: true, claimRole };
      expect(decide({ ...staff, fva: NO_MFA })).toBe("mfa-required");
      expect(decide({ ...staff, fva: undefined })).toBe("mfa-required");
      expect(decide({ ...staff, fva: MFA_OK })).toBe("allow");
    },
  );

  it("lets staff without MFA reach the MFA page itself (no redirect loop)", () => {
    expect(
      decide({ pathname: "/admin/mfa-required", signedIn: true, claimRole: "ADMIN", fva: NO_MFA }),
    ).toBe("allow");
  });

  it("requires a fresh first factor (≤ 12 h) for admin pages", () => {
    const staff = { pathname: "/admin", signedIn: true, claimRole: "ADMIN" };
    expect(decide({ ...staff, fva: [720, 5] })).toBe("allow");
    expect(decide({ ...staff, fva: [721, 5] })).toBe("reauth-required");
  });

  it("rejects admin API calls without MFA or with a stale session as 404 JSON", () => {
    const staff = { pathname: "/api/v1/admin/orders", signedIn: true, claimRole: "ADMIN" };
    expect(decide({ ...staff, fva: NO_MFA })).toBe("not-found-json");
    expect(decide({ ...staff, fva: [800, 5] })).toBe("not-found-json");
    expect(decide({ ...staff, fva: MFA_OK })).toBe("allow");
  });

  it("exempts demo staff from MFA (no real write capability, ADR-0016)", () => {
    expect(decide({ pathname: "/admin", signedIn: true, claimRole: "DEMO_STAFF" })).toBe("allow");
  });
});

describe("gate: guest data claim detour (docs/10 §4.1)", () => {
  const signedInWithCart = { signedIn: true, claimRole: "CUSTOMER", hasGuestCookie: true };

  it("routes signed-in page views carrying guest cookies through /auth/complete", () => {
    expect(decide({ ...signedInWithCart, pathname: "/shop" })).toBe("claim-guest-data");
  });

  it("never detours the claim hop, auth pages, APIs or non-GET requests", () => {
    for (const pathname of ["/auth/complete", "/sign-in", "/sign-up/verify", "/api/v1/cart"]) {
      expect(decide({ ...signedInWithCart, pathname })).toBe("allow");
    }
    expect(decide({ ...signedInWithCart, pathname: "/shop", method: "POST" })).toBe("allow");
  });

  it("ignores guest cookies for guests", () => {
    expect(decide({ pathname: "/shop", hasGuestCookie: true })).toBe("allow");
  });
});

describe("redirect targets (no open redirects)", () => {
  it.each([
    [null, "/"],
    ["", "/"],
    ["/account?tab=orders", "/account?tab=orders"],
    ["https://evil.example/x", "/"],
    ["//evil.example/x", "/"],
    ["/\\evil.example", "/"],
    ["account", "/"],
    ["/auth/complete?next=/x", "/"],
  ])("safeNextPath(%j) → %s", (input, expected) => {
    expect(safeNextPath(input)).toBe(expected);
  });

  it("keeps same-origin absolute redirect_url values as paths", () => {
    const origin = "http://localhost:3000";
    expect(nextFromRedirectUrl("http://localhost:3000/account?x=1", origin)).toBe("/account?x=1");
    expect(nextFromRedirectUrl("https://evil.example/account", origin)).toBe("/");
    expect(nextFromRedirectUrl("/admin", origin)).toBe("/admin");
    expect(nextFromRedirectUrl("http://[bad", origin)).toBe("/");
  });

  it("builds the claim-hop URL with an encoded, sanitized next", () => {
    expect(authCompleteUrl("/account?tab=orders")).toBe(
      "/auth/complete?next=%2Faccount%3Ftab%3Dorders",
    );
    expect(authCompleteUrl("https://evil.example")).toBe("/auth/complete?next=%2F");
  });
});
