"use client";

import { SORT_LABELS, SORTS, type Sort } from "../filters";

/**
 * Sort (docs/16 SortSelect): a GET form that carries the current filters as hidden fields.
 * With JavaScript the select submits on change; without it, the Apply button does.
 */
export function SortSelect({
  basePath,
  sort,
  hidden,
}: {
  basePath: string;
  sort: Sort;
  /** Current filter params (excluding sort and page). */
  hidden: Record<string, string>;
}) {
  return (
    <form action={basePath} method="get" className="flex items-center gap-2">
      {Object.entries(hidden).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      <label htmlFor="sort" className="text-body-sm text-muted-foreground">
        Sort by
      </label>
      <select
        id="sort"
        name="sort"
        defaultValue={sort}
        onChange={(e) => e.currentTarget.form?.requestSubmit()}
        className="h-11 rounded-sm border border-border-strong bg-surface px-3 text-body-sm"
      >
        {SORTS.map((s) => (
          <option key={s} value={s}>
            {SORT_LABELS[s]}
          </option>
        ))}
      </select>
      <noscript>
        <button
          type="submit"
          className="h-11 rounded-sm border border-border-strong px-3 text-body-sm"
        >
          Apply
        </button>
      </noscript>
    </form>
  );
}
