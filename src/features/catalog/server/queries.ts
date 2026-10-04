import "server-only";

import { cacheLife, cacheTag } from "next/cache";

import { availabilityFor } from "@/features/inventory/server/service";
import { getPricingSettings } from "@/features/settings/server/settings";
import { db } from "@/lib/server/db";

import {
  findSlugRedirect,
  isRetiredProduct,
  loadCatalogue,
  loadCategories,
  loadConcernIngredients,
  loadConcerns,
  loadIngredientDetail,
  loadIngredients,
  loadProductDetail,
  loadReviews,
} from "./service";

/**
 * Cached catalogue reads for pages (docs/06 §3.1). Tagged so admin writes (M8) can revalidate
 * precisely: `catalog` for anything product-shaped, `product:<slug>` for one PDP, and so on.
 * Stock is never cached here; it streams in per request (StockIndicator).
 */
export const CATALOG_TAG = "catalog";

export async function getCatalogue() {
  "use cache";
  cacheTag(CATALOG_TAG);
  cacheLife("hours");
  return loadCatalogue(db);
}

export async function getCategories() {
  "use cache";
  cacheTag(CATALOG_TAG, "categories");
  cacheLife("hours");
  return loadCategories(db);
}

export async function getConcerns() {
  "use cache";
  cacheTag(CATALOG_TAG, "concerns");
  cacheLife("hours");
  return loadConcerns(db);
}

export async function getProduct(slug: string) {
  "use cache";
  cacheTag(CATALOG_TAG, `product:${slug}`);
  cacheLife("hours");
  return loadProductDetail(db, slug);
}

export async function getSlugRedirect(
  entityType: "product" | "category" | "ingredient",
  slug: string,
) {
  "use cache";
  cacheTag(CATALOG_TAG, "redirects");
  cacheLife("hours");
  return findSlugRedirect(db, entityType, slug);
}

export async function getIsRetiredProduct(slug: string) {
  "use cache";
  cacheTag(CATALOG_TAG, `product:${slug}`);
  cacheLife("hours");
  return isRetiredProduct(db, slug);
}

export async function getIngredients() {
  "use cache";
  cacheTag(CATALOG_TAG, "ingredients");
  cacheLife("hours");
  return loadIngredients(db);
}

export async function getIngredient(slug: string) {
  "use cache";
  cacheTag(CATALOG_TAG, "ingredients", `ingredient:${slug}`);
  cacheLife("hours");
  return loadIngredientDetail(db, slug);
}

export async function getReviews(productId: string) {
  "use cache";
  cacheTag(`reviews:${productId}`);
  cacheLife("minutes");
  return loadReviews(db, productId);
}

export async function getConcernIngredients(concernSlug: string) {
  "use cache";
  cacheTag(CATALOG_TAG, "concerns", "ingredients");
  cacheLife("hours");
  return loadConcernIngredients(db, concernSlug);
}

/**
 * Live purchase state for a PDP: stock per variant and the subscription discount. Deliberately
 * **not** cached; it streams per request behind a Suspense boundary.
 */
export async function getLiveOffer(variantIds: string[]) {
  const [stock, pricing] = await Promise.all([
    availabilityFor(db, variantIds),
    getPricingSettings(db),
  ]);
  return {
    availability: Object.fromEntries(variantIds.map((id) => [id, stock.get(id) ?? 0])),
    subscriptionDiscountBp: pricing.subscriptionDiscountBp,
  };
}
