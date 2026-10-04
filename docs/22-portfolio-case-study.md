# 22 — Portfolio Case Study: Nura Skin

> **Status:** written at the specification stage. The **Results** section contains _target_ metrics and a checklist of evidence to capture. Replace them with measured numbers in M10. Never publish targets as achievements.

---

## Project description

**Nura Skin** is a production-grade, AI-personalized direct-to-consumer skincare store. A three-minute consultation builds each customer a compatible, explained skincare routine from the brand's catalogue, which they can buy once or subscribe to. Behind it is a full operations back-office for inventory, orders, refunds, coupons, reviews and analytics.

|                 |                                                                                                                                                                                                                                                                               |
| --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Role**        | Product architect & full-stack engineer (sole developer)                                                                                                                                                                                                                      |
| **Timeline**    | ~18 weeks (spec → launch)                                                                                                                                                                                                                                                     |
| **Stack**       | Next.js App Router (RSC, Server Actions, PPR) · React 19 · TypeScript · Tailwind CSS v4 · shadcn/ui · Framer Motion · PostgreSQL (Neon) · Prisma · Clerk · Stripe (Embedded Checkout, Billing) · Cloudinary · Claude API · Inngest · Upstash Redis · Resend · Sentry · Vercel |
| **Links**       | Live demo · GitHub repo · Demo video · Architecture docs (`/docs`)                                                                                                                                                                                                            |
| **Demo access** | Storefront is public. Admin demo roles: Admin / Inventory / Marketing (read-safe demo mode). Stripe test card `4242 4242 4242 4242`.                                                                                                                                          |

---

## Business problem

Skincare e-commerce has a **choice-overload problem**. Shoppers face hundreds of products with overlapping claims and actives that can conflict with each other, which leads to three costly outcomes:

1. **Low conversion.** Overwhelmed visitors leave without buying.
2. **Bad outcomes.** Customers combine the wrong actives, get irritated and churn, and leave negative reviews.
3. **One-and-done purchases.** Without a routine, there's no reason to come back, so there is no recurring revenue.

Existing "skin quizzes" are mostly marketing funnels. They recommend the most expensive products and explain nothing. Customers don't trust them.

**The business needed:** higher conversion and AOV, recurring revenue, and trust. The key constraint was that personalization must be **safe** (for example, never recommending a retinoid to a pregnant customer) and **honest**.

---

## Solution

### 1. The AI Routine Finder: grounded personalization

A 10-step adaptive consultation (skin type, ranked concerns, sensitivity, conditions, preferences, budget, free-text notes). It returns AM and PM routines in three budget tiers, with a personal explanation for every step, an introduction plan to avoid irritation, and a transparent "what we left out and why" list.

**The key design decision:** _deterministic code decides what is safe and possible; the LLM decides what is best and explains why._

- SQL hard filters (stock, pregnancy safety, allergies, avoid-lists) remove unsafe products before the model sees anything.
- A rule-based scorer and an assembler build a complete, valid draft routine.
- Claude reviews the draft, may swap within the per-slot candidates, and writes the explanations, using **structured outputs where product IDs are schema enums**. It cannot output a product that isn't a valid candidate.
- A validator re-checks conflicts, budget and safety, and filters medical claims. Any failure falls back to the deterministic routine, so users always get a valid answer.

### 2. Commerce built for routines

- Routine-aware cart (routine discount when ≥ 3 steps are purchased together), with **server-authoritative pricing** implemented as a pure, property-tested engine.
- **Stripe Embedded Checkout** supporting **mixed carts** (one-time + subscription items in one payment), wallets and 3DS.
- **Routine Plans:** subscriptions with skip, pause, swap, interval change and a two-click cancel. They also send pre-renewal reminders and have dunning.

### 3. Operations back-office

RBAC with four staff roles (mandatory MFA and step-up re-verification for refunds), a product editor with an INCI parser and publish checklist, an inventory ledger with reservations, order fulfilment and partial refunds with restock, coupons with margin guards, review moderation, first-party analytics (revenue, MRR, churn, checkout and finder funnels), finder quality insights, and a full audit log.

---

## Technical challenges

| Challenge                                           | Why it's hard                                                                                           | How it was solved                                                                                                                                                                                                                                                                                                                                                                                 |
| --------------------------------------------------- | ------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Making an LLM safe for product recommendations**  | LLMs hallucinate products, ignore constraints, and are vulnerable to prompt injection through free text | Seven-layer grounding: SQL pre-filter → rule draft → per-request enum schema → validator → text filter → deterministic fallback → eval suite (80 golden cases incl. adversarial). The model has no tools and cannot act.                                                                                                                                                                          |
| **Latency of an AI feature in a conversion funnel** | Waiting 10 s on a blank screen kills conversion                                                         | Two-phase streamed output: a compact selection phase is validated and rendered first (with templated text), then the personal explanations stream into the cards. It uses a static structured-output schema (index-based picks) so grammar and prompt caches stay warm, per-phase deadlines with fallbacks that degrade per step rather than per routine, and a leased Redis semaphore for spikes |
| **No oversell under concurrency**                   | Serverless functions race on the last unit; payment completes asynchronously                            | Inventory **reservations** at checkout-session creation with Postgres row locks; a ledger for every stock change; webhook-driven commits; an expiry sweeper; a concurrent-checkout integration test (50 buyers, 20 units → exactly 20 orders)                                                                                                                                                     |
| **Webhook correctness**                             | Stripe events can be duplicated, delayed or out of order                                                | Event-ID idempotency table, convergent handlers that re-read Stripe state, the same idempotent `markPaid` path shared by the webhook and the return page, and a nightly reconciliation job                                                                                                                                                                                                        |
| **Mixed one-time + subscription pricing**           | Stripe allows one discount per session; our rules stack (subscription 15%, routine 10%, coupons)        | Subscription discount encoded in recurring Prices; the other order-level discounts computed by our engine and applied as one ephemeral `amount_off` coupon; largest-remainder allocation so per-line refunds stay exact                                                                                                                                                                           |
| **Fast yet fresh catalogue pages**                  | Static speed vs. live price and stock                                                                   | Partial Prerendering: static PDP shell + dynamic islands for stock and "fits your routine"; tag-based revalidation from admin mutations                                                                                                                                                                                                                                                           |
| **Security for a multi-role back-office**           | Middleware-only checks are bypassable; roles drift                                                      | Permissions defined in code; every action and route declares its auth policy; a generated test runs every admin endpoint against every role; DB roles mirrored to Clerk claims for edge gating only                                                                                                                                                                                               |
| **Health-adjacent data**                            | Pregnancy and skin conditions are sensitive                                                             | Explicit consent, segregation from marketing, no PII sent to the LLM, redaction of free text after 90 days, export and delete                                                                                                                                                                                                                                                                     |

---

## Architecture decisions

| Decision                                                                                    | Alternatives considered                      | Rationale                                                                               |
| ------------------------------------------------------------------------------------------- | -------------------------------------------- | --------------------------------------------------------------------------------------- |
| Modular monolith on Next.js                                                                 | Microservices; SPA + separate API            | One deployable and shared types; feature boundaries keep extraction possible            |
| Server Actions for UI mutations + versioned REST for streaming, webhooks and future clients | tRPC; REST-only                              | Less boilerplate, progressive enhancement; REST where HTTP semantics matter             |
| Stripe **Embedded** Checkout                                                                | Payment Element custom flow; hosted redirect | Mixed carts, wallets, tax and SCA with SAQ A scope, and the user stays on-site          |
| Webhooks as the single source of payment truth                                              | Trust the redirect                           | Correctness under failures; idempotent convergence                                      |
| Grounded LLM (candidates + enum schema + validator + fallback)                              | Free-form LLM recommendations; pure rules    | Safety and reliability of rules + the judgement and language of an LLM                  |
| Transactional outbox → Inngest                                                              | Fire-and-forget after commit                 | No lost emails or side effects; retries and delayed flows (review requests at +21 days) |
| First-party analytics events + nightly rollups                                              | Third-party analytics SaaS                   | Business KPIs in the admin, privacy-friendly, no extra trackers                         |
| Roles in the DB, mirrored to Clerk                                                          | Clerk-only metadata; DB-only                 | Auditability + edge gating without DB calls                                             |
| Money as integer cents, discounts in basis points                                           | Decimal/float                                | Exact arithmetic; property-tested invariants                                            |
| Asset manifest with a CI check                                                              | Ad-hoc image URLs                            | Guarantees zero placeholders and complete alt text                                      |

Diagrams: system context, checkout sequence, finder pipeline, ERD (from `/docs`).

---

## Features (highlights for the portfolio)

**Customer**

- AI Routine Finder: 10 adaptive steps, streaming "analysis", three tiers, "Why this?", swap alternatives, introduction plan, safety notices
- Editorial storefront: PLP with URL-driven filters, PDP with INCI transparency and conflict warnings, ingredient glossary, concern hubs
- Routine-aware cart, Embedded Checkout with Apple/Google Pay, guest checkout
- Routine Plans: skip, pause, swap, change interval, cancel in two clicks, email deep links
- Verified reviews filterable by skin type
- Light/dark themes, WCAG 2.2 AA, reduced-motion support

**Staff**

- Role-based admin with MFA and step-up auth
- Product editor (media, variants, INCI parser, targeting, publish checklist)
- Inventory ledger with reservations and low-stock digest
- Orders: fulfilment, partial refunds with restock, attention queue
- Coupons with rule builder and margin guard
- Analytics: revenue, MRR, churn, funnels, concern heatmap; finder insights with a consultation debug viewer
- Audit log with diffs

**Engineering**

- ~210 purpose-made brand assets from a documented inventory; CI-enforced manifest
- CI/CD with per-PR Neon database branches, E2E on preview deployments, Lighthouse budgets and AI evals
- Observability: Sentry, structured logs with request correlation, synthetic checks

---

## Results

_Targets to verify and replace with measured values at launch (M10):_

| Area          | Target                                                                                                       | Evidence to capture                             |
| ------------- | ------------------------------------------------------------------------------------------------------------ | ----------------------------------------------- |
| Performance   | Lighthouse mobile ≥ 90 (Home/PLP/PDP/Finder); p75 LCP ≤ 2.0 s                                                | Lighthouse CI report; Speed Insights screenshot |
| Accessibility | 0 serious/critical axe violations; keyboard-complete finder and checkout                                     | axe reports; screen-reader demo clip            |
| AI quality    | 100% constraint pass on 80 eval cases; explanation quality ≥ 4.2/5; fallback < 3%; usable routine p95 ≤ 10 s | Eval report; finder insights dashboard          |
| Correctness   | 0 oversells in a 50-concurrent-buyer test; 0 duplicate side effects under webhook replay                     | Test output                                     |
| Quality       | N unit / N integration / 15 CUJ E2E tests; coverage on domain modules ≥ 90%                                  | CI summary                                      |
| Security      | securityheaders.com A; ZAP: no high/medium; role-matrix test covers 100% of admin endpoints                  | Reports                                         |
| Delivery      | 18-week plan vs actual; milestone burndown                                                                   | Roadmap retrospective                           |

**Business framing (hypothetical, clearly labelled):** based on the seeded demo dataset, the analytics dashboard shows finder-originated orders at a higher AOV and a subscription attach rate. This demonstrates the instrumentation, not a real market result.

---

## Future improvements

1. **Conversational follow-up.** "My skin is stinging after the serum": a grounded support assistant using the same safety layer and the order history.
2. **Routine check-ins and a skin diary.** Weekly self-ratings that feed re-recommendation (the lineage model already exists).
3. **Seasonal auto-adjustment.** Climate and UV index by postcode suggest swaps for subscribers.
4. **Experimentation platform.** A/B test prompt versions and finder copy with feature flags + event-level analysis.
5. **Internationalization.** EU store (multi-currency Stripe prices, VAT, translated INCI and copy), since money and i18n are designed for it.
6. **Carrier integrations.** Real tracking webhooks (EasyPost/Shippo) replacing manual tracking entry.
7. **Loyalty and referrals.** Using the existing coupon engine and customer metrics.
8. **Headless mobile app.** The versioned REST API and token auth are already in place.
9. **Opt-in photo analysis.** Only after bias, accuracy and privacy review, ideally on-device.

---

## What this project demonstrates (for reviewers)

- **Senior product thinking:** 22 specification documents, personas, flows, business model and explicit trade-offs (see `/docs`).
- **Advanced Next.js:** RSC, PPR, Server Actions, tag-based caching, streaming, metadata/OG, middleware.
- **Full-stack depth:** transactional inventory, idempotent payment pipelines, state machines, background jobs, RBAC.
- **Responsible AI engineering:** grounding, structured outputs, validation, fallbacks, evals and safety design.
- **Craft:** a coherent design system, a brand, motion and accessibility, not a template.
