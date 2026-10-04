# ADR-0019: Embedded Postgres for dev/test; node-postgres adapter at runtime

- **Status:** Accepted · **Date:** 2026-09-28 · **Refs:** 08 §6.2, review R-21, ADR-0004

## Context

- The development machine has no Docker and no local Postgres. The production database (Neon) wasn't provisioned yet, so M1 would otherwise have been blocked.
- Integration tests must exercise the **real** database guarantees (CHECKs, triggers, partial indexes, partitioning, row locks), which mocks or SQLite can't reproduce.
- Checkout and inventory need interactive transactions with `SELECT … FOR UPDATE` (review R-21).

## Decision

1. **Local and test databases use `embedded-postgres`** (real PostgreSQL 18 binaries from npm):
   - `pnpm db:local` runs a persistent dev instance on :5433 (`.local/postgres`).
   - `pnpm test:int` starts a throwaway instance on :5434 per run, applies the **production migration SQL** with `prisma migrate deploy`, seeds it, and deletes it afterwards. CI does the same, so no service container is needed.
2. **Runtime uses `@prisma/adapter-pg` (node-postgres pool)** for both local and Neon, instead of the Neon serverless adapter. A standard TCP pool supports interactive transactions and row locks everywhere. With Neon, `DATABASE_URL` points at the `-pooler` endpoint. Pool: `max 5`, `idleTimeoutMillis 10s` per instance. When deploying to Vercel Fluid compute, add `attachDatabasePool` from `@vercel/functions` in M5.
3. **Prisma 7.10 (stable).** npm's `latest` tag currently points at `8.0.0-rc`. Config lives in `prisma.config.ts` (the datasource URL for migrations and an optional shadow DB), and the client is generated to `src/generated/prisma`.

## Verification

- `test/integration/database.int.test.ts` (17 tests) proves the constraints, append-only triggers, partial uniques, full-text search refresh and partition routing. It also checks that a `FOR UPDATE` taken through the Prisma adapter blocks a competing locker (`55P03`).
- `pnpm db:drift` reports "No difference detected" between the migrations and the schema.

## Consequences

- ✅ M1 is fully built and verified without external accounts. Switching to Neon is only a change of connection string.
- ✅ The integration tests are production-faithful.
- ⚠️ Embedded Postgres is 18.x, while Neon may run 16/17. The SQL used is compatible with both; CI can pin a matching major when Neon is provisioned.
- ⚠️ Keep the project folder out of OneDrive sync (or exclude `node_modules`/`.local`): sync locks slow installs and can cause EPERM errors.
