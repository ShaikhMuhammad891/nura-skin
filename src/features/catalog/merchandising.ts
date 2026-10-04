import type { ConflictDTO, ProductCardDTO, SlotKey } from "./types";

/** Routine order (docs/12 §3): cleanse → treat → moisturize → protect. */
export const SLOT_ORDER: readonly SlotKey[] = ["CLEANSE", "TREAT", "MOISTURIZE", "PROTECT"];
export const SLOT_LABELS: Record<SlotKey, string> = {
  CLEANSE: "Cleanse",
  TREAT: "Treat",
  MOISTURIZE: "Moisturize",
  PROTECT: "Protect",
};

/** Seeded badge keys ("derm-favorite") → display labels ("Derm favorite"). */
export function formatBadge(badge: string): string {
  const words = badge.replace(/[-_]+/g, " ").trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/** Basis points → human percentage: 1000 → "10%", 25 → "0.25%". */
export function formatConcentration(bp: number): string {
  const pct = bp / 100;
  return `${Number.isInteger(pct) ? pct : Number(pct.toFixed(2))}%`;
}

function sharedConcerns(a: ProductCardDTO, b: ProductCardDTO): number {
  const mine = new Set(a.concerns.map((c) => c.slug));
  return b.concerns.reduce((n, c) => n + (mine.has(c.slug) ? c.efficacy : 0), 0);
}

function sharedSkinTypes(a: ProductCardDTO, b: ProductCardDTO): number {
  return b.skinTypes.filter((s) => a.skinTypes.includes(s)).length;
}

/**
 * "Complete the routine" (docs/16 CompleteTheRoutine): one product per missing slot, best match on
 * concerns then skin types, excluding anything whose actives clash with this product (any
 * severity except `caution`, which only asks for a gentle introduction).
 */
export function completeTheRoutine(
  product: ProductCardDTO,
  conflicts: readonly ConflictDTO[],
  catalogue: readonly ProductCardDTO[],
): ProductCardDTO[] {
  const clashing = new Set(
    conflicts.filter((c) => c.severity !== "caution").map((c) => c.other.slug),
  );
  const candidates = catalogue.filter(
    (p) =>
      p.type === "SINGLE" &&
      p.id !== product.id &&
      p.routineSlot !== null &&
      p.routineSlot !== product.routineSlot &&
      !p.keyActiveSlugs.some((slug) => clashing.has(slug)),
  );
  return SLOT_ORDER.flatMap((slot) => {
    const best = candidates
      .filter((p) => p.routineSlot === slot)
      .sort(
        (a, b) =>
          sharedConcerns(product, b) - sharedConcerns(product, a) ||
          sharedSkinTypes(product, b) - sharedSkinTypes(product, a) ||
          b.ratingAvg - a.ratingAvg ||
          a.name.localeCompare(b.name),
      )[0];
    return best ? [best] : [];
  });
}

/** Bestsellers for the home page: singles by 30-day units, featured as the tiebreaker. */
export function bestsellers(catalogue: readonly ProductCardDTO[], take = 4): ProductCardDTO[] {
  return catalogue
    .filter((p) => p.type === "SINGLE")
    .sort(
      (a, b) =>
        b.unitsSold30d - a.unitsSold30d ||
        Number(b.isFeatured) - Number(a.isFeatured) ||
        a.name.localeCompare(b.name),
    )
    .slice(0, take);
}

export function featuredRoutines(catalogue: readonly ProductCardDTO[], take = 3): ProductCardDTO[] {
  return catalogue
    .filter((p) => p.type === "BUNDLE")
    .sort(
      (a, b) =>
        Number(b.isFeatured) - Number(a.isFeatured) ||
        (a.featuredPosition ?? 999) - (b.featuredPosition ?? 999) ||
        a.name.localeCompare(b.name),
    )
    .slice(0, take);
}
