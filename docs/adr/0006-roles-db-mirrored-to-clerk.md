# ADR-0006: Roles in the DB, mirrored to Clerk

- **Status:** Accepted · **Date:** 2026-09-28 · **Refs:** 10 §3, §7

## Context

Role checks at the edge (middleware) must not hit the DB. Role changes must be auditable and transactional.

## Decision

- `User.roleId` in Postgres is the **source of truth**. Permissions per role are defined **in code** (`lib/permissions.ts`), reviewed via CODEOWNERS and snapshot-tested.
- The role is mirrored to Clerk `publicMetadata.role` and exposed in session claims **only** for the coarse middleware gate.
- Every Server Action and route handler re-reads the DB role and checks a specific permission.
- Mirroring happens after commit via the outbox (ADR-0015), and a nightly job repairs drift.

## Consequences

- ✅ Fast edge gating; authoritative, auditable server checks.
- ⚠️ A short claim lag after role changes; harmless because server checks use the DB, and demotions revoke sessions first.
