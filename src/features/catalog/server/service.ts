import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import type { DbClient } from "@/lib/server/db-types";

import type {
  BundleStepDTO,
  CategoryDTO,
  ConcernDTO,
  ConflictDTO,
  ImageDTO,
  IngredientDetailDTO,
  IngredientSummaryDTO,
  ProductCardDTO,
  ProductDetailDTO,
  ReviewDTO,
  ReviewSummaryDTO,
} from "../types";

/**
 * Catalogue reads (docs/09 §4). Every function takes the client so integration tests run them
 * against a throwaway database; `./queries.ts` wraps them in `"use cache"` for pages.
 * Only PUBLISHED, non-archived rows are ever visible on the storefront.
 */
const visible = {
  status: "PUBLISHED",
  archivedAt: null,
} as const satisfies Prisma.ProductWhereInput;

const cardSelect = {
  id: true,
  slug: true,
  name: true,
  subtitle: true,
  shortDescription: true,
  type: true,
  routineSlot: true,
  timeOfDay: true,
  skinTypes: true,
  fragranceFree: true,
  pregnancySafe: true,
  vegan: true,
  nonComedogenic: true,
  badges: true,
  ratingAvg: true,
  ratingCount: true,
  unitsSold30d: true,
  isFeatured: true,
  featuredPosition: true,
  publishedAt: true,
  category: { select: { slug: true, name: true } },
  concerns: {
    select: { efficacy: true, concern: { select: { slug: true, name: true, position: true } } },
  },
  variants: {
    where: { archivedAt: null },
    orderBy: { position: "asc" },
    select: { id: true, priceCents: true, compareAtPriceCents: true, isDefault: true },
  },
  ingredients: {
    where: { isKeyActive: true },
    orderBy: { position: "asc" },
    select: { ingredient: { select: { slug: true, commonName: true } } },
  },
  images: {
    orderBy: { position: "asc" },
    take: 1,
    select: { publicId: true, width: true, height: true, alt: true },
  },
} as const satisfies Prisma.ProductSelect;

type CardRow = Prisma.ProductGetPayload<{ select: typeof cardSelect }>;

function toCard(p: CardRow): ProductCardDTO {
  const prices = p.variants.map((v) => v.priceCents);
  const cheapest = p.variants.reduce<CardRow["variants"][number] | null>(
    (min, v) => (!min || v.priceCents < min.priceCents ? v : min),
    null,
  );
  const defaultVariant = p.variants.find((v) => v.isDefault) ?? p.variants[0] ?? null;
  return {
    id: p.id,
    slug: p.slug,
    name: p.name,
    subtitle: p.subtitle,
    shortDescription: p.shortDescription,
    type: p.type,
    category: p.category,
    routineSlot: p.routineSlot,
    timeOfDay: p.timeOfDay,
    skinTypes: p.skinTypes,
    concerns: [...p.concerns]
      .sort((a, b) => b.efficacy - a.efficacy || a.concern.position - b.concern.position)
      .map((c) => ({ slug: c.concern.slug, name: c.concern.name, efficacy: c.efficacy })),
    fragranceFree: p.fragranceFree,
    pregnancySafe: p.pregnancySafe,
    vegan: p.vegan,
    nonComedogenic: p.nonComedogenic,
    badges: p.badges,
    ratingAvg: Number(p.ratingAvg),
    ratingCount: p.ratingCount,
    unitsSold30d: p.unitsSold30d,
    isFeatured: p.isFeatured,
    featuredPosition: p.featuredPosition,
    publishedAt: p.publishedAt?.toISOString() ?? null,
    priceFromCents: prices.length ? Math.min(...prices) : 0,
    compareAtCents: cheapest?.compareAtPriceCents ?? null,
    variantCount: p.variants.length,
    defaultVariantId: defaultVariant?.id ?? null,
    keyActives: p.ingredients.map((i) => i.ingredient.commonName),
    keyActiveSlugs: p.ingredients.map((i) => i.ingredient.slug),
    image: p.images[0] ?? null,
  };
}

/** Every visible product (singles and routines) as cards. */
export async function loadCatalogue(db: DbClient): Promise<ProductCardDTO[]> {
  const rows = await db.product.findMany({
    where: visible,
    select: cardSelect,
    orderBy: { name: "asc" },
  });
  return rows.map(toCard);
}

export async function loadCategories(db: DbClient): Promise<CategoryDTO[]> {
  return db.category.findMany({
    where: { archivedAt: null },
    orderBy: { position: "asc" },
    select: {
      slug: true,
      name: true,
      description: true,
      routineSlot: true,
      heroImageKey: true,
      seoTitle: true,
      seoDescription: true,
    },
  });
}

export async function loadConcerns(db: DbClient): Promise<ConcernDTO[]> {
  return db.concern.findMany({
    orderBy: { position: "asc" },
    select: { slug: true, name: true, description: true, iconKey: true },
  });
}

/**
 * Conflicts that matter to someone using this product: pairs with exactly one side in it
 * (pairs fully inside the product are the formulator's problem, already resolved).
 */
async function conflictsFor(db: DbClient, ingredientIds: string[]): Promise<ConflictDTO[]> {
  if (!ingredientIds.length) return [];
  const inProduct = new Set(ingredientIds);
  const rows = await db.ingredientConflict.findMany({
    where: {
      OR: [{ ingredientAId: { in: ingredientIds } }, { ingredientBId: { in: ingredientIds } }],
    },
    select: {
      severity: true,
      reason: true,
      ingredientA: { select: { id: true, slug: true, commonName: true } },
      ingredientB: { select: { id: true, slug: true, commonName: true } },
    },
  });
  const severityRank = { avoid_same_routine: 0, avoid_same_day: 1, caution: 2 } as const;
  return rows
    .filter((r) => inProduct.has(r.ingredientA.id) !== inProduct.has(r.ingredientB.id))
    .map((r) => {
      const [mine, other] = inProduct.has(r.ingredientA.id)
        ? [r.ingredientA, r.ingredientB]
        : [r.ingredientB, r.ingredientA];
      return {
        severity: r.severity as ConflictDTO["severity"],
        reason: r.reason,
        ingredient: { slug: mine.slug, commonName: mine.commonName },
        other: { slug: other.slug, commonName: other.commonName },
      };
    })
    .sort((a, b) => severityRank[a.severity] - severityRank[b.severity]);
}

export async function loadProductDetail(
  db: DbClient,
  slug: string,
): Promise<ProductDetailDTO | null> {
  const row = await db.product.findFirst({
    where: { slug, ...visible },
    select: {
      ...cardSelect,
      description: true,
      howToUse: true,
      textures: true,
      strengthLevel: true,
      seoTitle: true,
      seoDescription: true,
      updatedAt: true,
      variants: {
        where: { archivedAt: null },
        orderBy: { position: "asc" },
        select: {
          id: true,
          sku: true,
          name: true,
          optionType: true,
          sizeMl: true,
          shadeHex: true,
          priceCents: true,
          compareAtPriceCents: true,
          subscriptionEligible: true,
          replenishDays: true,
          isDefault: true,
        },
      },
      images: {
        orderBy: { position: "asc" },
        select: { publicId: true, width: true, height: true, alt: true },
      },
      ingredients: {
        orderBy: { position: "asc" },
        select: {
          isKeyActive: true,
          concentrationBp: true,
          ingredient: {
            select: { id: true, slug: true, inciName: true, commonName: true, benefits: true },
          },
        },
      },
      bundleItems: {
        orderBy: { stepOrder: "asc" },
        select: {
          stepOrder: true,
          timeOfDay: true,
          quantity: true,
          variant: {
            select: {
              id: true,
              name: true,
              priceCents: true,
              product: {
                select: {
                  slug: true,
                  name: true,
                  subtitle: true,
                  routineSlot: true,
                  category: { select: { slug: true, name: true } },
                  images: {
                    orderBy: { position: "asc" },
                    take: 1,
                    select: { publicId: true, width: true, height: true, alt: true },
                  },
                },
              },
            },
          },
        },
      },
    },
  });
  if (!row) return null;

  const card = toCard({
    ...row,
    ingredients: row.ingredients.filter((i) => i.isKeyActive),
    images: row.images.slice(0, 1),
  });
  const steps: BundleStepDTO[] = row.bundleItems.map((b) => ({
    stepOrder: b.stepOrder,
    timeOfDay: b.timeOfDay,
    quantity: b.quantity,
    variantId: b.variant.id,
    variantName: b.variant.name,
    priceCents: b.variant.priceCents,
    product: {
      slug: b.variant.product.slug,
      name: b.variant.product.name,
      subtitle: b.variant.product.subtitle,
      routineSlot: b.variant.product.routineSlot,
      category: b.variant.product.category,
      image: (b.variant.product.images[0] as ImageDTO | undefined) ?? null,
    },
  }));

  return {
    ...card,
    description: row.description,
    howToUse: row.howToUse,
    textures: row.textures,
    strengthLevel: row.strengthLevel,
    seoTitle: row.seoTitle,
    seoDescription: row.seoDescription,
    updatedAt: row.updatedAt.toISOString(),
    variants: row.variants,
    images: row.images,
    ingredients: row.ingredients.map((i) => ({
      slug: i.ingredient.slug,
      inciName: i.ingredient.inciName,
      commonName: i.ingredient.commonName,
      isKeyActive: i.isKeyActive,
      concentrationBp: i.concentrationBp,
      benefits: i.ingredient.benefits,
    })),
    conflicts: await conflictsFor(
      db,
      row.ingredients.map((i) => i.ingredient.id),
    ),
    steps,
  };
}

/** Where an old slug moved to (docs/08 SlugRedirect), or null. */
export async function findSlugRedirect(
  db: DbClient,
  entityType: "product" | "category" | "ingredient",
  fromSlug: string,
): Promise<string | null> {
  const row = await db.slugRedirect.findUnique({
    where: { entityType_fromSlug: { entityType, fromSlug } },
    select: { toSlug: true },
  });
  return row?.toSlug ?? null;
}

/** A product that existed but was archived: the page answers 410 Gone, not 404. */
export async function isRetiredProduct(db: DbClient, slug: string): Promise<boolean> {
  const row = await db.product.findUnique({
    where: { slug },
    select: { status: true, archivedAt: true },
  });
  return Boolean(row && (row.status === "ARCHIVED" || row.archivedAt));
}

const ingredientSummarySelect = {
  slug: true,
  inciName: true,
  commonName: true,
  category: true,
  isActive: true,
  benefits: true,
} as const satisfies Prisma.IngredientSelect;

export async function loadIngredients(db: DbClient): Promise<IngredientSummaryDTO[]> {
  return db.ingredient.findMany({
    where: { status: "PUBLISHED", archivedAt: null },
    orderBy: { commonName: "asc" },
    select: ingredientSummarySelect,
  });
}

export async function loadIngredientDetail(
  db: DbClient,
  slug: string,
): Promise<IngredientDetailDTO | null> {
  const row = await db.ingredient.findFirst({
    where: { slug, status: "PUBLISHED", archivedAt: null },
    select: {
      ...ingredientSummarySelect,
      id: true,
      aliases: true,
      description: true,
      cautions: true,
      pregnancySafe: true,
      isFragrance: true,
      irritancyLevel: true,
      concerns: {
        orderBy: { evidence: "desc" },
        select: {
          evidence: true,
          minEffectiveBp: true,
          concern: { select: { slug: true, name: true } },
        },
      },
      conflictsA: {
        select: {
          severity: true,
          reason: true,
          ingredientB: { select: { slug: true, commonName: true } },
        },
      },
      conflictsB: {
        select: {
          severity: true,
          reason: true,
          ingredientA: { select: { slug: true, commonName: true } },
        },
      },
      products: {
        where: { product: visible },
        orderBy: { position: "asc" },
        select: { product: { select: { slug: true } } },
      },
    },
  });
  if (!row) return null;
  return {
    slug: row.slug,
    inciName: row.inciName,
    commonName: row.commonName,
    category: row.category,
    isActive: row.isActive,
    benefits: row.benefits,
    aliases: row.aliases,
    description: row.description,
    cautions: row.cautions,
    pregnancySafe: row.pregnancySafe,
    isFragrance: row.isFragrance,
    irritancyLevel: row.irritancyLevel,
    evidence: row.concerns.map((c) => ({
      slug: c.concern.slug,
      name: c.concern.name,
      evidence: c.evidence,
      minEffectiveBp: c.minEffectiveBp,
    })),
    conflicts: [
      ...row.conflictsA.map((c) => ({
        severity: c.severity,
        reason: c.reason,
        other: c.ingredientB,
      })),
      ...row.conflictsB.map((c) => ({
        severity: c.severity,
        reason: c.reason,
        other: c.ingredientA,
      })),
    ].map((c) => ({ ...c, severity: c.severity as ConflictDTO["severity"] })),
    productSlugs: row.products.map((p) => p.product.slug),
  };
}

/** Approved reviews (read-only until M7) and the summary computed from them. */
export async function loadReviews(
  db: DbClient,
  productId: string,
  take = 10,
): Promise<{ summary: ReviewSummaryDTO; reviews: ReviewDTO[] }> {
  const where = { productId, status: "APPROVED" } as const satisfies Prisma.ReviewWhereInput;
  const [groups, rows] = await Promise.all([
    db.review.groupBy({ by: ["rating"], where, _count: { _all: true } }),
    db.review.findMany({
      where,
      orderBy: [{ isFeatured: "desc" }, { createdAt: "desc" }],
      take,
      select: {
        id: true,
        rating: true,
        title: true,
        body: true,
        displayName: true,
        skinType: true,
        orderItemId: true,
        createdAt: true,
      },
    }),
  ]);
  const distribution: ReviewSummaryDTO["distribution"] = [0, 0, 0, 0, 0];
  for (const g of groups) {
    if (g.rating >= 1 && g.rating <= 5) distribution[g.rating - 1] = g._count._all;
  }
  const count = distribution.reduce((a, b) => a + b, 0);
  const total = distribution.reduce((sum, n, i) => sum + n * (i + 1), 0);
  return {
    summary: { average: count ? Math.round((total / count) * 10) / 10 : 0, count, distribution },
    reviews: rows.map((r) => ({
      id: r.id,
      rating: r.rating,
      title: r.title,
      body: r.body,
      authorName: r.displayName,
      skinType: r.skinType,
      verifiedPurchase: r.orderItemId !== null,
      createdAt: r.createdAt.toISOString(),
    })),
  };
}

/** Ingredients with evidence for a concern, strongest first (concern hubs, docs/15 P8). */
export async function loadConcernIngredients(
  db: DbClient,
  concernSlug: string,
): Promise<{ slug: string; evidence: number }[]> {
  const rows = await db.ingredientConcern.findMany({
    where: {
      concern: { slug: concernSlug },
      ingredient: { status: "PUBLISHED", archivedAt: null },
    },
    orderBy: [{ evidence: "desc" }],
    select: { evidence: true, ingredient: { select: { slug: true } } },
  });
  return rows.map((r) => ({ slug: r.ingredient.slug, evidence: r.evidence }));
}
