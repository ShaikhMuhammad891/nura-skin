# ADR-0011: Stripe API version pin and checkout findings

- **Status:** Accepted (payment mode) · **Date:** 2026-09-29 · **Refs:** 11 §2–§5, review R-05, ADR-0002/0003

## Context

Review R-05 required pinning the Stripe API version and recording the exact field paths the design touches before building checkout (the M1.5 spike). Several fields moved between recent API versions.

## Decision

1. **Pinned API version `2026-08-26.dahlia`** (stripe-node 22.6), set explicitly in `src/lib/server/stripe.ts`. Webhook endpoints must be created with the same version. Upgrading is a deliberate change that re-verifies the fields below.
2. **Field paths on this version** (differences from the original design text in 11 §3.1):
   - Embedded Checkout is `ui_mode: "embedded_page"` (formerly `"embedded"`); the session still returns `client_secret` for `<EmbeddedCheckout/>`.
   - The shipping address lives at `session.collected_information.shipping_details` (not `session.shipping_details`).
   - Tax: `session.total_details.amount_tax`; charge reference in payment mode: `session.payment_intent`.
   - `payment_status` is `"unpaid"` on `checkout.session.completed` for delayed methods; the order is marked paid only on `"paid"` (that event or `checkout.session.async_payment_succeeded`).
3. **Stripe sits behind a `CheckoutGateway` interface** (`features/checkout/server/gateway.ts`). The orchestration and webhook handlers are integration-tested against the real database with an in-memory gateway that honours idempotency keys like Stripe does.
4. **Idempotency keys:** `product:{variantId}`, `price:{variantId}:ONE_TIME::{amount}`, `customer:{userId}`, `order:{orderId}:session:{previousSessionId|first}` (and `…:coupon:…`), so a retried session after expiry gets a new key while exact retries collapse.
5. **Scope of this step:** one-time (payment mode) checkout. Subscription mode (Routine Plans) needs the subscription sync (M7) and is rejected with `SUBSCRIPTION_CHECKOUT_UNAVAILABLE` until then.

## Consequences

- ✅ Fields verified against the SDK types of the pinned version, not from memory.
- ✅ No network in integration tests; the Stripe adapter itself is a thin mapping.
- ⚠️ Not yet verified live: subscription-mode shipping limits and invoice → payment intent paths (M7), Stripe Tax (P1).
- ⚠️ Stripe idempotency keys expire after 24 h; product/price IDs are persisted on first success, so a re-created product can only happen if persisting failed right after Stripe succeeded.
