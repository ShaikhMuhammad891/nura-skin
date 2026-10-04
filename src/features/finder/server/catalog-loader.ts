import "server-only";

import type { DbClient } from "@/lib/server/db-types";

import type { EngineCatalog } from "../engine";
import type {
  Candidate,
  CandidateVariant,
  ConcernSlug,
  KnowledgeBase,
  SkinType,
  Slot,
  TimeOfDay,
} from "../engine/types";

/**
 * Loads the routine engine's catalogue from the database (docs/12 §4.3, §5): published single
 * products with live availability, plus the ingredient knowledge base. Produces exactly the
 * shape the engine's tests use (`testing/seed-catalog.ts`); an integration test proves they match.
 * The whole catalogue is small (≈ 15–60 products), so hard filters run in memory with the
 * tested TypeScript predicates, and SQL pre-filtering is a later optimisation (NFR-SCALE-06).
 */
export async function loadEngineCatalog(db: DbClient): Promise<EngineCatalog> {
  const [products, ingredients, conflicts, evidence, concerns] = await Promise.all([
    db.product.findMany({
      where: { status: "PUBLISHED", type: "SINGLE", archivedAt: null, routineSlot: { not: null } },
      select: {
        id: true,
        slug: true,
        name: true,
        routineSlot: true,
        timeOfDay: true,
        skinTypes: true,
        textures: true,
        pregnancySafe: true,
        fragranceFree: true,
        vegan: true,
        strengthLevel: true,
        ratingAvg: true,
        ratingCount: true,
        howToUse: true,
        variants: {
          where: { archivedAt: null },
          orderBy: { position: "asc" },
          select: {
            id: true,
            sku: true,
            name: true,
            priceCents: true,
            replenishDays: true,
            isDefault: true,
            inventory: { select: { onHand: true, reserved: true } },
          },
        },
        ingredients: {
          orderBy: { position: "asc" },
          select: {
            isKeyActive: true,
            concentrationBp: true,
            ingredient: { select: { slug: true } },
          },
        },
        concerns: { select: { efficacy: true, concern: { select: { slug: true } } } },
      },
    }),
    db.ingredient.findMany({
      where: { archivedAt: null },
      select: {
        slug: true,
        commonName: true,
        category: true,
        pregnancySafe: true,
        isFragrance: true,
        isAnimalDerived: true,
        irritancyLevel: true,
        description: true,
      },
    }),
    db.ingredientConflict.findMany({
      select: {
        severity: true,
        reason: true,
        ingredientA: { select: { slug: true } },
        ingredientB: { select: { slug: true } },
      },
    }),
    db.ingredientConcern.findMany({
      select: {
        evidence: true,
        minEffectiveBp: true,
        ingredient: { select: { slug: true } },
        concern: { select: { slug: true } },
      },
    }),
    db.concern.findMany({ select: { slug: true, name: true } }),
  ]);

  const evidenceMap = new Map<
    string,
    Map<ConcernSlug, { evidence: number; minEffectiveBp: number | null }>
  >();
  for (const e of evidence) {
    const byConcern = evidenceMap.get(e.ingredient.slug) ?? new Map();
    byConcern.set(e.concern.slug as ConcernSlug, {
      evidence: e.evidence,
      minEffectiveBp: e.minEffectiveBp,
    });
    evidenceMap.set(e.ingredient.slug, byConcern);
  }

  const kb: KnowledgeBase = {
    ingredients: new Map(
      ingredients.map((i) => [
        i.slug,
        {
          slug: i.slug,
          name: i.commonName,
          category: i.category,
          pregnancySafe: i.pregnancySafe,
          isFragrance: i.isFragrance,
          isAnimalDerived: i.isAnimalDerived,
          irritancyLevel: i.irritancyLevel,
          description: i.description ?? "",
        },
      ]),
    ),
    conflicts: conflicts.map((c) => ({
      a: c.ingredientA.slug,
      b: c.ingredientB.slug,
      severity: c.severity as "avoid_same_routine" | "avoid_same_day" | "caution",
      reason: c.reason,
    })),
    evidence: evidenceMap,
    concernNames: new Map(concerns.map((c) => [c.slug as ConcernSlug, c.name])),
  };

  const candidates: Candidate[] = products
    .filter((p) => p.variants.length > 0)
    .map((p) => {
      const variants: CandidateVariant[] = p.variants.map((v) => ({
        id: v.id,
        sku: v.sku,
        name: v.name,
        priceCents: v.priceCents,
        replenishDays: v.replenishDays,
        available: v.inventory ? Math.max(0, v.inventory.onHand - v.inventory.reserved) : 0,
      }));
      const defaultVariant =
        variants.find((v, i) => p.variants[i]!.isDefault && v.available > 0) ??
        variants.find((v) => v.available > 0) ??
        variants[0]!;
      return {
        productId: p.id,
        slug: p.slug,
        name: p.name,
        slot: p.routineSlot as Slot,
        timeOfDay: p.timeOfDay as TimeOfDay,
        skinTypes: p.skinTypes as SkinType[],
        textures: p.textures,
        pregnancySafe: p.pregnancySafe,
        fragranceFree: p.fragranceFree,
        vegan: p.vegan,
        strengthLevel: p.strengthLevel,
        ratingAvg: Number(p.ratingAvg),
        ratingCount: p.ratingCount,
        usage: p.howToUse,
        isTinted: p.textures.includes("tinted"),
        ingredients: p.ingredients.map((i) => i.ingredient.slug),
        keyActives: p.ingredients
          .filter((i) => i.isKeyActive)
          .map((i) => ({ slug: i.ingredient.slug, bp: i.concentrationBp })),
        concerns: Object.fromEntries(p.concerns.map((c) => [c.concern.slug, c.efficacy])),
        variant: defaultVariant,
        variants,
      };
    });

  return { candidates, kb };
}
