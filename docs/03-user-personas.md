# 03 — User Personas

Personas drive three things in this project:

1. **Feature priority**: which journeys are P0.
2. **UX decisions**: tone, information density, mobile vs. desktop.
3. **RBAC design**: what each internal role can see and do (see `10-authentication-design.md` §Permissions matrix).

The persona illustrations are listed in `17-asset-inventory.md` (`persona-*.webp`). They are used only in the portfolio case study, not in the product.

---

## Persona 1 — Customer: "Maya Chen, the Overwhelmed Optimizer"

| Attribute      | Detail                                                                                      |
| -------------- | ------------------------------------------------------------------------------------------- |
| Age / location | 29, Chicago (urban, four seasons)                                                           |
| Occupation     | UX researcher, hybrid work                                                                  |
| Skin           | Combination; oily T-zone, dehydrated cheeks; hormonal breakouts on the jaw; post-acne marks |
| Sensitivity    | Moderate: stinging from strong acids in the past                                            |
| Budget         | $60–$110/month on skincare, currently spread across 4 brands                                |
| Devices        | iPhone (80% of browsing), MacBook for considered purchases                                  |
| Channels       | TikTok, r/SkincareAddiction, Instagram, newsletters from 3 brands                           |

**Goals**

- Clear up breakouts _and_ fade the marks without irritating her skin.
- Stop buying products that sit unused ("my shelf is a graveyard").
- Understand _why_ a product should work for her.

**Problems / frustrations**

- Conflicting advice online ("never mix niacinamide and vitamin C" vs. "that's a myth").
- Brand quizzes that obviously just push the most expensive product.
- Surprise subscription charges from another brand; she distrusts auto-renew.
- Long ingredient lists she can't parse.

**Behaviors**

- Researches for 1–2 weeks before buying and reads the 1–3 star reviews first.
- Screenshots product pages and ingredients to compare.
- Abandons carts when shipping costs appear late.
- Uses Apple Pay whenever possible.

**Needs from Nura**

| Need                         | Feature                                                            |
| ---------------------------- | ------------------------------------------------------------------ |
| Trustworthy guidance         | AI Finder with per-step "why this" explanations and concentrations |
| No clash between actives     | Compatibility engine; AM/PM split                                  |
| Reviews from people like her | Review filter by skin type and concern                             |
| Subscription transparency    | Clear renewal date, 3-day reminder, 2-click cancel                 |
| Fast mobile checkout         | Apple Pay via Stripe Embedded Checkout                             |

**Expected interactions**

1. Lands from a TikTok ad on mobile and starts the finder from the hero.
2. Completes the finder in about 3 minutes, including the free-text note: "I get small bumps on my jaw before my period".
3. Reads the routine and taps "Why this?" on each step. Swaps Glow Serum for Calm Serum (budget).
4. Saves the routine by creating an account (Google via Clerk), then leaves.
5. Returns 2 days later from a reminder email, adds the routine to the cart, subscribes to the SPF only and pays with Apple Pay.
6. At day 28 receives the "How's your skin?" email and leaves a review at day 21 after delivery.

**Quote:** _"Just tell me what to use and why — and don't make me cancel through a chatbot."_

---

## Persona 1b — Customer (secondary): "Daniel Okafor, the Minimalist"

| Attribute          | Detail                                                                                                                          |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------- |
| Age                | 41, Atlanta, father of two, sales director                                                                                      |
| Skin               | Normal-to-dry, early fine lines, sun damage from running                                                                        |
| Budget             | Will pay for convenience; ~$90/month                                                                                            |
| Goal               | "A 3-step routine I never have to think about."                                                                                 |
| Key features       | Starter Duo → Age Renewal routine, 8-week subscription, skip via email link                                                     |
| Design implication | Short copy, obvious CTAs, email deep links that work without logging in again (signed, short-lived magic links for "skip next") |

## Persona 1c — Customer (tertiary): "Sofia Almeida, Sensitive & Specific"

| Attribute          | Detail                                                                                                                                                                 |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Age                | 33, Lisbon (ships to US address in v1), 5 months pregnant, rosacea-prone                                                                                               |
| Goal               | Products that are pregnancy-safe, fragrance-free and non-irritating                                                                                                    |
| Fear               | "An AI telling me to use a retinoid while pregnant."                                                                                                                   |
| Key features       | Pregnancy hard filter (excludes retinoids and high-dose salicylic acid), fragrance-free filter, dermatologist escalation copy for rosacea flare symptoms               |
| Design implication | The safety logic must be visible: "We've excluded 2 products because you're pregnant: Renew Night Serum (retinal), Clarify Gel Cleanser (salicylic acid). [Learn why]" |

---

## Persona 2 — Admin: "Priya Raman, Founder & Operations Lead"

| Attribute       | Detail                                                           |
| --------------- | ---------------------------------------------------------------- |
| Age / role      | 36, co-founder; owns operations, customer experience and finance |
| Technical skill | Comfortable with Shopify/Stripe dashboards; not a developer      |
| Devices         | Desktop (27" monitor) during the day; checks the phone at night  |
| Time in admin   | 2–3 hours/day                                                    |

**Goals**

- See business health in 10 seconds: revenue, orders to ship, subscription MRR, stock warnings.
- Resolve customer issues fast: find an order, refund partially, resend confirmation.
- Launch new products without developer help.

**Problems**

- Previous tools had separate dashboards for payments, stock and email, with no single source of truth.
- Fear of making irreversible mistakes (refunds, deleting products).
- Needs to know _who changed what_ when things go wrong.

**Behaviors**

- Starts the day on the dashboard, then the orders queue.
- Exports CSVs for the accountant monthly.
- Uses keyboard shortcuts if they are available.

**Needs**

| Need                      | Feature                                                                                                   |
| ------------------------- | --------------------------------------------------------------------------------------------------------- |
| At-a-glance KPIs          | Dashboard KPI tiles with period comparison                                                                |
| Safe irreversible actions | Confirmation dialogs with typed confirmation for refunds > $100 and for archiving; soft delete; audit log |
| Self-serve catalogue      | Product editor with preview, draft/publish, Cloudinary upload                                             |
| Accountability            | Audit log with actor, before/after diff                                                                   |
| Exports                   | CSV export on orders, customers and analytics                                                             |

**Expected interactions:** log in → dashboard → orders filtered "Paid, unfulfilled" → bulk "Mark as fulfilled" with tracking numbers → open a customer ticket order → partial refund with reason → check the analytics weekly.

**Permissions:** everything, including role management and settings.

---

## Persona 3 — Inventory Manager: "Marcus Lee"

| Attribute  | Detail                                                                                    |
| ---------- | ----------------------------------------------------------------------------------------- |
| Age / role | 31, warehouse and inventory coordinator (3PL liaison)                                     |
| Devices    | Desktop at the warehouse office; tablet on the warehouse floor (≥ 768px layout must work) |
| Skill      | Spreadsheet power user                                                                    |

**Goals**

- Never sell out of a best-seller, and never oversell.
- Record receiving of stock quickly and accurately.
- Know which subscription renewals are coming up (to forecast demand).

**Problems**

- Stock numbers drifting between systems.
- Can't tell _why_ a stock number changed.
- Subscription renewals silently eat stock.

**Behaviors**

- Receives stock twice a week; adjusts counts after cycle counts.
- Checks low-stock alerts every morning.

**Needs**

| Need                        | Feature                                                                                                                          |
| --------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| Accurate, explainable stock | `InventoryMovement` ledger: every change has a type and reason (SALE, RETURN, RECEIVE, ADJUSTMENT, RESERVATION, RELEASE, DAMAGE) |
| Forecast                    | "Committed next 14 days" column = upcoming subscription renewals × quantity                                                      |
| Fast adjustments            | Inline stock adjust with reason dropdown; bulk CSV import (P2)                                                                   |
| Alerts                      | Low-stock threshold per variant; daily digest email + dashboard badge                                                            |

**Expected interactions:** inventory page → filter "Below threshold" → open variant → "Receive stock +240 (PO-1042)" → check the movement history.

**Permissions:** read products, update inventory and variant stock thresholds, read orders (to see fulfilment), mark orders fulfilled. **Cannot**: refund, see revenue analytics, edit prices, manage coupons or users.

---

## Persona 4 — Marketing Manager: "Elena Duarte"

| Attribute  | Detail                                                                   |
| ---------- | ------------------------------------------------------------------------ |
| Age / role | 34, growth and CRM marketer                                              |
| Devices    | Laptop; heavy use of Google Sheets, Meta Ads Manager, Klaviyo-type tools |
| Skill      | Data-literate; writes SQL-ish filters but doesn't code                   |

**Goals**

- Grow finder starts and conversion; know where people drop off.
- Launch campaigns with coupon codes and see attributed revenue.
- Feature the right products and routines on the home page.
- Understand which concerns are trending (seasonality).

**Problems**

- Quiz tools with no data export and no step-level funnel.
- Coupons that stack accidentally and destroy margin.
- Needs a developer to change the home page hero.

**Behaviors**

- Reviews the funnel weekly and runs 2–3 campaigns per month.
- Checks review sentiment for creative ideas.

**Needs**

| Need            | Feature                                                                                                                   |
| --------------- | ------------------------------------------------------------------------------------------------------------------------- |
| Finder funnel   | Step-by-step drop-off chart, completion rate, top concerns, fallback rate                                                 |
| Safe coupons    | Coupon rules: min subtotal, max redemptions, per-customer limit, exclusivity, eligible categories, expiry; margin preview |
| Merchandising   | "Featured" flags and sort order for routines and products on the home page; hero content via the settings entity (P1)     |
| Attribution     | Revenue by coupon, by UTM source/campaign                                                                                 |
| Review insights | Moderate reviews and mark them "featured"                                                                                 |

**Expected interactions:** analytics → finder funnel → notices a 30% drop at the "budget" step → asks the product team to test the budget copy → creates coupon `GLOW15` (15%, Glow routine only, 500 redemptions, expires 31 Oct) → tracks redemptions on the coupon detail page.

**Permissions:** read products, update merchandising fields only (featured, badges, sort order), full coupon CRUD, full analytics, review moderation. **Cannot**: change prices, stock, orders, refunds or user roles.

---

## Persona 5 — Support Agent (supporting role): "Jordan Blake"

Part-time customer support. Needs: find a customer by email or order number, view orders and subscriptions, resend emails, skip or cancel a subscription on behalf of the customer, add internal notes. **Cannot** refund above $50 without an Admin, and cannot edit the catalogue. Included so that RBAC is designed for least privilege from day one.

---

## Persona-to-feature traceability matrix

| Feature                       | Maya | Daniel | Sofia | Priya | Marcus       | Elena         | Jordan |
| ----------------------------- | ---- | ------ | ----- | ----- | ------------ | ------------- | ------ |
| AI Finder                     | ●●●  | ●●     | ●●●   |       |              | ●● (insights) |        |
| Safety filters & explanations | ●●   | ●      | ●●●   |       |              |               |        |
| Subscriptions self-service    | ●●   | ●●●    | ●     | ●     | ● (forecast) | ●             | ●●     |
| Reviews by skin type          | ●●●  | ●      | ●●    |       |              | ●●            |        |
| Apple Pay / fast checkout     | ●●●  | ●●     | ●     |       |              |               |        |
| Dashboard KPIs                |      |        |       | ●●●   | ●            | ●●            |        |
| Inventory ledger              |      |        |       | ●●    | ●●●          |               |        |
| Coupons & attribution         |      |        |       | ●     |              | ●●●           |        |
| Audit log                     |      |        |       | ●●●   | ●            |               | ●      |
| Order refunds                 |      |        |       | ●●●   |              |               | ●●     |

●●● = critical · ●● = important · ● = nice to have
