# ADR-0003: Webhooks are the source of truth for payment and subscription state

- **Status:** Accepted · **Date:** 2026-09-28 · **Refs:** 11 §5

## Context

Redirects can be lost, duplicated or spoofed, and Stripe events can arrive late, twice or out of order.

## Decision

- Orders become PAID and subscriptions change state **only** via signature-verified Stripe events, processed by idempotent, convergent handlers. A handler re-reads the latest Stripe object when ordering matters.
- A `WebhookEvent` table keyed by the Stripe event ID de-duplicates events.
- The checkout return page may call the **same** idempotent `markPaidFromSession(sessionId)` after retrieving the session from Stripe. Whichever runs first wins; the other is a no-op.
- A nightly reconciliation job compares the last 48 h of Stripe objects with the DB and reprocesses any drift.
- The Stripe API version is pinned in the SDK and on the webhook endpoints (review R-05).

## Consequences

- ✅ Correct under retries, duplicates and reordering.
- ⚠️ The UI must handle "payment received, confirming…" states.
