import "server-only";

import type { DbClient } from "@/lib/server/db-types";

/**
 * Storefront search (docs/09 §4.4, docs/15 P14): Postgres full-text search over the product
 * `search_vector` (name A, subtitle B, ingredient names C) with a trigram fallback, so typos like
 * "niacinamde" still match. Ingredients match on common name, INCI and aliases; concerns on name.
 */
export type SearchResults = {
  query: string;
  products: { slug: string; name: string; subtitle: string | null; type: string }[];
  ingredients: { slug: string; commonName: string; inciName: string }[];
  concerns: { slug: string; name: string }[];
};

export const MIN_QUERY_LENGTH = 2;
const MAX_QUERY_LENGTH = 80;
const TRIGRAM_THRESHOLD = 0.3;

/** Trimmed, length-capped query; null when too short to search. */
export function normalizeQuery(raw: string | null | undefined): string | null {
  const q = (raw ?? "").replace(/\s+/g, " ").trim().slice(0, MAX_QUERY_LENGTH);
  return q.length >= MIN_QUERY_LENGTH ? q : null;
}

/** Prefix tsquery from free text: "vit c" → "vit:* & c:*". Non-word characters are dropped. */
export function toPrefixTsQuery(q: string): string | null {
  const terms = q
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean)
    .slice(0, 8);
  return terms.length ? terms.map((t) => `${t}:*`).join(" & ") : null;
}

export async function searchCatalog(db: DbClient, rawQuery: string): Promise<SearchResults> {
  const query = normalizeQuery(rawQuery);
  if (!query) return { query: rawQuery.trim(), products: [], ingredients: [], concerns: [] };
  const tsQuery = toPrefixTsQuery(query);
  const like = `%${query.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;

  const [products, ingredients, concerns] = await Promise.all([
    db.$queryRaw<SearchResults["products"]>`
      SELECT p.slug, p.name, p.subtitle, p.type::text AS type
      FROM products p
      WHERE p.status = 'PUBLISHED' AND p.archived_at IS NULL
        AND (
          (${tsQuery}::text IS NOT NULL AND p.search_vector @@ to_tsquery('simple', ${tsQuery}))
          OR similarity(p.name, ${query}) > ${TRIGRAM_THRESHOLD}
          OR word_similarity(${query}, p.name) > ${TRIGRAM_THRESHOLD + 0.2}
        )
      ORDER BY
        CASE WHEN ${tsQuery}::text IS NOT NULL
          THEN ts_rank(p.search_vector, to_tsquery('simple', ${tsQuery})) ELSE 0 END DESC,
        similarity(p.name, ${query}) DESC,
        p.name ASC
      LIMIT 12`,
    db.$queryRaw<SearchResults["ingredients"]>`
      SELECT i.slug, i.common_name AS "commonName", i.inci_name::text AS "inciName"
      FROM ingredients i
      WHERE i.status = 'PUBLISHED' AND i.archived_at IS NULL
        AND (
          i.common_name ILIKE ${like} OR i.inci_name::text ILIKE ${like}
          OR EXISTS (SELECT 1 FROM unnest(i.aliases) a WHERE a ILIKE ${like})
          OR similarity(i.common_name, ${query}) > ${TRIGRAM_THRESHOLD}
          OR similarity(i.inci_name::text, ${query}) > ${TRIGRAM_THRESHOLD}
        )
      ORDER BY
        GREATEST(similarity(i.common_name, ${query}), similarity(i.inci_name::text, ${query})) DESC,
        i.common_name ASC
      LIMIT 8`,
    db.$queryRaw<SearchResults["concerns"]>`
      SELECT c.slug, c.name
      FROM concerns c
      WHERE c.name ILIKE ${like} OR c.slug ILIKE ${like} OR similarity(c.name, ${query}) > ${TRIGRAM_THRESHOLD}
      ORDER BY c.position ASC
      LIMIT 6`,
  ]);

  return { query, products, ingredients, concerns };
}
