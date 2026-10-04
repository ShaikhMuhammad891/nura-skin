import { Check, SlidersHorizontal, X } from "lucide-react";
import Link from "next/link";

import { cn } from "@/lib/utils";

import {
  clearFilters,
  hasActiveFilters,
  serializeFilters,
  toggleFilter,
  type Facet,
  type ProductFilters,
} from "../filters";

/**
 * URL-driven facets (docs/16 FilterSidebar/FilterSheet, ActiveFilterChips). Every option is a real
 * link, so filtering works without JavaScript and each state is shareable. Facet links are
 * `nofollow`: crawlers index the category pages, not every filter combination.
 */
function FacetGroup({
  facet,
  filters,
  basePath,
}: {
  facet: Facet;
  filters: ProductFilters;
  basePath: string;
}) {
  const multi = facet.key === "concern" || facet.key === "skin" || facet.key === "pref";
  return (
    <fieldset className="flex flex-col gap-1 border-t border-border pt-4">
      <legend className="mb-2 text-heading-sm font-semibold">{facet.label}</legend>
      <ul className="flex flex-col">
        {facet.options.map((option) => {
          const disabled = option.count === 0 && !option.selected;
          const content = (
            <>
              <span
                aria-hidden
                className={cn(
                  "inline-flex size-5 shrink-0 items-center justify-center border border-border-strong",
                  multi ? "rounded-xs" : "rounded-full",
                  option.selected && "border-primary bg-primary text-primary-foreground",
                )}
              >
                {option.selected ? <Check className="size-3.5" /> : null}
              </span>
              <span className="flex-1">{option.label}</span>
              <span className="tabular text-caption text-muted-foreground">
                {option.count}
                <span className="sr-only"> products</span>
              </span>
              {option.selected ? <span className="sr-only">(selected)</span> : null}
            </>
          );
          return (
            <li key={option.value}>
              {disabled ? (
                <span className="flex min-h-11 items-center gap-3 px-1 text-body-sm text-subtle-foreground opacity-60">
                  {content}
                </span>
              ) : (
                <Link
                  href={`${basePath}${serializeFilters(toggleFilter(filters, facet.key, option.value))}`}
                  rel="nofollow"
                  scroll={false}
                  className="flex min-h-11 items-center gap-3 rounded-sm px-1 text-body-sm hover:bg-surface-alt"
                >
                  {content}
                </Link>
              )}
            </li>
          );
        })}
      </ul>
    </fieldset>
  );
}

export function FilterPanel({
  facets,
  filters,
  basePath,
  hide = [],
}: {
  facets: Facet[];
  filters: ProductFilters;
  basePath: string;
  hide?: Facet["key"][];
}) {
  const shown = facets.filter((f) => !hide.includes(f.key));
  const activeCount =
    filters.concerns.length +
    filters.skin.length +
    filters.prefs.length +
    Number(Boolean(filters.time)) +
    Number(Boolean(filters.price));
  const groups = shown.map((facet) => (
    <FacetGroup key={facet.key} facet={facet} filters={filters} basePath={basePath} />
  ));

  return (
    <>
      {/* Mobile: a native disclosure, so it works without JavaScript. */}
      <details className="group rounded-lg border border-border lg:hidden">
        <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 px-4 text-body-sm font-medium [&::-webkit-details-marker]:hidden">
          <SlidersHorizontal aria-hidden className="size-4" />
          Filters{activeCount ? ` (${activeCount})` : ""}
        </summary>
        <div className="flex flex-col gap-4 px-4 pb-4">{groups}</div>
      </details>
      <aside aria-label="Filters" className="hidden flex-col gap-4 lg:flex">
        {groups}
      </aside>
    </>
  );
}

export function ActiveFilterChips({
  facets,
  filters,
  basePath,
}: {
  facets: Facet[];
  filters: ProductFilters;
  basePath: string;
}) {
  if (!hasActiveFilters(filters)) return null;
  const selected = facets.flatMap((facet) =>
    facet.options.filter((o) => o.selected).map((o) => ({ facet: facet.key, ...o })),
  );
  return (
    <div className="flex flex-wrap items-center gap-2">
      {selected.map((chip) => (
        <Link
          key={`${chip.facet}:${chip.value}`}
          href={`${basePath}${serializeFilters(toggleFilter(filters, chip.facet, chip.value))}`}
          rel="nofollow"
          scroll={false}
          className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-border-strong px-3 text-body-sm hover:bg-surface-alt"
        >
          {chip.label}
          <X aria-hidden className="size-3.5" />
          <span className="sr-only">(remove filter)</span>
        </Link>
      ))}
      <Link
        href={`${basePath}${serializeFilters(clearFilters(filters))}`}
        rel="nofollow"
        scroll={false}
        className="min-h-9 px-2 text-body-sm text-link underline-offset-4 hover:underline"
      >
        Clear all
      </Link>
    </div>
  );
}
