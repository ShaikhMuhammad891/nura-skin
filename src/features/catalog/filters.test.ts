import {
  clearFilters,
  computeFacets,
  listProducts,
  PAGE_SIZE,
  parseFilters,
  serializeFilters,
  sortProducts,
  toggleFilter,
  type ProductFilters,
} from "./filters";
import type { ProductCardDTO } from "./types";

const CONCERNS = [
  { slug: "acne", name: "Breakouts" },
  { slug: "dryness", name: "Dryness" },
];

function product(over: Partial<ProductCardDTO> & { slug: string }): ProductCardDTO {
  return {
    id: over.slug,
    name: over.slug,
    subtitle: null,
    shortDescription: "",
    type: "SINGLE",
    category: { slug: "serums", name: "Serums" },
    routineSlot: "TREAT",
    timeOfDay: "BOTH",
    skinTypes: ["NORMAL"],
    concerns: [],
    fragranceFree: false,
    pregnancySafe: false,
    vegan: false,
    nonComedogenic: false,
    badges: [],
    ratingAvg: 0,
    ratingCount: 0,
    unitsSold30d: 0,
    isFeatured: false,
    featuredPosition: null,
    publishedAt: null,
    priceFromCents: 4000,
    compareAtCents: null,
    variantCount: 1,
    defaultVariantId: null,
    keyActives: [],
    keyActiveSlugs: [],
    image: null,
    ...over,
  };
}

const base = (over: Partial<ProductFilters> = {}): ProductFilters => ({
  concerns: [],
  skin: [],
  prefs: [],
  time: null,
  price: null,
  sort: "featured",
  page: 1,
  ...over,
});

describe("parseFilters / serializeFilters", () => {
  it("keeps only known values, in canonical order", () => {
    const f = parseFilters(
      {
        concern: "dryness,acne,hacked",
        skin: ["oily", "DRY"],
        pref: "vegan,fragrance-free,<script>",
        time: "noon",
        price: "30-50",
        sort: "price-desc",
        page: "3",
      },
      CONCERNS.map((c) => c.slug),
    );
    expect(f).toEqual({
      concerns: ["acne", "dryness"],
      skin: ["DRY", "OILY"],
      prefs: ["fragrance-free", "vegan"],
      time: null,
      price: "30-50",
      sort: "price-desc",
      page: 3,
    });
    expect(serializeFilters(f)).toBe(
      "?concern=acne,dryness&skin=dry,oily&pref=fragrance-free,vegan&price=30-50&sort=price-desc&page=3",
    );
  });

  it("falls back to defaults and clamps the page", () => {
    expect(parseFilters({ page: "-4", sort: "random" }, [])).toEqual(base());
    expect(parseFilters({ page: "9999" }, []).page).toBe(50);
    expect(parseFilters({ page: "abc" }, []).page).toBe(1);
    expect(serializeFilters(base())).toBe("");
  });

  it("round-trips", () => {
    const f = base({ concerns: ["acne"], time: "pm", sort: "newest" });
    const qs = new URLSearchParams(serializeFilters(f).slice(1));
    expect(parseFilters(Object.fromEntries(qs), ["acne"])).toEqual(f);
  });
});

describe("toggleFilter", () => {
  it("toggles values and resets pagination", () => {
    const f = base({ page: 4 });
    const on = toggleFilter(f, "concern", "acne");
    expect(on).toMatchObject({ concerns: ["acne"], page: 1 });
    expect(toggleFilter(on, "concern", "acne").concerns).toEqual([]);
    expect(toggleFilter(f, "time", "am").time).toBe("am");
    expect(toggleFilter(base({ time: "am" }), "time", "am").time).toBeNull();
  });

  it("clears filters but keeps the sort", () => {
    expect(clearFilters(base({ skin: ["DRY"], sort: "rating", page: 2 }))).toEqual(
      base({ sort: "rating" }),
    );
  });
});

describe("listProducts", () => {
  const catalogue = [
    product({
      slug: "a",
      concerns: [{ slug: "acne", name: "Breakouts", efficacy: 3 }],
      skinTypes: ["OILY"],
      vegan: true,
      fragranceFree: true,
      timeOfDay: "PM",
      priceFromCents: 2500,
    }),
    product({
      slug: "b",
      concerns: [{ slug: "dryness", name: "Dryness", efficacy: 2 }],
      skinTypes: ["DRY"],
      vegan: true,
      priceFromCents: 4500,
      timeOfDay: "AM",
    }),
    product({
      slug: "c",
      concerns: [{ slug: "acne", name: "Breakouts", efficacy: 1 }],
      priceFromCents: 6000,
    }),
  ];

  it("ORs within a facet and ANDs preferences", () => {
    const slugs = (f: ProductFilters) =>
      listProducts(catalogue, f, CONCERNS).products.map((p) => p.slug);
    expect(slugs(base({ concerns: ["acne", "dryness"] })).sort()).toEqual(["a", "b", "c"]);
    expect(slugs(base({ prefs: ["vegan"] })).sort()).toEqual(["a", "b"]);
    expect(slugs(base({ prefs: ["vegan", "fragrance-free"] }))).toEqual(["a"]);
    expect(slugs(base({ time: "am" })).sort()).toEqual(["b", "c"]);
    expect(slugs(base({ price: "over-50" }))).toEqual(["c"]);
  });

  it("computes disjunctive facet counts", () => {
    const facets = computeFacets(catalogue, base({ concerns: ["acne"] }), CONCERNS);
    const concern = facets.find((f) => f.key === "concern")!;
    // Counts for the concern facet ignore the concern selection itself.
    expect(concern.options).toEqual([
      { value: "acne", label: "Breakouts", count: 2, selected: true },
      { value: "dryness", label: "Dryness", count: 1, selected: false },
    ]);
    // Other facets respect it: only a and c remain, and only a is vegan.
    expect(
      facets.find((f) => f.key === "pref")!.options.find((o) => o.value === "vegan")!.count,
    ).toBe(1);
  });

  it("paginates cumulatively", () => {
    const many = Array.from({ length: PAGE_SIZE * 2 + 1 }, (_, i) => product({ slug: `p${i}` }));
    const page1 = listProducts(many, base(), []);
    expect(page1).toMatchObject({ total: 25, hasMore: true });
    expect(page1.products).toHaveLength(PAGE_SIZE);
    const page3 = listProducts(many, base({ page: 3 }), []);
    expect(page3.products).toHaveLength(25);
    expect(page3.hasMore).toBe(false);
  });
});

describe("sortProducts", () => {
  const items = [
    product({
      slug: "cheap",
      priceFromCents: 1000,
      unitsSold30d: 5,
      publishedAt: "2026-01-01T00:00:00Z",
    }),
    product({
      slug: "star",
      priceFromCents: 3000,
      ratingAvg: 4.9,
      ratingCount: 10,
      isFeatured: true,
      featuredPosition: 1,
    }),
    product({
      slug: "pricey",
      priceFromCents: 9000,
      unitsSold30d: 50,
      publishedAt: "2026-06-01T00:00:00Z",
    }),
  ];
  const order = (s: Parameters<typeof sortProducts>[1]) =>
    sortProducts(items, s).map((p) => p.slug);

  it("orders by each sort", () => {
    expect(order("featured")[0]).toBe("star");
    expect(order("bestselling")).toEqual(["pricey", "cheap", "star"]);
    expect(order("rating")[0]).toBe("star");
    expect(order("price-asc")).toEqual(["cheap", "star", "pricey"]);
    expect(order("price-desc")).toEqual(["pricey", "star", "cheap"]);
    expect(order("newest")).toEqual(["pricey", "cheap", "star"]);
  });
});
