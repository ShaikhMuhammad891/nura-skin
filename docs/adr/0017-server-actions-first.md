# ADR-0017: Server Actions first; REST only where HTTP semantics are needed

- **Status:** Accepted · **Date:** 2026-09-28 · **Refs:** 09 §1; review R-17

## Decision

- v1 UI mutations use **Server Actions only**.
- REST route handlers are built only for: webhooks, `/api/inngest`, `/api/health`, the finder SSE stream, checkout polling, the analytics beacon, public catalogue GETs (cacheable), signed-token email links and streamed CSV exports.
- The remaining REST contracts stay documented in 09 and share the same Zod schemas and DTOs, so exposing them later is mechanical.
- E2E setup uses a guarded `/api/test/*` factory router, available only on local/preview with a secret header.

## Consequences

- ✅ Half the API surface to secure, test and maintain in v1.
- ⚠️ A future mobile client requires adding the deferred routes (with the same services, so low effort).
