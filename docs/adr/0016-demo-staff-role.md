# ADR-0016: `DEMO_STAFF` role with rolled-back mutations

- **Status:** Accepted · **Date:** 2026-09-28 · **Refs:** 10 §9b; review R-06

## Context

Portfolio reviewers need one-click admin access, but real staff require MFA and real permissions.

## Decision

- Add the `DEMO_STAFF` role, only when `DEMO_MODE_ENABLED=true`. It has the read permissions of the persona being demoed; mutations run through `createAction` in a transaction that is **always rolled back**, and external effects (Stripe, Clerk, email, outbox) are skipped.
- Demo staff see only `User.isDemo` data, and are MFA-exempt.
- Sign-in uses Clerk sign-in tokens (5 min TTL); sessions are capped at 1 h and rate limited.

## Consequences

- ✅ Safe, convincing demo of every admin workflow.
- ⚠️ `createAction` must support a rollback mode, and every admin mutation must be tested under it (CUJ-16).
