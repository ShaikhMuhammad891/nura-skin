# ADR-0020: Storefront rendering, status codes and the in-memory catalogue

- **Status:** Accepted · **Date:** 2026-10-04 · **Refs:** 06 §3.1, 15 §1/§8, 16 §5, NFR-SCALE-06

## Context

M3 builds the catalogue storefront under Cache Components. Three constraints collided:

1. CI builds with **no database** ("nothing connects during `next build`").
2. A segment-wide `(storefront)/loading.tsx` streams the shell first, so `notFound()` and
   `permanentRedirect()` on dynamic pages returned **200** (soft 404, meta-refresh redirect).
3. The launch catalogue is small (≈ 20 products), and filters need disjunctive facet counts.

## Decision

- **Catalogue reads are `"use cache"` functions** (`features/catalog/server/queries.ts`, tags
  `catalog`, `product:<slug>`, …, `cacheLife("hours")`), always reached at **request time**:
  pages await `params`/`searchParams` or call `connection()`, and the home page streams its
  merchandised sections inside `<Suspense>`. The build never touches the DB.
- **No segment-wide `loading.tsx`** in `(storefront)`. Detail pages render blocking
  (`instant = false`), so unknown slugs return a real **404** and moved slugs a real **308**.
  Streaming is opted into locally with `<Suspense>` (e.g. live stock on the PDP).
- **Filtering, faceting and sorting run in memory** over the cached catalogue
  (`features/catalog/filters.ts`, pure and unit-tested), like the finder loader. Facet links are
  plain `nofollow` links; the URL is the state (works without JavaScript).
- Search uses Postgres FTS + trigram (`server/search.ts`), not the cached catalogue.

## Consequences

- ✅ Correct HTTP semantics for SEO, a DB-free build, fast cached pages, trivial facet logic.
- ⚠️ Archived products render the ER2 "discontinued" page with `noindex` but status 200; a true
  410 needs a proxy-side lookup (e.g. an Edge Config list of retired slugs). Follow-up.
- ⚠️ Revisit in-memory filtering past a few hundred products (move to SQL with the same
  `ProductFilters` contract).
- ⚠️ Client navigations into blocking pages have no generic skeleton; add per-route
  `<Suspense>` fallbacks where it matters.
