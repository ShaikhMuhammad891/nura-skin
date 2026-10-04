# 10 — Authentication & Authorization Design

## 1. Goals

1. **No credential liability.** We never store passwords, MFA secrets or OAuth tokens. Clerk owns authentication.
2. **Guest-first commerce.** Browsing, the finder and one-time checkout work without an account. An account is required only for subscriptions, reviews, wishlist and saved routines.
3. **Least privilege for staff.** Permissions are fine-grained, checked server-side on every mutation, and MFA is mandatory.
4. **Defense in depth.** Middleware is only the first gate. Pages, Server Actions and route handlers each re-check.

---

## 2. Identity provider: Clerk configuration

| Setting                  | Value                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | Reason                                              |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------- |
| Sign-in methods          | Email + password, email verification code; Google OAuth; Apple OAuth                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | Matches the persona devices (iPhone-heavy)          |
| Passwords                | Clerk defaults + breached-password detection (HIBP) + min length 10                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |                                                     |
| Email verification       | Required at sign-up                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | Prevents order-history claims via unverified emails |
| MFA                      | Optional for customers (TOTP, backup codes); **required for staff** (enforced in the app, see §6)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |                                                     |
| Bot protection           | Clerk bot protection (Cloudflare Turnstile) on sign-up                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |                                                     |
| Session lifetime         | Instance-level Clerk settings (they cannot differ per role): 7-day maximum lifetime, 24 h inactivity timeout. **Staff get stricter rules enforced in the app** (revised in review R-14; the session token has no reliable "last active" claim, so per-role _inactivity_ timeouts aren't implementable). Admin routes require the first factor to be ≤ 12 h old (`fva[0] ≤ 720` minutes) or the staff member is sent to re-authenticate. Sensitive actions require step-up reverification ≤ 10 min (§6). The admin UI also runs a client idle timer (30 min) that signs out on inactivity; this is UX hardening on top of server enforcement. |                                                     |
| Session token            | Short-lived JWT (60 s) in the `__session` cookie, auto-refreshed; `__client` on Clerk's domain                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | Standard Clerk                                      |
| Custom session claims    | `{ "metadata": "{{user.public_metadata}}" }` → gives `sessionClaims.metadata.role`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | Role available at the edge without a DB call        |
| Allowed redirect origins | Production domain, preview domain pattern, localhost                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | Prevents open redirects                             |
| Organizations            | Not used (single-tenant store)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |                                                     |
| Webhooks                 | `user.created`, `user.updated`, `user.deleted`, `session.created` → `/api/webhooks/clerk`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |                                                     |

**Trust boundary:** Clerk `publicMetadata` can only be written by our backend (Clerk Backend API with the secret key), never by the client. Clerk's `unsafeMetadata` is never read for authorization.

---

## 3. Identity model

```
Clerk User (auth)  ──1:1──  User (our DB, domain)  ──*:1── Role
   id ────────────────────► clerkId
   primary email ─────────► email (synced)
   publicMetadata.role ◄─── Role.key (DB is source of truth; mirrored to Clerk)
```

**Why roles live in our DB _and_ Clerk metadata (ADR-006)**

- The DB is the source of truth: it is auditable, joinable, and the admin UI changes it inside a transaction with an AuditLog entry.
- The Clerk mirror allows **edge-level route gating** in middleware (no DB call from the edge).
- Consistency (revised in review R-13; never call external APIs inside a DB transaction, because it holds row locks for network-latency time and can't be rolled back atomically anyway):
  1. The DB transaction updates `User.roleId` + AuditLog + an `OutboxEvent(user.role_changed)`, then commits.
  2. The outbox handler calls `clerkClient.users.updateUserMetadata` (retried with backoff until it succeeds), then **revokes the target user's sessions**.
  3. During the brief lag, the DB is authoritative for every server action and route (they read the DB role). The stale claim only affects the coarse middleware gate: a **demoted** user might still see the admin shell, but every data load and mutation is denied. For demotions, the handler revokes sessions first, then updates metadata, which minimizes that window.
  4. A nightly job compares DB roles with Clerk metadata and repairs drift.
- Server-side authorization **always reads the DB role** (via `getCurrentUser()`, cached per request). The claim is used only for the coarse middleware gate. A stale claim therefore cannot grant access to a mutation.

---

## 4. Authentication flows

### 4.1 Sign-up / sign-in (customer)

1. The user opens `/sign-up` (Clerk `<SignUp/>` styled via `appearance` using our design tokens).
2. Clerk verifies the email or OAuth, creates a session and redirects to **`/auth/complete?next=<allowlisted path>`** (configured as Clerk's `forceRedirectUrl` / `signUpForceRedirectUrl`).
3. `user.created` webhook → `UserService.upsertFromClerk()` → User(role=CUSTOMER), Wishlist.
4. **`/auth/complete` is a Route Handler (GET)** (revised in review R-10). Server Components cannot set or delete cookies, so guest-data claiming cannot run inside `getCurrentUser()` during an RSC render. The handler:
   - JIT-upserts the User if the webhook hasn't landed yet (idempotent on `clerkId` UQ);
   - if guest cookies exist (`nura_cart`, `nura_consult`) → runs `claimGuestData()` (merge cart, attach consultations, link orders by verified email) and **deletes the guest cookies**;
   - redirects (303) to `next`.
5. `getCurrentUser()` (used in RSC) is **read-only**: it finds the User by `clerkId`, and falls back to a read-only JIT upsert (DB write only, no cookie changes) if needed. Safety net: if a signed-in request still carries guest cookies (for example the sign-in happened in another tab), middleware redirects page navigations once through `/auth/complete`.

### 4.2 Guest identity

| Cookie         | Content                                                                                                                                                                                                                                                 | Flags                                                         | TTL           |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- | ------------- |
| `nura_sid`     | Random session ID (analytics). **Non-essential**: set only after analytics consent in consent-required regions (EU/UK/CH by Vercel geo); in the US it is set by default with an opt-out in the footer ("Your privacy choices"). Revised in review R-15. | `Secure; SameSite=Lax`, **not** httpOnly (read by the beacon) | 13 months max |
| `nura_cart`    | `cartId.signature` (HMAC-SHA256 with `COOKIE_SECRET`)                                                                                                                                                                                                   | `httpOnly; Secure; SameSite=Lax; Path=/`                      | 60 days       |
| `nura_consult` | `anonymousId.signature`                                                                                                                                                                                                                                 | `httpOnly; Secure; SameSite=Lax`                              | 30 days       |
| `nura_consent` | JSON consent categories                                                                                                                                                                                                                                 | `Secure; SameSite=Lax`                                        | 12 months     |

A guest cannot access another guest's cart or consultation. The ID alone is not enough; the HMAC signature must verify.

### 4.3 Guest checkout → account

- A guest pays one-time orders with the email typed in Stripe Checkout. The Order stores `email` and `userId = null`.
- The confirmation page and email offer "Create an account to track your order". The sign-up is prefilled with the email. After email verification, `claimOrdersByVerifiedEmail()` links all guest orders with that email (verified email only, which prevents account takeover of order history).

### 4.4 Subscriptions require an account

Stripe subscriptions need a durable customer relationship, and self-service management needs auth. When a guest has subscription lines at checkout → 409 `ACCOUNT_REQUIRED_FOR_SUBSCRIPTION` → the UI shows a modal "Create a free account to manage your Routine Plan" with inline Clerk sign-up → then continues to checkout with the cart preserved and merged.

### 4.5 Email deep links (signed action tokens)

For "Skip next delivery", "View my order" (guest) and "View my routine":

- Token = 32 random bytes (base64url). Only `SHA-256(token)` is stored in `SignedActionToken`, with the action, subject, expiry (72 h for subscription actions, 30 min for order view) and `usedAt`.
- GET renders a confirmation page. **Only POST mutates.** This protects against email scanners pre-fetching links.
- A token can authorize one narrowly scoped action; it never creates a session.

### 4.6 Sign-out & session revocation

- Clerk `<UserButton/>` sign-out clears the `__session` cookie. Our guest cookies (`nura_cart`) are not restored after sign-out, so the user's cart stays with the account.
- Admin "Revoke sessions" for staff (on a role change or offboarding) via the Clerk Backend API.
- `user.deleted` webhook → anonymize the User (FR-ACC-04).

---

## 5. Middleware (edge gate)

`src/middleware.ts` (`proxy.ts` on Next 16+), in order:

1. **Security headers + CSP nonce** generation (see 18-security §6).
2. **Anonymous cookies:** set `nura_sid` if missing **and** consent allows it (see §4.2); capture UTM params into `nura_utm` (first touch only, same consent rule). Global Privacy Control (`Sec-GPC: 1`) is honoured as an opt-out.
3. **`clerkMiddleware`** with route matchers:
   | Matcher                                                                                                                                 | Rule                                                                                                                               |
   | --------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
   | `/account(.*)`, `/api/v1/me(.*)`, `/api/v1/wishlist(.*)`, `/api/v1/subscriptions(.*)` (except `actions/:token`), `/api/v1/reviews` POST | `auth.protect()` → redirect to `/sign-in?redirect_url=…` (pages) or 401 JSON (API)                                                 |
   | `/admin(.*)`, `/api/v1/admin(.*)`                                                                                                       | Signed in **and** `sessionClaims.metadata.role ∈ STAFF_ROLES`, else **rewrite to `/404`** (pages) / 404 JSON (API)                 |
   | `/admin(.*)` (except `/admin/mfa-required`)                                                                                             | Staff without a verified second factor (`sessionClaims.fva?.[1] === -1` → no MFA in this session) → redirect `/admin/mfa-required` |
   | `/api/webhooks(.*)`, `/api/inngest`, `/api/health`                                                                                      | Public (signature-verified in the handler)                                                                                         |
   | Everything else                                                                                                                         | Public                                                                                                                             |
4. **Matcher config** excludes static files and `_next` assets for performance.

> Middleware is **not** the security boundary for data. It prevents rendering admin chrome for non-staff and reduces load. Every server entry point re-checks (see §7).

---

## 6. Staff MFA enforcement

- Clerk MFA is required for staff: staff are invited with `publicMetadata.role` set, and onboarding forces MFA enrolment on first sign-in (the `/admin/mfa-required` page embeds `<UserProfile/>`, security section).
- Every admin request checks that the session has completed a second factor (`fva` claim). Sensitive actions (refunds > $100, role changes, coupon generation > 100 codes, data exports) additionally require a **recent re-verification** (≤ 10 min) via Clerk's step-up reverification (`auth().has({ reverification: 'strict' })` pattern). If it is missing, the action returns `REVERIFICATION_REQUIRED` and the UI shows the Clerk reverification modal, then retries.

---

## 7. Authorization model (RBAC with permissions)

### 7.1 Server-side helpers (`lib/server/clerk.ts`)

| Helper                         | Behaviour                                                                                       |
| ------------------------------ | ----------------------------------------------------------------------------------------------- |
| `getCurrentUser()`             | `cache()`-memoized per request; returns `User & { role, permissions: Set<Permission> } \| null` |
| `requireUser()`                | Throws `UNAUTHENTICATED`                                                                        |
| `requireStaff()`               | Throws `NOT_FOUND` for non-staff (hides admin existence)                                        |
| `requirePermission(p)`         | Throws `FORBIDDEN` if the permission is missing (staff)                                         |
| `assertOwner(resource.userId)` | Throws `NOT_FOUND` if not the owner (no enumeration)                                            |
| `can(user, p)`                 | Boolean, for UI gating (`lib/permissions.ts` is isomorphic)                                     |

### 7.2 Permissions

| Permission                                                                     | Description                                     |
| ------------------------------------------------------------------------------ | ----------------------------------------------- |
| `product:read`                                                                 | View catalogue in the admin                     |
| `product:create` / `product:update` / `product:publish` / `product:archive`    | Catalogue lifecycle                             |
| `product:merchandise`                                                          | Featured flags, badges, SEO, home merchandising |
| `price:update`                                                                 | Change variant prices / compare-at              |
| `ingredient:read` / `ingredient:write`                                         | Ingredient DB, conflicts, evidence              |
| `inventory:read` / `inventory:update`                                          | Stock and thresholds                            |
| `order:read` / `order:fulfil` / `order:note` / `order:cancel` / `order:export` | Order ops                                       |
| `order:refund`                                                                 | Refund any amount                               |
| `order:refund_limited`                                                         | Refund ≤ $50 per order in total                 |
| `customer:read`                                                                | Customer list/detail (no sensitive data)        |
| `customer:read_sensitive`                                                      | Skin profile and health-adjacent fields         |
| `subscription:read` / `subscription:manage`                                    | View / act on behalf of customers               |
| `review:moderate`                                                              | Approve, reject, feature                        |
| `coupon:read` / `coupon:write`                                                 | Coupons                                         |
| `analytics:read`                                                               | Non-monetary analytics                          |
| `analytics:revenue`                                                            | Revenue/AOV/MRR                                 |
| `analytics:export`                                                             | CSV exports                                     |
| `audit:read`                                                                   | Audit log                                       |
| `team:manage`                                                                  | Invite staff, change roles                      |
| `settings:read` / `settings:write`                                             | Store settings                                  |

### 7.3 Role → permission matrix

| Permission                | ADMIN | INVENTORY_MANAGER |          MARKETING_MANAGER           | SUPPORT | CUSTOMER |
| ------------------------- | :---: | :---------------: | :----------------------------------: | :-----: | :------: |
| product:read              |   ✓   |         ✓         |                  ✓                   |    ✓    |          |
| product:create / update   |   ✓   |                   |                                      |         |          |
| product:publish / archive |   ✓   |                   |                                      |         |          |
| product:merchandise       |   ✓   |                   |                  ✓                   |         |          |
| price:update              |   ✓   |                   |                                      |         |          |
| ingredient:read           |   ✓   |         ✓         |                  ✓                   |    ✓    |          |
| ingredient:write          |   ✓   |                   |                                      |         |          |
| inventory:read            |   ✓   |         ✓         |                                      |    ✓    |          |
| inventory:update          |   ✓   |         ✓         |                                      |         |          |
| order:read                |   ✓   |         ✓         |                                      |    ✓    |          |
| order:fulfil              |   ✓   |         ✓         |                                      |         |          |
| order:note                |   ✓   |         ✓         |                                      |    ✓    |          |
| order:cancel              |   ✓   |                   |                                      |         |          |
| order:refund              |   ✓   |                   |                                      |         |          |
| order:refund_limited      |       |                   |                                      |    ✓    |          |
| order:export              |   ✓   |                   |                                      |         |          |
| customer:read             |   ✓   |                   | ✓ (aggregate only: no address/phone) |    ✓    |          |
| customer:read_sensitive   |   ✓   |                   |                                      |         |          |
| subscription:read         |   ✓   | ✓ (forecast view) |                  ✓                   |    ✓    |          |
| subscription:manage       |   ✓   |                   |                                      |    ✓    |          |
| review:moderate           |   ✓   |                   |                  ✓                   |    ✓    |          |
| coupon:read               |   ✓   |                   |                  ✓                   |    ✓    |          |
| coupon:write              |   ✓   |                   |                  ✓                   |         |          |
| analytics:read            |   ✓   |         ✓         |                  ✓                   |         |          |
| analytics:revenue         |   ✓   |                   |                  ✓                   |         |          |
| analytics:export          |   ✓   |                   |                  ✓                   |         |          |
| audit:read                |   ✓   |                   |                                      |         |          |
| team:manage               |   ✓   |                   |                                      |         |          |
| settings:read             |   ✓   |         ✓         |                  ✓                   |    ✓    |          |
| settings:write            |   ✓   |                   |            (home.* keys)             |         |          |

Customers have no admin permissions. Their access is governed by **ownership** checks.

### 7.4 Resource ownership rules (customers)

| Resource                                       | Access rule                                                                                       |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| Cart                                           | `cart.userId === user.id` **or** signed cart cookie matches                                       |
| Consultation                                   | `userId === user.id` **or** signed consult cookie `anonymousId` matches **or** a valid view token |
| Order                                          | `order.userId === user.id` **or** a valid `order.view` token                                      |
| Subscription, Address, Wishlist, Review (edit) | `userId === user.id`                                                                              |

All ownership failures return **404**, not 403.

### 7.5 UI gating

The admin sidebar (`features/admin/nav.ts`) declares the required permission per item. Buttons are hidden or disabled with a tooltip ("Requires Admin"). This is UX only; the server enforces.

---

## 8. Webhook authentication

| Source  | Verification                                                                 | Replay protection                    |
| ------- | ---------------------------------------------------------------------------- | ------------------------------------ |
| Stripe  | `stripe.webhooks.constructEvent(raw, header, secret)` with a 300 s tolerance | `WebhookEvent.id = event.id` PK      |
| Clerk   | `svix` `Webhook.verify(raw, headers)`                                        | `WebhookEvent.id = svix-id`          |
| Inngest | `serve()` verifies `INNGEST_SIGNING_KEY`                                     | Inngest event IDs + idempotency keys |

---

## 9. Server Actions security specifics

- Next.js checks the `Origin` against the `Host` for Server Actions (CSRF). `serverActions.allowedOrigins` is limited to the production domain.
- Action IDs are not secrets. **Every action authenticates and authorizes itself** inside `createAction`.
- Closed-over variables in inline actions are encrypted by Next.js; we still avoid closures over sensitive data by using top-level action files only.
- Actions return only DTOs (explicit `select`), never raw Prisma entities, to avoid leaking fields such as `costCents` or `stripeCustomerId`.

---

## 9b. Public portfolio demo access (added in review R-06)

**Conflict found:** staff MFA is mandatory (§6), but the case study promises reviewers a one-click admin demo. Reviewers cannot use a real admin's MFA, and a public, shared admin account with real permissions would be a vulnerability.

**Resolution: a dedicated `DEMO_STAFF` role**, never granted in non-demo deployments.

| Aspect         | Rule                                                                                                                                                                                                                                                                                             |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Permissions    | All `*:read` permissions of the persona being demoed (the dropdown offers "View as Admin / Inventory / Marketing"), plus **simulated** mutations                                                                                                                                                 |
| Mutations      | Admin Server Actions run inside `createAction` with `demoMode`: validation, authorization and the domain service run **in a transaction that is rolled back**. The UI shows the success state and a banner "Demo mode: changes aren't saved". Stripe, Clerk, email and outbox calls are skipped. |
| Sensitive data | Customers visible to demo staff are **seeded synthetic customers only** (`User.isDemo = true` filter applied in all admin queries under demo mode). Real sign-ups from portfolio visitors never appear. `customer:read_sensitive` is never granted.                                              |
| MFA            | Exempt, because the role has no real write capability. Middleware allows `DEMO_STAFF` without `fva` second-factor checks.                                                                                                                                                                        |
| Sign-in        | "Try the admin" button → a server action signs in a pooled demo user via a **Clerk sign-in token** (`clerkClient.signInTokens.createSignInToken`, 5 min TTL). Rate limited to 10/hour/IP; sessions are capped at 1 h.                                                                            |
| Enabled by     | `DEMO_MODE_ENABLED=true` (production portfolio deployment only). The role is rejected by the permission resolver when the flag is off.                                                                                                                                                           |
| Tests          | E2E asserts that a demo mutation produces no DB change, no Stripe call and no email; the registry test runs the demo role against every admin endpoint.                                                                                                                                          |

## 10. Test plan for auth (see 19-testing)

- Unit: the permission matrix is snapshot-tested; `can()` tables per role.
- Integration: every admin action is called as each role → expect 404/403/200 per the matrix (a generated test from the route/permission registry, so a new endpoint without a test fails CI).
- E2E: customer cannot open `/admin` (sees 404); Support refund of $60 → blocked; role change revokes the session; guest data claim after sign-up; a signed email token works once only.
