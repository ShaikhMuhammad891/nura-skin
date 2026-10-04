# ADR-0015: `/auth/complete` claim handler; no external calls inside DB transactions

- **Status:** Accepted · **Date:** 2026-09-28 · **Refs:** 10 §3, §4.1; reviews R-10, R-13

## Decision

1. Clerk force-redirects every sign-in/sign-up to `/auth/complete?next=…`, a **route handler** that JIT-upserts the User, claims the guest cart, consultations and orders (by verified email), **deletes the guest cookies** and 303-redirects to `next`. This is necessary because Server Components cannot set cookies. `getCurrentUser()` stays read-only.
2. **No network calls to third parties inside DB transactions.** State changes commit together with an `OutboxEvent`, and external effects (Clerk metadata, emails, Stripe sync) run afterwards, idempotently and with retries.
   - The exception is checkout session creation. Its compensation step is explicit: if the Stripe call fails after commit, release the reservations and cancel the order.

## Consequences

- ✅ Correct cookie lifecycle; short lock durations; retriable side effects.
- ⚠️ One extra redirect hop after sign-in.
