# ADR-0004: Inventory reservations + movement ledger

- **Status:** Accepted · **Date:** 2026-09-28 · **Refs:** 08 §4.3, 11 §3, §5.2

## Context

Serverless functions race for the last unit, and payment completes asynchronously. Overselling a skincare product damages trust, and stock changes must be explainable to the Inventory Manager.

## Decision

- `InventoryItem { onHand, reserved }` with CHECK `0 ≤ reserved ≤ onHand`. Available = onHand − reserved.
- Checkout creation locks inventory rows (`SELECT … FOR UPDATE`) inside an interactive transaction, creates `InventoryReservation`s (expiry = session expiry + 5 min) and increments `reserved`.
- Payment commits reservations into `SALE` movements; session expiry releases them; a sweeper handles missed events.
- Subscription renewals reserve at `invoice.upcoming` (review R-09).
- Every `onHand` change writes an append-only `InventoryMovement` (a DB trigger rejects UPDATE/DELETE).
- Transactions require the Neon adapter in WebSocket/Pool mode (review R-21).

## Consequences

- ✅ No oversell; a full audit trail.
- ⚠️ Stock is held for up to 35 min per abandoned checkout (acceptable at our volumes).
