# 09 — API Design

## 1. API surface strategy

The app exposes **two interfaces over the same domain services**:

| Interface                                           | Used by                                                                                                                                       | Why                                                                                           |
| --------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| **Server Actions** (`features/*/server/actions.ts`) | Our own React UI (forms, buttons)                                                                                                             | Typed end-to-end, progressive enhancement, built-in origin check (CSRF), no fetch boilerplate |
| **REST Route Handlers** `/api/v1/*`                 | SSE streaming (finder), client polling (checkout return), the beacon (analytics), webhooks, future mobile app / third parties, E2E test setup | Streaming, cacheable GETs, stable versioned contract                                          |

Every endpoint below lists its Server Action twin where one exists. Both call the same `service` function, so validation, authorization and business rules are **implemented once**.

**Build scope for v1 (revised in review R-17).** Implementing a REST twin for every mutation doubles the attack surface, the RBAC test matrix and the maintenance, with no consumer in v1. So:

| Build in v1 as REST                                                                                                                                                                                                                                                                                                                                                                                       | Build in v1 as Server Actions only (REST contract documented here, deferred until a real client exists)                                                                                                                                                                                                           |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Webhooks, `/api/inngest`, `/api/health`; finder SSE `/recommend`; checkout polling (`/checkout/sessions/:id`, `/orders/by-session/:id`); `/events` beacon; **public catalogue GETs** (`/products`, `/search`, `/products/:slug/stock`, `/products/:slug/reviews`), used by client components and cacheable at the CDN; signed-token endpoints reached from emails; admin CSV exports (streamed downloads) | Cart, wishlist, account, addresses, subscriptions, reviews, finder answers/swap/save, **all admin mutations**. E2E setup uses test factories (direct service calls through a guarded `/api/test/*` router that exists only when `APP_ENV ∈ {local, preview}` and a secret header is present), not the public API. |

The contracts below stay the reference for the future mobile app. Server Action inputs and outputs use exactly these schemas and DTOs, so exposing them later is mechanical.

---

## 2. Conventions

### 2.1 Base

- Base path `/api/v1`. Breaking changes go to `/api/v2`, and v1 keeps running for ≥ 6 months.
- JSON only (`Content-Type: application/json`), UTF-8. Money is always `{ amount: int cents, currency: "USD" }`, and dates are ISO-8601 UTC strings.
- IDs are opaque strings. Orders are addressed publicly by `orderNumber` (`NURA-100234`).

### 2.2 Authentication levels

| Level                | Meaning                                                                            | Mechanism                                                                                                    |
| -------------------- | ---------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `public`             | Anyone                                                                             | —                                                                                                            |
| `guest-or-user`      | Anonymous allowed; state bound to a cookie (`nura_cart`, `nura_consult`) or a user | Signed httpOnly cookie **or** Clerk session                                                                  |
| `user`               | Signed-in customer                                                                 | Clerk session (`auth()`); 401 if missing                                                                     |
| `staff:<permission>` | Staff with that permission                                                         | Clerk session + role → permission map (see 10-auth); 404 for non-staff, 403 for staff without the permission |
| `signature`          | Machine-to-machine                                                                 | Stripe / Svix / Inngest signing secrets                                                                      |
| `token`              | Email deep link                                                                    | Single-use signed token (`SignedActionToken`)                                                                |

### 2.3 Response envelope

```jsonc
// success
{ "data": { ... }, "meta": { "requestId": "req_…", "nextCursor": "…" /* lists only */ } }
// error
{ "error": { "code": "OUT_OF_STOCK", "message": "Only 2 left of Glow Serum 30 ml.", "details": { "variantId": "…", "available": 2 }, "requestId": "req_…" } }
```

Server Actions return a discriminated union with the same shape: `{ ok: true, data } | { ok: false, error: { code, message, fieldErrors? } }`.

### 2.4 Error codes → HTTP status

| Code               | HTTP | Meaning                                                                                                                                         |
| ------------------ | ---- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `VALIDATION`       | 422  | Zod failure; `details.fieldErrors` keyed by path                                                                                                |
| `BAD_REQUEST`      | 400  | Malformed JSON / unsupported params                                                                                                             |
| `UNAUTHENTICATED`  | 401  | No session                                                                                                                                      |
| `FORBIDDEN`        | 403  | Staff without the permission, or a non-owner resource                                                                                           |
| `NOT_FOUND`        | 404  | Also returned for resources that exist but belong to someone else (no enumeration)                                                              |
| `GONE`             | 410  | Archived product                                                                                                                                |
| `CONFLICT`         | 409  | State-machine violation, version mismatch, duplicate                                                                                            |
| `OUT_OF_STOCK`     | 409  | Insufficient available stock                                                                                                                    |
| `COUPON_INVALID`   | 422  | `details.reason`: `expired`, `not_started`, `min_subtotal`, `usage_limit`, `per_customer_limit`, `not_eligible`, `first_order_only`, `inactive` |
| `PAYMENT_PROVIDER` | 502  | Stripe error (sanitized)                                                                                                                        |
| `AI_UNAVAILABLE`   | —    | Never surfaced; the fallback engine answers instead                                                                                             |
| `RATE_LIMITED`     | 429  | `Retry-After` header                                                                                                                            |
| `INTERNAL`         | 500  | Unexpected; logged with requestId                                                                                                               |

### 2.5 Pagination, filtering, sorting

- Cursor pagination: `?cursor=<opaque>&limit=24` (max 100 for admin, 48 for storefront). Response `meta.nextCursor` is null at the end.
- Admin tables also support `?page=&pageSize=` (offset) for jump-to-page, bounded to 10k rows. Exports use streaming CSV.
- Filters use repeated params: `?concern=acne&concern=redness`. Sort: `?sort=price_asc`.

### 2.6 Idempotency

- All `POST` endpoints that create money- or stock-affecting resources accept `Idempotency-Key` (UUID). Keys are stored in Redis for 24 h with the response hash. A replay returns the stored response, and a different body with the same key returns 409.
- Stripe calls pass idempotency keys derived from our entity IDs (`order:{id}:session`, `refund:{refundId}`).

### 2.7 Rate limits (Upstash sliding window; key = userId or IP from `@vercel/functions` `ipAddress()`)

| Limiter            | Limit                                       | Applies to                         |
| ------------------ | ------------------------------------------- | ---------------------------------- |
| `browse`           | 300 / min                                   | Public GETs                        |
| `search`           | 60 / min                                    | `/search`                          |
| `mutation`         | 60 / min                                    | Cart, wishlist, account mutations  |
| `finder-create`    | 10 / hour per IP, 30/day                    | Creating consultations             |
| `finder-recommend` | 5 / hour per consultation, 20 / hour per IP | `/recommend`, swaps                |
| `checkout`         | 10 / 10 min                                 | Checkout sessions                  |
| `coupon`           | 10 / 10 min                                 | Coupon apply (brute-force defence) |
| `order-lookup`     | 5 / 15 min                                  | Guest order lookup                 |
| `review`           | 5 / day                                     | Review submit                      |
| `events`           | 120 / min per session                       | Analytics beacon                   |
| `admin`            | 600 / min                                   | Staff endpoints                    |

### 2.8 Implementation wrappers

- `createRoute({ auth, permission?, rateLimit?, input?: {params, query, body}, handler })` parses and validates with Zod, resolves the user, checks the permission, applies the rate limit, runs the handler, maps `AppError` to HTTP, and adds `requestId` and `Cache-Control`.
- `createAction({ schema, auth, permission?, rateLimit?, audit?: {action, entity}, handler })` does the same for Server Actions and writes the AuditLog for staff mutations.

---

## 3. Shared DTOs (response shapes)

```ts
Money            { amount: number; currency: "USD" }
ImageDTO         { publicId: string; alt: string; width: number; height: number; blurDataUrl?: string }
ProductCardDTO   { id, slug, name, subtitle, category: {slug,name}, primaryImage: ImageDTO, hoverImage?: ImageDTO,
                   priceFrom: Money, compareAt?: Money, rating: {avg: number, count: number}, badges: string[],
                   flags: {pregnancySafe, fragranceFree, vegan}, timeOfDay, inStock: boolean }
VariantDTO       { id, sku, name, optionType, shadeHex?, price: Money, compareAt?: Money, subscriptionPrice: Money,
                   replenishDays, available: number /* capped at 10 for display */, isDefault }
ProductDetailDTO ProductCardDTO & { description, howToUse, images: ImageDTO[], variants: VariantDTO[],
                   keyActives: {ingredient:{slug,name}, concentrationPct?: number}[], inci: {slug?, inciName}[],
                   concerns: {slug,name,efficacy}[], skinTypes: SkinType[], conflicts: {ingredient, withIngredient, reason}[],
                   seo: {title, description} }
CartDTO          { id, lines: CartLineDTO[], routineGroups: {consultationId, tier, lineIds[]}[], coupon?: {code, description},
                   subscriptionIntervalWeeks?: 4|8|12, quote: QuoteDTO, warnings: CartWarning[] }
CartLineDTO      { id, variant: VariantDTO & {product: {slug,name,image}}, quantity, purchaseType, unitPrice: Money,
                   discounts: {label, amount: Money}[], total: Money }
QuoteDTO         { subtotal, discounts: {kind:"subscription"|"routine"|"bundle"|"coupon", label, amount}[], shipping,
                   shippingLabel, taxEstimate?: Money, total, freeShippingRemaining?: Money }
OrderSummaryDTO  { orderNumber, status, paymentStatus, placedAt, total: Money, itemCount, firstImages: ImageDTO[] }
OrderDetailDTO   OrderSummaryDTO & { items[], subtotal, discount, shipping, tax, refunded, shippingAddress, timeline[], shipments[], receiptUrl? }
SubscriptionDTO  { id, name, status, intervalWeeks, nextChargeAt, pausedUntil?, cancelAtPeriodEnd, items: {id, variant, quantity, unitPrice}[],
                   upcomingTotal: Money, shippingAddress, paymentMethod?: {brand, last4} }
ConsultationDTO  { id, status, questionnaireVersion, answers, lastStep, safetyFlags, completedAt? }
RoutineResultDTO { consultationId, profileSummary, safety: {flags[], message?}, recommendedTier,
                   tiers: { tier, title, summary, total: Money, subscriptionTotal: Money,
                            am: RoutineStepDTO[], pm: RoutineStepDTO[], introductionPlan[], excluded: {product, reason}[] }[],
                   engine: "LLM"|"RULES_FALLBACK", disclaimer }
RoutineStepDTO   { id, order, slot, product: ProductCardDTO, variant: VariantDTO, rationale, usage, frequency, matchedConcerns[] }
```

---

## 4. Products & catalogue (public)

### `GET /api/v1/products`

- **Auth:** public · **Cache:** `s-maxage=60, stale-while-revalidate=600` + tag `products`
- **Query:** `category?`, `concern[]?`, `skinType[]?`, `ingredient[]?` (slugs), `minPrice?`/`maxPrice?` (cents), `flags[]?` ∈ {pregnancy_safe, fragrance_free, vegan}, `sort?` ∈ {featured, bestselling, rating, price_asc, price_desc, newest} (default featured), `cursor?`, `limit?` (1–48, default 24)
- **Response 200:** `{ data: ProductCardDTO[], meta: { nextCursor, total, facets: { concern: {slug,count}[], skinType[], ingredient[], priceRange: {min,max} } } }`
- **Validation:** enums are strict; unknown slugs are ignored (no 422, for crawler resilience); `minPrice ≤ maxPrice`.
- **Errors:** 422 VALIDATION (bad sort/limit), 429.

### `GET /api/v1/products/:slug`

- **Auth:** public · **Cache:** tag `product:{slug}` (stock is fetched separately, uncached)
- **Response 200:** `ProductDetailDTO` · **301** with `Location` if the slug is in `SlugRedirect` · **410** GONE if archived (body has `similar: ProductCardDTO[]`) · **404** if draft or missing.

### `GET /api/v1/products/:slug/stock`

- **Auth:** public · **Cache:** `no-store`
- **Response:** `{ data: { variants: { id, available: number /* capped 10 */, inStock: boolean }[] } }`

### `GET /api/v1/products/:slug/reviews`

- **Query:** `rating?` (1–5), `skinType?`, `withPhotos?` (bool), `sort?` ∈ {recent, helpful, rating_high, rating_low}, `cursor?`, `limit?` ≤ 20
- **Response:** `{ data: ReviewDTO[], meta: { nextCursor, summary: { avg, count, distribution: {1..5: n}, bySkinType: {type, avg, count}[] } } }`
- **Errors:** 404 product.

### `GET /api/v1/search?q=`

- **Auth:** public · **Rate:** search
- **Query:** `q` (1–80 chars, trimmed; control characters stripped), `limit?` ≤ 10 per group
- **Response:** `{ data: { products: ProductCardDTO[], ingredients: {slug, name, commonName}[], concerns: {slug, name}[], routines: {slug, name}[] } }`
- **Logic:** `websearch_to_tsquery` on `searchVector` ∪ trigram similarity > 0.3 on name/aliases; ranked.
- **Errors:** 422 (empty/too long), 429.

### `GET /api/v1/categories` · `GET /api/v1/concerns` · `GET /api/v1/ingredients` · `GET /api/v1/ingredients/:slug` · `GET /api/v1/routines` · `GET /api/v1/routines/:slug`

- **Auth:** public, cached by entity tags.
- Ingredient detail includes `products: ProductCardDTO[]` containing it, `concerns` with evidence and `conflicts`.
- Routine detail includes steps (AM/PM) with variants, bundle price vs. list price, availability (`min` of components).
- **Errors:** 404.

---

## 5. Authentication & account

Sign-up, sign-in, MFA, OAuth, password reset and session management are **delegated to Clerk** (hosted components and Frontend API). We do not expose our own credential endpoints. Our API covers the local user record and customer data.

| Method & route                                            | Auth                   | Request                                                                                                                                   | Response                                                                                                           | Validation / notes                                                                                                  | Errors                                       |
| --------------------------------------------------------- | ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------- | -------------------------------------------- |
| `GET /api/v1/me`                                          | user                   | —                                                                                                                                         | `{ id, email, firstName, lastName, role, marketingConsent, hasSkinProfile, stats: {orders, activeSubscriptions} }` | JIT-upsert if the webhook hasn't landed                                                                             | 401                                          |
| `PATCH /api/v1/me` (Action `updateProfile`)               | user                   | `{ firstName?: 1–50, lastName?: 1–50, phone?: E.164, marketingConsent?: bool }`                                                           | `{ me }`                                                                                                           | Name/email changes are also pushed to Clerk; email changes happen **only** in Clerk UI (verification)               | 401, 422                                     |
| `GET /api/v1/me/preferences`                              | user                   | —                                                                                                                                         | `CustomerPreferenceDTO`                                                                                            |                                                                                                                     | 401, 404                                     |
| `PUT /api/v1/me/preferences` (Action `updateSkinProfile`) | user                   | full preference object (Zod `SkinProfileSchema`) + `sensitiveConsent: true` if sensitive fields are present                               | `{ preferences }`                                                                                                  | Consent is required when `isPregnantOrNursing` or `usesPrescriptionTopicals` is set                                 | 401, 422                                     |
| `POST /api/v1/me/claim` (Action `claimGuestData`)         | user (+ guest cookies) | —                                                                                                                                         | `{ mergedCartLines, claimedConsultations }`                                                                        | Idempotent. Only claims consultations whose `anonymousId` matches the cookie.                                       | 401                                          |
| `GET /api/v1/me/addresses`                                | user                   | —                                                                                                                                         | `AddressDTO[]`                                                                                                     |                                                                                                                     | 401                                          |
| `POST /api/v1/me/addresses`                               | user                   | `{ label?, fullName, line1, line2?, city, region (US state code), postalCode (US ZIP regex), country: "US", phone?, isDefaultShipping? }` | `AddressDTO` 201                                                                                                   | Max 10                                                                                                              | 401, 422, 409 (limit)                        |
| `PATCH /api/v1/me/addresses/:id`                          | user (owner)           | partial of the above                                                                                                                      | `AddressDTO`                                                                                                       |                                                                                                                     | 401, 404, 422                                |
| `DELETE /api/v1/me/addresses/:id`                         | user (owner)           | —                                                                                                                                         | 204                                                                                                                |                                                                                                                     | 401, 404                                     |
| `POST /api/v1/me/export`                                  | user                   | —                                                                                                                                         | 202 `{ status: "queued" }`                                                                                         | Inngest builds JSON; emailed link valid for 24h                                                                     | 401, 429 (1/day)                             |
| `DELETE /api/v1/me`                                       | user                   | `{ confirm: "DELETE", reviewsHandling: "anonymize"\|"delete" }`                                                                           | 202                                                                                                                | Cancels active subs at period end, anonymizes orders, deletes Clerk user                                            | 401, 409 (open unshipped orders → must wait) |
| `POST /api/webhooks/clerk`                                | signature (Svix)       | Clerk event                                                                                                                               | 200                                                                                                                | Handles `user.created`, `user.updated`, `user.deleted`, `session.created` (staff audit). Dedupe via `WebhookEvent`. | 400 invalid signature                        |

---

## 6. Cart

Cart identity: `nura_cart` httpOnly, `Secure`, `SameSite=Lax`, signed (HMAC) cookie containing the cart ID for guests; the active cart by `userId` for signed-in users.

### `GET /api/v1/cart`

- **Auth:** guest-or-user · **Cache:** `no-store`
- **Response:** `CartDTO` (creates nothing; returns an empty cart DTO if none)
- **Notes:** `warnings[]` include `{ type: "stock_reduced", lineId, available }`, `{ type: "item_unavailable", lineId }`, `{ type: "routine_discount_lost" }`.

### `POST /api/v1/cart/items` · Action `addToCart`

- **Auth:** guest-or-user · **Rate:** mutation · **Idempotency-Key** supported
- **Request:** `{ variantId: cuid, quantity: int 1–10, purchaseType: "ONE_TIME"|"SUBSCRIPTION", consultationId?: cuid, routineTier?: RoutineTier }`
- **Response 200:** `CartDTO` (creates a cart and sets the cookie if absent)
- **Validation:** variant exists, product PUBLISHED, variant not archived; `SUBSCRIPTION` requires `subscriptionEligible`; merged quantity ≤ min(10, available); `consultationId` must belong to the caller (user or cookie).
- **Errors:** 404 VARIANT_NOT_FOUND, 409 OUT_OF_STOCK `{available}`, 422 VALIDATION / `NOT_SUBSCRIBABLE`, 429.

### `POST /api/v1/cart/routine` · Action `addRoutineToCart`

- **Request:** `{ consultationId, tier: RoutineTier, purchaseType, intervalWeeks?: 4|8|12 }`
- **Response:** `CartDTO`
- **Validation:** the consultation is owned by the caller and COMPLETED; the recommendation exists; each step is re-validated (published, in stock). Steps that are no longer available are skipped and reported in `warnings`.
- **Errors:** 404, 409 (all steps unavailable), 422.

### `PATCH /api/v1/cart/items/:itemId` · Action `updateCartItem`

- **Request:** `{ quantity?: 1–10, purchaseType?: PurchaseType }` (at least one)
- **Response:** `CartDTO` · **Errors:** 404 (not in the caller's cart), 409 OUT_OF_STOCK, 422.

### `DELETE /api/v1/cart/items/:itemId` · Action `removeCartItem`

- **Response:** `CartDTO` · **Errors:** 404.

### `PUT /api/v1/cart/subscription-interval` · Action `setCartInterval`

- **Request:** `{ intervalWeeks: 4|8|12 }` · **Response:** `CartDTO` · **Errors:** 422, 409 (no subscription lines).

### `POST /api/v1/cart/coupon` · Action `applyCoupon`

- **Rate:** coupon
- **Request:** `{ code: string 3–32, [A-Z0-9-] after uppercase }`
- **Response:** `CartDTO` with the coupon applied and the quote recomputed
- **Validation:** coupon rules (see 11 §6). The per-customer limit uses the userId, or the email captured at checkout (re-checked in the session).
- **Errors:** 422 COUPON_INVALID `{reason}` (generic message for non-existent codes: "This code isn't valid"), 429.

### `DELETE /api/v1/cart/coupon` · Action `removeCoupon` → `CartDTO`.

### `DELETE /api/v1/cart` · Action `clearCart` → 204.

---

## 7. Wishlist

| Method & route                                              | Auth | Request                       | Response                                                      | Validation                          | Errors                |
| ----------------------------------------------------------- | ---- | ----------------------------- | ------------------------------------------------------------- | ----------------------------------- | --------------------- |
| `GET /api/v1/wishlist`                                      | user | —                             | `{ items: {product: ProductCardDTO, variantId?, addedAt}[] }` |                                     | 401                   |
| `POST /api/v1/wishlist/items` (Action `toggleWishlist` add) | user | `{ productId, variantId? }`   | `{ items }` 201                                               | Product is published; max 100 items | 401, 404, 409 (limit) |
| `DELETE /api/v1/wishlist/items/:productId`                  | user | —                             | 204                                                           |                                     | 401, 404              |
| `POST /api/v1/wishlist/items/:productId/move-to-cart`       | user | `{ variantId, purchaseType }` | `CartDTO`                                                     | Same as addToCart                   | 401, 404, 409         |

---

## 8. Checkout & payments

### `POST /api/v1/checkout/sessions` · Action `createCheckoutSession`

- **Auth:** guest-or-user · **Rate:** checkout · **Idempotency:** internal (cartHash)
- **Request:** `{ }`. The cart is resolved from the cookie or session. The body carries **no prices**.
- **Response 200:** `{ data: { clientSecret: string, expiresAt: ISO } }`. There is no order number yet; it is assigned at payment (08 R-12).
- **Trigger:** called by `/checkout` on mount (the page owns session creation; the cart's Checkout button only navigates). This avoids stale client secrets when the user returns to the tab.
- **Server logic:** see 11 §3. Validates stock, computes the quote, creates the Order (PENDING_PAYMENT) and reservations, and creates the Stripe session (`ui_mode: embedded`).
- **Validation:** cart not empty; all lines available; subscription lines require an account (if a guest has subscription lines → 409 `ACCOUNT_REQUIRED_FOR_SUBSCRIPTION`, and the UI prompts sign-in/up, keeping the cart); the interval is set when subscription lines exist.
- **Errors:** 409 OUT_OF_STOCK `{lines: [{lineId, available}]}`, 409 ACCOUNT_REQUIRED_FOR_SUBSCRIPTION, 422 COUPON_INVALID (the coupon became invalid → removed; the client refreshes), 502 PAYMENT_PROVIDER, 429.

### `GET /api/v1/checkout/sessions/:sessionId`

- **Auth:** guest-or-user. The session's `metadata.orderId` must match an order tied to the caller's cart or user.
- **Response:** `{ data: { status: "open"|"complete"|"expired", paymentStatus, orderNumber } }`
- **Errors:** 404.

### `GET /api/v1/orders/by-session/:sessionId`

- **Purpose:** polling on the return page until the order is PAID (via the webhook or the return page's own idempotent `markPaidFromSession`).
- **Response:** `{ data: { status, paymentStatus, orderNumber: string | null } }` (the number appears once paid). When PAID, the server sets the short-lived signed cookie `nura_last_order` (30 min), which authorizes a guest to view `/checkout/success/[orderNumber]`. **Errors:** 404.

### `POST /api/v1/billing/portal-session` · Action `openBillingPortal`

- **Auth:** user with `stripeCustomerId`
- **Request:** `{ returnPath?: "/account/subscriptions" }` (allowlisted paths only)
- **Response:** `{ data: { url } }`. The Stripe Customer Portal is configured for **payment method updates and invoice history only**. Subscription changes happen in our UI.
- **Errors:** 401, 409 (no Stripe customer), 502.

### `POST /api/webhooks/stripe`

- **Auth:** signature (`stripe.webhooks.constructEvent(rawBody, sig, STRIPE_WEBHOOK_SECRET)`). The raw body is read with `await req.text()`.
- **Handled events:** `checkout.session.completed`, `checkout.session.expired`, `payment_intent.payment_failed`, `charge.refunded`, `refund.updated`, `charge.dispute.created`, `invoice.upcoming`, `invoice.paid`, `invoice.payment_failed`, `customer.subscription.created|updated|deleted|paused|resumed`, `product.*`/`price.*` (ignored, logged).
- **Response:** 200 `{received:true}` quickly. Heavy work is done inline within the transaction (bounded) or offloaded via the outbox. Duplicates (event ID already processed) → 200 no-op. On handler failure → 500 so Stripe retries (WebhookEvent `failed`, attempts++).
- **Errors:** 400 invalid signature (no details leaked).

---

## 9. Orders

| Method & route                                                | Auth                                               | Request                    | Response                                                                                   | Validation                                                      | Errors              |
| ------------------------------------------------------------- | -------------------------------------------------- | -------------------------- | ------------------------------------------------------------------------------------------ | --------------------------------------------------------------- | ------------------- |
| `GET /api/v1/orders`                                          | user                                               | `?cursor&limit≤20&status?` | `OrderSummaryDTO[]`                                                                        | Only the user's own orders                                      | 401                 |
| `GET /api/v1/orders/:orderNumber`                             | user (owner) **or** token                          | —                          | `OrderDetailDTO`                                                                           | Format `NURA-\d{6}`                                             | 401, 404            |
| `POST /api/v1/orders/lookup`                                  | public                                             | `{ email, orderNumber }`   | 202 `{ message: "If that order exists, we've emailed a secure link." }` (always identical) | Rate `order-lookup`; Turnstile/Clerk bot check after 2 attempts | 422, 429            |
| `GET /api/v1/orders/view?token=`                              | token (`order.view`, 30 min, multi-use within TTL) | —                          | `OrderDetailDTO` (addresses partially masked)                                              |                                                                 | 401 invalid/expired |
| `POST /api/v1/orders/:orderNumber/reorder` (Action `reorder`) | user (owner)                                       | —                          | `CartDTO`                                                                                  | Adds available items; warns on others                           | 401, 404            |

---

## 10. Subscriptions (customer)

All mutations call Stripe first (with an idempotency key), then persist and write `SubscriptionEvent`. The webhook later reconciles the local state (the handler is idempotent and convergent).

| Method & route                                   | Action                   | Request                                                  | Response                                                                        | Validation / rules                                                                                                                                                                                      | Errors                   |
| ------------------------------------------------ | ------------------------ | -------------------------------------------------------- | ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------ |
| `GET /api/v1/subscriptions`                      | —                        | —                                                        | `SubscriptionDTO[]`                                                             | owner                                                                                                                                                                                                   | 401                      |
| `GET /api/v1/subscriptions/:id`                  | —                        | —                                                        | `SubscriptionDTO` + `events[]`                                                  | owner                                                                                                                                                                                                   | 401, 404                 |
| `POST /api/v1/subscriptions/:id/skip`            | `skipNextDelivery`       | —                                                        | `SubscriptionDTO`                                                               | status ACTIVE; not within 24h of charge (409 `TOO_CLOSE_TO_RENEWAL`); max 3 consecutive skips                                                                                                           | 401, 404, 409            |
| `POST /api/v1/subscriptions/:id/pause`           | `pauseSubscription`      | `{ months: 1\|2\|3 }`                                    | `SubscriptionDTO`                                                               | ACTIVE only                                                                                                                                                                                             | 401, 404, 409, 422       |
| `POST /api/v1/subscriptions/:id/resume`          | `resumeSubscription`     | `{ chargeNow?: false }`                                  | `SubscriptionDTO`                                                               | PAUSED only                                                                                                                                                                                             | 409                      |
| `PATCH /api/v1/subscriptions/:id`                | `updateSubscription`     | `{ intervalWeeks?: 4\|8\|12, shippingAddressId?: cuid }` | `SubscriptionDTO`                                                               | Address owned by the user; US only                                                                                                                                                                      | 409, 422                 |
| `PATCH /api/v1/subscriptions/:id/items/:itemId`  | `updateSubscriptionItem` | `{ variantId?: cuid, quantity?: 1–10 }`                  | `SubscriptionDTO`                                                               | The new variant must be in the same category, subscribable, in stock, and **not conflict** with the user's routine (warns but allows unless there is a pregnancy hard conflict → 409 `SAFETY_CONFLICT`) | 404, 409, 422            |
| `POST /api/v1/subscriptions/:id/items`           | `addOneTimeToNext`       | `{ variantId, quantity: 1–5 }`                           | `SubscriptionDTO` (with `upcomingExtras`)                                       | Creates a Stripe invoice item on the upcoming invoice                                                                                                                                                   | 409 OUT_OF_STOCK         |
| `DELETE /api/v1/subscriptions/:id/items/:itemId` | `removeSubscriptionItem` | —                                                        | `SubscriptionDTO`                                                               | Cannot remove the last item (use cancel) → 409                                                                                                                                                          | 409                      |
| `GET /api/v1/subscriptions/:id/cancel-offers`    | —                        | `?reason=`                                               | `{ offers: {type: "skip"\|"interval_12"\|"swap"\|"discount_20_next", copy}[] }` | Reason ∈ {too_much_product, too_expensive, not_working, irritation, switching_brand, other}                                                                                                             | 422                      |
| `POST /api/v1/subscriptions/:id/cancel`          | `cancelSubscription`     | `{ reason, feedback?: ≤500, acceptOffer?: OfferType }`   | `SubscriptionDTO`                                                               | If `acceptOffer` → apply the offer instead; else `cancel_at_period_end=true`                                                                                                                            | 409 (already canceled)   |
| `POST /api/v1/subscriptions/actions/:token`      | `confirmSignedAction`    | `{ confirm: true }`                                      | `{ result }`                                                                    | Token single-use; action ∈ {skip, pause_1m}; the GET page renders the confirmation screen, and only POST mutates                                                                                        | 401 invalid/used/expired |

---

## 11. AI recommendations (Routine Finder)

### `POST /api/v1/finder/consultations` · Action `startConsultation`

- **Auth:** guest-or-user · **Rate:** finder-create
- **Request:** `{ source?: string ≤40, parentConsultationId?: cuid }`
- **Response 201:** `ConsultationDTO`. Sets the `nura_consult` cookie (anonymousId) for guests. If `parentConsultationId` is given (check-in), the answers are pre-filled.
- **Errors:** 404 parent, 429.

### `PATCH /api/v1/finder/consultations/:id/answers` · Action `saveConsultationAnswer`

- **Auth:** owner (userId or anonymousId cookie)
- **Request:** `{ stepId: StepId, answer: <step-specific schema> , sensitiveConsent?: true }`
- **Response:** `{ data: { lastStep, nextStepId, interstitial?: {title, body} } }`. Interstitials come from deterministic templates, not the LLM.
- **Validation:** discriminated union per `stepId` (see 12 §2). The `conditions` step requires `sensitiveConsent: true` when any condition is selected. `notes` ≤ 500 chars, stripped of URLs and control characters.
- **Errors:** 404, 409 (already completed → must start a re-consultation), 422.

### `POST /api/v1/finder/consultations/:id/recommend` (**SSE**)

- **Auth:** owner · **Rate:** finder-recommend · **Response:** `text/event-stream`
- **Preconditions:** required steps answered (skin-type, concerns, sensitivity, conditions, budget) → else 422 `INCOMPLETE` with `missingSteps`.
- **Events:**
  ```
  event: status   data: {"stage":"profile","message":"Understanding your skin"}
  event: status   data: {"stage":"candidates","message":"Checking 14 products","count":14}
  event: status   data: {"stage":"filtering","message":"Removing 2 that don't suit you","excluded":2}
  event: status   data: {"stage":"matching","message":"Matching to your concerns"}
  event: status   data: {"stage":"writing","message":"Writing your personal guide"}
  event: result       data: RoutineResultDTO          // after phase A: routine + templated rationales (usable)
  event: explanation  data: {"stepIds":["…"],"rationale":"…","usage":"…","matchedConcerns":[…]}  // phase B, one per product
  event: summary      data: {"tier":"COMPLETE","title":"…","summary":"…","introductionNote":"…"}
  event: done         data: {"engine":"LLM"|"RULES_FALLBACK","explanations":"complete"|"partial"}
  event: error    data: {"code":"INTERNAL"}   // only if even the fallback fails
  ```
- **Behaviour:** idempotent per consultation. If a result already exists, it is emitted immediately (no new LLM call) unless `?regenerate=1` (counted against the rate limit).
- **Errors (pre-stream):** 404, 422 INCOMPLETE, 429.

### `GET /api/v1/finder/consultations/:id`

- **Auth:** owner or a `consultation.view` token (email link) · **Response:** `ConsultationDTO & { result?: RoutineResultDTO }` · **Errors:** 404.

### `GET /api/v1/finder/consultations/:id/steps/:stepId/alternatives`

- **Query:** `reason?` ∈ {price, fragrance_free, texture, other}
- **Response:** `{ data: { alternatives: { product: ProductCardDTO, variant: VariantDTO, tradeOff: string, score: number }[] } }` (max 3)
- **Logic:** rule engine only (fast, deterministic): same slot and time, passes all hard constraints and conflict checks against the other steps. The trade-off copy comes from templates.

### `POST /api/v1/finder/consultations/:id/steps/:stepId/swap` · Action `swapRoutineStep`

- **Request:** `{ variantId }` · **Response:** `RoutineResultDTO`
- **Validation:** the variant must be in the alternatives set (recomputed server-side) → else 422 `NOT_A_VALID_ALTERNATIVE`.

### `POST /api/v1/finder/consultations/:id/steps/:stepId/variant` · Action `chooseStepVariant`

- **Purpose:** choose the shade for steps with `requiresVariantChoice` (tinted SPF).
- **Request:** `{ variantId }` · **Response:** `RoutineResultDTO`
- **Validation:** the variant belongs to the step's product, is in stock and is not archived · **Errors:** 404, 409 OUT_OF_STOCK, 422.

### `POST /api/v1/finder/consultations/:id/revise` · Action `reviseAnswers`

- **Purpose:** "Edit answers" from the results page. It creates a **child consultation** (`parentId`) prefilled with the answers, and completed consultations are never mutated.
- **Response 201:** `ConsultationDTO` (new ID) · **Rate:** finder-create.

### `POST /api/v1/finder/consultations/:id/email` · Action `emailRoutine`

- **Auth:** **user only** (revised in review R-16). Sending email to arbitrary typed-in addresses from a public demo is a spam and deliverability abuse vector. Guests are prompted to create an account (which verifies the email), or they can use "Copy link" (signed view token) instead.
- **Request:** `{ marketingConsent: boolean }` (the email is the user's verified address) · **Response:** 202
- **Rate:** 3/hour per consultation, 10/day per user · **Errors:** 401, 422, 429.

### `POST /api/v1/finder/consultations/:id/save` · Action `saveRoutine`

- **Auth:** user · Attaches the consultation to the user and updates `CustomerPreference` from the profile (if consented) · **Errors:** 401, 404.

---

## 12. Reviews, uploads, newsletter, events

| Method & route                                                 | Auth                                                                  | Request                                                                                                                                              | Response                                                            | Validation                                                                                                                                           | Errors                                                         |
| -------------------------------------------------------------- | --------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| `POST /api/v1/reviews` (Action `submitReview`)                 | user · rate `review`                                                  | `{ productId, rating 1–5, title 3–80, body 30–2000, skinType?, concerns?: slug[] ≤3, usageDuration?, wouldRecommend, imagePublicIds?: string[] ≤3 }` | 201 `{ id, status }`                                                | Verified purchase (paid order item for the product); one review per product; image public IDs must be in the user's `reviews/{userId}/` folder       | 401, 403 `NOT_VERIFIED_PURCHASER`, 409 `ALREADY_REVIEWED`, 422 |
| `POST /api/v1/reviews/:id/helpful`                             | guest-or-user                                                         | —                                                                                                                                                    | `{ helpfulCount }`                                                  | One vote per session/user (Redis set, 30d)                                                                                                           | 404, 409                                                       |
| `POST /api/v1/uploads/signature` (Action `getUploadSignature`) | user (`context=review`) or staff:`product:update` (`context=product`) | `{ context: "review"\|"product"\|"brand", productId? }`                                                                                              | `{ signature, timestamp, apiKey, cloudName, folder, uploadPreset }` | Folder is derived server-side, never client-supplied                                                                                                 | 401, 403                                                       |
| `POST /api/v1/newsletter` (Action `subscribeNewsletter`)       | public · rate 5/h/IP                                                  | `{ email, source? }`                                                                                                                                 | 202                                                                 | Double opt-in; same response if already subscribed                                                                                                   | 422, 429                                                       |
| `GET /api/v1/newsletter/confirm?token=`                        | token                                                                 | —                                                                                                                                                    | 302 → `/?newsletter=confirmed`                                      |                                                                                                                                                      | 302 → `?newsletter=invalid`                                    |
| `POST /api/v1/events`                                          | public · rate `events`                                                | `{ events: { name, occurredAt, properties, path }[] ≤ 20 }` (sent via `navigator.sendBeacon`)                                                        | 204                                                                 | Event names allowlisted; per-event Zod schemas; dropped if no analytics consent (the client doesn't send; the server also checks the consent cookie) | 422 (silently dropped individually), 429                       |

---

## 13. Admin operations (`/api/v1/admin/*`)

All return 404 to non-staff and 403 to staff lacking the permission. All mutations write `AuditLog`. The UI uses the Server Action twins (`features/admin/**/actions.ts`); the REST routes exist for scripting and E2E setup.

### 13.1 Products & catalogue

| Method & route                            | Permission                                                              | Request                                                                                                | Response                                                                                          | Validation                                                                                                                           | Errors                         |
| ----------------------------------------- | ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------ |
| `GET /admin/products`                     | `product:read`                                                          | `?q&status&category&cursor/page&sort`                                                                  | `AdminProductRow[]` (name, status, category, variants count, price range, stock total, updatedAt) |                                                                                                                                      |                                |
| `POST /admin/products`                    | `product:create`                                                        | `ProductDraftInput { name, slug?, categoryId, type }`                                                  | 201 `AdminProduct` (DRAFT)                                                                        | Slug unique, kebab-case, ≤ 80                                                                                                        | 409 SLUG_TAKEN, 422            |
| `GET /admin/products/:id`                 | `product:read`                                                          | —                                                                                                      | `AdminProduct` (all tabs)                                                                         |                                                                                                                                      | 404                            |
| `PATCH /admin/products/:id`               | `product:update` (merch-only fields allowed with `product:merchandise`) | Partial `ProductUpdateInput` + `version`                                                               | `AdminProduct`                                                                                    | Optimistic lock: `version` mismatch → 409; Marketing can only change `isFeatured`, `featuredPosition`, `badges`, `seo*`              | 409 VERSION_CONFLICT, 422, 403 |
| `PUT /admin/products/:id/variants`        | `product:update` + `price:update` for price fields                      | `{ variants: VariantInput[] }` (upsert by id; missing = archive)                                       | `VariantDTO[]`                                                                                    | SKU unique; `compareAt > price`; `price > 0`; changing a price triggers a Stripe price re-sync                                       | 409 SKU_TAKEN, 422             |
| `PUT /admin/products/:id/images`          | `product:update`                                                        | `{ images: { publicId, alt (≥3), kind, position, variantId? }[] }`                                     | `ImageDTO[]`                                                                                      | publicId in the `products/{slug}` folder; alt required                                                                               | 422                            |
| `PUT /admin/products/:id/ingredients`     | `product:update`                                                        | `{ inci: string }` or `{ items: {ingredientId, position, isKeyActive, concentrationBp?}[] }`           | `{ items, createdDraftIngredients[] }`                                                            | INCI is parsed by comma, respecting parentheses                                                                                      | 422                            |
| `PUT /admin/products/:id/targeting`       | `product:update`                                                        | `{ routineSlot, timeOfDay, skinTypes[], concerns: {concernId, efficacy 1–3}[], flags, strengthLevel }` | `AdminProduct`                                                                                    | `pregnancySafe=true` is rejected if any ingredient has `pregnancySafe=false` → 422 `SAFETY_FLAG_INCONSISTENT`                        | 422                            |
| `POST /admin/products/:id/publish`        | `product:publish`                                                       | `{ version }`                                                                                          | `AdminProduct`                                                                                    | Publish checklist (≥ 1 image with alt, ≥ 1 variant, targeting set, INCI set, SEO title) → 422 `PUBLISH_CHECKLIST_FAILED {missing[]}` | 409, 422                       |
| `POST /admin/products/:id/archive`        | `product:archive`                                                       | `{ confirmSlug }`                                                                                      | `AdminProduct`                                                                                    | Removes the product from active routines' future recommendations; active subscriptions containing it are flagged for admin           | 422                            |
| `POST /admin/products/:id/duplicate`      | `product:create`                                                        | —                                                                                                      | 201 `AdminProduct` (DRAFT, `-copy` slug)                                                          |                                                                                                                                      |                                |
| `GET/POST/PATCH /admin/ingredients[/:id]` | `ingredient:read/write`                                                 | Ingredient fields, conflicts `{withIngredientId, severity, reason}[]`, concerns evidence               | `AdminIngredient`                                                                                 | Conflict pair normalized (a<b)                                                                                                       | 409, 422                       |
| `GET/POST/PATCH /admin/routines[/:id]`    | `product:*`                                                             | Bundle definition `{ name, items: {variantId, qty, timeOfDay, stepOrder}[], bundlePriceCents }`        | `AdminBundle`                                                                                     | Bundle price < sum of items; components are not archived; no conflicting actives in the same time-of-day                             | 422                            |

### 13.2 Inventory

| Method & route                              | Permission         | Request                                                                                                                                               | Response                                                                                       | Validation                                                     | Errors   |
| ------------------------------------------- | ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- | -------------------------------------------------------------- | -------- |
| `GET /admin/inventory`                      | `inventory:read`   | `?status=low\|out\|ok&category&q&sort`                                                                                                                | rows `{variantId, sku, product, onHand, reserved, available, committed14d, threshold, status}` |                                                                |          |
| `POST /admin/inventory/:variantId/adjust`   | `inventory:update` | `{ type: RECEIVE\|ADJUSTMENT\|DAMAGE\|RETURN_RESTOCK, quantity: int ≠ 0 (RECEIVE > 0, DAMAGE < 0), reason: 3–200, reference?: ≤64, expectedVersion }` | `{ item, movement }`                                                                           | Row lock; result `onHand ≥ reserved` else 409 `BELOW_RESERVED` | 409, 422 |
| `PATCH /admin/inventory/:variantId`         | `inventory:update` | `{ lowStockThreshold: 0–10000 }`                                                                                                                      | `item`                                                                                         |                                                                | 422      |
| `GET /admin/inventory/:variantId/movements` | `inventory:read`   | `?cursor`                                                                                                                                             | `InventoryMovementDTO[]`                                                                       |                                                                | 404      |
| `GET /admin/inventory/export.csv`           | `inventory:read`   | filters                                                                                                                                               | streamed CSV                                                                                   |                                                                |          |

### 13.3 Orders

| Method & route                                      | Permission                                                 | Request                                                                                                                                            | Response                                                        | Validation                                              | Errors                                      |
| --------------------------------------------------- | ---------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- | ------------------------------------------------------- | ------------------------------------------- |
| `GET /admin/orders`                                 | `order:read`                                               | `?status&paymentStatus&type&needsAttention&q(email/number)&from&to&page`                                                                           | `AdminOrderRow[]`                                               |                                                         |                                             |
| `GET /admin/orders/:orderNumber`                    | `order:read`                                               | —                                                                                                                                                  | `AdminOrderDetail` (incl. Stripe links, events, notes, refunds) |                                                         | 404                                         |
| `POST /admin/orders/:orderNumber/status`            | `order:fulfil`                                             | `{ to: "PROCESSING"\|"DELIVERED", note? }`                                                                                                         | detail                                                          | State machine                                           | 409 INVALID_TRANSITION                      |
| `POST /admin/orders/:orderNumber/fulfil`            | `order:fulfil`                                             | `{ carrier, trackingNumber: 6–40 [A-Z0-9], notifyCustomer: bool }`                                                                                 | detail                                                          | Order in PAID/PROCESSING                                | 409, 422                                    |
| `POST /admin/orders/bulk-fulfil`                    | `order:fulfil`                                             | `{ items: {orderNumber, carrier, trackingNumber}[] ≤ 100 }`                                                                                        | `{ succeeded[], failed[{orderNumber, code}] }`                  | Per-item transaction                                    | 422                                         |
| `POST /admin/orders/:orderNumber/refunds`           | `order:refund` (Support: ≤ $50 via `order:refund_limited`) | `{ amountCents > 0, reason, note?, restock: bool, lines?: {orderItemId, quantity}[], confirmOrderNumber? (required if > $100) }` + Idempotency-Key | 202 `{ refund }` (PENDING until webhook)                        | amount ≤ total − refunded; line quantities ≤ refundable | 409 EXCEEDS_REFUNDABLE, 403 LIMIT, 422, 502 |
| `POST /admin/orders/:orderNumber/cancel`            | `order:cancel`                                             | `{ reason, restock: true }`                                                                                                                        | detail                                                          | Only before SHIPPED; issues a full refund               | 409                                         |
| `POST /admin/orders/:orderNumber/notes`             | `order:note`                                               | `{ body: 1–2000 }`                                                                                                                                 | `OrderNoteDTO`                                                  |                                                         | 422                                         |
| `POST /admin/orders/:orderNumber/resend-email`      | `order:note`                                               | `{ template: "order_confirmation"\|"order_shipped" }`                                                                                              | 202                                                             |                                                         | 409                                         |
| `POST /admin/orders/:orderNumber/resolve-attention` | `order:fulfil`                                             | `{ resolution: "restocked"\|"partial_refund"\|"canceled", note }`                                                                                  | detail                                                          |                                                         | 409                                         |
| `GET /admin/orders/export.csv`                      | `order:export`                                             | filters                                                                                                                                            | streamed CSV                                                    | Max 50k rows                                            |                                             |

### 13.4 Customers, subscriptions, reviews

| Method & route                                        | Permission            | Request                                                                                  | Response                                                                                                                 | Notes / errors                                                |
| ----------------------------------------------------- | --------------------- | ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------- |
| `GET /admin/customers`                                | `customer:read`       | `?q&stage&sort=ltv\|recent`                                                              | rows incl. CustomerMetric                                                                                                |                                                               |
| `GET /admin/customers/:id`                            | `customer:read`       | —                                                                                        | profile, orders, subs, consultations count, notes. **Skin profile hidden unless `customer:read_sensitive`** (ADMIN only) | 404                                                           |
| `GET /admin/subscriptions`                            | `subscription:read`   | `?status&dueBefore`                                                                      | rows                                                                                                                     |                                                               |
| `POST /admin/subscriptions/:id/{skip\|pause\|cancel}` | `subscription:manage` | same as customer endpoints + `onBehalfNote`                                              | `SubscriptionDTO`                                                                                                        | Audit-logged with the note                                    |
| `GET /admin/reviews`                                  | `review:moderate`     | `?status=PENDING&rating&flag`                                                            | rows                                                                                                                     |                                                               |
| `POST /admin/reviews/:id/moderate`                    | `review:moderate`     | `{ action: "approve"\|"reject"\|"feature"\|"unfeature", reason? (required for reject) }` | review                                                                                                                   | Recomputes aggregates in a transaction; 409 on a stale status |

### 13.5 Coupons

| Method & route                    | Permission     | Request                                           | Response                                                          | Validation                                                                                                      | Errors                   |
| --------------------------------- | -------------- | ------------------------------------------------- | ----------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- | ------------------------ |
| `GET /admin/coupons`              | `coupon:read`  | `?active&campaign&q`                              | rows with redemption count, discount total                        |                                                                                                                 |                          |
| `POST /admin/coupons`             | `coupon:write` | `CouponInput` (all Coupon fields)                 | 201 `Coupon`                                                      | Type-specific value required; percentage ≤ 50% unless ADMIN (margin guard); `expiresAt > startsAt`; code unique | 409 CODE_TAKEN, 422, 403 |
| `PATCH /admin/coupons/:id`        | `coupon:write` | partial                                           | `Coupon`                                                          | Cannot change `type`/`value` after the first redemption (→ archive and create a new one)                        | 409                      |
| `POST /admin/coupons/:id/archive` | `coupon:write` | —                                                 | `Coupon`                                                          |                                                                                                                 |                          |
| `POST /admin/coupons/generate`    | `coupon:write` | `{ prefix, count ≤ 1000, template: CouponInput }` | 202 job → CSV                                                     | Single-use codes                                                                                                | 422                      |
| `GET /admin/coupons/:id/stats`    | `coupon:read`  | `?from&to`                                        | `{ redemptions, discountCents, attributedRevenueCents, byDay[] }` |                                                                                                                 | 404                      |

### 13.6 Analytics

| Method & route                      | Permission                                                | Query                                                                                                                    | Response                                                                                                                                 |
| ----------------------------------- | --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /admin/analytics/summary`      | `analytics:read` (+ `analytics:revenue` for money fields) | `from, to, compare=previous\|yoy`                                                                                        | `{ kpis: { revenue, orders, aov, conversionRate, newCustomers, mrr, activeSubscriptions, churnRate } each {value, previous, deltaPct} }` |
| `GET /admin/analytics/timeseries`   | same                                                      | `metric ∈ {revenue, orders, sessions, finder_completed, mrr}, from, to, granularity=day\|week\|month, split?=order_type` | `{ points: {date, value, split?}[] }`                                                                                                    |
| `GET /admin/analytics/funnel`       | `analytics:read`                                          | `funnel=checkout\|finder, from, to, source?`                                                                             | `{ steps: {key, label, count, rateFromPrev, rateFromStart}[] }`                                                                          |
| `GET /admin/analytics/top-products` | `analytics:read`                                          | `from, to, by=revenue\|units, limit ≤ 50`                                                                                | rows (revenue hidden without `analytics:revenue`)                                                                                        |
| `GET /admin/analytics/concerns`     | `analytics:read`                                          | `from, to`                                                                                                               | heatmap `{concern, week, count}[]`                                                                                                       |
| `GET /admin/analytics/finder`       | `analytics:read`                                          | `from, to`                                                                                                               | `{ completionRate, avgDurationSec, fallbackRate, avgLatencyMs, p95LatencyMs, topSafetyFlags[], acceptanceRate, swapRate, tokensUsed }`   |
| `GET /admin/analytics/export.csv`   | `analytics:export`                                        | `report=…&from&to`                                                                                                       | CSV stream                                                                                                                               |

**Validation:** `from ≤ to`, range ≤ 400 days, dates are ISO. **Errors:** 422, 403. Responses are cached for 5 min (tag `analytics`) with `private` cache control.

### 13.7 Audit, team, settings

| Method & route                                       | Permission                                                                    | Request                                              | Response                        | Notes                                                                                                                            |
| ---------------------------------------------------- | ----------------------------------------------------------------------------- | ---------------------------------------------------- | ------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `GET /admin/audit-logs`                              | `audit:read`                                                                  | `?actorId&action&entityType&entityId&from&to&cursor` | `AuditLogDTO[]` (diff rendered) | Read-only                                                                                                                        |
| `GET /admin/team`                                    | `team:manage`                                                                 | —                                                    | staff users with roles          | ADMIN only                                                                                                                       |
| `POST /admin/team/invite`                            | `team:manage`                                                                 | `{ email, role: staff RoleKey }`                     | 202                             | Clerk invitation with `publicMetadata.role`                                                                                      |
| `PATCH /admin/team/:userId/role`                     | `team:manage`                                                                 | `{ role }`                                           | user                            | Cannot demote the last ADMIN (409); cannot change your own role (409). Updates Clerk metadata and revokes the target's sessions. |
| `GET /admin/settings` · `PATCH /admin/settings/:key` | `settings:read` / `settings:write` (`home.*` keys also `product:merchandise`) | `{ value }` (Zod per key)                            | setting                         | Revalidates tag `settings`                                                                                                       |

---

## 14. Webhooks & jobs endpoints (summary)

| Route                       | Caller         | Verification                                      | Notes                                                            |
| --------------------------- | -------------- | ------------------------------------------------- | ---------------------------------------------------------------- |
| `POST /api/webhooks/stripe` | Stripe         | `Stripe-Signature` (tolerance 300 s)              | Node runtime, raw body, `export const dynamic = 'force-dynamic'` |
| `POST /api/webhooks/clerk`  | Clerk (Svix)   | `svix-id`, `svix-timestamp`, `svix-signature`     |                                                                  |
| `GET/POST/PUT /api/inngest` | Inngest        | `INNGEST_SIGNING_KEY`                             | `serve()` handler                                                |
| `GET /api/health`           | Uptime monitor | none (returns only `ok`/`degraded`, no internals) |                                                                  |
