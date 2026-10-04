import { ArrowRight } from "lucide-react";
import Link from "next/link";

import { Container, Section, SectionHeader } from "@/components/layout/container";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { ProductGrid } from "@/features/catalog/components/product-card";
import type { ConcernDTO, IngredientDetailDTO, ProductCardDTO } from "@/features/catalog/types";

/** Merchandised home sections (docs/15 P1, docs/16 §4): routines, bestsellers, concerns, story. */

export function HomeSectionsSkeleton() {
  return (
    <Section aria-busy="true">
      <Container className="flex flex-col gap-8">
        <Skeleton className="h-10 w-72" />
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4 lg:gap-8">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="aspect-[4/5] w-full" />
          ))}
        </div>
      </Container>
    </Section>
  );
}

function SeeAll({ href, label, className }: { href: string; label: string; className?: string }) {
  return (
    <Link
      href={href}
      className={cn(
        "inline-flex min-h-11 items-center gap-1 text-body-sm font-medium text-link underline-offset-4 hover:underline",
        className,
      )}
    >
      {label}
      <ArrowRight aria-hidden className="size-4" />
    </Link>
  );
}

export function MerchandisedSections({
  routines,
  best,
  concerns,
  story,
  storyProducts,
}: {
  routines: ProductCardDTO[];
  best: ProductCardDTO[];
  concerns: ConcernDTO[];
  story: IngredientDetailDTO | null;
  storyProducts: ProductCardDTO[];
}) {
  return (
    <>
      <Section>
        <Container className="flex flex-col gap-10">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <SectionHeader
              eyebrow="Ready-made routines"
              title="Start with a routine"
              description="Complete, compatible steps for the most common goals, priced below their parts."
            />
            <SeeAll href="/routines" label="All routines" />
          </div>
          <ProductGrid products={routines} />
        </Container>
      </Section>

      <Section className="bg-surface-alt">
        <Container className="flex flex-col gap-10">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <SectionHeader eyebrow="Bestsellers" title="What people reorder" />
            <SeeAll href="/shop?sort=bestselling" label="Shop all" />
          </div>
          <ProductGrid products={best} />
        </Container>
      </Section>

      <Section>
        <Container className="flex flex-col gap-10">
          <SectionHeader
            eyebrow="Shop by concern"
            title="What would you like to improve?"
            description="Cosmetic concerns, matched to ingredients with real evidence behind them."
          />
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {concerns.map((c) => (
              <li key={c.slug}>
                <Link
                  href={`/concerns/${c.slug}`}
                  className="flex min-h-20 flex-col justify-between gap-2 rounded-lg border border-border bg-surface p-4 transition-shadow hover:shadow-sm"
                >
                  <span className="text-heading-sm font-semibold">{c.name}</span>
                  <ArrowRight aria-hidden className="size-4 text-muted-foreground" />
                </Link>
              </li>
            ))}
          </ul>
        </Container>
      </Section>

      {story ? (
        <Section className="bg-dew-subtle">
          <Container className="grid items-center gap-10 lg:grid-cols-2 lg:gap-16">
            <div className="flex flex-col gap-5">
              <p className="text-overline font-semibold text-dew-foreground uppercase">
                Ingredient story
              </p>
              <h2 className="font-display text-display-lg font-light">{story.commonName}</h2>
              <p className="font-mono text-body-sm text-muted-foreground">{story.inciName}</p>
              {story.description ? (
                <p className="max-w-prose text-body-lg text-muted-foreground">
                  {story.description}
                </p>
              ) : null}
              <div>
                <SeeAll
                  href={`/ingredients/${story.slug}`}
                  label="Read the evidence"
                  // Link colour lacks AA contrast on the dew tint.
                  className="text-foreground underline"
                />
              </div>
            </div>
            {storyProducts.length ? <ProductGrid products={storyProducts} /> : null}
          </Container>
        </Section>
      ) : null}
    </>
  );
}
