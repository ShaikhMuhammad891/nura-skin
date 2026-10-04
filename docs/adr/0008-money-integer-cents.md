# ADR-0008: Money as integer cents, discounts in basis points

- **Status:** Accepted · **Date:** 2026-09-28 · **Refs:** 08 §1, 11 §4

## Decision

- All amounts are stored as `Int` minor units + an ISO 4217 `currency`. Percentages are stored as integer **basis points** (1500 = 15%).
- Rounding is half-up per line: `floor((amount × bp + 5000) / 10000)`.
- Order-level discounts are allocated to lines by the largest-remainder method, so line discounts sum exactly to the order discount.
- No floats or decimals are used for money anywhere, including the UI (format with `Intl.NumberFormat` from cents).

## Consequences

- ✅ Exact arithmetic; property-testable invariants; per-line partial refunds are exact.
- ⚠️ Every boundary (Stripe, forms, CSV) must convert explicitly; `Money` helpers are the only allowed path.
