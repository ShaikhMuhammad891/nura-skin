import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";

import { Container, Section } from "@/components/layout/container";
import { Breadcrumbs } from "@/components/shared/breadcrumbs";
import { ProductListing } from "@/features/catalog/components/product-listing";
import {
  getCatalogue,
  getCategories,
  getConcerns,
  getSlugRedirect,
} from "@/features/catalog/server/queries";

/** Filter/sort state lives in the URL: a request-time route over the cached catalogue. */
export const instant = false;

async function findCategory(slug: string) {
  return (await getCategories()).find((c) => c.slug === slug) ?? null;
}

export async function generateMetadata({
  params,
}: PageProps<"/shop/[category]">): Promise<Metadata> {
  const category = await findCategory((await params).category);
  if (!category) return {};
  return {
    title: category.seoTitle ?? category.name,
    description: category.seoDescription ?? category.description ?? undefined,
    alternates: { canonical: `/shop/${category.slug}` },
  };
}

/** Category PLP (docs/15 P3). Routines have their own index at /routines. */
export default async function CategoryPage({
  params,
  searchParams,
}: PageProps<"/shop/[category]">) {
  const { category: slug } = await params;
  if (slug === "routines") permanentRedirect("/routines");
  const category = await findCategory(slug);
  if (!category) {
    const moved = await getSlugRedirect("category", slug);
    if (moved) permanentRedirect(`/shop/${moved}`);
    notFound();
  }
  const [catalogue, concerns] = await Promise.all([getCatalogue(), getConcerns()]);

  return (
    <Section className="pt-8 lg:pt-12">
      <Container className="flex flex-col gap-8">
        <Breadcrumbs
          items={[
            { label: "Home", href: "/" },
            { label: "Shop", href: "/shop" },
            { label: category.name, href: `/shop/${category.slug}` },
          ]}
        />
        <header className="flex max-w-prose flex-col gap-3">
          <h1 className="font-display text-display-xl font-light">{category.name}</h1>
          {category.description ? (
            <p className="text-body-lg text-muted-foreground">{category.description}</p>
          ) : null}
        </header>
        <ProductListing
          catalogue={catalogue}
          concerns={concerns}
          searchParams={await searchParams}
          basePath={`/shop/${category.slug}`}
          scope={{ categorySlug: category.slug }}
        />
      </Container>
    </Section>
  );
}
