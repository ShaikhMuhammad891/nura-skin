# ADR-0002: Stripe Embedded Checkout

- **Status:** Accepted · **Date:** 2026-09-28 · **Refs:** 11 §3

## Context

The checkout must support one-time and subscription lines in one payment, Apple Pay, Google Pay and Link, 3DS/SCA and (later) Stripe Tax, while keeping PCI scope minimal and the customer on-site.

## Decision

Use **Stripe Checkout with `ui_mode: embedded`**. `mode = subscription` if any line is a subscription, else `payment`. Line items reference synced Stripe Prices. Order-level discounts are passed as one ephemeral `amount_off` coupon (single use, `redeem_by`, nightly cleanup). Subscription carts share one interval (a Stripe constraint, review R-07) and always ship free, so no `shipping_options` are needed in subscription mode.

## Consequences

- ✅ SAQ A scope; wallets and SCA handled by Stripe; mixed carts in one session.
- ⚠️ Less control over the payment form UI (theming via the Appearance API only).
- ⚠️ One discount per session → our pricing engine composes discounts into a single coupon.

## Alternatives rejected

Payment Element custom flow (more code for mixed carts, more PCI surface); hosted redirect Checkout (leaves the site).
