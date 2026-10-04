/**
 * Catalogue status gate (ADR-0020). With Cache Components every dynamic route streams a static
 * shell first, so a page can no longer change its status once it runs: `notFound()` inside the page
 * yields a soft 404 (200 + noindex). The Next docs' answer is to decide in the proxy, before
 * anything streams. This module is the pure decision; `src/proxy.ts` maps it to a response and
 * `lib/server/slug-index.ts` loads the (slug-only, cached) index.
 */
export type SlugIndex = {
  /** Published, non-archived single products. */
  products: ReadonlySet<string>;
  /** Published, non-archived routines (bundles). */
  routines: ReadonlySet<string>;
  /** Products or routines that existed and were retired: 410 Gone. */
  retired: ReadonlySet<string>;
  categories: ReadonlySet<string>;
  ingredients: ReadonlySet<string>;
  concerns: ReadonlySet<string>;
  legal: ReadonlySet<string>;
  /** `entityType:fromSlug` → `toSlug` (docs/08 SlugRedirect). */
  redirects: ReadonlyMap<string, string>;
};

export type CatalogDecision =
  { kind: "allow" } | { kind: "not-found" } | { kind: "gone" } | { kind: "redirect"; to: string };

const ALLOW: CatalogDecision = { kind: "allow" };
const NOT_FOUND: CatalogDecision = { kind: "not-found" };

/** The catalogue routes this gate owns: exactly `/<prefix>/<slug>`. */
const PREFIXES = ["products", "routines", "shop", "ingredients", "concerns", "legal"] as const;
type Prefix = (typeof PREFIXES)[number];

/** `[prefix, slug]` for a gated path, or null (any other path is not this gate's business). */
export function catalogPath(pathname: string): [Prefix, string] | null {
  const parts = pathname.split("/");
  if (parts.length !== 3 || parts[0] !== "") return null;
  const [, prefix, raw] = parts;
  if (!raw || !(PREFIXES as readonly string[]).includes(prefix ?? "")) return null;
  let slug: string;
  try {
    slug = decodeURIComponent(raw);
  } catch {
    return [prefix as Prefix, "\u0000"]; // malformed escape: never matches, so 404
  }
  return [prefix as Prefix, slug];
}

export function catalogDecision(pathname: string, index: SlugIndex): CatalogDecision {
  const path = catalogPath(pathname);
  if (!path) return ALLOW;
  const [prefix, slug] = path;
  const moved = (entity: string) => index.redirects.get(`${entity}:${slug}`);

  switch (prefix) {
    case "products": {
      if (index.products.has(slug)) return ALLOW;
      if (index.routines.has(slug)) return { kind: "redirect", to: `/routines/${slug}` };
      const to = moved("product");
      if (to) return { kind: "redirect", to: `/products/${to}` };
      return index.retired.has(slug) ? { kind: "gone" } : NOT_FOUND;
    }
    case "routines": {
      if (index.routines.has(slug)) return ALLOW;
      return index.retired.has(slug) ? { kind: "gone" } : NOT_FOUND;
    }
    case "shop": {
      if (slug === "routines") return { kind: "redirect", to: "/routines" };
      if (index.categories.has(slug)) return ALLOW;
      const to = moved("category");
      return to ? { kind: "redirect", to: `/shop/${to}` } : NOT_FOUND;
    }
    case "ingredients": {
      if (index.ingredients.has(slug)) return ALLOW;
      const to = moved("ingredient");
      return to ? { kind: "redirect", to: `/ingredients/${to}` } : NOT_FOUND;
    }
    case "concerns":
      return index.concerns.has(slug) ? ALLOW : NOT_FOUND;
    case "legal":
      return index.legal.has(slug) ? ALLOW : NOT_FOUND;
  }
}
