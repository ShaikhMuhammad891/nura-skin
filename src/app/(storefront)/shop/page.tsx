import type { Metadata } from "next";

import { Container, Section } from "@/components/layout/container";
import { Breadcrumbs } from "@/components/shared/breadcrumbs";
import { ProductListing } from "@/features/catalog/components/product-listing";
import { getCatalogue, getConcerns } from "@/features/catalog/server/queries";

/** Filter/sort state lives in the URL: a request-time route over the cached catalogue. */
export const instant = false;

export const metadata: Metadata = {
  title: "Shop all skincare",
  description:
    "Cleansers, serums, moisturizers and sunscreens with transparent concentrations, plus complete routines that work together.",
  alternates: { canonical: "/shop" },
};

/** All products (docs/15 P2). */
export default async function ShopPage({ searchParams }: PageProps<"/shop">) {
  // Read the request first: catalogue queries must never run during `next build` (no DB in CI).
  const params = await searchParams;
  const [catalogue, concerns] = await Promise.all([getCatalogue(), getConcerns()]);
  return (
    <Section className="pt-8 lg:pt-12">
      <Container className="flex flex-col gap-8">
        <Breadcrumbs
          items={[
            { label: "Home", href: "/" },
            { label: "Shop", href: "/shop" },
          ]}
        />
        <header className="flex max-w-prose flex-col gap-3">
          <h1 className="font-display text-display-xl font-light">Shop all</h1>
          <p className="text-body-lg text-muted-foreground">
            Fewer, better products. Every formula lists its key actives and their concentrations.
          </p>
        </header>
        <ProductListing
          catalogue={catalogue}
          concerns={concerns}
          searchParams={params}
          basePath="/shop"
          scope={{}}
        />
      </Container>
    </Section>
  );
}
