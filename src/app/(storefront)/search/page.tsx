import { Search } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { Container, Section } from "@/components/layout/container";
import { Button } from "@/components/ui/button";
import { ProductGrid } from "@/features/catalog/components/product-card";
import { getCatalogue } from "@/features/catalog/server/queries";
import { normalizeQuery, searchCatalog } from "@/features/catalog/server/search";
import { db } from "@/lib/server/db";

/** Per-query results: a request-time route. */
export const instant = false;

export const metadata: Metadata = {
  title: "Search",
  robots: { index: false, follow: true },
};

/** Search results (docs/15 P14): grouped by products, ingredients, concerns. */
export default async function SearchPage({ searchParams }: PageProps<"/search">) {
  const { q } = await searchParams;
  const raw = typeof q === "string" ? q : "";
  const query = normalizeQuery(raw);
  const [results, catalogue] = await Promise.all([
    query ? searchCatalog(db, query) : null,
    getCatalogue(),
  ]);
  const bySlug = new Map(catalogue.map((p) => [p.slug, p]));
  const products = (results?.products ?? []).flatMap((r) => bySlug.get(r.slug) ?? []);
  const empty =
    results && !products.length && !results.ingredients.length && !results.concerns.length;

  return (
    <Section className="pt-8 lg:pt-12">
      <Container className="flex flex-col gap-10">
        <form action="/search" method="get" role="search" className="flex max-w-2xl gap-2">
          <label htmlFor="q" className="sr-only">
            Search products, ingredients and concerns
          </label>
          <div className="relative flex-1">
            <Search
              aria-hidden
              className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
            />
            <input
              id="q"
              name="q"
              type="search"
              defaultValue={raw}
              placeholder="Try “niacinamide” or “dry skin”"
              className="h-11 w-full rounded-sm border border-border-strong bg-surface pr-3 pl-9 text-body"
            />
          </div>
          <Button type="submit">Search</Button>
        </form>

        <h1 className="font-display text-display-lg font-light">
          {query ? (
            <>
              Results for <span className="italic">“{query}”</span>
            </>
          ) : (
            "Search"
          )}
        </h1>

        {empty ? (
          <div className="flex flex-col items-start gap-4">
            <p className="text-body-lg text-muted-foreground">
              Nothing matched. Try an ingredient name, a concern like “redness”, or browse
              everything.
            </p>
            <div className="flex flex-wrap gap-3">
              <Button asChild variant="secondary">
                <Link href="/shop">Shop all</Link>
              </Button>
              <Button asChild variant="accent">
                <Link href="/finder">Find my routine</Link>
              </Button>
            </div>
          </div>
        ) : null}

        {results?.concerns.length ? (
          <section aria-labelledby="r-concerns" className="flex flex-col gap-3">
            <h2 id="r-concerns" className="text-heading-lg font-semibold">
              Concerns
            </h2>
            <ul className="flex flex-wrap gap-2">
              {results.concerns.map((c) => (
                <li key={c.slug}>
                  <Link
                    href={`/concerns/${c.slug}`}
                    className="inline-flex min-h-11 items-center rounded-full border border-border-strong px-4 text-body-sm hover:bg-surface-alt"
                  >
                    {c.name}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {products.length ? (
          <section aria-labelledby="r-products" className="flex flex-col gap-6">
            <h2 id="r-products" className="text-heading-lg font-semibold">
              Products
            </h2>
            <ProductGrid products={products} />
          </section>
        ) : null}

        {results?.ingredients.length ? (
          <section aria-labelledby="r-ingredients" className="flex flex-col gap-3">
            <h2 id="r-ingredients" className="text-heading-lg font-semibold">
              Ingredients
            </h2>
            <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {results.ingredients.map((i) => (
                <li key={i.slug}>
                  <Link
                    href={`/ingredients/${i.slug}`}
                    className="flex flex-col gap-1 rounded-lg border border-border bg-surface p-4 hover:shadow-sm"
                  >
                    <span className="font-semibold">{i.commonName}</span>
                    <span className="text-caption text-muted-foreground">{i.inciName}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </Container>
    </Section>
  );
}
