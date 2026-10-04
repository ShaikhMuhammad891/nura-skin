# 06 — System Architecture & Technology Stack

This document covers the architecture sections of the brief ("System Architecture") and the "Technology Stack" section. Folder layout is in `07-folder-structure.md`.

---

## 1. Architecture at a glance

**Style:** a _modular monolith_ on Next.js App Router, deployed serverless on Vercel.

**Why a monolith:** one team, one deployable, shared types end to end, and the fewest moving parts. Modules (features) keep strict boundaries so that any of them (for example the AI engine or analytics) can be extracted into a service later without rewriting callers.

```
                                   ┌───────────────────────── Vercel ─────────────────────────┐
  Browser / Mobile Web             │                                                          │
  ┌──────────────────┐   HTTPS     │  Edge Network (CDN, static assets, PPR shells, OG imgs)  │
  │ RSC payload +    │◄───────────►│        │                                                 │
  │ Client islands   │             │        ▼                                                 │
  │ (cart, finder,   │             │  Middleware (Clerk auth, route guards, sid/utm cookies,  │
  │  checkout, admin │             │              security headers + CSP nonce)               │
  │  tables/charts)  │             │        │                                                 │
  └──────────────────┘             │        ▼                                                 │
        │  Stripe.js iframe        │  Node.js Functions (Fluid compute)                       │
        │  (card data never        │  ┌────────────────────────────────────────────────────┐  │
        │   touches our servers)   │  │ App Router: RSC pages · Server Actions ·           │  │
        │                          │  │ Route Handlers (/api/v1, /api/webhooks, /api/inngest)│ │
        ▼                          │  │                                                    │  │
   ┌─────────┐                     │  │  Feature modules (domain services, server-only):   │  │
   │ Stripe  │◄──── API ──────────►│  │  catalog · cart · pricing · checkout · orders ·    │  │
   │         │──── webhooks ──────►│  │  subscriptions · inventory · finder · reviews ·    │  │
   └─────────┘                     │  │  coupons · analytics · audit · notifications       │  │
   ┌─────────┐                     │  │                                                    │  │
   │ Clerk   │◄── session JWT ────►│  │  Infra adapters (lib/): db · stripe · clerk ·      │  │
   │         │──── webhooks ──────►│  │  ai · cloudinary · email · redis · logger · env    │  │
   └─────────┘                     │  └────────────────────────────────────────────────────┘  │
                                   └───────┬──────────────┬─────────────┬──────────────┬──────┘
                                           │              │             │              │
                             ┌─────────────▼───┐  ┌───────▼──────┐ ┌────▼──────┐ ┌─────▼──────┐
                             │ Neon Postgres   │  │ Upstash Redis│ │ Inngest   │ │ Anthropic  │
                             │ (pooled, Prisma)│  │ rate limit,  │ │ jobs,     │ │ Claude API │
                             │ branches/env    │  │ ephemeral    │ │ crons,    │ └────────────┘
                             └─────────────────┘  │ cache, locks │ │ retries   │ ┌────────────┐
                                                  └──────────────┘ └───────────┘ │ Cloudinary │
                                                          ┌────────┐ ┌────────┐  │ media CDN  │
                                                          │ Resend │ │ Sentry │  └────────────┘
                                                          └────────┘ └────────┘
```

---

## 2. Technology stack & rationale

### 2.1 Mandated stack

| Layer        | Technology                                               | Why it was selected                                                                                                                                                                                                                                                                  | Alternatives rejected & why                                                                                                                                          |
| ------------ | -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Framework    | **Next.js (App Router, ≥ 15, Cache Components enabled)** | RSC reduces client JS on content-heavy commerce pages. Built-in SEO (metadata API, sitemaps, OG image generation). Partial Prerendering gives a static PDP shell with dynamic stock/price. Server Actions remove API boilerplate for UI mutations. Best-in-class Vercel integration. | Remix/React Router 7 (less mature caching primitives for this use case); Astro (weak for app-like admin and cart); SPA + separate API (duplicated types, more infra) |
| UI library   | **React 19**                                             | `useOptimistic`, `useActionState` and form actions fit the Server Actions model; Suspense streaming for the finder.                                                                                                                                                                  | —                                                                                                                                                                    |
| Language     | **TypeScript (strict)**                                  | One type system from the DB (Prisma types) through Zod schemas to UI props. This is critical for money, state machines and API contracts.                                                                                                                                            | —                                                                                                                                                                    |
| Styling      | **Tailwind CSS v4**                                      | Design tokens as CSS variables (`@theme`) map one-to-one to the design system; zero runtime; consistent spacing scale; dark-mode variants.                                                                                                                                           | CSS-in-JS (runtime cost, RSC friction)                                                                                                                               |
| Components   | **shadcn/ui** (Radix primitives)                         | Accessible primitives (Dialog, Popover, Select, Tabs) that we _own_ and restyle to the brand, with no locked dependency.                                                                                                                                                             | MUI/Chakra (heavy, hard to make look premium and bespoke)                                                                                                            |
| Motion       | **Framer Motion** (`motion/react`, `LazyMotion`)         | Declarative, interruptible animations for finder transitions, cart drawer and layout animations (`layoutId` for routine step reordering). Loaded lazily with the `domAnimation` feature set (~15 KB).                                                                                | GSAP (imperative, licence considerations for commercial use); CSS-only (insufficient for shared-layout transitions)                                                  |
| Backend      | **Route Handlers + Server Actions**                      | Server Actions for same-origin UI mutations (typed, progressive enhancement, built-in CSRF protection via origin checks). Route Handlers for webhooks, SSE streaming, the public/versioned API and third-party callers.                                                              | tRPC (redundant with Server Actions); a separate Express service (extra deploy)                                                                                      |
| Database     | **PostgreSQL (Neon)**                                    | Relational integrity for orders, money and inventory; row locks for stock; JSONB for snapshots and flexible analytics properties; `pg_trgm`/FTS for search. Neon adds serverless autoscaling, scale-to-zero for previews and **database branching per preview deployment**.          | MongoDB (weak transactional guarantees for commerce); PlanetScale (no FKs by default in the Vitess model)                                                            |
| ORM          | **Prisma**                                               | Declarative schema, migrations and type-safe client. The driver adapter (`@prisma/adapter-neon`) works over pooled/serverless connections. `$transaction` with interactive mode handles inventory. Raw SQL (`$queryRawTyped` / TypedSQL) for analytics and FTS.                      | Drizzle (a valid choice; Prisma was chosen because the brief mandates it and for its migration workflow)                                                             |
| Auth         | **Clerk**                                                | Hosted, secure auth (MFA, OAuth, bot protection, session management) with no password storage liability. Next.js middleware integration. `publicMetadata` carries the role into session claims, so the edge can guard routes without a DB hit. Webhooks sync users.                  | NextAuth/Auth.js (we'd own MFA, bot protection and session revocation UI)                                                                                            |
| Payments     | **Stripe (test mode)**                                   | Embedded Checkout handles SCA/3DS, wallets, tax, promotion codes and **mixed one-time + recurring carts** in one session. Billing handles subscriptions, Smart Retries, dunning and the Customer Portal. PCI scope is reduced to SAQ A.                                              | Custom Payment Element flow (more PCI surface and more code for mixed carts); Paddle/LemonSqueezy (MoR, less control)                                                |
| Media        | **Cloudinary**                                           | On-the-fly transforms (`f_auto,q_auto,w_*`), AVIF/WebP, focal-point cropping (`g_auto`), signed uploads from the admin, a CDN, and named transformations per slot (e.g. `t_pdp_main`).                                                                                               | Vercel Blob + next/image (no transform presets or DAM UI for non-dev staff); S3 + imgproxy (ops burden)                                                              |
| Client state | **Zustand**                                              | Tiny, no provider, selector-based re-renders. Used **only** for client UI state: cart drawer open, finder in-progress answers (mirrored to the server), admin table view preferences. _Server state is never duplicated into Zustand; the server remains the source of truth._       | Redux Toolkit (overkill); React Context (re-render storms)                                                                                                           |
| Forms        | **React Hook Form + Zod**                                | Uncontrolled inputs give fast forms. Zod schemas are **shared** between client validation and Server Action validation (`@hookform/resolvers/zod`).                                                                                                                                  | Formik (slower, less maintained)                                                                                                                                     |
| Hosting      | **Vercel**                                               | Zero-config Next.js, preview deployments per PR, edge network, cron, Speed Insights, Web Analytics, environment management.                                                                                                                                                          | Self-hosted Docker (ops overhead for a small team)                                                                                                                   |
| DB hosting   | **Neon**                                                 | Serverless Postgres, branching for previews and CI, pooled connections, PITR.                                                                                                                                                                                                        | Supabase (a valid alternative; Neon's branching is a better fit for per-PR previews)                                                                                 |

### 2.2 Supporting services (added by the architect; each justified)

| Need (from the brief)                 | Service                                                                                                    | Why                                                                                                                                                                                                                                                                                |
| ------------------------------------- | ---------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| AI integration                        | **Anthropic Claude API** via `@anthropic-ai/sdk` — model `claude-opus-5` (configurable through `AI_MODEL`) | Strong instruction-following for grounded selection; **structured outputs** (`output_config.format` with a JSON schema) guarantee a parseable result; streaming for progressive UI. Model choice is revisited with the eval set (see 12-ai §9) before switching to a cheaper tier. |
| Background jobs                       | **Inngest**                                                                                                | Durable functions on Vercel with retries, step functions, delays (`step.sleep` for "review request in 21 days"), cron, concurrency keys and a local dev server. Vercel Cron alone lacks retries and delayed jobs.                                                                  |
| Email                                 | **Resend + React Email**                                                                                   | Emails are written as React components with the same design tokens; good deliverability; simple API; test mode.                                                                                                                                                                    |
| Rate limiting, ephemeral cache, locks | **Upstash Redis** (`@upstash/ratelimit`)                                                                   | HTTP-based Redis works from serverless and edge; sliding-window limits; short-lived idempotency locks.                                                                                                                                                                             |
| Error tracking & tracing              | **Sentry** (`@sentry/nextjs`)                                                                              | Source-mapped errors across server, edge and client; performance traces; release health.                                                                                                                                                                                           |
| Web vitals / product analytics        | **Vercel Speed Insights + first-party `AnalyticsEvent`**                                                   | Business analytics are owned first-party (in our DB) for the admin dashboard. No third-party trackers are needed for core KPIs, which is better for privacy and CSP.                                                                                                               |
| Feature flags (P1)                    | **Vercel Flags SDK** (env-backed at first)                                                                 | For gradual rollout of AI prompt versions and UI experiments.                                                                                                                                                                                                                      |

---

## 3. Frontend architecture

### 3.1 Rendering strategy per route

| Route                                                         | Rendering                                                                                                | Cache / revalidation                                | Notes                                                       |
| ------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- | --------------------------------------------------- | ----------------------------------------------------------- |
| `/` Home                                                      | PPR: static shell + cached sections                                                                      | `cacheTag('home','products')`, `cacheLife('hours')` | Personalized greeting island (dynamic, Suspense)            |
| `/shop`, `/shop/[category]`                                   | Dynamic RSC reading `searchParams` → cached query per filter key                                         | `cacheTag('products')`                              | Filters are links; results stream in Suspense               |
| `/products/[slug]`                                            | PPR: static (`generateStaticParams` for all published) + dynamic stock/price/"fits your routine" islands | `cacheTag('product:<slug>')`                        | Revalidated on admin publish, price change, review approval |
| `/routines/[slug]`, `/ingredients/[slug]`, `/concerns/[slug]` | Static + tag revalidation                                                                                | tags per entity                                     | SEO pages                                                   |
| `/finder/**`                                                  | Client-heavy island inside an RSC layout                                                                 | No cache (`noStore`)                                | Answers autosaved via Server Actions                        |
| `/finder/results/[id]`                                        | Dynamic RSC (authz check: owner or anonymous cookie)                                                     | Private, no CDN cache                               |                                                             |
| `/cart` (drawer)                                              | Client component hydrated from RSC-provided cart                                                         | `cacheTag('cart:<id>')` per request                 | Optimistic updates with `useOptimistic`                     |
| `/checkout`                                                   | Dynamic, client Stripe embed                                                                             | none                                                | Stripe.js loaded only here                                  |
| `/account/**`                                                 | Dynamic RSC, auth required                                                                               | per-user, no CDN                                    |                                                             |
| `/admin/**`                                                   | Dynamic RSC + client tables/charts                                                                       | none (fresh), except analytics 5 min                | `robots: noindex`                                           |

### 3.2 Component layering

1. **`components/ui`**: shadcn primitives restyled with brand tokens (Button, Input, Dialog…). No business logic.
2. **`components/shared`**: brand compositions used across features (Price, Rating, ProductImage, EmptyState, Section).
3. **`features/<feature>/components`**: feature-specific components (ProductCard, RoutineTimeline, CheckoutSummary). They may import from 1–2 only.
4. **`app/**/page.tsx`**: composition and data loading only. It calls `features/<x>/server/queries.ts`.

**Rules:**

- Server Components by default. `"use client"` only at leaves that need interactivity.
- Server-only modules import `server-only`, so a client import fails at build time.
- Data fetching happens in RSC via query functions; mutations go through Server Actions in `features/<x>/server/actions.ts`.
- Every Server Action goes through `createAction()` (see 09-api-design §2), which wraps Zod validation, auth, permission, rate limit, error mapping and audit.

### 3.3 State management

| State kind          | Where                                                           | Example                                                   |
| ------------------- | --------------------------------------------------------------- | --------------------------------------------------------- |
| Server/domain state | Postgres → RSC props                                            | products, cart contents, orders                           |
| URL state           | `searchParams`                                                  | PLP filters, admin table filters/sort/page, finder step   |
| Form state          | React Hook Form                                                 | admin product editor, review form, address form           |
| Client UI state     | Zustand stores (`useCartUI`, `useFinderDraft`, `useAdminPrefs`) | drawer open, unsaved finder answers mirror, table density |
| Optimistic state    | `useOptimistic`                                                 | cart qty changes, wishlist toggle                         |
| Streaming state     | SSE via `fetch` + ReadableStream reader                         | finder analyzing status, AI text                          |

### 3.4 Styling & theming

Tailwind v4 `@theme` tokens are generated from `13-design-system.md`. Light theme is the default for the storefront; dark mode is supported through the `class` strategy (see design system §Dark mode). Fonts use `next/font` (Fraunces, Inter, JetBrains Mono), self-hosted and subset.

---

## 4. Backend architecture

### 4.1 Layers inside a feature module

```
features/orders/
  server/
    actions.ts      ← Server Actions (thin: validate → authorize → call service → revalidate)
    queries.ts      ← read functions for RSC (cached where safe)
    service.ts      ← domain logic (pure-ish, receives tx/db + deps; unit tested)
    repository.ts   ← Prisma access for complex queries (optional; simple ones inline in service)
    state-machine.ts← allowed transitions (orders/subscriptions)
  schemas.ts        ← Zod schemas (shared client/server)
  types.ts
  components/
```

- **Services never import Next.js APIs** (`cookies`, `revalidateTag`), so they stay testable and reusable by Inngest functions and webhooks.
- **Actions/route handlers** own HTTP/Next concerns: cookies, redirects, revalidation.
- **Cross-feature calls** go through the other feature's `service.ts` public functions only; features never touch another feature's repository directly.

### 4.2 Transactions & consistency

- Inventory, orders, coupons and payments are updated in **Prisma interactive transactions** with `SELECT … FOR UPDATE` on `InventoryItem` rows (via `$queryRaw`), at `ReadCommitted` isolation + row locks, with a retry on serialization or deadlock (max 3).
- External side effects (email, Stripe sync, analytics) are **not** run inside DB transactions. They are published as Inngest events **after commit** (transactional outbox pattern: an `OutboxEvent` row is written in the same transaction and a dispatcher sends it to Inngest. This guarantees no lost events if Inngest's API fails right after commit).

### 4.3 Error model

Domain errors are typed (`AppError` with `code`: `NOT_FOUND`, `FORBIDDEN`, `VALIDATION`, `CONFLICT`, `OUT_OF_STOCK`, `COUPON_INVALID`, `RATE_LIMITED`, `PAYMENT_PROVIDER`, `AI_UNAVAILABLE`, `INTERNAL`). They map to HTTP status codes in route handlers and to `{ ok:false, error }` results in Server Actions. Unknown errors are logged to Sentry with a request ID and returned as `INTERNAL` without leaking details.

---

## 5. Database architecture

- **Primary DB:** Neon Postgres 16, with one database per environment. Preview deployments get a **Neon branch** created by the Vercel integration, seeded from a sanitized staging snapshot.
- **Connections:** `DATABASE_URL` (pooled, `-pooler` host) for runtime through the Neon adapter in **WebSocket/Pool mode**. This is required for interactive transactions and `FOR UPDATE` locks; the HTTP mode can't hold a transaction (08 §6.2, review R-21). `DIRECT_URL` is for `prisma migrate`.
- **Extensions:** `pg_trgm` (fuzzy search), `citext` (case-insensitive email/codes), `pgcrypto` (UUIDs if needed).
- **IDs:** `cuid2` strings for public entities (non-sequential, URL-safe); `Order.number` from a Postgres sequence for human-friendly display.
- **Money:** integer minor units (`Int` cents) + `currency` (ISO 4217). Never floats.
- **Timestamps:** `timestamptz` in UTC, `createdAt` / `updatedAt` on every table.
- **Soft delete:** `archivedAt` for products/variants/coupons (referential history must survive); hard delete only for ephemeral rows (cart items, expired reservations).
- **Snapshots:** orders copy product name, variant, SKU, image and unit price into `OrderItem`, so history never changes when the catalogue changes.
- **Analytics:** append-only `AnalyticsEvent` + nightly `DailyMetric` rollups + `CustomerMetric` materialization.

Full schema: `08-database-design.md`.

---

## 6. External services map

| Service       | Purpose                               | Integration point                                                | Failure behaviour                                                                                                              |
| ------------- | ------------------------------------- | ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| Clerk         | Identity, sessions, MFA               | `clerkMiddleware`, `auth()`, `/api/webhooks/clerk` (Svix-signed) | Clerk down → storefront browsing still works (public routes); account/checkout sign-in unavailable; guest checkout still works |
| Stripe        | Payments, subscriptions, tax, refunds | `lib/stripe.ts`, Server Actions, `/api/webhooks/stripe`          | Checkout unavailable → banner "Checkout temporarily unavailable"; cart preserved                                               |
| Neon          | Data                                  | Prisma                                                           | Hard dependency. Health check `/api/health`; static PPR shells still render                                                    |
| Cloudinary    | Image delivery & upload               | `next-cloudinary` / custom loader; signed upload API route       | CDN-cached; uploads fail gracefully in the admin                                                                               |
| Anthropic     | AI routine selection & explanation    | `lib/ai.ts` in `features/finder/server/engine`                   | Rule-based fallback (see 12-ai §8)                                                                                             |
| Resend        | Transactional email                   | Inngest functions → `lib/email.ts`                               | Inngest retries (exponential, 24 h)                                                                                            |
| Upstash Redis | Rate limit, locks, short cache        | `lib/redis.ts`, `lib/rate-limit.ts`                              | Fail-open for reads, fail-closed for the AI                                                                                    |
| Inngest       | Jobs, crons, delays                   | `/api/inngest`                                                   | Events buffered by Inngest; outbox replays                                                                                     |
| Sentry        | Errors, traces                        | `instrumentation.ts`                                             | Non-blocking                                                                                                                   |

---

## 7. Authentication flow (summary; detail in `10-authentication-design.md`)

```
Browser ──(sign in via Clerk components)──► Clerk ──► session cookie (__session JWT, short-lived, auto-refreshed)
Request ──► middleware: clerkMiddleware → isPublicRoute? pass : auth.protect()
                       /admin/** → sessionClaims.metadata.role ∈ STAFF_ROLES else rewrite 404
         ──► RSC / Server Action: getCurrentUser() → DB User (by clerkId, JIT upsert) → requirePermission('order:refund')
Clerk ──(webhook user.created/updated/deleted, session.created)──► /api/webhooks/clerk → upsert/anonymize User, audit staff logins
Role change (admin UI) → DB User.roleId + clerkClient.users.updateUserMetadata(publicMetadata.role) → session claims refresh
```

---

## 8. Payment flow (summary; detail in `11-payment-design.md`)

```
Cart ─► createCheckoutSession (Server Action)
          ├─ PricingEngine.quote(cart) (authoritative)
          ├─ tx: Order(PENDING_PAYMENT) + OrderItems + InventoryReservations(expires 35m) + CouponHold
          └─ stripe.checkout.sessions.create({ui_mode:'embedded', mode, line_items (Stripe Price IDs), metadata.orderId, …}, {idempotencyKey: order.id})
Browser ─► <EmbeddedCheckout clientSecret> ─► Stripe (card/3DS/Apple Pay)
Stripe ─► webhook checkout.session.completed ─► verify signature ─► WebhookEvent insert (unique event.id) ─► OrderService.markPaid (tx)
                                                                  ─► Outbox: order.paid → emails, analytics, subscription link
Stripe ─► invoice.paid (renewals) ─► create renewal Order ─► decrement stock ─► email
Stripe ─► checkout.session.expired ─► release reservations, Order EXPIRED
```

---

## 9. AI architecture (summary; detail in `12-ai-routine-finder-design.md`)

```
Answers ─► ProfileNormalizer (Zod, deterministic) ─► SkinProfile
        ─► SafetyScreen (rules + keyword/LLM classifier on free text) ─► flags
        ─► CandidateRetriever (SQL hard filters: published, in stock, pregnancy, avoid-list, fragrance, vegan, budget)
        ─► RuleScorer (concern × ingredient efficacy matrix, skin-type fit, sensitivity penalty, price fit) ─► top-N per slot
        ─► LLM Selector/Explainer (Claude, structured output, may ONLY reference candidate IDs)
        ─► Validator (IDs ∈ candidates, conflict check per AM/PM, step count, budget per tier) ──fail──► RuleEngine fallback
        ─► Persist RoutineConsultation + RoutineRecommendation(tiers) + RoutineSteps ─► stream to UI
```

The LLM is a **ranker and explainer over a pre-filtered, pre-validated set**, never a product generator.

---

## 10. Image management

| Aspect           | Decision                                                                                                                                                                                                                                                                        |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Storage          | Cloudinary, folder structure `nura/{env}/products/{productSlug}/`, `nura/{env}/brand/`, `nura/{env}/reviews/{userId}/`                                                                                                                                                          |
| Upload (admin)   | Signed uploads: the Server Action `getUploadSignature()` checks permission `product:update` and returns a signature with `folder`, `allowed_formats`, `max_file_size` (10 MB) and `upload_preset=nura_admin` (unsigned presets disabled)                                        |
| Upload (reviews) | Signed with `nura_reviews` preset: 5 MB, jpg/png/webp/heic, auto-moderation (Cloudinary AI moderation add-on optional); images stored `PENDING` until the review is approved                                                                                                    |
| DB               | `ProductImage { publicId, width, height, alt, position, variantId? }`. Store **publicId, not URLs**; URLs are built at render time                                                                                                                                              |
| Delivery         | Custom `next/image` loader → Cloudinary URL with `f_auto,q_auto,c_fill,g_auto,w_{w}`, `dpr` via srcset; blur placeholder from a stored tiny base64 (`blurDataUrl`, generated on upload by an Inngest job)                                                                       |
| Named transforms | `pdp_main` (1:1, 1200), `card` (4:5, 600), `thumb` (1:1, 160), `og` (1200×630 composited), `hero` (16:9 / 4:5 art-directed)                                                                                                                                                     |
| Brand assets     | Versioned in Cloudinary; manifest `src/config/assets.ts` maps asset keys (from 17-asset-inventory) → publicIds, so **no hard-coded URLs** in components and no placeholder can slip through (a CI check fails if a component references an asset key missing from the manifest) |

---

## 11. Email system

| Aspect    | Decision                                                                                                                                                                                                        |
| --------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Provider  | Resend; domain `mail.nuraskin.com` (fictional) with SPF, DKIM, DMARC `p=quarantine`                                                                                                                             |
| Templates | React Email components in `src/emails/*`, sharing tokens with the site; plain-text alternative auto-generated                                                                                                   |
| Sending   | **Always async** through Inngest functions (`email/send`), keyed by `idempotencyKey = {template}:{entityId}:{version}` so retries never double-send                                                             |
| Types     | Transactional (no unsubscribe needed but included in the footer for preferences), Lifecycle/marketing (requires `marketingConsent`, one-click unsubscribe `List-Unsubscribe` + `List-Unsubscribe-Post` headers) |
| Logging   | `EmailLog { template, to(hash), status, providerId, entityType, entityId }` for support traceability                                                                                                            |
| Preview   | `email dev` server locally; `/admin/emails` preview route in staging only                                                                                                                                       |

---

## 12. Caching strategy

| Layer              | What                                                                                                                | Mechanism                                                 | Invalidation                                 |
| ------------------ | ------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- | -------------------------------------------- |
| Browser            | Static assets, fonts, images                                                                                        | Immutable hashed filenames; Cloudinary `max-age=31536000` | Filename/version change                      |
| CDN (Vercel)       | PPR static shells, static pages, OG images                                                                          | Build/ISR output                                          | `revalidateTag` / `revalidatePath`           |
| Next.js data cache | Catalogue queries, product by slug, category lists, ingredient pages, home sections, analytics rollups              | `"use cache"` + `cacheTag()` + `cacheLife()`              | Tags below, emitted by services after commit |
| Request memo       | Current user, cart within one request                                                                               | React `cache()`                                           | Per request                                  |
| Redis              | Rate-limit counters, idempotency locks, AI candidate-set cache by profile hash (10 min), search autocomplete (60 s) | Upstash                                                   | TTL                                          |
| DB                 | —                                                                                                                   | Proper indexes; no query cache                            | —                                            |

**Tag taxonomy:** `products` (any listing), `product:{slug}`, `category:{slug}`, `ingredient:{slug}`, `routine:{slug}`, `home`, `reviews:{productId}`, `cart:{cartId}`, `analytics`, `settings`.
**Rule:** anything user-specific (cart, account, results) is never put in the shared cache without the user or cart ID in the tag and key. Price and stock on the PDP are rendered in a dynamic island so a cached shell can never show a stale price at checkout. The checkout always recomputes prices anyway.

---

## 13. Background jobs (Inngest)

| Function                     | Trigger                                     | Purpose                                                                                        | Retries / concurrency        |
| ---------------------------- | ------------------------------------------- | ---------------------------------------------------------------------------------------------- | ---------------------------- |
| `outbox/dispatch`            | cron every 1 min + after-commit fast path   | Deliver `OutboxEvent` rows to Inngest                                                          | Idempotent by event ID       |
| `email/send`                 | event                                       | Render and send an email                                                                       | 5 retries, exponential       |
| `order/paid`                 | event `order.paid`                          | Confirmation email, CustomerMetric update, schedule onboarding series, schedule review request | step functions               |
| `order/review-request`       | `step.sleepUntil(deliveredAt+21d)`          | Review email if not reviewed                                                                   | cancel on `review.submitted` |
| `routine/onboarding`         | event `order.delivered`                     | Day 0/14/28 emails                                                                             | cancelable                   |
| `routine/checkin`            | `step.sleep(90d)` after first routine order | Re-consultation invite                                                                         |                              |
| `replenish/reminder`         | daily cron                                  | Non-subscribers approaching `replenishDays`                                                    |                              |
| `inventory/release-expired`  | cron every 5 min                            | Release reservations past `expiresAt` (safety net for missed webhooks)                         | concurrency 1                |
| `inventory/low-stock-digest` | daily cron 07:00 store TZ                   | Email the Inventory Manager                                                                    |                              |
| `stripe/product.sync`        | event `product.published/updated`           | Upsert Stripe Product & Prices                                                                 | concurrency key per product  |
| `stripe/reconcile`           | nightly cron                                | Compare the last 48 h of Stripe payments/subscriptions vs DB; alert on drift                   |                              |
| `analytics/rollup-daily`     | cron 00:15 UTC                              | Build `DailyMetric` for the previous day (idempotent upsert)                                   |                              |
| `analytics/customer-metrics` | nightly                                     | Materialize LTV, order count, lifecycle stage                                                  |                              |
| `media/blur-placeholder`     | event `media.uploaded`                      | Generate `blurDataUrl`, dimensions                                                             |                              |
| `ai/eval-nightly` (staging)  | nightly                                     | Run the finder eval set against the current prompt version, and report the score               |                              |
| `privacy/delete-user`        | event                                       | Anonymize/delete per FR-ACC-04                                                                 |                              |
| `cart/abandoned` (P1)        | `checkout.session.expired` + 1h             | Recovery email (consent required)                                                              |                              |

---

## 14. Observability

- **Logging:** `pino` JSON logs with `requestId` (from the `x-vercel-id` header or generated), `userId` (hashed), `route`, `durationMs`. PII redaction paths: `email`, `address`, `phone`, `name`, `notes`. Logs are shipped via Vercel Log Drains to Axiom/Better Stack (P1).
- **Errors:** Sentry with `beforeSend` scrubbing; release tagging by git SHA.
- **Metrics:** Vercel Speed Insights (CWV); custom business metrics via `DailyMetric`; AI metrics (latency, tokens, fallback rate) in `RoutineConsultation` columns and the admin "Finder insights" page.
- **Health:** `/api/health` checks DB (`SELECT 1`), Redis ping and env sanity; uptime monitor (Better Stack) on `/` and `/api/health`.

Detail: `20-deployment-strategy.md` §Monitoring.

---

## 15. Key architecture decision records (ADR summary)

| ADR     | Decision                                                                                                                                     | Status                                    |
| ------- | -------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------- |
| ADR-001 | Modular monolith on Next.js; features as boundaries                                                                                          | Accepted                                  |
| ADR-002 | Stripe **Embedded Checkout** instead of a custom Payment Element flow (mixed carts, wallets, tax, reduced PCI scope; keeps the user on-site) | Accepted                                  |
| ADR-003 | Webhooks are the only path that marks orders paid or changes subscription state                                                              | Accepted                                  |
| ADR-004 | Inventory reserved at checkout-session creation, with a movement ledger                                                                      | Accepted                                  |
| ADR-005 | LLM constrained to candidate IDs + structured output + deterministic validator + rule fallback                                               | Accepted                                  |
| ADR-006 | Roles in the DB (source of truth), mirrored to Clerk `publicMetadata` for edge checks                                                        | Accepted                                  |
| ADR-007 | Transactional outbox → Inngest for side effects                                                                                              | Accepted                                  |
| ADR-008 | Money as integer cents + currency                                                                                                            | Accepted                                  |
| ADR-009 | First-party analytics events + nightly rollups instead of a third-party analytics SaaS for business KPIs                                     | Accepted                                  |
| ADR-010 | Cloudinary publicIds + asset manifest; CI blocks unknown asset keys                                                                          | Accepted                                  |
| ADR-011 | Stripe spike findings: pinned API version, subscription-mode charge resolution, shipping in subscription mode (M1.5)                         | Pending spike                             |
| ADR-012 | AI model, effort level and two-phase output with a static index-based schema (M3.5)                                                          | Accepted in design; numbers pending spike |
| ADR-013 | Two-tier CSP: nonce on dynamic sensitive routes, allowlist on static pages                                                                   | Accepted (review R-03)                    |
| ADR-014 | Staged production deploys (`--skip-domain` → smoke → promote) instead of cross-environment promotion                                         | Accepted (review R-02)                    |
| ADR-015 | Guest-data claim in the `/auth/complete` route handler; external calls never inside DB transactions (outbox)                                 | Accepted (review R-10, R-13)              |
| ADR-016 | `DEMO_STAFF` role with rolled-back mutations for the public admin demo                                                                       | Accepted (review R-06)                    |
| ADR-017 | Server Actions only for v1 mutations; REST limited to streaming, webhooks, polling, public catalogue GETs                                    | Accepted (review R-17)                    |

See `23-architecture-review.md` for the review that produced ADR-012 to ADR-017.
