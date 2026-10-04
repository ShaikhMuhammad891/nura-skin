# 02 — Business Model

> Nura Skin is a fictional brand. The numbers below are planning assumptions. They exist to make the product design decisions concrete: bundle pricing, subscription discount, free-shipping threshold and coupon guardrails. They are also used as seed data for the admin analytics.

---

## 1. Revenue model overview

| Stream                          | Share of revenue (Y1 target) | Margin profile                          | Notes                                                                                                                                                                                      |
| ------------------------------- | ---------------------------- | --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| One-time product sales          | 45%                          | Gross margin ~72%                       | Single products and add-ons                                                                                                                                                                |
| Routine bundles (one-time)      | 20%                          | ~68% (bundle discount ~8–12%)           | Pre-built routines and AI routines                                                                                                                                                         |
| Subscriptions ("Routine Plans") | 33%                          | ~65% (15% sub discount + free shipping) | Recurring. Highest LTV.                                                                                                                                                                    |
| Travel minis                    | 2%                           | ~75%                                    | Acquisition (cleanser mini at checkout). _Gift cards are out of scope for v1 (they need a stored-value liability ledger and escheatment handling), and are listed under future expansion._ |

**Unit economics assumptions (per order):**

| Item                        | One-time order        | Subscription renewal         |
| --------------------------- | --------------------- | ---------------------------- |
| AOV                         | $72                   | $88                          |
| COGS (product + packaging)  | 26%                   | 26%                          |
| Payment fees (2.9% + $0.30) | ~$2.40                | ~$2.85                       |
| Fulfilment (pick/pack)      | $3.50                 | $3.00                        |
| Shipping cost to us         | $6.50 (free over $60) | $6.50 (always free for subs) |
| Contribution margin         | ~52%                  | ~50%                         |
| CAC (blended)               | $38                   | — (no CAC on renewal)        |

A customer who subscribes and keeps the plan for 4 renewals is worth about 3.5× a one-time buyer in contribution. **Every UX decision in the funnel should push toward routines, and then toward subscriptions, without dark patterns.**

---

## 2. Product sales

### 2.1 Catalogue (launch range: 14 SKUs, 20 variants, 5 routines)

| Category    | Product                   | Key active(s)                                    | Size / price                       | Target                                   |
| ----------- | ------------------------- | ------------------------------------------------ | ---------------------------------- | ---------------------------------------- |
| Cleanser    | **Cloud Milk Cleanser**   | Oat lipids, ceramide NP                          | 150 ml $24 · 30 ml mini $9         | Dry, sensitive                           |
| Cleanser    | **Clarify Gel Cleanser**  | 0.5% salicylic acid, zinc PCA                    | 150 ml $24                         | Oily, acne-prone                         |
| Cleanser    | **Melt Cleansing Balm**   | Sunflower + oat oils                             | 100 ml $32                         | All; makeup/SPF removal                  |
| Serum       | **Dew Serum**             | 1.5% multi-weight hyaluronic acid, 5% panthenol  | 30 ml $34                          | Dehydration, all types                   |
| Serum       | **Clear Serum**           | 10% niacinamide, 1% zinc PCA                     | 30 ml $30                          | Oil, pores, breakouts                    |
| Serum       | **Glow Serum**            | 15% ethyl ascorbic acid, ferulic acid, vitamin E | 30 ml $48                          | Dullness, pigmentation                   |
| Serum       | **Renew Night Serum**     | 0.05% encapsulated retinal                       | 30 ml $56                          | Fine lines, texture (not pregnancy-safe) |
| Serum       | **Calm Serum**            | 10% azelaic acid, centella asiatica              | 30 ml $42                          | Redness, post-acne marks                 |
| Moisturizer | **Barrier Cream**         | 3% ceramide complex (3:1:1), cholesterol         | 50 ml $38 · 100 ml refill $58      | Dry, compromised barrier                 |
| Moisturizer | **Water Gel Cream**       | Squalane, ectoin, glycerin (oil-free)            | 50 ml $34 · 100 ml refill $52      | Oily, combination                        |
| Moisturizer | **Night Recovery Cream**  | Peptide complex, shea                            | 50 ml $52                          | Aging, dryness                           |
| Sunscreen   | **Daily Veil SPF 50**     | Hybrid filters, 2% niacinamide                   | 50 ml $36                          | All; invisible finish                    |
| Sunscreen   | **Mineral Shield SPF 50** | 20% zinc oxide                                   | 50 ml $38                          | Sensitive, pregnancy                     |
| Sunscreen   | **Tinted Glow SPF 30**    | Zinc oxide + iron oxides                         | 50 ml $40 in Light / Medium / Deep | Even tone, all                           |

### 2.2 Pre-built routines (bundles)

| Routine            | Contents                                                                            | List price | Bundle price | Saving |
| ------------------ | ----------------------------------------------------------------------------------- | ---------- | ------------ | ------ |
| **Barrier Rescue** | Cloud Milk · Dew Serum · Barrier Cream · Mineral Shield                             | $134       | $118         | 12%    |
| **Clear Skin**     | Clarify Gel · Clear Serum · Water Gel Cream · Daily Veil                            | $124       | $110         | 11%    |
| **Glow**           | Melt Balm · Glow Serum · Water Gel Cream · Daily Veil                               | $150       | $134         | 11%    |
| **Age Renewal**    | Cloud Milk · Glow Serum (AM) · Renew Night Serum (PM) · Night Recovery · Daily Veil | $216       | $189         | 12.5%  |
| **Starter Duo**    | Cloud Milk · Daily Veil                                                             | $60        | $54          | 10%    |

**Bundles and subscriptions (review R-08):** a pre-built routine is sold as a **bundle SKU for one-time purchase only**. "Subscribe to this routine" adds the routine's **components as individual subscription lines**, each at the 15% subscription price. This avoids an un-swappable bundle price inside a Stripe subscription and component-stock expansion on every renewal. Because 15% > the ~11% bundle saving, subscribers never pay more.

**AI routines** are dynamic bundles. The routine discount is applied automatically when ≥ 3 recommended steps are purchased together from a saved routine: 10% off those lines. This rewards completing the routine and is enforced server-side (see `11-payment-design.md` §Pricing engine).

### 2.3 Pricing rules

- Prices are stored as integer cents (USD at launch).
- `compareAtPrice` is shown struck through only when there is a real, active discount. This is FTC-compliant: we never show fake anchors.
- Discounts do not stack beyond one "best price" rule per line (see the priority order in `11-payment-design.md`). A coupon can stack on top of that, unless the coupon is flagged `exclusive`.

---

## 3. Subscription model — "Routine Plans"

| Parameter                                              | Decision                                                                                                                                                                                                                                                                                                                                                                                                                                              | Reasoning                                                                                                                                                                                                                                                                                                                                        |
| ------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Unit of subscription                                   | Per line item, grouped under one Stripe Subscription per checkout                                                                                                                                                                                                                                                                                                                                                                                     | One bill, one shipment. **All items share one interval.** This is a hard Stripe Checkout constraint (one subscription per session), and it is also better UX (one box).                                                                                                                                                                          |
| Intervals                                              | Every 4, 8 or 12 weeks                                                                                                                                                                                                                                                                                                                                                                                                                                | Matches product usage: 30 ml serum ≈ 6–8 weeks, SPF 50 ml ≈ 4–6 weeks at correct dosage                                                                                                                                                                                                                                                          |
| Suggested interval & quantity (revised in review R-07) | The **cart/plan** has one interval, defaulting to the one closest to the median `replenishDays` of its subscription lines (usually 8 weeks). Products that run out faster get a **quantity suggestion** rather than a different interval ("Your SPF lasts ~5 weeks, so we suggest 2 per 8-week delivery"). The PDP shows "Delivered every {cart interval} weeks with your plan" instead of a per-product interval picker once a plan interval exists. | Items with different usage rates are handled without splitting subscriptions; reduces "too much / too little product" churn                                                                                                                                                                                                                      |
| Discount                                               | 15% on every renewal, including the first order                                                                                                                                                                                                                                                                                                                                                                                                       | Clear and simple; competitive benchmark 10–20%                                                                                                                                                                                                                                                                                                   |
| Shipping                                               | Always free                                                                                                                                                                                                                                                                                                                                                                                                                                           | Strong differentiator versus one-time orders                                                                                                                                                                                                                                                                                                     |
| Commitment                                             | None; cancel anytime                                                                                                                                                                                                                                                                                                                                                                                                                                  | Trust; reduces pre-purchase anxiety                                                                                                                                                                                                                                                                                                              |
| Self-service                                           | Skip, pause (≤ 90 days), change interval, swap variant/product within the same category, add a one-time item to the next box                                                                                                                                                                                                                                                                                                                          | Replaces cancellation with alternatives                                                                                                                                                                                                                                                                                                          |
| Reminder                                               | Email 3 days before each renewal, with skip/edit deep links                                                                                                                                                                                                                                                                                                                                                                                           | Prevents surprise charges and chargebacks                                                                                                                                                                                                                                                                                                        |
| Failed payments                                        | Stripe Smart Retries (4 attempts over 2 weeks) + dunning emails on day 0, 3 and 7; then `past_due` → `canceled`                                                                                                                                                                                                                                                                                                                                       | Recovers ~30–40% of failed renewals (industry benchmark)                                                                                                                                                                                                                                                                                         |
| Cancellation flow                                      | One screen: reason (required, single select) + offers based on reason (e.g. "too much product" → switch to 12 weeks). The customer can always confirm the cancel from that same screen.                                                                                                                                                                                                                                                               | Reduces churn without dark patterns. Designed to meet **"cancel as easily as you signed up"** requirements in state auto-renewal laws (e.g. California's ARL amendments effective July 2025). The FTC's federal click-to-cancel rule was vacated in 2025, so the design follows the strictest remaining state standard and FTC ROSCA principles. |

**Subscription states** (mirroring Stripe with local extensions): `ACTIVE`, `PAUSED`, `PAST_DUE`, `CANCELED`, `INCOMPLETE`. See `08-database-design.md`.

---

## 4. Customer retention strategy

| Lever                                                     | Mechanism                                                                                            | Trigger / timing                                | Owner (system)                 |
| --------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- | ----------------------------------------------- | ------------------------------ |
| **Routine onboarding sequence**                           | Email series: "How to start your routine" → "Week 2: introduce retinal" → "Week 4: how's your skin?" | Order delivered + 0/14/28 days                  | Inngest scheduled job + Resend |
| **Usage-based replenishment reminders** (non-subscribers) | "You're probably running low on Glow Serum" plus a one-click reorder                                 | `orderDate + variant.replenishDays − 7`         | Inngest                        |
| **Subscription conversion nudge**                         | After the 2nd one-time purchase of the same variant, offer "Subscribe & save 15%"                    | On 2nd purchase                                 | Order-paid handler             |
| **90-day routine check-in**                               | Short re-consultation that pre-fills the previous answers and adjusts the routine                    | Day 90 after the first routine                  | Inngest + Finder               |
| **Seasonal switch**                                       | "Winter is coming — swap Water Gel for Barrier Cream?"                                               | Quarterly campaign, for subscribers             | Marketing manager              |
| **Review request**                                        | Request 21 days after delivery (after the skin has had time to respond)                              | Delivery + 21 days                              | Inngest                        |
| **Win-back**                                              | 10% code, single-use, expiring in 14 days                                                            | 120 days since the last order, not a subscriber | Inngest + coupon generator     |
| **Cancellation save offers**                              | Reason-mapped offers (skip, change interval, swap product, one-time 20% off next box)                | Cancel flow                                     | Subscription service           |

---

## 5. Upselling & cross-selling opportunities

All upsell surfaces are **routine-aware**. The system never suggests a product that conflicts with the customer's saved routine or skin profile.

| Surface                                 | Logic                                                                                          | Guardrail                                                        |
| --------------------------------------- | ---------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| PDP "Complete the routine"              | The missing routine slots (cleanse/treat/moisturize/protect) for the product's primary concern | Excludes conflicting actives; excludes profile avoidances        |
| Cart "Pairs well with"                  | Top compatible item by co-purchase score from `DailyMetric` / order-item pairs                 | Max 1 suggestion; never a second serum with a conflicting active |
| Cart "Upgrade to routine"               | If the cart contains ≥ 2 items of a pre-built routine, show the bundle saving                  | Only if the saving is ≥ $5                                       |
| Cart "Subscribe & save" toggle per line | Shows the per-renewal saving                                                                   | Default is one-time. We never pre-check subscription.            |
| Travel minis at checkout                | $9 minis of the cleanser                                                                       | Only for new customers                                           |
| Post-purchase page                      | "Add SPF to your order": one click to add to the _next_ subscription shipment                  | Subscribers only                                                 |
| Finder budget tiers                     | Essential → Complete → Advanced, with incremental price shown                                  | The AI explains what each extra step does                        |

---

## 6. Marketing strategy

### 6.1 Positioning pillars

1. **"Your routine, explained."** Transparency and education.
2. **"Fewer products. Better skin."** Minimalism and anti-overconsumption.
3. **"Made to work together."** Compatibility engine.

### 6.2 Channel plan

| Channel                    | Role                | Tactics                                                                                                                                                      | KPI                                          |
| -------------------------- | ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------- |
| SEO (content)              | Low-CAC acquisition | Ingredient glossary (e.g. "niacinamide vs azelaic acid"), concern hubs, "routine for oily skin" pages, generated from structured product and ingredient data | Organic sessions, finder starts from organic |
| Paid social (Meta, TikTok) | Scale               | Finder-first creative ("Get your routine in 3 minutes"), UGC before/after (compliant), retargeting of finder completers who didn't buy                       | CAC, finder start rate                       |
| Creators                   | Trust               | Dermatology-literate creators; affiliate codes via the coupon engine                                                                                         | Attributed revenue                           |
| Email / SMS                | Retention           | Lifecycle flows (see §4)                                                                                                                                     | Repeat rate                                  |
| Referral (P2)              | Low-CAC             | Give $10 / Get $10                                                                                                                                           | K-factor                                     |
| PR                         | Brand               | "The anti-hype skincare brand" story                                                                                                                         | Branded search volume                        |

### 6.3 Attribution

- UTM parameters are captured on the first page view and stored on `AnalyticsEvent.properties` and on `Order.attribution` (first-touch + last-touch).
- Coupon codes map to campaigns (`Coupon.campaign`).
- The finder records `source` (e.g. `home_hero`, `pdp_banner`, `email_checkin`).

---

## 7. Customer lifecycle

```
 AWARENESS ─► CONSIDERATION ─► CONSULTATION ─► FIRST PURCHASE ─► ONBOARDING ─► HABIT ─► LOYALTY/ADVOCACY
   ads, SEO     browse PDPs,      AI Finder      routine or        routine emails   subscription   reviews,
   creators     ingredients       (3 min)        single product    (0/14/28 d)      renewals       referrals
                                                                                        │
                                                          AT-RISK ◄─────────────────────┘
                                                          (skip x2, payment failed,
                                                           120d inactive)
                                                               │
                                                          WIN-BACK / SAVE ─► CHURNED
```

| Stage           | Definition (data)                                                                             | Primary goal            | System touchpoints                              |
| --------------- | --------------------------------------------------------------------------------------------- | ----------------------- | ----------------------------------------------- |
| Visitor         | Session with no account                                                                       | Start the finder        | Hero CTA, sticky finder pill                    |
| Lead            | Finder completed, email captured, no order                                                    | First purchase          | "Your routine is saved" email + reminder at 24h |
| New customer    | 1 paid order                                                                                  | Onboarding success      | Routine how-to emails                           |
| Repeat customer | ≥ 2 paid orders                                                                               | Convert to subscription | Subscribe nudge                                 |
| Subscriber      | ≥ 1 active subscription                                                                       | Retain, expand          | Reminders, swaps, check-ins                     |
| At-risk         | Subscriber with 2 consecutive skips, or `PAST_DUE`, or a one-time buyer inactive for 120 days | Save                    | Dunning, save offers, win-back                  |
| Churned         | Cancelled or inactive for 180 days                                                            | Win-back                | Seasonal campaign                               |

Lifecycle stage is **computed**, not stored: a nightly job materializes it into `CustomerMetric.lifecycleStage` for admin segmentation (see `08-database-design.md`).
