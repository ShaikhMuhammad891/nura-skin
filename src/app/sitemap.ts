import type { MetadataRoute } from "next";
import { connection } from "next/server";

import { getCatalogue, getConcerns, getIngredients } from "@/features/catalog/server/queries";
import { LEGAL_DOCS } from "@/features/marketing/legal";
import { env } from "@/lib/env";

/**
 * Sitemap (docs/15 "Index" column). Built from the cached catalogue at request time, so the build
 * never needs a database. Filter/sort URLs, search, account, checkout and admin are excluded.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  await connection();
  const base = env.NEXT_PUBLIC_SITE_URL;
  const url = (path: string) => new URL(path, base).toString();
  const [catalogue, concerns, ingredients] = await Promise.all([
    getCatalogue(),
    getConcerns(),
    getIngredients(),
  ]);
  const categories = [
    ...new Set(catalogue.filter((p) => p.type === "SINGLE").map((p) => p.category.slug)),
  ];

  return [
    { url: url("/"), changeFrequency: "weekly", priority: 1 },
    { url: url("/shop"), changeFrequency: "daily", priority: 0.9 },
    ...categories.map((slug) => ({
      url: url(`/shop/${slug}`),
      changeFrequency: "weekly" as const,
      priority: 0.8,
    })),
    { url: url("/routines"), changeFrequency: "weekly", priority: 0.8 },
    ...catalogue.map((p) => ({
      url: url(p.type === "BUNDLE" ? `/routines/${p.slug}` : `/products/${p.slug}`),
      lastModified: p.publishedAt ?? undefined,
      changeFrequency: "weekly" as const,
      priority: 0.8,
    })),
    ...concerns.map((c) => ({
      url: url(`/concerns/${c.slug}`),
      changeFrequency: "monthly" as const,
      priority: 0.6,
    })),
    { url: url("/ingredients"), changeFrequency: "monthly", priority: 0.6 },
    ...ingredients.map((i) => ({
      url: url(`/ingredients/${i.slug}`),
      changeFrequency: "monthly" as const,
      priority: 0.5,
    })),
    ...["/science", "/about", "/faq"].map((path) => ({
      url: url(path),
      changeFrequency: "monthly" as const,
      priority: 0.5,
    })),
    ...LEGAL_DOCS.map((d) => ({
      url: url(`/legal/${d.slug}`),
      changeFrequency: "yearly" as const,
      priority: 0.2,
    })),
  ];
}
