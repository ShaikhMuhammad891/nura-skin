# 05 — Software Requirements Specification (SRS)

Requirement IDs are stable and referenced by tests (`19-testing-strategy.md`) and roadmap milestones (`21-development-roadmap.md`).
Keywords **MUST / SHOULD / MAY** follow RFC 2119.

---

## 1. Scope & system context

The system is a single Next.js application deployed on Vercel. It serves:

- the **storefront** (public and customer pages),
- the **admin** (staff pages),
- **HTTP APIs** (`/api/v1/*`, webhooks, the Inngest endpoint).

It integrates with Clerk (identity), Stripe (payments and subscriptions), Neon Postgres (data), Cloudinary (media), Anthropic Claude API (AI), Resend (email), Upstash Redis (rate limiting and ephemeral cache), Inngest (background jobs) and Sentry (errors).

---

## 2. Functional requirements

### 2.1 Catalogue (FR-CAT)

| ID        | Requirement                                                                                                                                                                                                |
| --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| FR-CAT-01 | The system MUST list published products with pagination (cursor-based, 24 per page) and filters: category, concern, skin type, key ingredient, price range, flags (pregnancy-safe, fragrance-free, vegan). |
| FR-CAT-02 | The system MUST support sorting by featured, bestselling (30-day units), rating, price asc/desc and newest.                                                                                                |
| FR-CAT-03 | The product detail MUST show variants with independent price, stock and images; the selected variant MUST be reflected in the URL (`?variant=sku`).                                                        |
| FR-CAT-04 | The system MUST show full INCI in order, and key actives with concentration where known.                                                                                                                   |
| FR-CAT-05 | The system MUST show ingredient conflicts ("don't use with") derived from `IngredientConflict`.                                                                                                            |
| FR-CAT-06 | Search MUST support prefix/typo-tolerant matching across product name, ingredient name/aliases and concern (Postgres `tsvector` + `pg_trgm`), returning in < 150 ms p95 server time.                       |
| FR-CAT-07 | Bundles/routines MUST be purchasable as a unit with a bundle price, and MUST decrement stock of each component variant.                                                                                    |
| FR-CAT-08 | Archived products MUST NOT appear in listings/search. Their PDP MUST return HTTP 410.                                                                                                                      |

### 2.2 AI Routine Finder (FR-AI)

| ID       | Requirement                                                                                                                                                                                                                                                                                                                                         |
| -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| FR-AI-01 | The finder MUST collect the questionnaire in `12-ai-routine-finder-design.md` §2, autosaving each step server-side.                                                                                                                                                                                                                                 |
| FR-AI-02 | Consultations MUST be resumable for 30 days via an anonymous cookie, and claimable on sign-up.                                                                                                                                                                                                                                                      |
| FR-AI-03 | The recommendation engine MUST only return products that are published, in stock (available ≥ 1) and pass all hard constraints (pregnancy, avoid-list, conflicts, budget ceiling of the tier).                                                                                                                                                      |
| FR-AI-04 | The recommendation MUST include AM and PM routines with ordered steps, per-step rationale, usage frequency and an introduction plan.                                                                                                                                                                                                                |
| FR-AI-05 | The system MUST provide Essential, Complete and Advanced tiers.                                                                                                                                                                                                                                                                                     |
| FR-AI-06 | If the LLM call fails, does not complete its selection phase within 10 s, or returns a selection failing validation, the system MUST return a deterministic rule-based recommendation with identical structure. If explanations don't complete within 30 s, templated explanations MUST fill the missing steps without discarding the AI selection. |
| FR-AI-07 | The system MUST detect red-flag inputs and show dermatologist guidance.                                                                                                                                                                                                                                                                             |
| FR-AI-08 | The user MUST be able to swap a step for a compatible alternative (re-validated server-side).                                                                                                                                                                                                                                                       |
| FR-AI-09 | The system MUST persist the input snapshot, candidate set, engine used, model, prompt version, latency and token usage for every recommendation.                                                                                                                                                                                                    |
| FR-AI-10 | The user MUST be able to add a routine tier to the cart as one-time or subscription in one action.                                                                                                                                                                                                                                                  |

### 2.3 Cart & checkout (FR-CART / FR-CHK)

| ID         | Requirement                                                                                                                                                                                                                                                                       |
| ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| FR-CART-01 | Guests MUST have a persistent cart (httpOnly cookie token, 60 days). Authenticated users MUST have one active cart.                                                                                                                                                               |
| FR-CART-02 | On sign-in, guest and user carts MUST merge (sum quantities, clamp to stock and the per-line max of 10).                                                                                                                                                                          |
| FR-CART-03 | Each cart line MUST carry a purchase type (ONE_TIME / SUBSCRIPTION) and, if subscription, an interval (4/8/12 weeks). All subscription lines in one checkout MUST share an interval (UI enforces this with a single cart-level interval selector when subscriptions are present). |
| FR-CART-04 | Prices displayed in the cart MUST be computed server-side by the Pricing Engine. The client MUST NOT submit prices.                                                                                                                                                               |
| FR-CART-05 | Coupons MUST be validated server-side against all coupon rules (see 11-payment-design §Coupons).                                                                                                                                                                                  |
| FR-CHK-01  | Checkout MUST use Stripe Embedded Checkout, supporting cards, Apple Pay, Google Pay and Link.                                                                                                                                                                                     |
| FR-CHK-02  | The system MUST create an Order in `PENDING_PAYMENT` with immutable price snapshots before creating the Stripe session.                                                                                                                                                           |
| FR-CHK-03  | The system MUST reserve inventory for the session lifetime and release it on expiry.                                                                                                                                                                                              |
| FR-CHK-04  | Orders MUST be marked paid only from verified Stripe webhooks, processed idempotently.                                                                                                                                                                                            |
| FR-CHK-05  | Guest checkout MUST be supported; the confirmation email MUST offer account creation.                                                                                                                                                                                             |
| FR-CHK-06  | Order numbers MUST be human-friendly and sequential (`NURA-` + 6-digit sequence), **assigned only when an order is paid**. Guest lookup requires email + number or a signed token.                                                                                                |
| FR-CHK-07  | If a product's price changes while it sits in a cart, the cart MUST show the new price with a one-time notice ("Price updated since you added this"). Pending checkout sessions keep the price they were created with (the Order snapshot).                                       |
| FR-CHK-08  | When a subscription cart is checked out, all subscription lines MUST share one delivery interval (a Stripe Checkout constraint: one subscription per session, and all recurring prices share an interval). See 02 §3.                                                             |

### 2.4 Subscriptions (FR-SUB)

| ID        | Requirement                                                                                                               |
| --------- | ------------------------------------------------------------------------------------------------------------------------- |
| FR-SUB-01 | Customers MUST be able to skip, pause (≤ 90 days), resume, change interval, swap variant, add a one-time item and cancel. |
| FR-SUB-02 | The subscription state MUST be reconciled from Stripe webhooks (`customer.subscription.*`, `invoice.*`).                  |
| FR-SUB-03 | Each paid renewal invoice MUST create an Order of type `SUBSCRIPTION_RENEWAL` and decrement stock.                        |
| FR-SUB-04 | A reminder email MUST be sent 3 days before renewal (`invoice.upcoming`).                                                 |
| FR-SUB-05 | Cancellation MUST be completable in ≤ 3 interactions from the subscription page.                                          |

### 2.5 Accounts (FR-ACC)

| ID        | Requirement                                                                                                                                                                                                                                                             |
| --------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| FR-ACC-01 | Sign up / sign in via email+password (with verification), Google and Apple, through Clerk.                                                                                                                                                                              |
| FR-ACC-02 | Users MUST manage addresses (max 10, one default shipping).                                                                                                                                                                                                             |
| FR-ACC-03 | Users MUST see order history, order detail, subscriptions, saved routines, wishlist and reviews.                                                                                                                                                                        |
| FR-ACC-04 | Users MUST be able to export their data (JSON) and request account deletion (GDPR/CCPA). Deletion anonymizes orders (kept for legal/accounting) and deletes the profile, preferences, consultations, wishlist and reviews (or anonymizes reviews at the user's choice). |

### 2.6 Reviews (FR-REV)

| ID        | Requirement                                                                                                 |
| --------- | ----------------------------------------------------------------------------------------------------------- |
| FR-REV-01 | Only verified purchasers (a paid order containing the product) MAY review; one review per user per product. |
| FR-REV-02 | Reviews MUST support rating, title, body, skin type, concerns and up to 3 photos.                           |
| FR-REV-03 | Reviews MUST pass moderation rules; flagged reviews go to the admin queue.                                  |
| FR-REV-04 | Product rating aggregates MUST update on approval/rejection transactionally.                                |
| FR-REV-05 | Reviews MUST be filterable by rating, skin type and "with photos".                                          |

### 2.7 Admin (FR-ADM)

| ID        | Requirement                                                                                                                                   |
| --------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| FR-ADM-01 | Role-based access with permissions (see 10-authentication-design).                                                                            |
| FR-ADM-02 | Product CRUD with draft/publish/archive, variants, images, ingredients, targeting and SEO.                                                    |
| FR-ADM-03 | Inventory adjustments MUST create ledger movements and MUST NOT allow `onHand < reserved`.                                                    |
| FR-ADM-04 | Order management: status transitions via a state machine, fulfilment with tracking, full/partial refunds with restock option, internal notes. |
| FR-ADM-05 | Coupon CRUD with rules and usage stats.                                                                                                       |
| FR-ADM-06 | Review moderation (approve, reject with reason, feature).                                                                                     |
| FR-ADM-07 | Analytics dashboard with date ranges, comparison and CSV export.                                                                              |
| FR-ADM-08 | Every staff mutation MUST write an AuditLog entry with actor, action, entity, before/after diff, IP and user agent.                           |
| FR-ADM-09 | Customer list with search, and detail (orders, LTV, subscriptions, consultations count).                                                      |

### 2.8 Notifications (FR-NOT)

Transactional emails MUST be sent for: order confirmation, shipped, delivered, refund issued, subscription created, renewal reminder, renewal paid, payment failed, subscription cancelled, routine saved/emailed, review request, back-in-stock (P2), low-stock digest (staff), and new order digest (staff, optional).

---

## 3. Non-functional requirements

### 3.1 Performance (NFR-PERF)

| ID          | Metric                                 | Target (p75 real users, mobile 4G)                                                                                                                                                                                                                                                                                                                                                                                                         |
| ----------- | -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| NFR-PERF-01 | LCP                                    | ≤ 2.0 s on Home, PLP, PDP; ≤ 2.5 s elsewhere                                                                                                                                                                                                                                                                                                                                                                                               |
| NFR-PERF-02 | INP                                    | ≤ 200 ms                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| NFR-PERF-03 | CLS                                    | ≤ 0.05                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| NFR-PERF-04 | TTFB (cached pages)                    | ≤ 200 ms at edge                                                                                                                                                                                                                                                                                                                                                                                                                           |
| NFR-PERF-05 | Server Action latency (cart mutations) | ≤ 300 ms p95                                                                                                                                                                                                                                                                                                                                                                                                                               |
| NFR-PERF-06 | Finder recommendation                  | First streamed status ≤ 1 s; usable routine (selection validated) ≤ 10 s p95; explanations fully streamed ≤ 25 s p95; fallback routine ≤ 1 s                                                                                                                                                                                                                                                                                               |
| NFR-PERF-07 | Admin table pages (≤ 50 rows)          | ≤ 500 ms server time p95                                                                                                                                                                                                                                                                                                                                                                                                                   |
| NFR-PERF-08 | JS budget                              | ≤ 170 KB gzipped first-load JS **from our bundle** on storefront routes (Stripe/Framer loaded only where used). Third-party runtime JS (Clerk's `clerk-js`, loaded async from its CDN) is budgeted separately at ≤ 120 KB and must not block LCP or regress INP. This is measured in M0; if it does, the storefront switches to loading Clerk UI only on interaction (account menu, auth pages) with server-side `auth()` still available. |
| NFR-PERF-09 | Images                                 | AVIF/WebP via Cloudinary `f_auto,q_auto`, responsive `srcset`, priority only for the LCP image                                                                                                                                                                                                                                                                                                                                             |

**How:** RSC by default. Tag-based data cache (`"use cache"` + `cacheTag`) for the catalogue. Partial prerendering of product pages (a static shell with dynamic stock/price islands). Font subsetting with `next/font`. `framer-motion` via `LazyMotion` + `domAnimation`. Stripe.js loaded only on `/checkout`.

### 3.2 Accessibility (NFR-A11Y)

| ID          | Requirement                                                                                                                                                                                        |
| ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| NFR-A11Y-01 | Conform to **WCAG 2.2 AA**.                                                                                                                                                                        |
| NFR-A11Y-02 | All interactive elements MUST be keyboard operable, with visible focus (2px ring, 3:1 contrast against adjacent colours).                                                                          |
| NFR-A11Y-03 | Text contrast ≥ 4.5:1 (body), ≥ 3:1 (large text ≥ 24px / 18.66px bold, UI components).                                                                                                             |
| NFR-A11Y-04 | The finder MUST be fully usable with a screen reader: each step is a `<fieldset>` with `<legend>`, progress announced via `aria-live="polite"`, and focus moved to the step heading on navigation. |
| NFR-A11Y-05 | Drag-to-rank for concerns MUST have a keyboard/tap alternative (move up/down buttons).                                                                                                             |
| NFR-A11Y-06 | `prefers-reduced-motion` MUST disable non-essential animation (see 13-design-system §Motion).                                                                                                      |
| NFR-A11Y-07 | Target size ≥ 24×24 CSS px (WCAG 2.5.8); primary touch targets 44×44.                                                                                                                              |
| NFR-A11Y-08 | All images MUST have meaningful alt text or `alt=""` if decorative; alt text is required in the admin media editor.                                                                                |
| NFR-A11Y-09 | Forms MUST associate labels and errors (`aria-describedby`), with errors announced and focus moved to the first invalid field on submit.                                                           |
| NFR-A11Y-10 | Charts MUST have a tabular data alternative ("View as table").                                                                                                                                     |

### 3.3 SEO (NFR-SEO)

| ID         | Requirement                                                                                                                                                                                                                   |
| ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| NFR-SEO-01 | Server-rendered HTML for all public pages; unique `<title>` and meta description via `generateMetadata`.                                                                                                                      |
| NFR-SEO-02 | JSON-LD: `Organization`, `WebSite` + `SearchAction` (home); `Product` + `Offer`/`AggregateOffer` + `AggregateRating` + `Review` (PDP); `BreadcrumbList` (all catalogue pages); `FAQPage` (FAQ); `Article` (ingredient pages). |
| NFR-SEO-03 | Dynamic `sitemap.xml` (products, routines, ingredients, categories, concerns) and `robots.txt` disallowing `/admin`, `/account`, `/checkout`, `/finder/results`, `/api`.                                                      |
| NFR-SEO-04 | Canonical URLs; faceted filter pages `noindex,follow` except whitelisted landing combos (e.g. `/shop/serums/concern/acne`) which have static params and unique copy.                                                          |
| NFR-SEO-05 | Dynamic OG images (`opengraph-image.tsx`) for products, routines and ingredients using brand templates.                                                                                                                       |
| NFR-SEO-06 | Clean, stable URLs: `/products/glow-serum`, `/ingredients/niacinamide`, `/routines/clear-skin`, `/concerns/acne`.                                                                                                             |
| NFR-SEO-07 | 301 redirects for changed slugs (`SlugRedirect` table).                                                                                                                                                                       |
| NFR-SEO-08 | Core Web Vitals targets (NFR-PERF) because they are ranking signals.                                                                                                                                                          |

### 3.4 Security (NFR-SEC) — summary; full plan in `18-security-plan.md`

| ID         | Requirement                                                                                                                                                                                                                                |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| NFR-SEC-01 | All authorization MUST be enforced server-side, per action/route, by permission, not only by middleware.                                                                                                                                   |
| NFR-SEC-02 | All inputs MUST be validated with Zod schemas shared between client and server.                                                                                                                                                            |
| NFR-SEC-03 | Webhooks MUST verify signatures (Stripe `constructEvent`, Clerk/Svix) and be idempotent.                                                                                                                                                   |
| NFR-SEC-04 | No card data touches our servers (Stripe Embedded Checkout → SAQ A).                                                                                                                                                                       |
| NFR-SEC-05 | Rate limits on auth-adjacent, finder, search, review, coupon, order-lookup and all mutation endpoints.                                                                                                                                     |
| NFR-SEC-06 | Two-tier CSP: nonce-based strict CSP on dynamic sensitive routes (checkout, account, admin, auth, results); an allowlist CSP without nonces on static/PPR catalogue pages, so static rendering is preserved (18 §6). HSTS; secure cookies. |
| NFR-SEC-07 | Secrets only in Vercel environment variables; validated at boot with Zod (`env.ts`).                                                                                                                                                       |
| NFR-SEC-08 | PII minimization in logs and in LLM prompts (no names/emails/addresses sent to the AI).                                                                                                                                                    |

### 3.5 Scalability (NFR-SCALE)

| ID           | Requirement                                                                            | Design response                                                                                                                                          |
| ------------ | -------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| NFR-SCALE-01 | Handle 100k monthly sessions and 50 concurrent checkouts at launch, with a path to 10× | Stateless serverless functions; CDN-cached catalogue; Neon autoscaling + pooled connections                                                              |
| NFR-SCALE-02 | Handle a traffic spike of 20× (influencer post) without errors                         | ISR/PPR static shells; cache tags; Redis rate limits protect the AI and DB; the finder queues if the LLM is rate limited (falls back to the rule engine) |
| NFR-SCALE-03 | DB connections MUST NOT exhaust                                                        | Neon pooled connection string (PgBouncer) for runtime + Prisma driver adapter; direct URL only for migrations                                            |
| NFR-SCALE-04 | Long work MUST NOT block requests                                                      | Inngest for emails, Stripe sync, rollups, AI batch jobs                                                                                                  |
| NFR-SCALE-05 | Analytics MUST NOT slow down OLTP queries                                              | Append-only `AnalyticsEvent` with a partition-ready design (monthly by `occurredAt`); nightly rollups into `DailyMetric`; dashboards read rollups        |
| NFR-SCALE-06 | Catalogue growth to 1,000 SKUs without a redesign                                      | Indexed filters; the finder candidate pre-filter runs in SQL; LLM receives ≤ 40 candidates                                                               |

### 3.6 Reliability & availability (NFR-REL)

| ID         | Requirement                                                                                                                                                                                                                 |
| ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| NFR-REL-01 | Availability target 99.9% monthly for the storefront (bounded by Vercel/Neon SLAs).                                                                                                                                         |
| NFR-REL-02 | Degraded modes: AI down → rule engine; Redis down → rate limiter fails open for browsing and fails closed for the AI endpoint (fallback engine used); Cloudinary down → cached CDN; Resend down → Inngest retries for 24 h. |
| NFR-REL-03 | RPO ≤ 1 h / RTO ≤ 4 h. Neon point-in-time restore (7-day history on the paid tier); daily logical backup to object storage (P1).                                                                                            |
| NFR-REL-04 | All external calls MUST have timeouts and bounded retries with jitter.                                                                                                                                                      |

### 2.9 Requirements added in the pre-implementation review

| ID        | Requirement                                                                                                                                                                                                                                                                     | Priority |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| FR-RET-01 | Customers MUST be able to request a return/refund for a delivered order within 30 days from the order detail (reason, items, optional photos). Admin approves, rejects or partially approves, which leads to a refund via the existing refund flow. `ReturnRequest` table (08). | P1       |
| FR-RET-02 | "Report a skin reaction" (adverse event) intake as described in NFR-PRIV; it links to the returns flow with a "reaction" reason and a no-questions refund policy for first-time reactions.                                                                                      | P1       |
| FR-ADM-10 | Admin "Abandoned checkouts" view (PENDING/EXPIRED attempts, last 30 days) for recovery insight.                                                                                                                                                                                 | P2       |
| FR-ACC-05 | Customers MUST be able to update the shipping address of an unfulfilled order (status PAID) within 1 hour of payment; after that, support handles it.                                                                                                                           | P2       |
| FR-OPS-01 | Support ticket-lite: `SupportCase` records (type: adverse_event, return, general) visible in the admin, linked to customers and orders. No external helpdesk integration in v1.                                                                                                 | P1       |

### 3.7 Maintainability (NFR-MNT)

- TypeScript `strict`, `noUncheckedIndexedAccess`; ESLint (next, typescript-eslint strict, jsx-a11y, import order) and Prettier.
- Feature-based folder structure with clear server/client boundaries (`server-only` package).
- ≥ 80% line coverage on `features/*/server` domain services (pricing, inventory, finder engine, state machines).
- Conventional Commits; ADRs in `docs/adr/` for significant decisions.

### 3.8 Privacy & compliance (NFR-PRIV)

- Cookie consent for non-essential analytics (EU/UK). Essential cookies: session, cart, consult, CSRF.
- Privacy policy, terms and subscription terms pages. Auto-renewal disclosures at checkout (California ARL): the renewal terms are shown next to the pay button and the consent checkbox is explicit.
- Health-adjacent data (pregnancy, skin conditions) is treated as **sensitive**: explicit consent at the finder step, stored in `CustomerPreference` with its own consent timestamp, excluded from marketing segmentation, deleted on request.
- **US consumer health data laws (added in review R-15).** Pregnancy, "trying to conceive", rosacea/eczema and prescription use can count as _consumer health data_ under Washington's My Health My Data Act and similar laws (Nevada, Connecticut). Requirements:
  - a separate, linkable **Consumer Health Data Privacy Policy** (`/legal/health-data`);
  - **consent to collect** that is separate from general terms (the finder `conditions` step: an unchecked checkbox with specific wording, stored with a timestamp and the policy version);
  - sharing only with processors under contract (the LLM provider receives only normalized flags, never free text containing conditions if the user withheld consent);
  - the right to withdraw consent and delete (the Skin profile page);
  - **no geofencing** or advertising use of this data.

  If consent is declined, the `conditions` step is skipped; the finder still works, and pregnancy-sensitive filtering is offered as a neutral preference ("Show only pregnancy-safe options") that isn't stored as a condition.

- **Cosmetic adverse events (MoCRA):** customers MUST be able to report a reaction ("Report a skin reaction" on the order detail and the contact page). Reports create a support ticket flagged `adverse_event`, store the product, lot (if known) and description, and are visible to ADMIN only. A serious-event triage runbook exists. The responsible-person reporting obligation is documented, though as a fictional brand it isn't exercised.
- **Global Privacy Control** honoured; the US "Your privacy choices" footer link; the EU/UK consent banner (region by Vercel geo).

### 3.9 Browser & device support

Last 2 versions of Chrome, Edge, Firefox and Safari (macOS/iOS 16+); Samsung Internet latest. Layouts: 360 px → 1920 px. The admin is optimized for ≥ 1024 px and usable at ≥ 768 px (tablet for the Inventory Manager).

### 3.10 Internationalization readiness

Launch is en-US / USD only. All copy lives in message files (`next-intl`-compatible structure), money is formatted with `Intl.NumberFormat`, and dates with `Intl.DateTimeFormat` in the user's timezone. Store times are UTC in the DB.
