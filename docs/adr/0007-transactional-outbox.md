# ADR-0007: Transactional outbox → Inngest

- **Status:** Accepted · **Date:** 2026-09-28 · **Refs:** 06 §4.2, §13

## Context

Side effects (emails, Stripe catalogue sync, Clerk metadata, analytics) must not be lost if the process dies right after a DB commit, and must not run inside transactions.

## Decision

- Services write an `OutboxEvent` row **in the same transaction** as the state change.
- After commit, a fast path sends it to Inngest. An Inngest cron (every minute) dispatches anything still pending.
- Consumers are idempotent (keyed by event ID or a domain idempotency key).
- Delayed and scheduled workflows (review requests at +21 days, check-ins) use Inngest step functions.

## Consequences

- ✅ At-least-once delivery with idempotent consumers ⇒ effectively once.
- ⚠️ An extra table and dispatcher; eventual consistency of side effects (seconds).
