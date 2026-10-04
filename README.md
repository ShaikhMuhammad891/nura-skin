# Nura Skin

AI-personalized skincare commerce platform: a portfolio-grade Next.js build.
**Current progress: [`docs/STATUS.md`](docs/STATUS.md)** (what is built, live, and next).

The full specification lives in [`docs/`](docs/README.md) (start with `01-product-requirements.md` and `23-architecture-review.md`).

## Status

Live at **https://nura-skin-1fzq.vercel.app**. Storefront, auth, Stripe checkout and the Routine
Finder are built; cart polish, account, admin and subscriptions are next. Details, environment and
the session log: **[`docs/STATUS.md`](docs/STATUS.md)**.

Stack: Next.js 16.3 · React 19.3 · TypeScript 6.0 · Tailwind CSS 4.3 · Vitest 5 · Playwright 1.63. Version rationale: [ADR-0018](docs/adr/0018-toolchain-versions.md).

## Requirements

- Node.js ≥ 22.12 (`.nvmrc` pins 22)
- pnpm 12.6 (pinned in `packageManager`). Node 22's bundled corepack can't launch pnpm 12, so either:
  - `npm i -g corepack@latest && corepack enable` (then use `pnpm`), or
  - prefix commands with `npx pnpm@12.6.0` (e.g. `npx pnpm@12.6.0 install`)

## Getting started

```bash
pnpm install
cp .env.example .env.local
pnpm dev            # generates design tokens, then starts http://localhost:3000
```

Design-system playground (non-production only): http://localhost:3000/dev/components

## Database (no Docker needed)

```bash
pnpm db:local      # terminal 1: real Postgres on :5433 via embedded-postgres (data in .local/)
pnpm db:deploy     # apply migrations
pnpm db:seed       # launch catalogue: 14 products, 5 routines, 41 ingredients (idempotent)
pnpm db:drift      # migrations vs schema must report "No difference detected"
pnpm test:int      # throwaway Postgres per run: migrations + seed + constraint tests
```

`.env.local` points at the local database. For Neon, swap `DATABASE_URL` (pooled) and `DIRECT_URL` (direct). See [ADR-0019](docs/adr/0019-local-postgres-and-pg-adapter.md) and [prisma/migrations/README.md](prisma/migrations/README.md).

## Scripts

| Script                                         | Purpose                                                                    |
| ---------------------------------------------- | -------------------------------------------------------------------------- |
| `pnpm dev` / `pnpm build` / `pnpm start`       | Next.js (tokens are regenerated automatically before dev/build)            |
| `pnpm tokens`                                  | Generate `src/styles/tokens.css` from `src/styles/tokens.json`             |
| `pnpm lint` / `pnpm typecheck` / `pnpm format` | Quality gates                                                              |
| `pnpm test`                                    | Vitest unit & component tests (incl. WCAG contrast checks for both themes) |
| `pnpm test:e2e`                                | Playwright smoke suite (builds and starts the app)                         |
| `pnpm ci`                                      | Everything CI runs, locally                                                |

## Project layout

See [`docs/07-folder-structure.md`](docs/07-folder-structure.md). Key conventions:

- Business logic in `src/features/<feature>`; routes in `src/app` stay thin.
- Server Actions go through `createAction` (`src/lib/server/action.ts`) and must declare an auth policy.
- Components use **semantic colour utilities only** (`bg-background`, `text-link`, …). Raw palette values are not exposed.
- Decisions are recorded in [`docs/adr/`](docs/adr/README.md).
