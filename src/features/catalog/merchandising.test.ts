import {
  bestsellers,
  completeTheRoutine,
  featuredRoutines,
  formatBadge,
  formatConcentration,
} from "./merchandising";
import type { ConflictDTO, ProductCardDTO } from "./types";

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
    priceFromCents: 3000,
    compareAtCents: null,
    variantCount: 1,
    defaultVariantId: null,
    keyActives: [],
    keyActiveSlugs: [],
    image: null,
    ...over,
  };
}

const conflict = (other: string, severity: ConflictDTO["severity"]): ConflictDTO => ({
  severity,
  reason: "",
  ingredient: { slug: "retinal", commonName: "Retinal" },
  other: { slug: other, commonName: other },
});

describe("formatConcentration", () => {
  it("formats basis points as percentages", () => {
    expect(formatConcentration(1000)).toBe("10%");
    expect(formatConcentration(25)).toBe("0.25%");
    expect(formatConcentration(150)).toBe("1.5%");
  });
});

describe("completeTheRoutine", () => {
  const retinol = product({
    slug: "renew",
    routineSlot: "TREAT",
    concerns: [{ slug: "fine-lines", name: "Fine lines", efficacy: 3 }],
  });
  const catalogue = [
    retinol,
    product({
      slug: "bha-cleanser",
      routineSlot: "CLEANSE",
      keyActiveSlugs: ["salicylic-acid"],
      concerns: [{ slug: "fine-lines", name: "", efficacy: 3 }],
    }),
    product({ slug: "milk-cleanser", routineSlot: "CLEANSE" }),
    product({
      slug: "cream",
      routineSlot: "MOISTURIZE",
      concerns: [{ slug: "fine-lines", name: "", efficacy: 2 }],
    }),
    product({ slug: "plain-cream", routineSlot: "MOISTURIZE" }),
    product({ slug: "other-serum", routineSlot: "TREAT" }),
    product({ slug: "a-routine", type: "BUNDLE", routineSlot: null }),
  ];

  it("fills each other slot once, in routine order, skipping clashes", () => {
    const picks = completeTheRoutine(
      retinol,
      [conflict("salicylic-acid", "avoid_same_routine")],
      catalogue,
    );
    expect(picks.map((p) => p.slug)).toEqual(["milk-cleanser", "cream"]);
  });

  it("keeps products that only need caution", () => {
    const picks = completeTheRoutine(retinol, [conflict("salicylic-acid", "caution")], catalogue);
    expect(picks[0]?.slug).toBe("bha-cleanser");
  });
});

describe("home merchandising", () => {
  it("ranks bestsellers and featured routines", () => {
    const items = [
      product({ slug: "a", unitsSold30d: 5 }),
      product({ slug: "b", unitsSold30d: 50 }),
      product({ slug: "r2", type: "BUNDLE", isFeatured: true, featuredPosition: 2 }),
      product({ slug: "r1", type: "BUNDLE", isFeatured: true, featuredPosition: 1 }),
      product({ slug: "r3", type: "BUNDLE" }),
    ];
    expect(bestsellers(items, 2).map((p) => p.slug)).toEqual(["b", "a"]);
    expect(featuredRoutines(items).map((p) => p.slug)).toEqual(["r1", "r2", "r3"]);
  });
});

describe("formatBadge", () => {
  it("turns keys into labels", () => {
    expect(formatBadge("derm-favorite")).toBe("Derm favorite");
    expect(formatBadge("bestseller")).toBe("Bestseller");
  });
});
