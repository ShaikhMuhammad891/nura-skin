# 01 — Product Requirements Document (PRD)

| Field          | Value                                                                    |
| -------------- | ------------------------------------------------------------------------ |
| Product        | Nura Skin — AI-personalized DTC skincare platform                        |
| Document owner | Lead Product Architect                                                   |
| Status         | Approved for build (v1.0)                                                |
| Last updated   | 2026-09-28                                                               |
| Related        | 02-business-model, 05-software-requirements, 12-ai-routine-finder-design |

---

## 1. Why this product exists

Skincare shoppers have too much choice and not enough guidance. A typical online skincare store shows hundreds of products, many with overlapping claims and actives that clash with each other. Customers then do one of three things:

1. **Buy by hype.** They follow TikTok trends, buy the wrong actives for their skin, react badly and churn.
2. **Buy too much.** They stack five serums with overlapping or conflicting actives (retinoids plus AHAs plus vitamin C) and damage their skin barrier.
3. **Buy nothing.** They are overwhelmed, leave the site and come back later, or never.

Dermatologist consultations fix this, but they are expensive, slow and hard to book for non-medical concerns such as dullness, texture or early aging.

**Nura Skin gives every visitor a free, 3-minute, expert-grade consultation. The result is a small, compatible routine built only from Nura products that are in stock, fit the customer's budget and suit their skin. The customer can buy it in one click and have it replenished automatically.**

The business reason: a personalized routine has a higher average order value than a single product, since it bundles 3–5 items. It also converts naturally into a subscription, which is recurring revenue. Personalization is what turns a one-off purchase into a relationship.

---

## 2. Vision & mission

**Vision.** Become the most trusted "skincare expert in your pocket". The brand people think of because it told them what _not_ to buy.

**Mission.** Give everyone a simple, science-backed routine that works for their skin, budget and life, and keep it working as their skin changes.

**Product principles** (used to settle product disputes):

| #   | Principle                      | Implication                                                                                                                                             |
| --- | ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P1  | **Fewer, better products**     | The finder recommends 3–5 steps max. We never recommend a product just to raise cart size.                                                              |
| P2  | **Explain everything**         | Every recommendation shows _why_: the matched concern, the key ingredient and how to use it.                                                            |
| P3  | **Safety over sales**          | Conflicting actives are never combined in the same routine slot. Pregnancy and sensitivity filters are hard constraints, not soft preferences.          |
| P4  | **The AI is grounded**         | The AI can only choose from real, in-stock catalogue items that deterministic rules have already filtered. It cannot invent products, claims or prices. |
| P5  | **Premium, calm, fast**        | Editorial aesthetics without sacrificing Core Web Vitals.                                                                                               |
| P6  | **The customer is in control** | Subscriptions can be skipped, swapped, paused or cancelled in two clicks, with no dark patterns.                                                        |

---

## 3. Target audience

### Primary segment: "Overwhelmed Optimizers" (≈60% of revenue target)

- Age 24–38, urban, digitally native, disposable income of $40–150/month for skincare.
- Has 1–2 specific concerns (breakouts, dullness, early fine lines, redness).
- Has already tried products that didn't work or caused irritation.
- Researches on Reddit/TikTok but distrusts influencer claims.
- Wants a routine, not a product.

### Secondary segment: "Minimalists" (≈25%)

- Age 30–50, time-poor professionals and parents.
- Wants a 3-step routine delivered automatically. Values subscriptions and convenience.

### Tertiary segment: "Sensitive & Specific" (≈15%)

- Rosacea-prone, eczema-prone, pregnant or breastfeeding, or following a fragrance-free / vegan preference.
- Highest trust barrier and highest lifetime value once trust is earned.
- Needs transparent ingredient data and hard filtering.

### Internal users

- **Admin / store owner.** Full control of catalogue, orders, customers and settings.
- **Inventory manager.** Stock, receiving, low-stock alerts, product variants.
- **Marketing manager.** Coupons, featured content, analytics, finder funnel insights.

Detailed personas: `03-user-personas.md`.

---

## 4. Market positioning

| Brand archetype       | Examples                                 | Their strength        | Their gap                                | Nura's position                                       |
| --------------------- | ---------------------------------------- | --------------------- | ---------------------------------------- | ----------------------------------------------------- |
| Clinical minimalist   | The Ordinary, The Inkey List             | Price, transparency   | No guidance; customers mix actives badly | Same transparency, **plus guidance**                  |
| Prescription telederm | Curology, Agency, Musely                 | Personalized formulas | Requires medical intake, slower, $$      | Non-prescription, **instant**, no doctor friction     |
| Premium DTC           | Glossier, Drunk Elephant, Paula's Choice | Brand, community      | Quizzes are shallow marketing funnels    | **A real expert-grade consultation**, fully explained |
| Marketplace           | Sephora, Cult Beauty                     | Selection             | Choice overload                          | **Curated, compatible routines**                      |

**Positioning statement.** _For skincare shoppers who are overwhelmed by choice, Nura Skin is the DTC skincare brand that builds your routine for you. Unlike quiz-driven brands, every Nura recommendation is explained, ingredient-checked and made only from products that work together._

**Price tier.** "Accessible premium": $24–$56 per product, $95–$165 per routine. Subscribers get 15% off.

---

## 5. Core problems solved

| Problem                              | Evidence (market)                                                | Nura solution                                                              | Feature                             |
| ------------------------------------ | ---------------------------------------------------------------- | -------------------------------------------------------------------------- | ----------------------------------- |
| Choice overload                      | Beauty e-commerce conversion ~2–3%, with high browse abandonment | Consultation replaces browsing                                             | AI Routine Finder                   |
| Conflicting actives cause irritation | Common complaint on skincare forums                              | Rule engine blocks conflicting actives in the same AM/PM slot              | Ingredient compatibility matrix     |
| Opaque ingredient lists              | Growing demand for INCI transparency                             | Full INCI, key-active concentration and per-ingredient pages               | Ingredient glossary                 |
| Replenishment friction               | Customers run out and switch brands                              | Routine-level subscription with intervals matched to product usage         | Routine Plans                       |
| Low trust in reviews                 | Fake reviews are widespread                                      | Only verified purchasers can review. Reviews can be filtered by skin type. | Verified reviews + skin-type filter |
| Routines stop working                | Skin changes by season, age and hormones                         | Re-consultation every 90 days, and the plan adjusts                        | Routine check-in                    |

---

## 6. Main features (MVP scope = v1.0)

Priority: **P0** = launch blocker, **P1** = launch target, **P2** = fast-follow.

### 6.1 Storefront

| ID      | Feature                                                                                                                                  | Priority |
| ------- | ---------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| F-SF-01 | Editorial home page (hero, finder CTA, featured routines, bestsellers, ingredient story, social proof)                                   | P0       |
| F-SF-02 | Catalogue listing with filters (category, concern, skin type, key ingredient, price, "free-from" flags) and sort                         | P0       |
| F-SF-03 | Product detail page: gallery, variants, INCI, key actives, how-to-use, AM/PM badge, compatibility notes, reviews, "complete the routine" | P0       |
| F-SF-04 | Pre-built routine (bundle) pages with bundle pricing                                                                                     | P0       |
| F-SF-05 | Ingredient glossary and ingredient detail pages (SEO asset)                                                                              | P1       |
| F-SF-06 | Search with typo tolerance and autocomplete (Postgres full-text + trigram)                                                               | P1       |
| F-SF-07 | Wishlist (auth) with share link                                                                                                          | P1       |
| F-SF-08 | Recently viewed products                                                                                                                 | P2       |

### 6.2 AI Routine Finder (the differentiator)

| ID      | Feature                                                                                                                                                                                     | Priority |
| ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| F-AI-01 | Adaptive questionnaire of 8–12 steps: skin type, concerns (ranked), sensitivity, reactions history, pregnancy/nursing, budget, routine time, climate, ingredient preferences and avoidances | P0       |
| F-AI-02 | Optional free-text note ("anything else we should know?") parsed into structured signals                                                                                                    | P0       |
| F-AI-03 | Grounded recommendation: AM and PM routines with 3–5 steps each, per-step reasoning, usage schedule and introduction plan (e.g. "retinal 2×/week for 2 weeks")                              | P0       |
| F-AI-04 | Budget tiers: Essential / Complete / Advanced alternatives                                                                                                                                  | P0       |
| F-AI-05 | One-click "Add routine to cart" as one-time or subscription                                                                                                                                 | P0       |
| F-AI-06 | Save the routine to the account. Guest results are persisted and claimed at sign-up.                                                                                                        | P0       |
| F-AI-07 | Safety escalation: suggests a dermatologist for red-flag answers                                                                                                                            | P0       |
| F-AI-08 | Swap a single step ("show me a fragrance-free alternative")                                                                                                                                 | P1       |
| F-AI-09 | 90-day check-in re-consultation using history                                                                                                                                               | P2       |

### 6.3 Commerce

| ID      | Feature                                                                         | Priority |
| ------- | ------------------------------------------------------------------------------- | -------- |
| F-CM-01 | Persistent cart (guest via cookie token, merged on sign-in)                     | P0       |
| F-CM-02 | Stripe Embedded Checkout: cards, Apple Pay, Google Pay, Link                    | P0       |
| F-CM-03 | Mixed carts (one-time plus subscription items in one checkout)                  | P0       |
| F-CM-04 | Coupons (percentage, fixed, free shipping, first-order, routine-only)           | P0       |
| F-CM-05 | Shipping rules: flat rate, with free shipping over $60 and free for subscribers | P0       |
| F-CM-06 | Order confirmation, status tracking and emails                                  | P0       |
| F-CM-07 | Verified-purchase reviews with photos and a skin-type attribute                 | P1       |
| F-CM-08 | Tax calculation via Stripe Tax (test mode)                                      | P1       |
| F-CM-09 | Guest checkout, with an account-claim link in the confirmation email            | P1       |

### 6.4 Subscriptions ("Routine Plans")

| ID      | Feature                                                                                                              | Priority |
| ------- | -------------------------------------------------------------------------------------------------------------------- | -------- |
| F-SB-01 | Subscribe per item or per routine; interval every 4, 8 or 12 weeks                                                   | P0       |
| F-SB-02 | 15% subscriber discount; free shipping                                                                               | P0       |
| F-SB-03 | Self-service: skip next, pause (up to 3 months), change interval, swap variant, update payment, cancel with a reason | P0       |
| F-SB-04 | Pre-renewal reminder email 3 days before charge                                                                      | P0       |
| F-SB-05 | Failed-payment recovery (Stripe Smart Retries plus dunning emails)                                                   | P1       |

### 6.5 Customer account

Profile, addresses, orders and order detail, subscriptions, saved routines, skin profile, wishlist, reviews, and data export/delete (GDPR). P0–P1.

### 6.6 Admin dashboard

| ID      | Feature                                                                                             | Priority |
| ------- | --------------------------------------------------------------------------------------------------- | -------- |
| F-AD-01 | RBAC (Admin, Inventory Manager, Marketing Manager, Support)                                         | P0       |
| F-AD-02 | Product CRUD with variants, images (Cloudinary), ingredients, concerns, SEO fields, draft/publish   | P0       |
| F-AD-03 | Inventory: stock levels, adjustments with reasons, movement ledger, low-stock alerts                | P0       |
| F-AD-04 | Orders: list, filters, detail, fulfil (tracking number), refund (full/partial), cancel              | P0       |
| F-AD-05 | Analytics: revenue, AOV, conversion funnel, finder funnel, subscription MRR and churn, top products | P0       |
| F-AD-06 | Coupons CRUD with usage stats                                                                       | P1       |
| F-AD-07 | Review moderation                                                                                   | P1       |
| F-AD-08 | Customers list and detail (orders, LTV, subscriptions)                                              | P1       |
| F-AD-09 | Audit log viewer                                                                                    | P1       |
| F-AD-10 | Finder insights: most common concerns, drop-off step, fallback rate                                 | P1       |

### 6.7 Explicit non-goals for v1

- Multi-currency and multi-language (the architecture is ready for them, but they are not shipped).
- Real carrier integration (tracking numbers are entered manually; the carrier-link template is configurable).
- Photo-based skin analysis (see future expansion). This is excluded on purpose because of accuracy, bias and liability concerns.
- Native mobile apps.
- Loyalty points program.

---

## 7. Business goals (first 12 months, hypothetical launch)

| Goal                 | Target                                                                |
| -------------------- | --------------------------------------------------------------------- |
| G1 — Finder adoption | ≥ 35% of new sessions start the finder; ≥ 70% of starters complete it |
| G2 — Conversion      | Finder completers convert at ≥ 3× the site average                    |
| G3 — AOV             | Finder-originated orders AOV ≥ $95 (vs. ≥ $55 for non-finder orders)  |
| G4 — Subscriptions   | ≥ 30% of finder orders include a subscription; MRR ≥ $40k by month 12 |
| G5 — Retention       | 90-day repeat purchase rate ≥ 35%; subscription monthly churn ≤ 6%    |
| G6 — Trust           | Average review rating ≥ 4.5; return/irritation complaint rate < 2%    |

---

## 8. Success metrics (instrumented, see 06-system-architecture §Analytics)

**North Star metric:** _Active routines_, meaning customers with a routine purchased or subscribed in the last 90 days.

| Layer       | Metric                     | Definition                                           | Source                         |
| ----------- | -------------------------- | ---------------------------------------------------- | ------------------------------ |
| Acquisition | Sessions, new visitors     | Unique session IDs per day                           | `AnalyticsEvent(page_view)`    |
| Activation  | Finder start rate          | `finder_started / sessions`                          | Events                         |
| Activation  | Finder completion rate     | `finder_completed / finder_started`                  | Events                         |
| Activation  | Step drop-off              | Last step answered before abandonment                | `RoutineConsultation.lastStep` |
| Conversion  | Routine-to-cart rate       | `routine_added_to_cart / finder_completed`           | Events                         |
| Conversion  | Checkout conversion        | `order_paid / checkout_started`                      | Orders + events                |
| Revenue     | AOV, revenue, gross margin | Paid orders net of refunds and discounts             | `Order`                        |
| Revenue     | MRR                        | Sum of active subscriptions normalized to 30 days    | `Subscription`                 |
| Retention   | Sub churn                  | Cancelled in month / active at month start           | `Subscription`                 |
| Retention   | Repeat rate 90d            | Customers with ≥ 2 paid orders within 90 days        | `Order`                        |
| Quality     | AI fallback rate           | Consultations resolved by the deterministic fallback | `RoutineConsultation.engine`   |
| Quality     | Recommendation acceptance  | % of recommended steps purchased                     | Join routine ↔ order items     |
| Quality     | Swap rate                  | Steps swapped / steps shown                          | Events                         |
| Tech        | LCP p75, INP p75, CLS p75  | Core Web Vitals                                      | Vercel Speed Insights          |
| Tech        | Error rate                 | 5xx / requests                                       | Sentry + Vercel logs           |

---

## 9. Release criteria (v1.0 "launch")

1. All P0 features pass the E2E critical journeys (see `19-testing-strategy.md`).
2. Lighthouse ≥ 90 on Performance, Accessibility, Best Practices and SEO for Home, PLP, PDP and Finder on mobile.
3. WCAG 2.2 AA on all customer-facing pages (axe: zero serious or critical violations).
4. Stripe webhook handling is idempotent and verified with the Stripe CLI replay suite.
5. No placeholder imagery: every image slot maps to an asset in `17-asset-inventory.md`.
6. Security checklist in `18-security-plan.md` is 100% complete.

---

## 10. Future expansion ideas (post-v1, ranked by expected ROI)

| #   | Idea                                                                 | Rationale                          | Architectural hook already in place                 |
| --- | -------------------------------------------------------------------- | ---------------------------------- | --------------------------------------------------- |
| 1   | **Routine check-ins and skin diary** (weekly photo-free self-rating) | Retention; feeds re-recommendation | `RoutineConsultation.parentId` for lineage          |
| 2   | **Conversational follow-up** ("my skin is stinging after the serum") | Support deflection, trust          | AI service boundary, safety layer                   |
| 3   | **Seasonal auto-adjust** (climate/UV index by postcode)              | Relevance                          | `CustomerPreference.climate`                        |
| 4   | **Multi-currency / EU store**                                        | Market expansion                   | Money stored as integer minor units + currency code |
| 5   | **Referral program** ("give $10, get $10")                           | Low-CAC acquisition                | Coupon engine supports single-use generated codes   |
| 6   | **Loyalty tiers for subscribers**                                    | Churn reduction                    | `DailyMetric` + customer LTV                        |
| 7   | **Dermatologist marketplace integration**                            | Escalation revenue share           | Safety escalation already routes out                |
| 8   | **B2B / spa wholesale portal**                                       | New channel                        | Role system is extensible                           |
| 9   | **Photo-assisted analysis** (opt-in, on-device where possible)       | Differentiation                    | Deferred for bias, accuracy and privacy review      |
| 10  | **Headless mobile app**                                              | Retention                          | API v1 is already versioned and token-authenticated |
