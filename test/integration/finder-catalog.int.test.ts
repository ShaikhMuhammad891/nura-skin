/**
 * The finder's DB loader must produce the same catalogue the engine was tested against, so
 * every engine guarantee (pregnancy safety, conflicts, budget…) carries over to production data.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { recommendDeterministic, type EngineCatalog } from "../../src/features/finder/engine";
import { buildSeedCatalog } from "../../src/features/finder/engine/testing/seed-catalog";
import type { Answers } from "../../src/features/finder/questionnaire";
import { loadEngineCatalog } from "../../src/features/finder/server/catalog-loader";
import type { PrismaClient } from "../../src/generated/prisma/client";

import { createTestPrisma } from "./helpers";

let prisma: PrismaClient;

beforeAll(() => {
  prisma = createTestPrisma();
});
afterAll(async () => {
  await prisma.$disconnect();
});

const comparable = (c: Awaited<ReturnType<typeof loadEngineCatalog>>["candidates"][number]) => ({
  slug: c.slug,
  slot: c.slot,
  timeOfDay: c.timeOfDay,
  skinTypes: [...c.skinTypes].sort(),
  textures: [...c.textures],
  pregnancySafe: c.pregnancySafe,
  fragranceFree: c.fragranceFree,
  vegan: c.vegan,
  strengthLevel: c.strengthLevel,
  ingredients: c.ingredients,
  keyActives: c.keyActives,
  concerns: c.concerns,
  variants: c.variants.map((v) => ({
    sku: v.sku,
    priceCents: v.priceCents,
    replenishDays: v.replenishDays,
  })),
  defaultSku: c.variant.sku,
});

const PROFILES: Answers[] = [
  {
    "skin-type": { skinType: "COMBINATION" },
    concerns: { ranked: ["acne", "post-acne-marks"] },
    sensitivity: { level: 3 },
    reactions: { items: ["none"] },
    conditions: { items: ["none"], sensitiveConsent: false },
    "routine-time": { value: "standard" },
    budget: { monthlyCents: 12000 },
  },
  {
    "skin-type": { skinType: "DRY" },
    concerns: { ranked: ["fine-lines", "dryness"] },
    sensitivity: { level: 2 },
    reactions: { items: ["none"] },
    conditions: { items: ["pregnant"], sensitiveConsent: true },
    "routine-time": { value: "enthusiast" },
    budget: { monthlyCents: 20000 },
  },
];

describe("loadEngineCatalog", () => {
  it("matches the seed fixture the engine is tested against (seeded products only)", async () => {
    const fromDb = await loadEngineCatalog(prisma);
    const fixture = buildSeedCatalog();
    const seeded = new Set(fixture.candidates.map((c) => c.slug));
    const dbSeeded = fromDb.candidates.filter((c) => seeded.has(c.slug));

    const bySlug = (a: { slug: string }, b: { slug: string }) => a.slug.localeCompare(b.slug);
    // Stock differs between runs (other tests buy things), so availability isn't compared.
    expect(dbSeeded.map(comparable).sort(bySlug)).toEqual(
      fixture.candidates.map(comparable).sort(bySlug),
    );
    expect([...fromDb.kb.ingredients.keys()].sort()).toEqual(
      [...fixture.kb.ingredients.keys()].sort(),
    );
    expect(fromDb.kb.conflicts.length).toBe(fixture.kb.conflicts.length);
  });

  it.each(PROFILES.map((p, i) => [i, p] as const))(
    "recommends the same routine as the fixture (profile %i)",
    async (_i, answers) => {
      const fromDb = await loadEngineCatalog(prisma);
      const seededSlugs = new Set(buildSeedCatalog().candidates.map((c) => c.slug));
      const dbCatalog = {
        ...fromDb,
        candidates: fromDb.candidates.filter((c) => seededSlugs.has(c.slug)),
      };

      // Use generous identical stock so only catalogue data drives the result.
      const withStock = (catalog: EngineCatalog) => ({
        ...catalog,
        candidates: catalog.candidates.map((c) => ({
          ...c,
          variants: c.variants.map((v) => ({
            ...v,
            available: v.sku === "NURA-SPF-TINT-DEEP" ? 0 : 100,
          })),
          variant: { ...c.variant, available: 100 },
        })),
      });

      const a = recommendDeterministic(answers, withStock(dbCatalog));
      const b = recommendDeterministic(answers, withStock(buildSeedCatalog()));
      for (const tier of ["ESSENTIAL", "COMPLETE", "ADVANCED"] as const) {
        expect(a.tiers[tier].products.map((p) => p.slug)).toEqual(
          b.tiers[tier].products.map((p) => p.slug),
        );
      }
      expect(a.recommendedTier).toBe(b.recommendedTier);
    },
  );
});
