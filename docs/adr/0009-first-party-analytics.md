# ADR-0009: First-party analytics events + typed daily rollups

- **Status:** Accepted · **Date:** 2026-09-28 · **Refs:** 08 §4.12 (R-19, R-20)

## Decision

- Business and funnel events (`session_started`, `product_viewed`, `finder_*`, `cart_*`, `checkout_*`, `order_paid`, `subscription_*`) go to a **monthly-partitioned** `analytics_events` table.
- Generic page traffic uses Vercel Web Analytics; there are no per-page-view rows.
- Consent-gated session IDs; events without consent are stored unlinked.
- Nightly idempotent rollups populate the typed tables `DailyStoreMetric`, `DailyProductMetric`, `DailyFinderStepMetric`, `DailyConcernMetric` and `DailyCouponMetric`. The admin reads rollups plus a live "today" query.
- Retention works by dropping partitions older than 13 months.

## Consequences

- ✅ Privacy-friendly KPIs owned by us, fast dashboards, bounded storage.
- ⚠️ No ad-hoc product analytics tool; exploratory analysis requires SQL.
