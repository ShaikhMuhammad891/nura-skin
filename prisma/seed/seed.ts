/**
 * Idempotent catalogue seed (docs/08 §6.6). Safe to re-run: everything upserts by natural key
 * (slug / SKU / role key), and stock is only initialised for variants that have none, so
 * re-seeding never resets real inventory. Synthetic customers/orders are seeded later (M4+),
 * once the pricing and order services exist to keep that history internally consistent.
 */
import type {
  PrismaClient,
  RoleKey,
  RoutineSlot,
  SkinType,
  TimeOfDay,
} from "../../src/generated/prisma/client";

import { BUNDLES, CATEGORIES, PRODUCTS, ROLES, STORE_SETTINGS } from "./data/catalog";
import { CONCERNS, INGREDIENT_CONCERNS, INGREDIENT_CONFLICTS, INGREDIENTS } from "./data/knowledge";

export type SeedSummary = Record<string, number>;

export async function seed(prisma: PrismaClient, now: Date = new Date()): Promise<SeedSummary> {
  // ── Roles ──────────────────────────────────────────────────────────────────
  for (const role of ROLES) {
    await prisma.role.upsert({
      where: { key: role.key as RoleKey },
      update: { name: role.name },
      create: { key: role.key as RoleKey, name: role.name },
    });
  }

  // ── Knowledge base ─────────────────────────────────────────────────────────
  const concernIds = new Map<string, string>();
  for (const [position, c] of CONCERNS.entries()) {
    const row = await prisma.concern.upsert({
      where: { slug: c.slug },
      update: { name: c.name, description: c.description, iconKey: c.iconKey, position },
      create: {
        slug: c.slug,
        name: c.name,
        description: c.description,
        iconKey: c.iconKey,
        position,
      },
    });
    concernIds.set(c.slug, row.id);
  }

  const ingredientIds = new Map<string, string>();
  for (const i of INGREDIENTS) {
    const data = {
      inciName: i.inciName,
      commonName: i.commonName,
      aliases: i.aliases ?? [],
      category: i.category,
      isActive: i.isActive ?? false,
      pregnancySafe: i.pregnancySafe,
      isFragrance: i.isFragrance ?? false,
      isAnimalDerived: i.isAnimalDerived ?? false,
      irritancyLevel: i.irritancyLevel,
      description: i.description,
      benefits: i.benefits ?? [],
      cautions: i.cautions ?? null,
    };
    const row = await prisma.ingredient.upsert({
      where: { slug: i.slug },
      update: data,
      create: { slug: i.slug, ...data },
    });
    ingredientIds.set(i.slug, row.id);
  }

  const idOf = (map: Map<string, string>, key: string, kind: string): string => {
    const id = map.get(key);
    if (!id) throw new Error(`Seed references unknown ${kind} "${key}"`);
    return id;
  };

  for (const ic of INGREDIENT_CONCERNS) {
    const ingredientId = idOf(ingredientIds, ic.ingredient, "ingredient");
    const concernId = idOf(concernIds, ic.concern, "concern");
    await prisma.ingredientConcern.upsert({
      where: { ingredientId_concernId: { ingredientId, concernId } },
      update: { evidence: ic.evidence, minEffectiveBp: ic.minEffectiveBp ?? null },
      create: {
        ingredientId,
        concernId,
        evidence: ic.evidence,
        minEffectiveBp: ic.minEffectiveBp ?? null,
      },
    });
  }

  for (const conflict of INGREDIENT_CONFLICTS) {
    // Stored once per unordered pair with a < b (DB CHECK constraint).
    const [a, b] = [
      idOf(ingredientIds, conflict.a, "ingredient"),
      idOf(ingredientIds, conflict.b, "ingredient"),
    ].sort();
    await prisma.ingredientConflict.upsert({
      where: { ingredientAId_ingredientBId: { ingredientAId: a!, ingredientBId: b! } },
      update: { severity: conflict.severity, reason: conflict.reason },
      create: {
        ingredientAId: a!,
        ingredientBId: b!,
        severity: conflict.severity,
        reason: conflict.reason,
      },
    });
  }

  // ── Categories ─────────────────────────────────────────────────────────────
  const categoryIds = new Map<string, string>();
  for (const c of CATEGORIES) {
    const data = {
      name: c.name,
      description: c.description,
      position: c.position,
      routineSlot: c.routineSlot as RoutineSlot | null,
    };
    const row = await prisma.category.upsert({
      where: { slug: c.slug },
      update: data,
      create: { slug: c.slug, ...data },
    });
    categoryIds.set(c.slug, row.id);
  }

  // ── Products, variants, INCI, targeting, inventory ─────────────────────────
  const variantIds = new Map<string, string>();
  let createdInventory = 0;

  for (const p of PRODUCTS) {
    const data = {
      name: p.name,
      subtitle: p.subtitle,
      type: "SINGLE" as const,
      status: "PUBLISHED" as const,
      categoryId: idOf(categoryIds, p.category, "category"),
      shortDescription: p.shortDescription,
      description: p.description,
      howToUse: p.howToUse,
      routineSlot: p.routineSlot as RoutineSlot,
      timeOfDay: p.timeOfDay as TimeOfDay,
      skinTypes: p.skinTypes as SkinType[],
      textures: p.textures,
      pregnancySafe: p.pregnancySafe,
      fragranceFree: p.fragranceFree,
      vegan: p.vegan,
      nonComedogenic: p.nonComedogenic,
      strengthLevel: p.strengthLevel,
      isFeatured: p.isFeatured ?? false,
      featuredPosition: p.featuredPosition ?? null,
      badges: p.badges ?? [],
      seoTitle: `${p.name}: ${p.subtitle}`,
      seoDescription: p.shortDescription,
    };
    const product = await prisma.product.upsert({
      where: { slug: p.slug },
      update: data,
      create: { slug: p.slug, publishedAt: now, ...data },
    });

    // INCI and targeting are replaced wholesale so the seed stays the source of truth.
    await prisma.$transaction([
      prisma.productIngredient.deleteMany({ where: { productId: product.id } }),
      prisma.productIngredient.createMany({
        data: p.inci.map((entry, position) => ({
          productId: product.id,
          ingredientId: idOf(ingredientIds, entry.ingredient, "ingredient"),
          position,
          isKeyActive: entry.key ?? false,
          concentrationBp: entry.bp ?? null,
        })),
      }),
      prisma.productConcern.deleteMany({ where: { productId: product.id } }),
      prisma.productConcern.createMany({
        data: p.concerns.map(([slug, efficacy]) => ({
          productId: product.id,
          concernId: idOf(concernIds, slug, "concern"),
          efficacy,
        })),
      }),
    ]);

    for (const [position, v] of p.variants.entries()) {
      const vData = {
        productId: product.id,
        name: v.name,
        optionType: v.optionType,
        sizeMl: v.sizeMl ?? null,
        shadeHex: v.shadeHex ?? null,
        priceCents: v.priceCents,
        compareAtPriceCents: v.compareAtPriceCents ?? null,
        costCents: v.costCents,
        subscriptionEligible: v.subscriptionEligible ?? true,
        replenishDays: v.replenishDays,
        weightGrams: v.weightGrams,
        position,
        isDefault: v.isDefault ?? false,
      };
      const variant = await prisma.productVariant.upsert({
        where: { sku: v.sku },
        update: vData,
        create: { sku: v.sku, ...vData },
      });
      variantIds.set(v.sku, variant.id);

      const existing = await prisma.inventoryItem.findUnique({ where: { variantId: variant.id } });
      if (!existing) {
        await prisma.inventoryItem.create({
          data: {
            variantId: variant.id,
            onHand: v.onHand,
            lowStockThreshold: v.lowStockThreshold ?? 20,
            ...(v.onHand > 0
              ? {
                  movements: {
                    create: {
                      type: "INITIAL",
                      quantity: v.onHand,
                      balanceAfter: v.onHand,
                      reason: "Initial stock (seed)",
                    },
                  },
                }
              : {}),
          },
        });
        createdInventory += 1;
      }
    }
  }

  // ── Bundles (pre-built routines) ───────────────────────────────────────────
  const productBySku = new Map(
    PRODUCTS.flatMap((p) => p.variants.map((v) => [v.sku, { product: p, variant: v }] as const)),
  );

  for (const b of BUNDLES) {
    const components = b.items.map((item) => {
      const found = productBySku.get(item.sku);
      if (!found) throw new Error(`Bundle ${b.slug} references unknown SKU ${item.sku}`);
      return { ...item, ...found };
    });
    const listPrice = components.reduce((sum, c) => sum + c.variant.priceCents, 0);
    const all = (pick: (p: (typeof components)[number]["product"]) => boolean) =>
      components.every((c) => pick(c.product));

    const data = {
      name: b.name,
      subtitle: b.subtitle,
      type: "BUNDLE" as const,
      status: "PUBLISHED" as const,
      categoryId: idOf(categoryIds, "routines", "category"),
      shortDescription: b.shortDescription,
      description: b.description,
      howToUse: b.howToUse,
      routineSlot: null,
      timeOfDay: "BOTH" as const,
      skinTypes: [...new Set(components.flatMap((c) => c.product.skinTypes))] as SkinType[],
      textures: [],
      pregnancySafe: all((p) => p.pregnancySafe),
      fragranceFree: all((p) => p.fragranceFree),
      vegan: all((p) => p.vegan),
      nonComedogenic: all((p) => p.nonComedogenic),
      strengthLevel: Math.max(...components.map((c) => c.product.strengthLevel)),
      isFeatured: b.isFeatured ?? false,
      featuredPosition: b.featuredPosition ?? null,
      seoTitle: `${b.name}: ${b.subtitle}`,
      seoDescription: b.shortDescription,
    };
    const bundle = await prisma.product.upsert({
      where: { slug: b.slug },
      update: data,
      create: { slug: b.slug, publishedAt: now, ...data },
    });

    const vData = {
      productId: bundle.id,
      name: "Routine",
      optionType: "size",
      priceCents: b.priceCents,
      compareAtPriceCents: listPrice,
      costCents: b.costCents,
      // Bundles are one-time only; "subscribe to routine" adds components (review R-08).
      subscriptionEligible: false,
      replenishDays: 56,
      weightGrams: components.reduce((sum, c) => sum + c.variant.weightGrams, 0),
      isDefault: true,
    };
    const bundleVariant = await prisma.productVariant.upsert({
      where: { sku: b.sku },
      update: vData,
      create: { sku: b.sku, ...vData },
    });
    variantIds.set(b.sku, bundleVariant.id);

    await prisma.$transaction([
      prisma.bundleItem.deleteMany({ where: { bundleProductId: bundle.id } }),
      prisma.bundleItem.createMany({
        data: components.map((c) => ({
          bundleProductId: bundle.id,
          variantId: idOf(variantIds, c.sku, "variant"),
          quantity: 1,
          timeOfDay: c.timeOfDay as TimeOfDay,
          stepOrder: c.stepOrder,
        })),
      }),
    ]);
  }

  // ── Store settings ─────────────────────────────────────────────────────────
  for (const [key, value] of Object.entries(STORE_SETTINGS)) {
    await prisma.storeSetting.upsert({
      where: { key },
      update: { value: value as object },
      create: { key, value: value as object },
    });
  }

  return {
    roles: ROLES.length,
    concerns: CONCERNS.length,
    ingredients: INGREDIENTS.length,
    ingredientConcerns: INGREDIENT_CONCERNS.length,
    conflicts: INGREDIENT_CONFLICTS.length,
    categories: CATEGORIES.length,
    products: PRODUCTS.length,
    bundles: BUNDLES.length,
    variants: variantIds.size,
    inventoryCreated: createdInventory,
    settings: Object.keys(STORE_SETTINGS).length,
  };
}
