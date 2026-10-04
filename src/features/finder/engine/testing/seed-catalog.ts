/**
 * Builds the engine's catalogue from the seed data (prisma/seed/data), with the same shape the
 * production SQL loader returns in M6. Used by unit tests and the offline eval CLI, so the
 * engine is exercised against the real launch catalogue without a database.
 */
import { PRODUCTS } from "../../../../../prisma/seed/data/catalog";
import {
  CONCERNS,
  INGREDIENT_CONCERNS,
  INGREDIENT_CONFLICTS,
  INGREDIENTS,
} from "../../../../../prisma/seed/data/knowledge";
import type { EngineCatalog } from "../index";
import type { Candidate, ConcernSlug, KnowledgeBase } from "../types";

export function buildSeedKnowledgeBase(): KnowledgeBase {
  const evidence = new Map<
    string,
    Map<ConcernSlug, { evidence: number; minEffectiveBp: number | null }>
  >();
  for (const ic of INGREDIENT_CONCERNS) {
    const byConcern = evidence.get(ic.ingredient) ?? new Map();
    byConcern.set(ic.concern, { evidence: ic.evidence, minEffectiveBp: ic.minEffectiveBp ?? null });
    evidence.set(ic.ingredient, byConcern);
  }
  return {
    ingredients: new Map(
      INGREDIENTS.map((i) => [
        i.slug,
        {
          slug: i.slug,
          name: i.commonName,
          category: i.category,
          pregnancySafe: i.pregnancySafe,
          isFragrance: i.isFragrance ?? false,
          isAnimalDerived: i.isAnimalDerived ?? false,
          irritancyLevel: i.irritancyLevel,
          description: i.description,
        },
      ]),
    ),
    conflicts: INGREDIENT_CONFLICTS,
    evidence,
    concernNames: new Map(CONCERNS.map((c) => [c.slug, c.name])),
  };
}

export function buildSeedCandidates(stockOverrides: Record<string, number> = {}): Candidate[] {
  return PRODUCTS.map((p) => {
    const variants = p.variants.map((v) => ({
      id: `var_${v.sku}`,
      sku: v.sku,
      name: v.name,
      priceCents: v.priceCents,
      replenishDays: v.replenishDays,
      available: stockOverrides[v.sku] ?? v.onHand,
    }));
    const defaultVariant =
      variants.find((v, i) => p.variants[i]!.isDefault && v.available > 0) ??
      variants.find((v) => v.available > 0) ??
      variants[0]!;
    return {
      productId: `prd_${p.slug}`,
      slug: p.slug,
      name: p.name,
      slot: p.routineSlot,
      timeOfDay: p.timeOfDay,
      skinTypes: p.skinTypes,
      textures: p.textures,
      pregnancySafe: p.pregnancySafe,
      fragranceFree: p.fragranceFree,
      vegan: p.vegan,
      strengthLevel: p.strengthLevel,
      ratingAvg: 0,
      ratingCount: 0,
      usage: p.howToUse,
      isTinted: p.textures.includes("tinted"),
      ingredients: p.inci.map((e) => e.ingredient),
      keyActives: p.inci
        .filter((e) => e.key)
        .map((e) => ({ slug: e.ingredient, bp: e.bp ?? null })),
      concerns: Object.fromEntries(p.concerns),
      variant: defaultVariant,
      variants,
    };
  });
}

export function buildSeedCatalog(stockOverrides?: Record<string, number>): EngineCatalog {
  return { candidates: buildSeedCandidates(stockOverrides), kb: buildSeedKnowledgeBase() };
}
