# 04 — User Flows

Notation: `[Page]` = route; `(Action)` = user action; `{System}` = server behaviour; `◆` = decision; `⚠` = error/edge case.
Every flow lists the **happy path**, **edge cases** and the **events emitted** for analytics (see `06-system-architecture.md` §Analytics).

---

## Customer flows

### C1 — First visit

```
Entry (ad / SEO / direct)
  │
  ▼
[ / ]  {middleware: assign anonymous session id cookie `nura_sid` (1st-party) and capture UTM → `nura_utm` (30d), only where consent rules allow (10 §4.2); honour GPC}
  │    {consent banner if region requires (EU/UK/CA): analytics events queued until consent}
  │
  ├─(Tap "Find my routine")──────────────► C4 AI consultation
  ├─(Browse "Shop")──────────────────────► C3 Product discovery
  ├─(Tap routine card "Clear Skin")──────► [ /routines/clear-skin ]
  └─(Scroll) hero → finder explainer (3 steps) → featured routines → bestsellers → ingredient story → reviews → newsletter
```

- **Sticky finder pill** appears on mobile after 40% scroll, unless the user has already completed the finder in this session.
- Newsletter signup gives 10% off the first order (a single-use code is generated and emailed). It asks for email only, with double opt-in.
- ⚠ Returning visitor with a saved guest routine (cookie `nura_consult` present): the home hero changes to "Welcome back — your routine is ready" and links to `/finder/results/[id]`.

**Events:** `page_view`, `consent_updated`, `hero_cta_clicked{target}`, `newsletter_subscribed`.

---

### C2 — Account creation

Account creation is **never forced before value**. It is offered at 4 moments: saving a routine, checkout (optional), wishlist, and the header "Sign in".

```
(Click "Save my routine" | "Sign in" | wishlist ♡ as guest)
  │
  ▼
[ /sign-up ]  Clerk <SignUp/> (email+password w/ verification code, Google, Apple)
  │  redirect_url preserved (e.g. /finder/results/abc?save=1)
  ▼
{Clerk webhook `user.created` → upsert User(role=CUSTOMER), create empty Wishlist}
{Clerk redirects through the `/auth/complete` route handler (it can set/delete cookies, unlike RSC), which runs `claimGuestData()`:
   - merge guest Cart (cookie `nura_cart`) into user Cart (sum quantities, cap at stock & max 10/line)
   - attach RoutineConsultation(s) with matching `anonymousId` to userId
   - attach CustomerPreference from latest consultation if none exists}
  │
  ▼
Back to redirect_url → toast "Routine saved to your account"
```

**Edge cases**

- ⚠ The webhook has not arrived yet at the first request (race condition): `getCurrentUser()` performs a **just-in-time upsert** from the Clerk session claims. The webhook remains the source of truth for later updates. Both paths are idempotent on `clerkId`.
- ⚠ The email already exists with a different sign-in method: Clerk handles account linking and verification.
- ⚠ Guest checkout email matches an existing user: the order is linked by verified email only after that user signs in and verifies (never auto-linked by the unverified checkout email).

**Events:** `sign_up_started`, `sign_up_completed{method}`, `guest_data_claimed{cartItems, consultations}`.

---

### C3 — Product discovery

```
[ /shop ] ─── filters (URL search params: ?category=serum&concern=acne&skinType=oily&ingredient=niacinamide&price=0-40&sort=bestselling)
   │          {RSC renders from cached query; filters are links → shareable, crawlable, back-button safe}
   │
   ├─(Search ⌘K / header search) → command palette → debounced `/api/v1/search?q=` → products, ingredients, routines
   │
   ▼
[ /products/[slug] ]
   - Gallery (Cloudinary responsive), name, rating, price, variant selector (size/shade)
   - Purchase type toggle: One-time | Subscribe & save 15%. If the cart has no plan yet: an interval select (4/8/12 weeks, default nearest replenishDays) that **sets the cart's plan interval**. If a plan interval exists: "Delivered every 8 weeks with your plan" + a quantity suggestion when usage differs (see 02 §3)
   - "Good for": skin types, concerns   "Key actives": with concentration → link to ingredient page
   - AM/PM badge, "Don't use with" (from IngredientConflict), "Pregnancy-safe" badge
   - How to use, Full INCI (collapsible), Reviews (filter by skin type), "Complete the routine"
   - If user has a saved routine: "✓ Fits your routine" or "⚠ Conflicts with Renew Night Serum in your PM routine"
   │
   ├─(Add to cart) → cart drawer opens (optimistic) → C6
   └─(♡) → wishlist (auth required → C2 with return)
```

**Edge cases**

- ⚠ Variant out of stock: the button changes to "Notify me" (email capture → `BackInStockRequest`, P2) and the variant chip is struck through, but it can still be selected.
- ⚠ Product archived: the PDP returns 410 with a similar-products grid (SEO: tells crawlers to drop the page).
- ⚠ Filters yield zero results: an empty state suggests removing the last filter and offers "Try the Routine Finder instead".

**Events:** `product_list_viewed{filters}`, `search_performed{q, results}`, `product_viewed{productId, source}`, `variant_selected`, `purchase_type_toggled`.

---

### C4 — AI consultation (Routine Finder)

Full design: `12-ai-routine-finder-design.md`. This section is the UX flow only.

```
[ /finder ] intro: "3 minutes · 10 questions · no sign-up needed" + privacy note + (Start)
  │ {createConsultation() → RoutineConsultation(status=IN_PROGRESS, anonymousId|userId, source)}
  ▼
[ /finder?step=skin-type ]   Q1 Skin type (cards w/ illustrations + "Not sure?" helper → mini-quiz of 2 questions)
[ step=concerns ]             Q2 Concerns — pick up to 3, then drag to rank (mobile: tap order)
[ step=sensitivity ]          Q3 Sensitivity scale 1–5 + reactions history (multi: fragrance, acids, retinoids, none)
[ step=conditions ]           Q4 "Do any apply?" pregnant/breastfeeding/trying, diagnosed rosacea/eczema, on prescription topicals (tretinoin, etc.) — with "prefer not to say"
[ step=current-routine ]      Q5 Current routine steps & actives (optional, skippable)
[ step=lifestyle ]            Q6 Sun exposure, climate (auto-suggest from geo-IP, editable), sleep/stress (optional)
[ step=routine-time ]         Q7 Time: "2 min", "5 min", "I love my routine"
[ step=preferences ]          Q8 Ingredient prefs: fragrance-free, vegan, avoid list (chips + search ingredients)
[ step=budget ]               Q9 Monthly budget slider ($30–$200) with live "routines in this range" hint
[ step=notes ]                Q10 Free-text "Anything else?" (max 500 chars, optional)
  │ each step: {saveConsultationAnswer() — autosave, resumable via cookie `nura_consult`}
  │ expert interstitials after Q2 and Q4 ("Great — combination skin with breakouts usually needs …")
  ▼
[ /finder/analyzing ]  animated "building your routine" (streamed status: Checking 14 products → Removing 2 conflicts → Matching to your concerns → Writing your guide)
  │ {POST /api/v1/finder/consultations/:id/recommend (SSE stream)}
  ▼
[ /finder/results/[consultationId] ]
```

**Branching rules**

- If `pregnant|breastfeeding|trying` is selected, a reassurance card appears: "We'll only show pregnancy-safe options". The hard filter is set.
- If on prescription topicals (e.g. tretinoin), a note appears: "We'll avoid other retinoids and strong acids. Keep following your dermatologist." The retinoid slot is disabled.
- Red flags (e.g. "sudden severe acne", "painful cysts", "skin infection", "bleeding or changing mole" in the concerns "other" or free text) → the results page shows a **safety card first**: "Some of what you described is best checked by a dermatologist." A gentle routine is still offered.
- If the user leaves mid-flow, a resume banner appears on the next visit (via cookie, 30 days).

**Edge cases**

- ⚠ AI selection not ready in 10 s, error, or a selection that fails validation: the **deterministic fallback** routine is shown, with identical UI. `engine = RULES_FALLBACK` is logged and the user is not told unless they ask ("How was this made?").
- ⚠ Budget too low for the minimum routine: the Essential tier is shown (cleanser + SPF), with "Add later" suggestions.
- ⚠ All candidates for a slot are out of stock: the slot is marked "Back soon" with a waitlist, or a compatible alternative is used.
- ⚠ Rate-limited (more than 5 consultations per hour per IP): friendly message with a cooldown.

**Events:** `finder_started{source}`, `finder_step_completed{step, ms}`, `finder_step_back`, `finder_abandoned{lastStep}` (derived), `finder_completed{engine, latencyMs}`, `finder_safety_flagged{flags}`.

---

### C5 — Routine recommendation (results page)

```
[ /finder/results/[id] ]
  ├─ Skin profile summary ("Combination · Breakouts, Marks · Sensitivity 3/5") + (Edit answers)
  ├─ Tier tabs: Essential (3) | Complete (4–5) ★recommended | Advanced (5–6) — price per tier
  ├─ AM routine timeline: 1 Cleanse → 2 Treat → 3 Moisturize → 4 Protect
  ├─ PM routine timeline
  │    each step card: product image, name, variant, price, "Why this" (expand), how to use, frequency badge ("3×/week to start")
  │    (Swap) → sheet with 2–3 compatible alternatives ranked, each with trade-off note
  ├─ Introduction plan (week 1–2 / 3–4 / 5+) — prevents irritation
  ├─ "What we left out and why" (excluded products w/ reason) — trust builder
  ├─ Purchase panel: One-time $X | Routine Plan $Y (−15%, every 8 weeks) | routine discount (−10%)
  │    (Add routine to cart) (Save routine) (Email me this routine)
  └─ Disclaimer: "Cosmetic guidance, not medical advice."
```

- "Email me this routine" works for guests: it captures the email (marketing consent is a separate checkbox) and sends a Resend email with a signed link.
- The results page is **not indexable** (`noindex`), and a signed share link is optional (P2).

**Events:** `routine_viewed{tier}`, `routine_tier_changed`, `routine_step_why_opened`, `routine_step_swapped{from,to}`, `routine_saved`, `routine_emailed`.

---

### C6 — Add routine to cart

```
(Add routine to cart, purchaseType=SUBSCRIPTION, interval=8w)
  │
  ▼ {Server Action addRoutineToCart(consultationId, tier, purchaseType, interval)
  │    - load RoutineRecommendation(tier) steps → variants
  │    - re-validate stock & active status (never trust results page data)
  │    - upsert CartItems with `routineId` + `purchaseType` + `intervalWeeks`
  │    - if existing identical variant line → merge qty (max 10)
  │    - revalidateTag(`cart:${cartId}`) }
  ▼
Cart drawer: grouped "Your Routine (4)" block with routine discount badge, then other items
  ├─ per-line: qty stepper, purchase-type toggle, interval select, remove
  ├─ Routine discount auto-applied if ≥3 routine lines remain (recomputed live)
  ├─ Free-shipping progress bar ("$12 away from free shipping" — hidden if subscription in cart)
  ├─ Coupon field (validates server-side on apply)
  └─ (Checkout)
```

- ⚠ The routine includes a tinted SPF without a chosen shade: the "Add routine to cart" button is replaced by "Choose your shade" until a shade is chosen on the results page (12 §4.5).
- ⚠ Adding subscription lines to a cart that already has a plan interval: new lines adopt the plan interval, and a toast explains "Added to your 8-week plan".
- ⚠ The user removes a routine item and fewer than 3 routine lines remain: the discount is removed, with inline copy explaining why.
- ⚠ Stock changes while the product sits in the cart: the line shows "Only 2 left" or "Out of stock — removed from checkout" at checkout creation.

**Events:** `routine_added_to_cart{tier, purchaseType, value}`, `cart_viewed`, `cart_item_updated`, `coupon_applied{code, valid}`.

---

### C7 — Checkout

```
[ /checkout ]  (auth optional; guest allowed)
  │ {Server Action createCheckoutSession(cartId):
  │    1. load cart (fresh from DB, not client state)
  │    2. validate each line: active, in stock (available = onHand − reserved)
  │    3. compute prices via PricingEngine (server-side, see 11-payment-design)
  │    4. create Order(status=PENDING_PAYMENT) + OrderItems (price snapshots)
  │    5. reserve inventory (InventoryReservation, expires 35 min)
  │    6. create Stripe Checkout Session (ui_mode=embedded, mode=payment|subscription,
  │       customer = user.stripeCustomerId or customer_creation, metadata {orderId, cartId},
  │       shipping_address_collection, automatic_tax (P1), discounts (coupon → Stripe promotion or computed amounts),
  │       expires_at = now + 30 min)
  │    7. return clientSecret }
  ▼
Page renders: left = Stripe <EmbeddedCheckout/> (email, shipping address, shipping method, payment incl. Apple/Google Pay, Link)
              right = order summary (server-rendered from Order snapshot)
  │
  │ (Pay)  → Stripe handles SCA/3DS
  ▼
[ /checkout/return?session_id=cs_... ]
  │ {retrieve session: status=complete → show confirmation (poll order status until PAID, max 10s, via webhook-updated DB)
  │                    status=open → back to /checkout with "Payment not completed"}
  ▼
{Webhook checkout.session.completed → OrderService.markPaid (idempotent):
   - Order → PAID, Payment row, convert reservations → SALE movements
   - if subscription: create Subscription + SubscriptionItems from session.subscription
   - increment coupon redemptions, clear cart, emit `order_paid`
   - enqueue: send confirmation email, analytics rollup, review-request schedule}
  ▼
[ /checkout/success/[orderNumber] ] — confirmation, "Create account to track" (guest), onboarding tips, subscription summary
```

**Edge cases**

- ⚠ The user abandons the payment and the session expires: the `checkout.session.expired` webhook releases the reservations, sets Order → `EXPIRED` and sends an abandoned-cart email after 1 hour if consent was given (P1).
- ⚠ The user opens checkout twice (two tabs): the existing `PENDING_PAYMENT` order for the cart is reused if the cart hash is unchanged; otherwise the old session is expired and a new one created.
- ⚠ Payment succeeds but the webhook is delayed: the return page shows "Confirming your payment…" and polls `GET /api/v1/orders/by-session/:id`. After 10 s it shows "Payment received — confirmation email on its way".
- ⚠ Async payment methods (not enabled in v1): designed for `checkout.session.async_payment_succeeded`.
- ⚠ Race: stock sells out between reservation and payment. This cannot happen, because stock was reserved at session creation.
- ⚠ The reservation expires but the payment completes late, an edge within Stripe's window: `markPaid` re-checks stock. If it is insufficient, the order is flagged `NEEDS_ATTENTION` for admin review (the order is never cancelled automatically after payment).

**Events:** `checkout_started{value, items}`, `checkout_completed`, `order_paid{orderId, value, hasSubscription}`.

---

### C8 — Subscription management

```
[ /account/subscriptions ] list: plan name, items, next renewal date, amount, status
  │
  ▼
[ /account/subscriptions/[id] ]
  ├─ (Skip next delivery)         → confirm → {Stripe: subscriptions.update(trial_end = currentPeriodEnd + interval, proration_behavior=none) — shifts the next charge by one cycle} → email
  ├─ (Pause 1/2/3 months)          → {Stripe pause_collection{behavior:void, resumes_at}}
  ├─ (Change frequency 4/8/12w)    → {Stripe subscription item price swap, proration_behavior=none}
  ├─ (Swap product/variant)        → sheet: compatible alternatives in same category → {update item price}
  ├─ (Add one-time item to next box) → {add invoice item to upcoming invoice}
  ├─ (Update payment method)       → Stripe Customer Portal session (payment method only config)
  └─ (Cancel)                      → reason → contextual save offer → (Confirm cancel) → {cancel_at_period_end=true}
```

- All mutations go through `SubscriptionService`. It calls Stripe first and then persists the result, so Stripe is the source of truth for billing. The `customer.subscription.updated` webhook reconciles the local state.
- Email deep links (for example "Skip next") use a signed token (HMAC, 72h, single-use via `usedAt`). The link opens a confirm page and **never mutates on GET**.

**Events:** `subscription_skipped`, `subscription_paused`, `subscription_interval_changed`, `subscription_item_swapped`, `subscription_cancel_started`, `subscription_save_accepted{offer}`, `subscription_canceled{reason}`.

**Renewal flow (system):** `invoice.upcoming` (T−3 days) → reminder email · `invoice.paid` → create renewal Order (type `SUBSCRIPTION_RENEWAL`), deduct stock, email · `invoice.payment_failed` → status `PAST_DUE`, dunning email · final failure → `customer.subscription.deleted` → `CANCELED`.

---

### C9 — Order tracking

```
[ /account/orders ] → [ /account/orders/[orderNumber] ]
   status timeline: Placed → Paid → Processing → Shipped (carrier + tracking link) → Delivered
   items, totals, addresses, invoice PDF link (Stripe hosted invoice/receipt URL), "Reorder" button, "Need help?" mailto with order no.
Guest: [ /orders/lookup ] email + order number → emails a magic link (signed, 30 min) → read-only order page
```

- Status changes create an `OrderStatusEvent` row and send an email (Shipped, Delivered).
- ⚠ Order lookup is rate limited (5 per 15 min per IP) to prevent enumeration, and returns the same response whether or not the order exists.

**Events:** `order_tracking_viewed`, `reorder_clicked`.

---

### C10 — Review submission

```
Trigger: email at delivery+21d  OR  PDP "Write a review" (only if verified purchaser of product)  OR  /account/orders/[no] item "Review"
  │
  ▼
[ /account/reviews/new?product=... ] (auth required)
   rating (1–5, required) · title (≤ 80) · body (30–2000 chars) · skin type (prefilled from profile) · concerns · "used for" duration
   · photos (≤ 3, Cloudinary signed upload, ≤ 5 MB each, image/* only) · "Would recommend" toggle
  │ {Server Action submitReview: Zod validate → verify OrderItem ownership & delivered/paid → one review per user per product (unique)
  │   → profanity/PII heuristics → status=PENDING (auto-approve if rating≥3 & no flags & text clean, else moderation queue)}
  ▼
Confirmation "Thanks — your review will appear shortly" → admin moderation (A-flows)
On approve: {recompute Product.ratingAvg / ratingCount (transaction), revalidateTag(`product:${slug}`)}
```

**Events:** `review_started`, `review_submitted{rating}`.

---

## Admin flows

All admin routes live under `/admin`. The middleware requires an authenticated session with a role in `{ADMIN, INVENTORY_MANAGER, MARKETING_MANAGER, SUPPORT}`. Every mutation checks its **permission** again server-side (see `10-authentication-design.md`).

### A1 — Admin login

```
[ /admin ] → middleware: not signed in → redirect /sign-in?redirect_url=/admin
  → Clerk sign-in (MFA REQUIRED for staff roles — enforced: session claim `mfa_verified` or Clerk "require MFA" org setting; if missing → /admin/mfa-required page)
  → middleware: role from session claims (publicMetadata.role) ∉ staff → 404 (not 403: do not reveal admin existence)
  → [ /admin ] dashboard; nav filtered by permissions
```

- Staff sessions: re-authentication is required once the first-factor verification is older than 12 h, a 30-minute client idle sign-out applies, and sensitive actions need step-up reverification (see 10 §2, §6).
- Every successful staff sign-in writes an `AuditLog(action=auth.sign_in)` via the Clerk `session.created` webhook.

### A2 — Add product

```
[ /admin/products ] (New product)
  ▼
[ /admin/products/new ] tabbed form (React Hook Form + Zod, autosave draft every 10s)
  1. Basics: name, slug (auto, editable, unique check), category, short description, description (rich text → sanitized HTML/MD), status DRAFT
  2. Media: Cloudinary signed upload widget → drag to reorder → alt text REQUIRED per image → set primary
  3. Variants: name (e.g. "30 ml"), SKU (unique), price, compareAtPrice, replenishDays, weight, barcode, initial stock, low-stock threshold
  4. Ingredients: INCI list paste → parsed into ordered ProductIngredient rows (match existing Ingredient by INCI name, create unknowns as DRAFT ingredients) → mark key actives + concentration %
  5. Targeting: skin types, concerns (with efficacy weight 1–3), routine slot (CLEANSE/TREAT/MOISTURIZE/PROTECT), time of day (AM/PM/BOTH), flags (pregnancySafe, fragranceFree, vegan, nonComedogenic)
  6. SEO: meta title/description (char counters), OG image (auto from primary)
  7. Review & publish: checklist (≥1 image w/ alt, ≥1 variant, price>0, key actives set, targeting set) → (Publish)
  │ {Server Action publishProduct: permission `product:publish` → validate → transaction (product, variants, inventory items, ingredients)
  │   → sync Stripe Product/Prices (Inngest job `stripe/product.sync`) → AuditLog → revalidateTag('products', `product:${slug}`)}
  ▼
Toast "Published" + "View on store" link
```

- ⚠ Slug collision: inline error with a suggestion (`glow-serum-2`).
- ⚠ Stripe sync fails: the product is still published (the storefront doesn't depend on Stripe IDs until checkout). The job retries with backoff, and checkout creates missing prices lazily as a safety net.

### A3 — Manage inventory

```
[ /admin/inventory ] table: SKU, product, variant, on hand, reserved, available, committed(14d subs), threshold, status chip
  filters: below threshold, out of stock, category; sort by available
  ├─ (Adjust) row action → dialog: type (RECEIVE | ADJUSTMENT | DAMAGE | RETURN), quantity (+/−), reason/reference (required), note
  │    {adjustInventory: permission `inventory:update` → SELECT … FOR UPDATE on InventoryItem → validate onHand+qty ≥ reserved
  │     → update + InventoryMovement row → AuditLog → if crosses threshold → event `inventory.low_stock` → email digest}
  ├─ (History) → movement ledger drawer (who, when, type, qty, balance after, reference)
  └─ (Export CSV)
```

- ⚠ Concurrent adjustments: row-level lock plus an optimistic `version` column. A stale form produces "Stock changed since you opened this — review and retry".

### A4 — Process order

```
[ /admin/orders ] default view: status=PAID (unfulfilled), oldest first; badges for NEEDS_ATTENTION
  ▼
[ /admin/orders/[orderNumber] ] customer, items, payment (Stripe link), timeline, notes
  ├─ (Mark processing) → PROCESSING
  ├─ (Fulfil) → dialog: carrier, tracking number, items (partial fulfilment P2) → SHIPPED → email w/ tracking
  ├─ (Mark delivered) (or carrier webhook later) → DELIVERED → schedules review request (+21d)
  ├─ (Refund) → full/partial amount, per-line restock checkbox, reason → {Stripe refund (idempotency key) → Refund row
  │             → refund.updated/charge.refunded webhook confirms → Order.paymentStatus PARTIALLY_REFUNDED/REFUNDED → restock movements}
  │             Support role: max $50; >$100 requires typing order number to confirm
  ├─ (Cancel) (only before SHIPPED) → auto full refund + restock
  └─ (Add internal note) → OrderNote
```

- Allowed state transitions are enforced by an `OrderStateMachine` (see `08-database-design.md` §Order states). Illegal transitions return a 409.

### A5 — Analyze sales

```
[ /admin/analytics ] date range picker (presets: 7d/30d/90d/YTD/custom) + compare to previous period
  ├─ KPI tiles: Revenue, Orders, AOV, Conversion rate, New customers, MRR, Active subs, Churn
  ├─ Revenue over time (line, one-time vs subscription stacked)
  ├─ Finder funnel (start → each step → complete → add to cart → paid)
  ├─ Top products / routines (table w/ units, revenue, refund rate)
  ├─ Concern heatmap (concern × week)
  ├─ Coupon performance (redemptions, discount given, attributed revenue)
  └─ (Export CSV) per widget
  {Data from DailyMetric rollups (fast) + live "today" query; cached 5 min with tag `analytics`}
```

- Marketing Manager sees everything on this page. The Inventory Manager sees units only (revenue widgets hidden by permission `analytics:revenue`).
