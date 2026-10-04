/** Catalogue reads and search against the seeded database (docs/09 §4, docs/19 M3). */
import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { listProducts, parseFilters } from "../../src/features/catalog/filters";
import { searchCatalog } from "../../src/features/catalog/server/search";
import {
  findSlugRedirect,
  isRetiredProduct,
  loadCatalogue,
  loadConcerns,
  loadIngredientDetail,
  loadProductDetail,
  loadReviews,
} from "../../src/features/catalog/server/service";
import type { PrismaClient } from "../../src/generated/prisma/client";
import { catalogDecision } from "../../src/lib/catalog-gate";
import { loadSlugIndex } from "../../src/lib/server/slug-index";
import { BUNDLES, PRODUCTS } from "../../prisma/seed/data/catalog";

import { uid } from "./factories";
import { createTestPrisma } from "./helpers";

let prisma: PrismaClient;

beforeAll(() => {
  prisma = createTestPrisma();
});
afterAll(async () => {
  await prisma.$disconnect();
});

describe("catalogue", () => {
  it("lists every published seeded product and routine as plain DTOs", async () => {
    const catalogue = await loadCatalogue(prisma);
    const slugs = catalogue.map((p) => p.slug);
    for (const p of [...PRODUCTS, ...BUNDLES]) expect(slugs).toContain(p.slug);

    const serum = catalogue.find((p) => p.slug === "clear-serum")!;
    expect(typeof serum.ratingAvg).toBe("number");
    expect(serum.keyActives.length).toBeGreaterThan(0);
    expect(serum.priceFromCents).toBeGreaterThan(0);
    expect(serum.defaultVariantId).toBeTruthy();
    // Serializable across "use cache": no class instances.
    expect(JSON.parse(JSON.stringify(serum))).toEqual(serum);
  });

  it("hides drafts and archived products", async () => {
    const category = await prisma.category.findFirstOrThrow({ where: { slug: "serums" } });
    const slug = `draft-${uid()}`;
    await prisma.product.create({
      data: {
        slug,
        name: "Secret draft",
        categoryId: category.id,
        shortDescription: "x",
        description: "x",
        howToUse: "x",
        routineSlot: "TREAT",
        status: "DRAFT",
      },
    });
    expect((await loadCatalogue(prisma)).map((p) => p.slug)).not.toContain(slug);
    expect(await loadProductDetail(prisma, slug)).toBeNull();

    await prisma.product.update({ where: { slug }, data: { status: "ARCHIVED" } });
    expect(await isRetiredProduct(prisma, slug)).toBe(true);
    expect(await isRetiredProduct(prisma, "clear-serum")).toBe(false);
    expect(await isRetiredProduct(prisma, "never-existed")).toBe(false);
  });

  it("filters the real catalogue through the URL parser", async () => {
    const [catalogue, concerns] = await Promise.all([loadCatalogue(prisma), loadConcerns(prisma)]);
    const f = parseFilters(
      { concern: "acne", pref: "fragrance-free" },
      concerns.map((c) => c.slug),
    );
    const listing = listProducts(catalogue, f, concerns);
    expect(listing.total).toBeGreaterThan(0);
    for (const p of listing.products) {
      expect(p.fragranceFree).toBe(true);
      expect(p.concerns.map((c) => c.slug)).toContain("acne");
    }
  });

  it("loads a PDP with ingredients, conflicts that cross the product boundary, and variants", async () => {
    const product = (await loadProductDetail(prisma, "renew-night-serum"))!;
    expect(product.variants.length).toBeGreaterThan(0);
    expect(product.ingredients.some((i) => i.isKeyActive && i.slug === "retinal")).toBe(true);
    const others = product.conflicts.map((c) => c.other.slug);
    expect(others).toEqual(expect.arrayContaining(["salicylic-acid", "ethyl-ascorbic-acid"]));
    // Sorted most severe first.
    expect(product.conflicts[0]?.severity).toBe("avoid_same_routine");
  });

  it("loads routine steps for bundles", async () => {
    const routine = (await loadProductDetail(prisma, "barrier-rescue-routine"))!;
    expect(routine.type).toBe("BUNDLE");
    expect(routine.steps.map((s) => s.product.slug)).toEqual([
      "cloud-milk-cleanser",
      "dew-serum",
      "barrier-cream",
      "mineral-shield-spf-50",
    ]);
  });

  it("follows slug redirects", async () => {
    const from = `old-${uid()}`;
    await prisma.slugRedirect.create({
      data: { entityType: "product", fromSlug: from, toSlug: "clear-serum" },
    });
    expect(await findSlugRedirect(prisma, "product", from)).toBe("clear-serum");
    expect(await findSlugRedirect(prisma, "ingredient", from)).toBeNull();
  });

  it("summarizes only approved reviews", async () => {
    const product = await prisma.product.findFirstOrThrow({ where: { slug: "dew-serum" } });
    const make = (rating: number, status: "APPROVED" | "PENDING") =>
      prisma.review.create({
        data: {
          productId: product.id,
          rating,
          title: "Lovely",
          body: "Calmed my skin within a week, would buy again.",
          wouldRecommend: true,
          displayName: "Sam",
          status,
        },
      });
    await Promise.all([make(5, "APPROVED"), make(4, "APPROVED"), make(1, "PENDING")]);
    const { summary, reviews } = await loadReviews(prisma, product.id);
    expect(summary).toEqual({ average: 4.5, count: 2, distribution: [0, 0, 0, 1, 1] });
    expect(reviews).toHaveLength(2);
  });

  it("loads ingredient detail with evidence, conflicts and products", async () => {
    const niacinamide = (await loadIngredientDetail(prisma, "niacinamide"))!;
    expect(niacinamide.evidence.length).toBeGreaterThan(0);
    expect(niacinamide.productSlugs).toContain("clear-serum");
    const retinal = (await loadIngredientDetail(prisma, "retinal"))!;
    expect(retinal.conflicts.map((c) => c.other.slug)).toContain("salicylic-acid");
  });
});

describe("search", () => {
  it("finds products by name, ingredient, and with typos", async () => {
    expect((await searchCatalog(prisma, "clear")).products.map((p) => p.slug)).toContain(
      "clear-serum",
    );
    expect((await searchCatalog(prisma, "niacinamide")).products.map((p) => p.slug)).toContain(
      "clear-serum",
    );
    expect((await searchCatalog(prisma, "niacinamde")).ingredients.map((i) => i.slug)).toContain(
      "niacinamide",
    );
    expect((await searchCatalog(prisma, "cleansr")).products.length).toBeGreaterThan(0);
  });

  it("matches concerns and ignores short or hostile input", async () => {
    expect((await searchCatalog(prisma, "dry")).concerns.map((c) => c.slug)).toContain("dryness");
    expect(await searchCatalog(prisma, "a")).toMatchObject({ products: [], ingredients: [] });
    await expect(searchCatalog(prisma, "'); DROP TABLE products; --")).resolves.toBeDefined();
    await expect(searchCatalog(prisma, "100%_\\")).resolves.toBeDefined();
  });
});

describe("proxy slug index", () => {
  it("classifies live, routine, retired and draft slugs from the real schema", async () => {
    const pool = new Pool({ connectionString: process.env.TEST_DATABASE_URL, max: 1 });
    try {
      const category = await prisma.category.findFirstOrThrow({ where: { slug: "serums" } });
      const retiredSlug = `retired-${uid()}`;
      const draftSlug = `draft-${uid()}`;
      for (const [slug, status] of [
        [retiredSlug, "ARCHIVED"],
        [draftSlug, "DRAFT"],
      ] as const) {
        await prisma.product.create({
          data: {
            slug,
            name: slug,
            categoryId: category.id,
            shortDescription: "x",
            description: "x",
            howToUse: "x",
            routineSlot: "TREAT",
            status,
          },
        });
      }
      const index = { ...(await loadSlugIndex(pool)), legal: new Set<string>() };
      const decide = (p: string) => catalogDecision(p, index).kind;

      expect(decide("/products/clear-serum")).toBe("allow");
      expect(decide("/routines/glow-routine")).toBe("allow");
      expect(decide("/products/glow-routine")).toBe("redirect");
      expect(decide(`/products/${retiredSlug}`)).toBe("gone");
      expect(decide(`/products/${draftSlug}`)).toBe("not-found");
      expect(decide("/shop/serums")).toBe("allow");
      expect(decide("/ingredients/niacinamide")).toBe("allow");
      expect(decide("/concerns/acne")).toBe("allow");
    } finally {
      await pool.end();
    }
  });
});
