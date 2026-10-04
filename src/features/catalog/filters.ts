import type { ProductCardDTO, SkinTypeKey } from "./types";

/**
 * PLP filters (docs/15 P2, docs/16 FilterSidebar). The URL is the state: filters parse from search
 * params, every facet option is a plain link, and unknown values are dropped (never trusted).
 * The launch catalogue is small, so filtering, faceting and sorting run in memory over the cached
 * catalogue (same trade-off as the finder loader, NFR-SCALE-06).
 */
export const SORTS = [
  "featured",
  "bestselling",
  "rating",
  "price-asc",
  "price-desc",
  "newest",
] as const;
export type Sort = (typeof SORTS)[number];

export const SORT_LABELS: Record<Sort, string> = {
  featured: "Featured",
  bestselling: "Bestselling",
  rating: "Top rated",
  "price-asc": "Price: low to high",
  "price-desc": "Price: high to low",
  newest: "Newest",
};

export const SKIN_TYPES = [
  "DRY",
  "OILY",
  "COMBINATION",
  "NORMAL",
] as const satisfies readonly SkinTypeKey[];
export const SKIN_TYPE_LABELS: Record<SkinTypeKey, string> = {
  DRY: "Dry",
  OILY: "Oily",
  COMBINATION: "Combination",
  NORMAL: "Normal",
};

export const PREFS = ["fragrance-free", "pregnancy-safe", "vegan", "non-comedogenic"] as const;
export type Pref = (typeof PREFS)[number];
export const PREF_LABELS: Record<Pref, string> = {
  "fragrance-free": "Fragrance-free",
  "pregnancy-safe": "Pregnancy-safe",
  vegan: "Vegan",
  "non-comedogenic": "Non-comedogenic",
};

export const TIMES = ["am", "pm"] as const;
export type Time = (typeof TIMES)[number];
export const TIME_LABELS: Record<Time, string> = { am: "Morning", pm: "Evening" };

export const PRICE_BANDS = ["under-30", "30-50", "over-50"] as const;
export type PriceBand = (typeof PRICE_BANDS)[number];
export const PRICE_BAND_LABELS: Record<PriceBand, string> = {
  "under-30": "Under $30",
  "30-50": "$30 – $50",
  "over-50": "Over $50",
};

export const PAGE_SIZE = 12;
const MAX_PAGE = 50;

export type ProductFilters = {
  concerns: string[];
  skin: SkinTypeKey[];
  prefs: Pref[];
  time: Time | null;
  price: PriceBand | null;
  sort: Sort;
  page: number;
};

export type FacetKey = "concern" | "skin" | "pref" | "time" | "price";

type RawParams = Record<string, string | string[] | undefined>;

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/** Comma-separated list, deduplicated, restricted to `allowed`, in canonical order. */
function list<T extends string>(value: string | string[] | undefined, allowed: readonly T[]): T[] {
  const raw = (Array.isArray(value) ? value.join(",") : (value ?? "")).toLowerCase().split(",");
  return allowed.filter((a) => raw.includes(a.toLowerCase()));
}

export function parseFilters(params: RawParams, knownConcerns: readonly string[]): ProductFilters {
  const sort = first(params.sort);
  const time = first(params.time);
  const price = first(params.price);
  const page = Number.parseInt(first(params.page) ?? "1", 10);
  return {
    concerns: list(params.concern, knownConcerns),
    skin: list(params.skin, SKIN_TYPES),
    prefs: list(params.pref, PREFS),
    time: (TIMES as readonly string[]).includes(time ?? "") ? (time as Time) : null,
    price: (PRICE_BANDS as readonly string[]).includes(price ?? "") ? (price as PriceBand) : null,
    sort: (SORTS as readonly string[]).includes(sort ?? "") ? (sort as Sort) : "featured",
    page: Number.isFinite(page) ? Math.min(Math.max(page, 1), MAX_PAGE) : 1,
  };
}

/** Canonical query string (stable order, defaults omitted) so URLs are shareable and cacheable. */
export function serializeFilters(filters: ProductFilters): string {
  const params = new URLSearchParams();
  if (filters.concerns.length) params.set("concern", filters.concerns.join(","));
  if (filters.skin.length) params.set("skin", filters.skin.join(",").toLowerCase());
  if (filters.prefs.length) params.set("pref", filters.prefs.join(","));
  if (filters.time) params.set("time", filters.time);
  if (filters.price) params.set("price", filters.price);
  if (filters.sort !== "featured") params.set("sort", filters.sort);
  if (filters.page > 1) params.set("page", String(filters.page));
  const query = params.toString().replaceAll("%2C", ",");
  return query ? `?${query}` : "";
}

export function hasActiveFilters(f: ProductFilters): boolean {
  return Boolean(f.concerns.length || f.skin.length || f.prefs.length || f.time || f.price);
}

function toggle<T>(values: readonly T[], value: T): T[] {
  return values.includes(value) ? values.filter((v) => v !== value) : [...values, value];
}

/** The filters after toggling one facet value; any filter change resets pagination. */
export function toggleFilter(f: ProductFilters, facet: FacetKey, value: string): ProductFilters {
  const next = { ...f, page: 1 };
  switch (facet) {
    case "concern":
      return { ...next, concerns: toggle(f.concerns, value) };
    case "skin":
      return { ...next, skin: toggle(f.skin, value as SkinTypeKey) };
    case "pref":
      return { ...next, prefs: toggle(f.prefs, value as Pref) };
    case "time":
      return { ...next, time: f.time === value ? null : (value as Time) };
    case "price":
      return { ...next, price: f.price === value ? null : (value as PriceBand) };
  }
}

export function clearFilters(f: ProductFilters): ProductFilters {
  return { concerns: [], skin: [], prefs: [], time: null, price: null, sort: f.sort, page: 1 };
}

export function isSelected(f: ProductFilters, facet: FacetKey, value: string): boolean {
  switch (facet) {
    case "concern":
      return f.concerns.includes(value);
    case "skin":
      return f.skin.includes(value as SkinTypeKey);
    case "pref":
      return f.prefs.includes(value as Pref);
    case "time":
      return f.time === value;
    case "price":
      return f.price === value;
  }
}

function inBand(cents: number, band: PriceBand): boolean {
  if (band === "under-30") return cents < 3000;
  if (band === "30-50") return cents >= 3000 && cents <= 5000;
  return cents > 5000;
}

const PREF_FIELD: Record<Pref, keyof ProductCardDTO> = {
  "fragrance-free": "fragranceFree",
  "pregnancy-safe": "pregnancySafe",
  vegan: "vegan",
  "non-comedogenic": "nonComedogenic",
};

/**
 * Within a facet, values are OR-ed (any selected concern); preferences are AND-ed because each one
 * is a requirement ("fragrance-free and vegan"). Facets combine with AND. `except` skips one facet,
 * which is how facet counts stay useful (disjunctive faceting).
 */
export function matches(p: ProductCardDTO, f: ProductFilters, except?: FacetKey): boolean {
  if (
    except !== "concern" &&
    f.concerns.length &&
    !p.concerns.some((c) => f.concerns.includes(c.slug))
  )
    return false;
  if (except !== "skin" && f.skin.length && !p.skinTypes.some((s) => f.skin.includes(s)))
    return false;
  if (except !== "pref" && !f.prefs.every((pref) => p[PREF_FIELD[pref]] === true)) return false;
  if (except !== "time" && f.time) {
    const want = f.time === "am" ? "AM" : "PM";
    if (p.timeOfDay !== "BOTH" && p.timeOfDay !== want) return false;
  }
  if (except !== "price" && f.price && !inBand(p.priceFromCents, f.price)) return false;
  return true;
}

export function sortProducts(products: readonly ProductCardDTO[], sort: Sort): ProductCardDTO[] {
  const byName = (a: ProductCardDTO, b: ProductCardDTO) => a.name.localeCompare(b.name);
  const sorted = [...products];
  switch (sort) {
    case "featured":
      return sorted.sort(
        (a, b) =>
          Number(b.isFeatured) - Number(a.isFeatured) ||
          (a.featuredPosition ?? 999) - (b.featuredPosition ?? 999) ||
          b.unitsSold30d - a.unitsSold30d ||
          byName(a, b),
      );
    case "bestselling":
      return sorted.sort((a, b) => b.unitsSold30d - a.unitsSold30d || byName(a, b));
    case "rating":
      return sorted.sort(
        (a, b) => b.ratingAvg - a.ratingAvg || b.ratingCount - a.ratingCount || byName(a, b),
      );
    case "price-asc":
      return sorted.sort((a, b) => a.priceFromCents - b.priceFromCents || byName(a, b));
    case "price-desc":
      return sorted.sort((a, b) => b.priceFromCents - a.priceFromCents || byName(a, b));
    case "newest":
      return sorted.sort(
        (a, b) => (b.publishedAt ?? "").localeCompare(a.publishedAt ?? "") || byName(a, b),
      );
  }
}

export type FacetOption = { value: string; label: string; count: number; selected: boolean };
export type Facet = { key: FacetKey; label: string; options: FacetOption[] };

export function computeFacets(
  products: readonly ProductCardDTO[],
  f: ProductFilters,
  concerns: readonly { slug: string; name: string }[],
): Facet[] {
  const count = (facet: FacetKey, test: (p: ProductCardDTO) => boolean) =>
    products.filter((p) => matches(p, f, facet) && test(p)).length;

  const facet = (
    key: FacetKey,
    label: string,
    options: { value: string; label: string; test: (p: ProductCardDTO) => boolean }[],
  ): Facet => ({
    key,
    label,
    options: options.map((o) => ({
      value: o.value,
      label: o.label,
      count: count(key, o.test),
      selected: isSelected(f, key, o.value),
    })),
  });

  return [
    facet(
      "concern",
      "Concern",
      concerns.map((c) => ({
        value: c.slug,
        label: c.name,
        test: (p) => p.concerns.some((pc) => pc.slug === c.slug),
      })),
    ),
    facet(
      "skin",
      "Skin type",
      SKIN_TYPES.map((s) => ({
        value: s,
        label: SKIN_TYPE_LABELS[s],
        test: (p) => p.skinTypes.includes(s),
      })),
    ),
    facet(
      "pref",
      "Preferences",
      PREFS.map((pref) => ({
        value: pref,
        label: PREF_LABELS[pref],
        test: (p) => p[PREF_FIELD[pref]] === true,
      })),
    ),
    facet(
      "time",
      "Time of day",
      TIMES.map((t) => ({
        value: t,
        label: TIME_LABELS[t],
        test: (p) => p.timeOfDay === "BOTH" || p.timeOfDay === (t === "am" ? "AM" : "PM"),
      })),
    ),
    facet(
      "price",
      "Price",
      PRICE_BANDS.map((b) => ({
        value: b,
        label: PRICE_BAND_LABELS[b],
        test: (p) => inBand(p.priceFromCents, b),
      })),
    ),
  ];
}

export type ProductListing = {
  products: ProductCardDTO[];
  total: number;
  hasMore: boolean;
  facets: Facet[];
};

/** Filter → facet → sort → paginate ("Load more" shows pages 1..n cumulatively). */
export function listProducts(
  catalogue: readonly ProductCardDTO[],
  f: ProductFilters,
  concerns: readonly { slug: string; name: string }[],
): ProductListing {
  const filtered = sortProducts(
    catalogue.filter((p) => matches(p, f)),
    f.sort,
  );
  const visible = filtered.slice(0, f.page * PAGE_SIZE);
  return {
    products: visible,
    total: filtered.length,
    hasMore: visible.length < filtered.length,
    facets: computeFacets(catalogue, f, concerns),
  };
}
