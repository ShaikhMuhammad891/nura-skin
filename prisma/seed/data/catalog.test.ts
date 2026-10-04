import { describe, expect, it } from "vitest";

import { BUNDLES, PRODUCTS } from "./catalog";
import { CONCERNS, INGREDIENT_CONCERNS, INGREDIENT_CONFLICTS, INGREDIENTS } from "./knowledge";

/**
 * The catalogue is the routine engine's knowledge base (docs/12 §5), so its integrity is
 * tested like code: a bad flag here becomes a bad (or unsafe) recommendation.
 */
const ingredients = new Map(INGREDIENTS.map((i) => [i.slug, i]));
const concernSlugs = new Set(CONCERNS.map((c) => c.slug));
const skus = new Map(PRODUCTS.flatMap((p) => p.variants.map((v) => [v.sku, { p, v }] as const)));

describe("knowledge base", () => {
  it("has unique ingredient slugs and INCI names", () => {
    expect(ingredients.size).toBe(INGREDIENTS.length);
    const inci = new Set(INGREDIENTS.map((i) => i.inciName.toLowerCase()));
    expect(inci.size).toBe(INGREDIENTS.length);
  });

  it("references only known ingredients and concerns", () => {
    for (const ic of INGREDIENT_CONCERNS) {
      expect(ingredients.has(ic.ingredient), ic.ingredient).toBe(true);
      expect(concernSlugs.has(ic.concern), ic.concern).toBe(true);
    }
    for (const c of INGREDIENT_CONFLICTS) {
      expect(ingredients.has(c.a) && ingredients.has(c.b), `${c.a}/${c.b}`).toBe(true);
      expect(c.a).not.toBe(c.b);
    }
  });

  it("does not list vitamin C + niacinamide as a conflict (a myth)", () => {
    const pair = (a: string, b: string) =>
      INGREDIENT_CONFLICTS.some((c) => (c.a === a && c.b === b) || (c.a === b && c.b === a));
    expect(pair("ethyl-ascorbic-acid", "niacinamide")).toBe(false);
    expect(pair("retinal", "ethyl-ascorbic-acid")).toBe(true);
  });
});

describe("products", () => {
  it.each(PRODUCTS.map((p) => [p.slug, p] as const))("%s is internally consistent", (_slug, p) => {
    expect(p.shortDescription.length).toBeLessThanOrEqual(160);
    expect(p.variants.filter((v) => v.isDefault)).toHaveLength(1);
    expect(p.skinTypes.length).toBeGreaterThan(0);
    expect(p.concerns.length).toBeGreaterThan(0);

    for (const entry of p.inci) {
      expect(ingredients.has(entry.ingredient), `${p.slug}: ${entry.ingredient}`).toBe(true);
      if (entry.bp !== undefined) expect(entry.bp).toBeGreaterThan(0);
    }
    const slugs = p.inci.map((e) => e.ingredient);
    expect(new Set(slugs).size, `${p.slug} lists an ingredient twice`).toBe(slugs.length);
    expect(
      p.inci.some((e) => e.key),
      `${p.slug} has no key active`,
    ).toBe(true);

    for (const v of p.variants) {
      expect(v.priceCents).toBeGreaterThan(0);
      expect(v.costCents).toBeLessThan(v.priceCents);
      expect(v.replenishDays).toBeGreaterThanOrEqual(14);
      expect(v.replenishDays).toBeLessThanOrEqual(180);
    }
  });

  it("safety flags agree with ingredients (pregnancy, fragrance, vegan)", () => {
    for (const p of PRODUCTS) {
      const used = p.inci.map((e) => ingredients.get(e.ingredient)!);
      // A product may only claim pregnancy-safe if every KEY active is known-safe.
      if (p.pregnancySafe) {
        const unsafe = p.inci.filter(
          (e) => e.key && ingredients.get(e.ingredient)!.pregnancySafe !== true,
        );
        expect(
          unsafe.map((e) => e.ingredient),
          `${p.slug} pregnancySafe`,
        ).toEqual([]);
      }
      expect(p.fragranceFree, `${p.slug} fragranceFree`).toBe(!used.some((i) => i.isFragrance));
      if (p.vegan)
        expect(
          used.some((i) => i.isAnimalDerived),
          `${p.slug} vegan`,
        ).toBe(false);
    }
  });

  it("uses unique SKUs across the catalogue", () => {
    const all = [
      ...PRODUCTS.flatMap((p) => p.variants.map((v) => v.sku)),
      ...BUNDLES.map((b) => b.sku),
    ];
    expect(new Set(all).size).toBe(all.length);
  });

  it("covers every routine slot with at least one pregnancy-safe, fragrance-free product", () => {
    for (const slot of ["CLEANSE", "TREAT", "MOISTURIZE", "PROTECT"] as const) {
      expect(
        PRODUCTS.some((p) => p.routineSlot === slot && p.pregnancySafe && p.fragranceFree),
        slot,
      ).toBe(true);
    }
  });
});

describe("bundles", () => {
  it.each(BUNDLES.map((b) => [b.slug, b] as const))(
    "%s is cheaper than its parts and conflict-free",
    (_slug, b) => {
      const components = b.items.map((item) => {
        const found = skus.get(item.sku);
        expect(found, `${b.slug}: ${item.sku}`).toBeDefined();
        return { ...item, ...found! };
      });
      const list = components.reduce((sum, c) => sum + c.v.priceCents, 0);
      expect(b.priceCents).toBeLessThan(list);
      expect(components.some((c) => c.p.routineSlot === "CLEANSE")).toBe(true);

      // No avoid_same_routine conflict may share a time of day inside a bundle.
      const actives = (time: "AM" | "PM") =>
        components
          .filter((c) => c.timeOfDay === time || c.timeOfDay === "BOTH")
          .flatMap((c) => c.p.inci.filter((e) => e.key).map((e) => e.ingredient));
      for (const time of ["AM", "PM"] as const) {
        const present = new Set(actives(time));
        for (const conflict of INGREDIENT_CONFLICTS.filter(
          (c) => c.severity === "avoid_same_routine",
        )) {
          expect(
            present.has(conflict.a) && present.has(conflict.b),
            `${b.slug} ${time}: ${conflict.a}+${conflict.b}`,
          ).toBe(false);
        }
      }
    },
  );
});
