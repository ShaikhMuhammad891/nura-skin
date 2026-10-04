import { SearchX, Sparkles } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";

import type { ConcernDTO, ProductCardDTO } from "../types";
import {
  clearFilters,
  listProducts,
  parseFilters,
  serializeFilters,
  type FacetKey,
} from "../filters";
import { ActiveFilterChips, FilterPanel } from "./filters";
import { ProductGrid } from "./product-card";
import { SortSelect } from "./sort-select";

type SearchParams = Record<string, string | string[] | undefined>;

/** Finder promo inserted after row two (docs/15 P2, IMG-BANNER-FINDER). */
function FinderBanner() {
  return (
    <div className="flex flex-col items-start gap-4 rounded-xl bg-accent-subtle p-6 sm:flex-row sm:items-center sm:justify-between lg:p-8">
      <div className="flex flex-col gap-1">
        <p className="font-display text-heading-xl font-normal">Not sure where to start?</p>
        <p className="text-body text-muted-foreground">
          Answer ten questions and get a routine where every product works together.
        </p>
      </div>
      <Button asChild variant="accent">
        <Link href="/finder">
          <Sparkles aria-hidden />
          Find my routine
        </Link>
      </Button>
    </div>
  );
}

/**
 * Shared PLP body (docs/15 P2–P3): facets, chips, sort, grid and "Load more". `scope` narrows the
 * catalogue (a category) before faceting; `hide` removes facets that the scope makes redundant.
 */
export function ProductListing({
  catalogue,
  concerns,
  searchParams,
  basePath,
  scope,
  hide = [],
}: {
  catalogue: ProductCardDTO[];
  concerns: ConcernDTO[];
  searchParams: SearchParams;
  basePath: string;
  scope: { categorySlug?: string; type?: "SINGLE" | "BUNDLE" };
  hide?: FacetKey[];
}) {
  const scoped = catalogue.filter(
    (p) =>
      (!scope.categorySlug || p.category.slug === scope.categorySlug) &&
      (!scope.type || p.type === scope.type),
  );
  const filters = parseFilters(
    searchParams,
    concerns.map((c) => c.slug),
  );
  const { products, total, hasMore, facets } = listProducts(scoped, filters, concerns);
  // Only concerns that occur in this scope are worth offering.
  const relevant = facets.map((f) =>
    f.key === "concern" ? { ...f, options: f.options.filter((o) => o.count > 0 || o.selected) } : f,
  );
  const hidden = Object.fromEntries(
    new URLSearchParams(serializeFilters({ ...filters, sort: "featured", page: 1 }).slice(1)),
  );

  return (
    <div className="grid gap-8 lg:grid-cols-[240px_1fr] lg:gap-12">
      <FilterPanel facets={relevant} filters={filters} basePath={basePath} hide={hide} />
      <div className="flex min-w-0 flex-col gap-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <p role="status" className="text-body-sm text-muted-foreground">
            {total} {total === 1 ? "product" : "products"}
          </p>
          <SortSelect basePath={basePath} sort={filters.sort} hidden={hidden} />
        </div>
        <ActiveFilterChips facets={relevant} filters={filters} basePath={basePath} />

        {products.length ? (
          <ProductGrid products={products} priorityCount={4}>
            {products.length > 8 ? <FinderBanner /> : null}
          </ProductGrid>
        ) : (
          <div className="flex flex-col items-center gap-4 rounded-xl border border-dashed border-border px-6 py-16 text-center">
            <SearchX aria-hidden className="size-8 text-muted-foreground" />
            <h2 className="text-heading-lg font-semibold">No products match these filters</h2>
            <p className="max-w-sm text-body text-muted-foreground">
              Try removing a filter, or let the routine finder choose for you.
            </p>
            <div className="flex flex-wrap justify-center gap-3">
              <Button asChild variant="secondary">
                <Link href={`${basePath}${serializeFilters(clearFilters(filters))}`}>
                  Clear filters
                </Link>
              </Button>
              <Button asChild variant="accent">
                <Link href="/finder">Find my routine</Link>
              </Button>
            </div>
          </div>
        )}

        {hasMore ? (
          <div className="flex justify-center pt-4">
            <Button asChild variant="secondary" size="lg">
              <Link
                href={`${basePath}${serializeFilters({ ...filters, page: filters.page + 1 })}`}
                scroll={false}
              >
                Load more
              </Link>
            </Button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
