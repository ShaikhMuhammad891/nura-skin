# 18 — Security Plan

**Threat model scope:** a public e-commerce site handling PII (names, addresses, emails), health-adjacent data (finder conditions), payments (delegated to Stripe), staff back-office access and an LLM integration.
**Framework:** OWASP Top 10 (2021/2025), OWASP ASVS L2 as the target, and the OWASP Top 10 for LLM Applications for the finder.

---

## 1. Assets & threats (STRIDE summary)

| Asset                       | Key threats                                                | Primary controls                                                                          |
| --------------------------- | ---------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| Customer accounts           | Credential stuffing, ATO, session hijack                   | Clerk (breached-password checks, bot protection, MFA option), secure cookies, rate limits |
| Staff accounts (admin)      | Phishing, privilege escalation, insider misuse             | Mandatory MFA, step-up reverification, least-privilege RBAC, audit log, session timeout   |
| Orders / PII                | IDOR, enumeration, data leak via logs                      | Ownership checks (404), non-sequential IDs, lookup rate limits, PII log redaction         |
| Payments                    | Price tampering, webhook spoofing, replay, refund abuse    | Server-side pricing, signature verification, idempotency, refund limits and audit         |
| Inventory / coupons         | Race conditions, coupon brute-force                        | Row locks, reservations, coupon rate limits, generic errors                               |
| Health-adjacent finder data | Exposure, misuse in marketing                              | Consent, segregation, deletion, no PII to the LLM, restricted admin permission            |
| LLM feature                 | Prompt injection, cost abuse, harmful output, data leakage | Constrained output, validator, rate limits, semaphore, safety screen                      |
| Media uploads               | Malware, XSS via SVG, storage abuse                        | Signed uploads, format allowlist, size caps, no SVG uploads from users                    |
| Infrastructure secrets      | Leakage                                                    | Vercel env vars, Zod-validated env, restricted keys, secret scanning                      |

---

## 2. Authentication security

- **Delegated to Clerk:** password hashing, breached-password detection, brute-force lockout, email verification, OAuth, MFA, device/session management.
- **Staff:** MFA mandatory (app-enforced via the `fva` claim); step-up reverification for sensitive operations (10-auth §6); 2 h inactivity timeout; sessions revoked on a role change or offboarding.
- **Session cookies:** `__session` httpOnly, Secure, SameSite=Lax, short-lived JWT with rotation (Clerk).
- **Sign-up abuse:** Clerk bot protection (Turnstile); disposable email blocking (Clerk setting); rate limits.
- **Account enumeration:** sign-in and password-reset responses are generic (Clerk setting); guest order lookup always returns the same message.
- **Email change:** only via Clerk with verification of the new address; orders are claimed only by _verified_ email.

## 3. Authorization

- **Server-side on every entry point:** `createAction` / `createRoute` wrappers require an explicit `auth` level and, for staff, a `permission`. A route or action **cannot be registered without declaring its auth policy** (type-level requirement + a CI registry test).
- **Least privilege:** the role → permission matrix is in code (10-auth §7.3), reviewed via CODEOWNERS (the security owner must approve changes to `lib/permissions.ts`).
- **IDOR prevention:** all customer queries are scoped by `userId` in the `WHERE` clause (never "fetch by ID, then check"); ownership failures return 404; public order identifiers require email + number or a signed token.
- **Admin concealment:** non-staff get a 404 for `/admin/**` and `/api/v1/admin/**`.
- **Field-level protection:** DTO mappers with explicit `select` prevent over-exposure (`costCents`, `stripeCustomerId`, internal notes, sensitive profile fields).
- **Guard rails on privilege changes:** you cannot change your own role; you cannot remove the last ADMIN; role changes require step-up auth and are audit-logged.

## 4. Input validation & output encoding

- **Zod everywhere:** every action and route has input schemas (body, params, query). Strict objects (`.strict()`) reject unknown keys. Strings have length limits, numbers have ranges, and enums are closed.
- **Normalization:** trim, Unicode NFC, strip control characters; emails lowercased (citext in the DB).
- **Rich text:** product descriptions and legal pages are Markdown rendered with `rehype-sanitize` (allowlist); no raw HTML from users. Reviews are **plain text only** (escaped by React).
- **No `dangerouslySetInnerHTML`** except `JsonLd` (JSON-escaped with `<` → `<`) and the next-themes script. A lint rule enforces this.
- **SQL injection:** Prisma parameterizes queries; raw SQL only via tagged `$queryRaw` / TypedSQL (parameterized). `$queryRawUnsafe` is banned by lint.
- **File uploads:** signed Cloudinary uploads only; server-derived folder; `allowed_formats` jpg/png/webp/heic (users) and + avif (staff); **SVG uploads disallowed** (XSS risk); size caps (5 MB users / 10 MB staff); Cloudinary strips EXIF metadata (GPS privacy) via the `strip_profile` / `fl_strip_profile` transform on delivery.
- **Redirects:** `redirect_url` and `returnPath` values are validated against an allowlist of relative paths (open-redirect prevention).
- **CSV exports:** formula-injection protection. Cells starting with `= + - @` or tab/CR are prefixed with `'`.

## 5. API security

- **CSRF:** Server Actions use Next.js origin checks and `allowedOrigins`; REST mutations require `Content-Type: application/json` (not form-encodable without CORS preflight) + SameSite=Lax cookies + an Origin header check in `createRoute` for cookie-authenticated mutations.
- **CORS:** no CORS headers by default (same-origin only). Future mobile clients use bearer tokens, not cookies.
- **Rate limiting:** Upstash sliding windows per 09-api §2.7; keyed by userId, then IP (`ipAddress()` from `@vercel/functions`), then consultation/cart ID where relevant. The limiter fails open for browsing and fails closed for the AI endpoints (fallback engine) and coupons.
- **Idempotency:** `Idempotency-Key` on money/stock-affecting POSTs; Stripe idempotency keys.
- **Webhooks:** signature verification with the raw body, timestamp tolerance, event-ID dedupe, minimal error details.
- **Error handling:** no stack traces or DB errors in responses; `requestId` is returned for support correlation.
- **Pagination caps and query cost:** max page sizes; the date-range cap for analytics (400 days); a search query length cap; the `pg_trgm` similarity threshold avoids full scans.
- **Health endpoint:** returns only `ok`/`degraded`.
- **Versioned API:** deprecation headers for older versions.

## 6. HTTP security headers (set in middleware / `next.config.ts`)

| Header                       | Value                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| ---------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Content-Security-Policy`    | `default-src 'self'; script-src 'self' 'nonce-{n}' 'strict-dynamic' https://js.stripe.com https://*.clerk.accounts.dev https://challenges.cloudflare.com; frame-src https://js.stripe.com https://hooks.stripe.com https://checkout.stripe.com https://challenges.cloudflare.com; connect-src 'self' https://api.stripe.com https://*.clerk.accounts.dev https://*.clerk.com https://api.cloudinary.com https://*.sentry.io https://vitals.vercel-insights.com; img-src 'self' data: blob: https://res.cloudinary.com https://img.clerk.com https://*.stripe.com; style-src 'self' 'unsafe-inline'; font-src 'self'; worker-src 'self' blob:; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'; upgrade-insecure-requests` (Clerk domains are replaced with the custom Clerk frontend API domain in production) |
| `Strict-Transport-Security`  | `max-age=63072000; includeSubDomains; preload`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| `X-Content-Type-Options`     | `nosniff`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| `Referrer-Policy`            | `strict-origin-when-cross-origin`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| `Permissions-Policy`         | `camera=(), microphone=(), geolocation=(), payment=(self "https://js.stripe.com")`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `X-Frame-Options`            | `DENY` (legacy; CSP `frame-ancestors` is authoritative)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `Cross-Origin-Opener-Policy` | `same-origin-allow-popups` (OAuth popups)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |

CSP starts in `Report-Only` mode in staging with a report endpoint (Sentry), then is enforced before launch.

**Two-tier CSP (revised in review R-03).** A per-request nonce requires every HTML response to be rendered dynamically: Next.js must inject the nonce into its inline bootstrap scripts. That **disables static generation, ISR and the PPR static shell**, which directly contradicts the performance strategy (05 NFR-PERF, 06 §3.1). The policy is therefore split by route:

| Tier                  | Routes                                                                                                               | `script-src`                                                                                                                                                                                                                                  | Why it's acceptable                                                                                                                                                                                                                           |
| --------------------- | -------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Strict (nonce)**    | `/checkout/**`, `/account/**`, `/admin/**`, `/finder/results/**`, `/sign-in`, `/sign-up`, `/auth/**`, `/orders/view` | `'self' 'nonce-{n}' 'strict-dynamic'` + Stripe/Clerk/Turnstile hosts                                                                                                                                                                          | These routes are already dynamic (per-user) and handle payment, PII or admin power, so they get the strongest XSS protection                                                                                                                  |
| **Static-compatible** | Catalogue, content, home, finder steps                                                                               | `'self' 'unsafe-inline'` + an explicit host allowlist (Clerk, Vercel Insights); **no `'unsafe-eval'`**; with `object-src 'none'`, `base-uri 'self'`, `form-action 'self'`, `frame-ancestors 'none'`, and a restricted `connect-src`/`img-src` | These pages render no user-supplied HTML (reviews are React-escaped plain text, and Markdown is sanitized and staff-authored). The remaining directives still block framing, base-tag hijacking, form exfiltration and arbitrary connections. |

The middleware sets the header per route group. A future upgrade path is to adopt hash-based CSP / SRI for static pages if Next.js support for them becomes stable (`experimental.sri`), which would remove `'unsafe-inline'` without dynamic rendering. This decision is recorded as ADR-013.

## 7. Payment security

See 11 §11. In summary: SAQ A (Stripe-hosted fields), server-side pricing only, webhook verification, idempotency, restricted API keys, refund permissions, limits and step-up, Radar, and the nightly reconciliation job.

## 8. Data protection & privacy

| Control                            | Implementation                                                                                                                                                                                                                                    |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Encryption in transit              | TLS 1.2+ everywhere (Vercel, Neon, Clerk, Stripe, Cloudinary, Upstash)                                                                                                                                                                            |
| Encryption at rest                 | Neon (AES-256), Cloudinary, Upstash, Vercel, all provider-managed                                                                                                                                                                                 |
| Data minimization                  | We don't store card data, passwords, DOB or ethnicity. Phone is optional.                                                                                                                                                                         |
| Sensitive data (finder conditions) | Explicit consent; stored only in `RoutineConsultation.answers` and optionally `CustomerPreference`; only ADMIN (`customer:read_sensitive`) can view it; excluded from analytics and marketing exports; free-text notes are redacted after 90 days |
| LLM data handling                  | No PII sent; notes scrubbed of emails, phone numbers and URLs; the provider data-use policy and retention are documented in the privacy policy                                                                                                    |
| Logging                            | pino redaction paths (email, name, address, phone, notes, authorization headers, cookies); Sentry `beforeSend` scrubbing; user IDs are hashed in logs                                                                                             |
| Retention                          | Guest carts 60 days; guest consultations 12 months; raw analytics 13 months; webhook payload PII fields 30 days; audit logs 2 years; orders 7 years (tax/accounting)                                                                              |
| Data subject rights                | Export (JSON) and delete (anonymize orders, delete the profile, preferences, consultations and wishlist) via the account settings; also on request to support (audit-logged)                                                                      |
| Backups                            | Neon PITR; backups inherit encryption; restore drills quarterly (runbook)                                                                                                                                                                         |
| Staff access to production DB      | None by default. Break-glass read-only role with time-boxed credentials; all queries logged.                                                                                                                                                      |
| Environment separation             | Separate Clerk, Stripe (test accounts), Neon projects/branches, Cloudinary folders/environments, Resend domains per environment; production data never copied to preview (sanitized seeds only)                                                   |

## 9. Rate limiting & abuse prevention (summary)

| Abuse                                                        | Control                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| ------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Credential stuffing                                          | Clerk protections + our login-adjacent endpoint limits                                                                                                                                                                                                                                                                                                                                                                                       |
| Coupon brute force                                           | 10 attempts / 10 min per IP+cart; generic errors; alert on > 100 failures/hour globally                                                                                                                                                                                                                                                                                                                                                      |
| Order enumeration                                            | Email + number required; rate limit 5/15 min; identical responses                                                                                                                                                                                                                                                                                                                                                                            |
| Finder/LLM cost abuse                                        | Per-IP and per-consultation limits, global semaphore, daily cap → fallback, Turnstile after 3 consultations/hour from one IP                                                                                                                                                                                                                                                                                                                 |
| Review spam                                                  | Verified-purchase requirement, 5/day, moderation heuristics                                                                                                                                                                                                                                                                                                                                                                                  |
| Newsletter bombing                                           | Double opt-in, 5/h/IP, Turnstile                                                                                                                                                                                                                                                                                                                                                                                                             |
| Scraping                                                     | Browse limits (300/min), Vercel Firewall (bot rules) and attack-challenge mode available for spikes                                                                                                                                                                                                                                                                                                                                          |
| Card testing (at checkout)                                   | Stripe Radar, checkout session rate limits (10/10 min), Turnstile challenge after 3 failed sessions                                                                                                                                                                                                                                                                                                                                          |
| **Outbound email abuse (public demo; added in review R-16)** | Nothing sends email to an address the sender hasn't proven they own, except order confirmations (the address was entered in Stripe Checkout, which requires a completed test payment). "Email me this routine" is signed-in only (verified email). The newsletter is double opt-in, and the confirmation email is rate limited per address (1/24 h) and per IP. A global Resend send cap per hour alerts and pauses non-transactional sends. |
| **Client IP spoofing for rate limits**                       | IPs come from `ipAddress(request)` in `@vercel/functions` (derived from Vercel's trusted header), never from a raw client-supplied `x-forwarded-for` chain                                                                                                                                                                                                                                                                                   |
| **Demo account misuse**                                      | `DEMO_STAFF` role with rolled-back mutations, demo-only data scope and short sessions (10 §9b)                                                                                                                                                                                                                                                                                                                                               |

## 10. Common attack prevention (OWASP mapping)

| OWASP risk                         | Controls                                                                                                                          |
| ---------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| A01 Broken access control          | Server-side permission checks per endpoint, ownership scoping, 404 policy, registry tests per role                                |
| A02 Cryptographic failures         | TLS, provider encryption, HMAC-signed cookies/tokens (SHA-256), hashed tokens at rest, no custom crypto                           |
| A03 Injection                      | Prisma parameterization, raw SQL restrictions, Zod validation, React escaping, sanitized Markdown, CSV injection guard            |
| A04 Insecure design                | Threat model (this doc), state machines, reservation/idempotency patterns, LLM constraints                                        |
| A05 Security misconfiguration      | Headers/CSP, env validation at boot, no debug in production, Clerk/Stripe config reviewed in the checklist                        |
| A06 Vulnerable components          | Renovate (weekly, grouped), `pnpm audit` + GitHub Dependabot alerts, lockfile, CodeQL in CI                                       |
| A07 Identification & auth failures | Clerk, MFA for staff, session revocation, step-up auth                                                                            |
| A08 Software & data integrity      | Signed webhooks, locked CI actions (pinned SHAs), protected branches, required reviews, Vercel deployment protection for previews |
| A09 Logging & monitoring failures  | Audit log, Sentry alerts, security event alerts (see §12)                                                                         |
| A10 SSRF                           | No server-side fetch of user-supplied URLs; Cloudinary upload by signed client upload, not by URL                                 |

### LLM-specific (OWASP LLM Top 10)

| Risk                            | Controls                                                                                                                                                      |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| LLM01 Prompt injection          | Notes delimited and declared as data; no tools/function calling; constrained structured output with ID enums; validator; no rendering of model output as HTML |
| LLM02 Sensitive info disclosure | No PII or secrets in prompts; the system prompt holds no secrets; output text filter                                                                          |
| LLM05 Improper output handling  | Output is parsed by schema, validated and escaped; IDs are resolved against the DB                                                                            |
| LLM06 Excessive agency          | The model cannot act; it only selects from candidates                                                                                                         |
| LLM09 Misinformation            | Numbers only from the data; the claims lexicon; the glossary; the eval suite                                                                                  |
| LLM10 Unbounded consumption     | Rate limits, semaphore, max_tokens, timeouts, daily cap                                                                                                       |

## 11. Secure development lifecycle

- **Branch protection:** PRs required, 1 approval, green CI, no force pushes to `main`.
- **CI security steps:** typecheck, ESLint security rules (`eslint-plugin-security`, custom bans), CodeQL, dependency audit, **gitleaks** secret scanning, the permission registry test, and a CSP check (the header snapshot test).
- **Secrets:** only in Vercel env / GitHub encrypted secrets; `.env.example` has no values; `env.ts` fails the build if server secrets are referenced from client code (`NEXT_PUBLIC_` separation).
- **Reviews:** CODEOWNERS on `lib/server/**`, `features/payments/**`, `lib/permissions.ts`, `middleware.ts` and `prisma/migrations/**`.
- **Pre-launch:** OWASP ZAP baseline scan against staging; a manual pentest checklist (IDOR on every resource, role matrix, webhook forgery, coupon races, checkout tampering, upload abuse, prompt injection suite).

## 12. Security monitoring & incident response

| Signal                                         | Alert                                                           |
| ---------------------------------------------- | --------------------------------------------------------------- |
| Staff sign-in from a new country/device        | Email to ADMIN (from the Clerk `session.created` webhook + geo) |
| Role changes, refunds > $200, bulk exports     | Real-time Slack/email notification                              |
| Webhook signature failures > 10/hour           | Sentry alert                                                    |
| Rate-limit hits spike (coupon, lookup, finder) | Upstash analytics → alert                                       |
| CSP violations                                 | Sentry report aggregation                                       |
| Unexpected 5xx rate > 1%                       | Sentry/Vercel alert                                             |

**Incident runbook** (`docs/runbooks/incident.md`, created in M9): triage → contain (rotate keys, revoke sessions, disable features via settings/kill switches: `finder.enabled`, `checkout.enabled`) → eradicate → recover → postmortem within 5 business days. **Key rotation procedure** covers Clerk, Stripe, Resend, Cloudinary, Upstash, Anthropic, `COOKIE_SECRET` (dual-key validation window) and `TOKEN_SECRET`.

## 13. Security launch checklist

- [ ] All endpoints are registered with auth policies; the role-matrix tests pass
- [ ] CSP enforced; headers verified (securityheaders.com grade A)
- [ ] Stripe webhook and Clerk webhook signature tests pass; replay tests pass
- [ ] Staff MFA enforced; step-up reverification on sensitive actions
- [ ] Rate limits configured and tested
- [ ] PII redaction verified in logs and Sentry
- [ ] Upload restrictions verified (SVG rejected; size caps)
- [ ] Prompt-injection eval cases pass (100%)
- [ ] ZAP baseline: no high/medium findings open
- [ ] Privacy policy, cookie consent and data export/delete are working
- [ ] Secrets rotated from development values; restricted Stripe key in use
