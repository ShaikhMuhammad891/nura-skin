# ADR-0018: Toolchain & framework versions

- **Status:** Accepted · **Date:** 2026-09-28 · **Refs:** review item V-9

## Context

The project targets the latest stable Next.js. Several ecosystem majors have been released since the spec was written: TypeScript 7 (the native compiler), ESLint 10, Vitest 5 and pnpm 12. Not every tool in the chain supports them yet.

## Decision

Use the latest version of everything **unless** a peer-dependency constraint in the toolchain forbids it. Resolved on 2026-09-28 via `pnpm add <pkg>@latest` and `pnpm peers check` (no issues):

| Area            | Package                                 | Version                | Note                                                                                                                                               |
| --------------- | --------------------------------------- | ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| Framework       | next / eslint-config-next               | 16.3.6                 | Latest. Turbopack build, `cacheComponents: true`, `proxy.ts` for request interception (from M2)                                                    |
| UI runtime      | react / react-dom                       | 19.3.0                 | Latest                                                                                                                                             |
| Styling         | tailwindcss / @tailwindcss/postcss      | 4.3.3                  | Latest                                                                                                                                             |
| Components      | radix-ui                                | 1.6.7                  | Unified package (`Slot`, `Label`, `Separator`, …)                                                                                                  |
| Motion          | motion                                  | 13.4.4                 | Latest                                                                                                                                             |
| Icons           | lucide-react                            | 1.48.0                 | Latest                                                                                                                                             |
| Validation      | zod / @t3-oss/env-nextjs                | 4.6.5 / 0.13.11        | Latest                                                                                                                                             |
| Logging         | pino                                    | 10.3.1                 | Latest                                                                                                                                             |
| Language        | **typescript**                          | **~6.0.3**             | **Held back from 7.0.2**: `typescript-eslint` 8.x (via eslint-config-next) requires `>=4.8.4 <6.1.0`                                               |
| Linting         | **eslint**                              | **^9.39.5**            | **Held back from 10.x**: eslint-plugin-import / jsx-a11y / react (via eslint-config-next) support ESLint ≤ 9                                       |
| Formatting      | prettier / prettier-plugin-tailwindcss  | 3.9.9 / 0.8.1          | Latest                                                                                                                                             |
| Unit tests      | vitest / @vitest/coverage-v8 / jsdom    | 5.0.2 / 30.1.1         | Latest; requires Node ≥ 22.12                                                                                                                      |
| E2E             | @playwright/test / @axe-core/playwright | 1.63.0 / 4.13.0        | Latest                                                                                                                                             |
| Package manager | pnpm                                    | 12.6.0                 | `packageManager` field. Node 22's bundled corepack can't launch pnpm 12, so use `npx pnpm@12.6.0` or a newer corepack (`npm i -g corepack@latest`) |
| Runtime         | Node.js                                 | ≥ 22.12 (dev: 22.16.0) | `.nvmrc` = 22                                                                                                                                      |

Build scripts are allowlisted in `pnpm-workspace.yaml` (`allowBuilds`: esbuild, unrs-resolver). pnpm blocks all other install scripts.

## Consequences

- ✅ The latest framework and runtime; a clean peer tree.
- ⚠️ Revisit TypeScript 7 and ESLint 10 when `eslint-config-next` / `typescript-eslint` widen their peer ranges. Renovate will surface this. The upgrade is a deliberate PR, not an automatic one.

## Verification

- [x] `pnpm install` resolves; `pnpm peers check` is clean
- [x] `pnpm typecheck`, `pnpm lint`, `pnpm format:check`, `pnpm test` (72 tests), `pnpm build` pass
- [x] `pnpm test:e2e` smoke passes: 11 passed, 1 skipped (keyboard test on touch profile), Chromium + WebKit
- [ ] Lockfile committed (pending repository creation)
