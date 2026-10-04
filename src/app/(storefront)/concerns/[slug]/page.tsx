import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Container, Section } from "@/components/layout/container";
import { Breadcrumbs } from "@/components/shared/breadcrumbs";
import { Button } from "@/components/ui/button";
import { ProductGrid } from "@/features/catalog/components/product-card";
import {
  getCatalogue,
  getConcernIngredients,
  getConcerns,
  getIngredients,
} from "@/features/catalog/server/queries";

/** Real 404s need a blocking render (docs/15 P8). */
export const instant = false;

export async function generateMetadata({
  params,
}: PageProps<"/concerns/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const concern = (await getConcerns()).find((c) => c.slug === slug);
  if (!concern) return { robots: { index: false } };
  return {
    title: `${concern.name}: what helps`,
    description: concern.description.slice(0, 155),
    alternates: { canonical: `/concerns/${concern.slug}` },
  };
}

/** Concern hub (docs/15 P8): what it is, which ingredients help (with evidence), products. */
export default async function ConcernPage({ params }: PageProps<"/concerns/[slug]">) {
  const { slug } = await params;
  const concern = (await getConcerns()).find((c) => c.slug === slug);
  if (!concern) notFound();

  const [catalogue, helpful, ingredients] = await Promise.all([
    getCatalogue(),
    getConcernIngredients(slug),
    getIngredients(),
  ]);
  const names = new Map(ingredients.map((i) => [i.slug, i.commonName]));
  const products = catalogue
    .filter((p) => p.type === "SINGLE" && p.concerns.some((c) => c.slug === slug))
    .sort(
      (a, b) =>
        (b.concerns.find((c) => c.slug === slug)?.efficacy ?? 0) -
        (a.concerns.find((c) => c.slug === slug)?.efficacy ?? 0),
    );
  const routines = catalogue.filter(
    (p) => p.type === "BUNDLE" && p.concerns.some((c) => c.slug === slug),
  );

  return (
    <>
      <Section className="pt-8 pb-12 lg:pt-12">
        <Container className="flex flex-col gap-8">
          <Breadcrumbs
            items={[
              { label: "Home", href: "/" },
              { label: "Concerns", href: "/shop" },
              { label: concern.name, href: `/concerns/${concern.slug}` },
            ]}
          />
          <header className="flex max-w-prose flex-col gap-3">
            <p className="text-overline font-semibold text-muted-foreground uppercase">Concern</p>
            <h1 className="font-display text-display-xl font-light">{concern.name}</h1>
            <p className="text-body-lg text-muted-foreground">{concern.description}</p>
            <p className="text-caption text-subtle-foreground">
              Cosmetic information, not medical advice. For persistent or painful skin conditions,
              see a dermatologist.
            </p>
          </header>

          {helpful.length ? (
            <section aria-labelledby="helps" className="flex flex-col gap-4">
              <h2 id="helps" className="font-display text-heading-xl font-normal">
                Ingredients that help
              </h2>
              <ul className="flex flex-wrap gap-2">
                {helpful.map((i) => (
                  <li key={i.slug}>
                    <Link
                      href={`/ingredients/${i.slug}`}
                      className="inline-flex min-h-11 items-center gap-2 rounded-full border border-border-strong px-4 text-body-sm hover:bg-surface-alt"
                    >
                      {names.get(i.slug) ?? i.slug}
                      <span className="sr-only">, evidence level {i.evidence} of 3</span>
                      <span aria-hidden className="text-caption text-muted-foreground">
                        {"●".repeat(i.evidence)}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </Container>
      </Section>

      {products.length ? (
        <Section className="bg-surface-alt">
          <Container className="flex flex-col gap-8">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <h2 className="font-display text-display-lg font-normal">
                Products for {concern.name.toLowerCase()}
              </h2>
              <Button asChild variant="secondary">
                <Link href={`/shop?concern=${concern.slug}`}>Filter all products</Link>
              </Button>
            </div>
            <ProductGrid products={products.slice(0, 8)} />
          </Container>
        </Section>
      ) : null}

      <Section>
        <Container className="flex flex-col items-start gap-4">
          <h2 className="font-display text-display-lg font-normal">
            {routines.length ? "Or start with a routine" : "Want a routine for this?"}
          </h2>
          {routines.length ? <ProductGrid products={routines} /> : null}
          <Button asChild variant="accent" size="lg">
            <Link href="/finder">Find my routine</Link>
          </Button>
        </Container>
      </Section>
    </>
  );
}
