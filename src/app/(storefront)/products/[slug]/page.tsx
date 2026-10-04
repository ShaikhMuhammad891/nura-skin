import type { Metadata } from "next";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import { Suspense } from "react";

import { LivePurchase } from "../../_components/live-purchase";
import { Container, Section } from "@/components/layout/container";
import { Breadcrumbs } from "@/components/shared/breadcrumbs";
import { Rating } from "@/components/shared/rating";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ProductGrid } from "@/features/catalog/components/product-card";
import { ProductImage } from "@/features/catalog/components/product-image";
import {
  GoodFor,
  HowToUse,
  IngredientConflicts,
  InciList,
  KeyActives,
  ReviewsSection,
  SectionTitle,
} from "@/features/catalog/components/product-sections";

import { completeTheRoutine, formatBadge } from "@/features/catalog/merchandising";
import {
  getCatalogue,
  getIsRetiredProduct,
  getProduct,
  getReviews,
  getSlugRedirect,
} from "@/features/catalog/server/queries";

/** Real 404s/redirects need a blocking render (docs/15 P5). Content is cached; stock streams. */
export const instant = false;

export async function generateMetadata({
  params,
}: PageProps<"/products/[slug]">): Promise<Metadata> {
  const product = await getProduct((await params).slug);
  if (!product) return { robots: { index: false } };
  return {
    title: product.seoTitle ?? `${product.name}${product.subtitle ? ` · ${product.subtitle}` : ""}`,
    description: product.seoDescription ?? product.shortDescription,
    alternates: { canonical: `/products/${product.slug}` },
    openGraph: { type: "website", title: product.name, description: product.shortDescription },
  };
}

/** ER2: discontinued product (soft 410: noindex + alternatives; true 410 needs a proxy lookup). */
async function Discontinued() {
  const catalogue = await getCatalogue();
  const picks = catalogue.filter((p) => p.type === "SINGLE").slice(0, 4);
  return (
    <Section>
      <Container className="flex flex-col gap-10">
        <meta name="robots" content="noindex" />
        <div className="flex max-w-prose flex-col gap-4">
          <p className="text-overline font-semibold text-muted-foreground uppercase">
            Discontinued
          </p>
          <h1 className="font-display text-display-xl font-light">
            This product has been discontinued.
          </h1>
          <p className="text-body-lg text-muted-foreground">
            We retire formulas when we have something better. These are close alternatives, or let
            the finder build a routine around your skin.
          </p>
          <div>
            <Button asChild variant="accent">
              <Link href="/finder">Find my routine</Link>
            </Button>
          </div>
        </div>
        <ProductGrid products={picks} headingLevel="h2" />
      </Container>
    </Section>
  );
}

export default async function ProductPage({ params, searchParams }: PageProps<"/products/[slug]">) {
  const { slug } = await params;
  const product = await getProduct(slug);

  if (!product) {
    const moved = await getSlugRedirect("product", slug);
    if (moved) permanentRedirect(`/products/${moved}`);
    if (await getIsRetiredProduct(slug)) return <Discontinued />;
    notFound();
  }
  if (product.type === "BUNDLE") permanentRedirect(`/routines/${product.slug}`);

  const { variant } = await searchParams;
  const [catalogue, { summary, reviews }] = await Promise.all([
    getCatalogue(),
    getReviews(product.id),
  ]);
  const routine = completeTheRoutine(product, product.conflicts, catalogue);

  return (
    <>
      <Section className="pt-6 pb-12 lg:pt-10 lg:pb-16">
        <Container className="flex flex-col gap-6">
          <Breadcrumbs
            items={[
              { label: "Home", href: "/" },
              { label: product.category.name, href: `/shop/${product.category.slug}` },
              { label: product.name, href: `/products/${product.slug}` },
            ]}
          />
          <div className="grid gap-8 lg:grid-cols-2 lg:gap-16">
            <div className="lg:sticky lg:top-24 lg:self-start">
              <ProductImage
                image={product.images[0] ?? null}
                slot={product.routineSlot}
                categorySlug={product.category.slug}
                sizes="(min-width: 1024px) 50vw, 100vw"
                priority
              />
            </div>
            <div className="flex flex-col gap-6">
              <div className="flex flex-col gap-3">
                {product.badges.length ? (
                  <div className="flex flex-wrap gap-2">
                    {product.badges.map((b) => (
                      <Badge key={b} variant="accent">
                        {formatBadge(b)}
                      </Badge>
                    ))}
                  </div>
                ) : null}
                <h1 className="font-display text-heading-xl font-normal lg:text-display-lg lg:font-light">
                  {product.name}
                </h1>
                {product.subtitle ? (
                  <p className="text-body-lg text-muted-foreground">{product.subtitle}</p>
                ) : null}
                <Rating value={product.ratingAvg} count={product.ratingCount} />
                <p className="max-w-prose text-body text-muted-foreground">{product.description}</p>
              </div>
              <Suspense fallback={<Skeleton className="h-72 w-full" />}>
                <LivePurchase
                  product={product}
                  requestedVariantId={typeof variant === "string" ? variant : undefined}
                />
              </Suspense>
              <p className="text-caption text-muted-foreground">
                Free shipping over $50 · 30-day returns, even if opened.
              </p>
            </div>
          </div>
        </Container>
      </Section>

      <Section className="border-t border-border pt-12 lg:pt-16">
        <Container className="grid gap-12 lg:grid-cols-2 lg:gap-16">
          <div className="flex flex-col gap-12">
            <KeyActives product={product} />
            <HowToUse product={product} />
          </div>
          <div className="flex flex-col gap-12">
            <GoodFor product={product} />
            <IngredientConflicts conflicts={product.conflicts} />
            <InciList product={product} />
          </div>
        </Container>
      </Section>

      {routine.length ? (
        <Section className="bg-surface-alt">
          <Container className="flex flex-col gap-8">
            <div className="flex flex-col gap-2">
              <SectionTitle>Complete the routine</SectionTitle>
              <p className="max-w-prose text-body text-muted-foreground">
                Compatible with {product.name}: no clashing actives, matched to the same concerns.
              </p>
            </div>
            <ProductGrid products={routine} />
          </Container>
        </Section>
      ) : null}

      <Section>
        <Container>
          <ReviewsSection summary={summary} reviews={reviews} />
        </Container>
      </Section>
    </>
  );
}
