import { Pool } from "pg";

import type { SlugIndex } from "@/lib/catalog-gate";

/**
 * Loads the catalogue slug index for the proxy's status gate (ADR-0020). Proxy-only, so it uses a
 * tiny dedicated `pg` pool instead of the app's Prisma client (which is `server-only` and far
 * heavier than five slug queries need). Cached per instance for `TTL_MS`; a newly published or
 * retired product is reflected within that window. On any error it returns null and the proxy
 * fails open (pages still render their own noindex not-found UI).
 */
export type Queryable = { query: (sql: string) => Promise<{ rows: Record<string, unknown>[] }> };

export const SLUG_INDEX_TTL_MS = 60_000;

type DbSlugIndex = Omit<SlugIndex, "legal">;

export async function loadSlugIndex(db: Queryable): Promise<DbSlugIndex> {
  const [products, categories, ingredients, concerns, redirects] = await Promise.all([
    db.query(`SELECT slug, type::text AS type, status::text AS status, archived_at FROM products`),
    db.query(`SELECT slug FROM categories WHERE archived_at IS NULL`),
    db.query(`SELECT slug FROM ingredients WHERE status = 'PUBLISHED' AND archived_at IS NULL`),
    db.query(`SELECT slug FROM concerns`),
    db.query(`SELECT entity_type, from_slug, to_slug FROM slug_redirects`),
  ]);

  const live = new Set<string>();
  const routines = new Set<string>();
  const retired = new Set<string>();
  for (const row of products.rows) {
    const slug = String(row.slug);
    const archived = row.status === "ARCHIVED" || row.archived_at !== null;
    if (archived) retired.add(slug);
    else if (row.status === "PUBLISHED") (row.type === "BUNDLE" ? routines : live).add(slug);
    // DRAFT products are simply unknown: 404.
  }
  const slugs = (r: { rows: Record<string, unknown>[] }) =>
    new Set(r.rows.map((x) => String(x.slug)));

  return {
    products: live,
    routines,
    retired,
    categories: slugs(categories),
    ingredients: slugs(ingredients),
    concerns: slugs(concerns),
    redirects: new Map(
      redirects.rows.map((r) => [
        `${String(r.entity_type)}:${String(r.from_slug)}`,
        String(r.to_slug),
      ]),
    ),
  };
}

let pool: Pool | undefined;
let cached: { index: DbSlugIndex; at: number } | undefined;
let inflight: Promise<DbSlugIndex | null> | undefined;

function getPool(): Pool | null {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) return null;
  pool ??= new Pool({
    connectionString,
    max: 2,
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 5_000,
  });
  return pool;
}

/** The cached index, refreshed at most once per TTL per instance (single flight). */
export async function getSlugIndex(now = Date.now()): Promise<DbSlugIndex | null> {
  if (cached && now - cached.at < SLUG_INDEX_TTL_MS) return cached.index;
  inflight ??= (async () => {
    try {
      const db = getPool();
      if (!db) return null;
      const index = await loadSlugIndex(db);
      cached = { index, at: Date.now() };
      return index;
    } catch (error) {
      // Not the pino logger: it is `server-only`, which the proxy bundle must not import.
      console.warn("slug index unavailable; catalogue gate failing open", error);
      return cached?.index ?? null; // serve stale over nothing
    } finally {
      inflight = undefined;
    }
  })();
  return inflight;
}
