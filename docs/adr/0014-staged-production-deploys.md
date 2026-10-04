# ADR-0014: Staged production deploys

- **Status:** Accepted · **Date:** 2026-09-28 · **Refs:** 20 §3; review R-02

## Context

`NEXT_PUBLIC_*` variables are inlined at build time, so a staging build can't be promoted to production without rebuilding.

## Decision

Release pipeline, run on a tag of a commit that is already green on staging:

1. `vercel deploy --prod --skip-domain`: a production-env build that takes no traffic.
2. `prisma migrate deploy` on production (expand-only migrations).
3. Smoke tests against the staged URL.
4. `vercel promote <url>`: domains switch without a rebuild. Instant Rollback remains available.

The parity guarantee is: same commit, same lockfile, same build image.

## Consequences

- ✅ Production-configured artifacts are tested before they receive traffic.
- ⚠️ Two builds per commit (staging and production); CI minutes increase slightly.
