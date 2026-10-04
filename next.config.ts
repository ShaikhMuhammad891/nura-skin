import type { NextConfig } from "next";

/**
 * Static-tier security headers (ADR-0013).
 * The strict nonce-based CSP for checkout/account/admin/auth is set per request in the
 * proxy (added in M2). This static-tier policy must not require dynamic rendering.
 * CSP is production-only: the dev server needs eval for React Refresh.
 */
const isProd = process.env.NODE_ENV === "production";
// `upgrade-insecure-requests` only when served over HTTPS: WebKit (unlike Chromium) does not
// exempt localhost, so on plain-HTTP origins it rewrites every stylesheet/script to https:// and
// the page renders unstyled. Production is HTTPS-only (plus HSTS), so nothing is lost.
const servedOverHttps = (process.env.NEXT_PUBLIC_SITE_URL ?? "").startsWith("https://");

/**
 * Clerk's Frontend API host is encoded in the publishable key (`pk_<env>_<base64(host$)>`), so the
 * CSP allows exactly this instance (dev: *.clerk.accounts.dev, prod: clerk.<our domain>).
 */
function clerkFrontendApiOrigin(): string {
  const key = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ?? "";
  const encoded = key.split("_")[2] ?? "";
  const host = Buffer.from(encoded, "base64").toString("utf8").replace(/\$$/, "");
  return /^[a-z0-9.-]+$/i.test(host) ? `https://${host}` : "";
}
const clerk = clerkFrontendApiOrigin();
// Clerk bot protection on sign-up runs Cloudflare Turnstile in an iframe (docs/10 §2).
const turnstile = "https://challenges.cloudflare.com";
// Stripe.js + Embedded Checkout iframes (docs/11 §1: card data stays inside Stripe's frames).
const stripeJs = "https://js.stripe.com";
const stripeFrames = "https://js.stripe.com https://checkout.stripe.com https://hooks.stripe.com";

const staticTierCsp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline' ${clerk} ${turnstile} ${stripeJs}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://res.cloudinary.com https://img.clerk.com https://*.stripe.com",
  "font-src 'self'",
  `connect-src 'self' https://vitals.vercel-insights.com ${clerk} https://api.stripe.com https://checkout.stripe.com`,
  `frame-src ${turnstile} ${stripeFrames}`,
  "worker-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  ...(servedOverHttps ? ["upgrade-insecure-requests"] : []),
].join("; ");

const securityHeaders = [
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "DENY" },
  {
    key: "Permissions-Policy",
    value: 'camera=(), microphone=(), geolocation=(), payment=(self "https://js.stripe.com")',
  },
  ...(isProd ? [{ key: "Content-Security-Policy", value: staticTierCsp }] : []),
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // Cache Components ("use cache", cacheTag, cacheLife, PPR). See 06 §3.1.
  cacheComponents: true,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
