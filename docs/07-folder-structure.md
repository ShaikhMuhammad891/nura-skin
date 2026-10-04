# 07 — Folder Structure

**Principles**

1. **Feature-first.** Business logic lives in `src/features/<feature>`. Routes in `src/app` are thin composition layers.
2. **Explicit server/client boundary.** Everything in `features/*/server/**` and `src/lib/server/**` imports `server-only`.
3. **Shared contracts.** Zod schemas in `features/*/schemas.ts` are imported by both client forms and server actions.
4. **Route groups** separate layouts without affecting URLs: `(storefront)`, `(account)`, `(auth)`, `(checkout)`; `admin` is a real segment.
5. **Colocate tests** as `*.test.ts` next to the code. E2E tests go in `/e2e`.
6. **No barrel files (`index.ts`) inside features**: they hurt tree-shaking and risk pulling server code into client bundles. Import by path.

---

## 1. Repository root

```
nura-skin/
├── .github/
│   ├── workflows/
│   │   ├── ci.yml                    # lint, typecheck, unit, integration (Neon branch), build
│   │   ├── e2e.yml                   # Playwright against Vercel preview URL
│   │   └── migrate.yml               # prisma migrate deploy on main (production) — gated
│   ├── pull_request_template.md
│   └── CODEOWNERS
├── .husky/                           # pre-commit: lint-staged; commit-msg: commitlint
├── docs/                             # ← these documents (+ docs/adr/*.md)
├── e2e/                              # Playwright
│   ├── fixtures/                     # auth states, seeded users, stripe test cards
│   ├── storefront/*.spec.ts
│   ├── finder/*.spec.ts
│   ├── checkout/*.spec.ts
│   ├── account/*.spec.ts
│   └── admin/*.spec.ts
├── prisma/
│   ├── schema.prisma
│   ├── migrations/
│   ├── sql/                          # TypedSQL queries (analytics, search)
│   └── seed/
│       ├── index.ts                  # orchestrates seeds (idempotent upserts)
│       ├── catalog.ts                # 14 products, 20 variants, 5 routines
│       ├── ingredients.ts            # ~60 ingredients, conflicts, concern efficacy
│       ├── users.ts                  # staff users per role (Clerk test users)
│       ├── orders.ts                 # 6 months synthetic orders for analytics demo
│       └── data/*.json
├── public/                           # only favicons, manifest, robots fallback — images live in Cloudinary
│   ├── favicon.ico, icon.svg, apple-touch-icon.png
│   └── site.webmanifest
├── scripts/
│   ├── check-asset-manifest.ts       # CI: every asset key used in code exists in manifest & Cloudinary
│   ├── stripe-sync.ts                # one-off: sync catalog to Stripe test mode
│   ├── generate-tokens.ts            # design tokens JSON → Tailwind @theme CSS
│   └── ai-eval.ts                    # run finder eval set locally
├── src/                              # (see below)
├── .env.example
├── components.json                   # shadcn config
├── eslint.config.mjs
├── next.config.ts
├── package.json
├── playwright.config.ts
├── postcss.config.mjs
├── prettier.config.mjs
├── sentry.client.config.ts / sentry.server.config.ts / sentry.edge.config.ts
├── tsconfig.json                     # paths: "@/*" → "src/*"
└── vitest.config.ts                  # projects: unit (node), components (jsdom), integration (node + DB)
```

---

## 2. `src/` tree

```
src/
├── app/
│   ├── layout.tsx                        # <html>, fonts, ClerkProvider, ThemeProvider, Toaster, analytics
│   ├── globals.css                       # Tailwind v4 @import + @theme tokens (generated) + base layers
│   ├── not-found.tsx                     # global 404
│   ├── global-error.tsx                  # root error boundary (Sentry)
│   ├── robots.ts
│   ├── sitemap.ts
│   ├── manifest.ts
│   ├── opengraph-image.tsx               # default OG
│   │
│   ├── (storefront)/
│   │   ├── layout.tsx                    # Header, Footer, CartDrawer, AnnouncementBar
│   │   ├── page.tsx                      # Home
│   │   ├── loading.tsx
│   │   ├── error.tsx
│   │   ├── shop/
│   │   │   ├── page.tsx                  # all products PLP
│   │   │   └── [category]/page.tsx       # category PLP (cleansers, serums, moisturizers, sunscreens)
│   │   ├── products/[slug]/
│   │   │   ├── page.tsx
│   │   │   ├── opengraph-image.tsx
│   │   │   └── loading.tsx
│   │   ├── routines/
│   │   │   ├── page.tsx
│   │   │   └── [slug]/page.tsx
│   │   ├── concerns/[slug]/page.tsx      # SEO hub: acne, dullness, redness, aging, dryness, pigmentation, oiliness
│   │   ├── ingredients/
│   │   │   ├── page.tsx                  # glossary A–Z
│   │   │   └── [slug]/page.tsx
│   │   ├── finder/
│   │   │   ├── layout.tsx                # minimal chrome, progress header
│   │   │   ├── page.tsx                  # intro + steps (client FinderFlow)
│   │   │   ├── analyzing/page.tsx
│   │   │   └── results/[consultationId]/page.tsx
│   │   ├── search/page.tsx
│   │   ├── orders/lookup/page.tsx        # guest order lookup
│   │   ├── orders/view/page.tsx          # magic-link landing (token)
│   │   ├── about/page.tsx
│   │   ├── science/page.tsx              # "How our routine engine works"
│   │   ├── faq/page.tsx
│   │   ├── contact/page.tsx
│   │   └── legal/
│   │       ├── privacy/page.tsx
│   │       ├── terms/page.tsx
│   │       ├── subscription-terms/page.tsx
│   │       ├── shipping-returns/page.tsx
│   │       └── cookies/page.tsx
│   │
│   ├── (checkout)/
│   │   ├── layout.tsx                    # focused layout: logo + secure badge only
│   │   └── checkout/
│   │       ├── page.tsx                  # Embedded Checkout
│   │       ├── return/page.tsx           # session status resolver
│   │       └── success/[orderNumber]/page.tsx
│   │
│   ├── (auth)/
│   │   ├── layout.tsx                    # split layout with brand image
│   │   ├── sign-in/[[...sign-in]]/page.tsx
│   │   ├── sign-up/[[...sign-up]]/page.tsx
│   │   └── sso-callback/page.tsx
│   │
│   ├── (account)/account/
│   │   ├── layout.tsx                    # auth guard + AccountNav
│   │   ├── page.tsx                      # overview
│   │   ├── orders/page.tsx
│   │   ├── orders/[orderNumber]/page.tsx
│   │   ├── subscriptions/page.tsx
│   │   ├── subscriptions/[id]/page.tsx
│   │   ├── subscriptions/[id]/cancel/page.tsx
│   │   ├── routines/page.tsx
│   │   ├── skin-profile/page.tsx
│   │   ├── wishlist/page.tsx
│   │   ├── reviews/page.tsx
│   │   ├── reviews/new/page.tsx
│   │   ├── addresses/page.tsx
│   │   ├── settings/page.tsx             # profile (Clerk <UserProfile/>), email prefs, privacy (export/delete)
│   │   └── actions/[token]/page.tsx      # signed email action confirm (skip/pause)
│   │
│   ├── admin/
│   │   ├── layout.tsx                    # staff guard + Sidebar + Topbar + CommandMenu
│   │   ├── page.tsx                      # dashboard
│   │   ├── mfa-required/page.tsx
│   │   ├── products/page.tsx
│   │   ├── products/new/page.tsx
│   │   ├── products/[id]/page.tsx        # editor tabs via ?tab=
│   │   ├── routines/page.tsx             # pre-built routines/bundles
│   │   ├── routines/[id]/page.tsx
│   │   ├── ingredients/page.tsx
│   │   ├── ingredients/[id]/page.tsx
│   │   ├── inventory/page.tsx
│   │   ├── orders/page.tsx
│   │   ├── orders/[orderNumber]/page.tsx
│   │   ├── customers/page.tsx
│   │   ├── customers/[id]/page.tsx
│   │   ├── subscriptions/page.tsx
│   │   ├── reviews/page.tsx
│   │   ├── coupons/page.tsx
│   │   ├── coupons/[id]/page.tsx
│   │   ├── analytics/page.tsx
│   │   ├── analytics/finder/page.tsx
│   │   ├── audit-log/page.tsx
│   │   ├── team/page.tsx                 # staff users & roles (ADMIN only)
│   │   └── settings/page.tsx             # store settings, shipping rules, home merchandising
│   │
│   └── api/
│       ├── health/route.ts
│       ├── inngest/route.ts
│       ├── webhooks/
│       │   ├── stripe/route.ts
│       │   └── clerk/route.ts
│       └── v1/
│           ├── products/route.ts                     # GET list
│           ├── products/[slug]/route.ts              # GET detail
│           ├── products/[slug]/reviews/route.ts      # GET paginated reviews
│           ├── search/route.ts
│           ├── cart/route.ts                         # GET/DELETE
│           ├── cart/items/route.ts                   # POST
│           ├── cart/items/[itemId]/route.ts          # PATCH/DELETE
│           ├── cart/coupon/route.ts                  # POST/DELETE
│           ├── wishlist/route.ts ...                 # (see 09-api-design for full list)
│           ├── checkout/sessions/route.ts
│           ├── checkout/sessions/[sessionId]/route.ts
│           ├── orders/route.ts, orders/[orderNumber]/route.ts, orders/by-session/[sessionId]/route.ts, orders/lookup/route.ts
│           ├── subscriptions/**
│           ├── finder/consultations/**               # incl. SSE recommend
│           ├── me/**                                 # profile, preferences, export, delete
│           ├── uploads/signature/route.ts
│           └── admin/**                              # products, inventory, orders, refunds, coupons, reviews, analytics, audit, users
│
├── features/
│   ├── catalog/
│   │   ├── components/        # ProductCard, ProductGrid, ProductGallery, VariantSelector, IngredientList, FilterSidebar, SortSelect, ...
│   │   ├── server/            # queries.ts (listProducts, getProductBySlug, ...), search.ts, service.ts
│   │   ├── schemas.ts         # productFilterSchema, ...
│   │   └── types.ts
│   ├── cart/
│   │   ├── components/        # CartDrawer, CartLine, CartSummary, FreeShippingProgress, CouponForm
│   │   ├── server/            # actions.ts, queries.ts, service.ts (merge, add, update), cart-cookie.ts
│   │   ├── store.ts           # Zustand: useCartUI (open/close, lastAdded)
│   │   └── schemas.ts
│   ├── pricing/
│   │   ├── server/engine.ts   # PricingEngine.quote(cart, ctx) — pure; heavily unit-tested
│   │   ├── server/rules/      # subscription-discount.ts, routine-discount.ts, bundle.ts, coupon.ts, shipping.ts
│   │   └── money.ts           # Money helpers (cents, format) — isomorphic
│   ├── checkout/
│   │   ├── components/        # EmbeddedCheckoutPanel, OrderSummary, CheckoutReturnStatus
│   │   └── server/            # actions.ts (createCheckoutSession), service.ts
│   ├── orders/
│   │   ├── components/        # OrderTimeline, OrderItemsTable, OrderStatusBadge
│   │   └── server/            # service.ts (markPaid, fulfil, refund, cancel), state-machine.ts, queries.ts, number.ts
│   ├── payments/
│   │   └── server/            # stripe-webhook-handler.ts (event router), handlers/*.ts, stripe-catalog-sync.ts, reconcile.ts
│   ├── subscriptions/
│   │   ├── components/        # SubscriptionCard, ManageSubscriptionPanel, CancelFlow, IntervalSelect
│   │   └── server/            # service.ts, state-machine.ts, actions.ts, signed-actions.ts
│   ├── inventory/
│   │   ├── components/        # InventoryTable, AdjustStockDialog, MovementLedger
│   │   └── server/            # service.ts (reserve, release, commit, adjust), queries.ts
│   ├── finder/
│   │   ├── components/        # FinderFlow, steps/*, ProgressHeader, ExpertInterstitial, AnalyzingStatus, RoutineResults, RoutineTimeline, StepCard, SwapSheet, TierTabs, SafetyNotice
│   │   ├── questionnaire.ts   # step definitions (single source for UI + validation)
│   │   ├── store.ts           # Zustand: useFinderDraft
│   │   ├── schemas.ts         # answer schemas, SkinProfile, LLM output schema
│   │   └── server/
│   │       ├── actions.ts
│   │       ├── engine/
│   │       │   ├── normalize.ts        # answers → SkinProfile
│   │       │   ├── safety.ts           # red-flag detection
│   │       │   ├── candidates.ts       # SQL hard filters
│   │       │   ├── scoring.ts          # rule scorer
│   │       │   ├── compatibility.ts    # conflict checks (AM/PM)
│   │       │   ├── assemble.ts         # tiers & slots, budget fitting
│   │       │   ├── llm.ts              # Claude call, prompt build, structured output
│   │       │   ├── validate.ts         # post-LLM validator
│   │       │   ├── fallback.ts         # deterministic routine
│   │       │   └── index.ts            # orchestrator: recommend()
│   │       ├── prompts/
│   │       │   ├── system.v3.md
│   │       │   └── registry.ts         # prompt versions
│   │       └── eval/
│   │           ├── cases.jsonl         # golden profiles + expected constraints
│   │           └── graders.ts
│   ├── reviews/        (components, server, schemas)
│   ├── wishlist/       (components, server)
│   ├── account/        (components: AccountNav, AddressForm, SkinProfileCard; server)
│   ├── coupons/        (server/service.ts validation rules; admin components)
│   ├── analytics/
│   │   ├── client/track.ts     # client event beacon (consent-aware)
│   │   ├── server/track.ts     # server event writer
│   │   ├── server/rollups.ts
│   │   └── components/         # KpiTile, RevenueChart, FunnelChart, ConcernHeatmap, DataTableExport
│   ├── audit/          (server/log.ts, components/AuditLogTable)
│   ├── notifications/  (server/send.ts → Inngest)
│   ├── admin/
│   │   ├── components/        # AdminSidebar, AdminTopbar, DataTable (TanStack Table), ProductEditor/*, OrderActions, RefundDialog, ...
│   │   └── nav.ts             # nav items with required permission
│   └── marketing/             # Hero, FeaturedRoutines, IngredientStory, TestimonialStrip, NewsletterForm
│
├── components/
│   ├── ui/                    # shadcn primitives (button, input, dialog, sheet, select, tabs, toast(sonner), tooltip, badge, skeleton, table, ...)
│   ├── layout/                # Header, MobileNav, Footer, AnnouncementBar, Container, Section
│   └── shared/                # Price, Rating, CloudImage, EmptyState, ErrorState, Logo, Icon, ConsentBanner, ThemeToggle
│
├── lib/
│   ├── server/                # server-only adapters
│   │   ├── db.ts              # Prisma client singleton w/ Neon adapter
│   │   ├── stripe.ts
│   │   ├── clerk.ts           # getCurrentUser(), requireUser(), requirePermission()
│   │   ├── ai.ts              # Anthropic client
│   │   ├── cloudinary.ts      # signing
│   │   ├── email.ts           # Resend client
│   │   ├── redis.ts
│   │   ├── rate-limit.ts      # named limiters
│   │   ├── outbox.ts
│   │   ├── logger.ts          # pino + redaction
│   │   ├── action.ts          # createAction() wrapper
│   │   ├── route.ts           # createRoute() wrapper for route handlers
│   │   ├── signed-token.ts    # HMAC tokens for email actions
│   │   └── errors.ts          # AppError, codes, mapping
│   ├── env.ts                 # Zod-validated env (server/client split)
│   ├── permissions.ts         # Permission enum + role→permission map (isomorphic, for UI gating)
│   ├── cloudinary-loader.ts   # next/image loader (isomorphic)
│   ├── utils.ts               # cn(), etc.
│   └── constants.ts
│
├── inngest/
│   ├── client.ts
│   ├── events.ts              # typed event schemas
│   └── functions/*.ts         # one file per function (see 06 §13)
│
├── emails/                    # React Email templates
│   ├── components/            # EmailLayout, Button, ProductRow
│   ├── order-confirmation.tsx, order-shipped.tsx, refund-issued.tsx, subscription-*.tsx,
│   ├── routine-saved.tsx, review-request.tsx, low-stock-digest.tsx, ...
│
├── config/
│   ├── site.ts                # name, urls, social
│   ├── assets.ts              # asset manifest (key → Cloudinary publicId, alt, dimensions)
│   ├── navigation.ts
│   └── shipping.ts            # shipping rules (flat rate, thresholds)
│
├── styles/tokens.json         # source of truth for design tokens
├── messages/en.json           # UI copy (i18n-ready)
├── middleware.ts              # Clerk + guards + headers (named proxy.ts on Next 16+)
├── instrumentation.ts         # Sentry, OpenTelemetry registration
└── types/                     # global .d.ts (env, clerk session claims)
```

---

## 3. Naming conventions

| Thing              | Convention                                              | Example                              |
| ------------------ | ------------------------------------------------------- | ------------------------------------ |
| React components   | PascalCase file & export                                | `ProductCard.tsx`                    |
| Hooks              | `use-` kebab file, camel export                         | `use-debounce.ts` → `useDebounce`    |
| Server actions     | verbNoun, suffix-free                                   | `addToCart`, `createCheckoutSession` |
| Queries            | `get*` single / `list*` many                            | `getProductBySlug`, `listProducts`   |
| Zod schemas        | camelCase + `Schema`                                    | `addToCartSchema`                    |
| Types from schemas | PascalCase `z.infer`                                    | `AddToCartInput`                     |
| DB models          | PascalCase singular                                     | `OrderItem`                          |
| DB tables          | snake_case plural via `@@map`                           | `order_items`                        |
| Env vars           | SCREAMING_SNAKE; client-exposed prefixed `NEXT_PUBLIC_` | `STRIPE_SECRET_KEY`                  |
| Inngest events     | `domain.past_tense`                                     | `order.paid`, `review.submitted`     |
| Analytics events   | `snake_case`                                            | `finder_step_completed`              |
| Cache tags         | `entity` / `entity:{key}`                               | `product:glow-serum`                 |

## 4. Import rules (enforced by ESLint `no-restricted-imports` / `eslint-plugin-boundaries`)

| From ↓ may import →     | `components/ui` | `components/shared` | `features/*/components`     | `features/*/server`                 | `lib/server`     |
| ----------------------- | --------------- | ------------------- | --------------------------- | ----------------------------------- | ---------------- |
| `app/**`                | ✓               | ✓                   | ✓                           | ✓ (queries/actions)                 | ✓ (auth helpers) |
| `features/X/components` | ✓               | ✓                   | only X or explicitly shared | actions only (`"use server"`)       | ✗                |
| `features/X/server`     | ✗               | ✗                   | ✗                           | X, and other features' `service.ts` | ✓                |
| `components/**`         | ✓               | ✓                   | ✗                           | ✗                                   | ✗                |
| `inngest/functions`     | ✗               | ✗                   | ✗                           | services ✓                          | ✓                |
