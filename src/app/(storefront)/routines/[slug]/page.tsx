import { Moon, Sun } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { LivePurchase } from "../../_components/live-purchase";
import { Container, Section } from "@/components/layout/container";
import { Breadcrumbs } from "@/components/shared/breadcrumbs";
import { Price } from "@/features/catalog/components/price";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ProductImage } from "@/features/catalog/components/product-image";
import { ReviewsSection, SectionTitle } from "@/features/catalog/components/product-sections";

import { SLOT_LABELS } from "@/features/catalog/merchandising";
import { getProduct, getReviews } from "@/features/catalog/server/queries";
import type { BundleStepDTO } from "@/features/catalog/types";
import { formatMoney } from "@/features/pricing/money";

/** Real 404s need a blocking render (docs/15 P7). */
export const instant = false;

export async function generateMetadata({
  params,
}: PageProps<"/routines/[slug]">): Promise<Metadata> {
  const routine = await getProduct((await params).slug);
  if (!routine || routine.type !== "BUNDLE") return { robots: { index: false } };
  return {
    title: routine.seoTitle ?? routine.name,
    description: routine.seoDescription ?? routine.shortDescription,
    alternates: { canonical: `/routines/${routine.slug}` },
  };
}

function Timeline({
  title,
  icon,
  steps,
}: {
  title: string;
  icon: React.ReactNode;
  steps: BundleStepDTO[];
}) {
  return (
    <div className="flex flex-col gap-4 rounded-xl border border-border bg-surface p-6">
      <h3 className="inline-flex items-center gap-2 text-heading-md font-semibold">
        {icon}
        {title}
      </h3>
      <ol className="flex flex-col gap-4">
        {steps.map((step, i) => (
          <li key={step.variantId} className="grid grid-cols-[64px_1fr] items-center gap-4">
            <ProductImage
              image={step.product.image}
              slot={step.product.routineSlot}
              categorySlug={step.product.category.slug}
              sizes="64px"
              className="rounded-md"
            />
            <div className="flex flex-col gap-0.5">
              <p className="text-overline font-semibold text-muted-foreground uppercase">
                Step {i + 1}
                {step.product.routineSlot ? ` · ${SLOT_LABELS[step.product.routineSlot]}` : ""}
              </p>
              <Link
                href={`/products/${step.product.slug}`}
                className="text-heading-sm font-semibold underline-offset-4 hover:underline"
              >
                {step.product.name}
              </Link>
              <p className="text-caption text-muted-foreground">{step.variantName}</p>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}

/** Routine (bundle) detail (docs/15 P7). */
export default async function RoutinePage({ params }: PageProps<"/routines/[slug]">) {
  const { slug } = await params;
  const routine = await getProduct(slug);
  if (!routine || routine.type !== "BUNDLE") notFound();

  const { summary, reviews } = await getReviews(routine.id);
  const am = routine.steps.filter((s) => s.timeOfDay !== "PM");
  const pm = routine.steps.filter((s) => s.timeOfDay !== "AM");
  const partsCents = routine.steps.reduce((sum, s) => sum + s.priceCents * s.quantity, 0);
  const savings = Math.max(0, partsCents - routine.priceFromCents);

  return (
    <>
      <Section className="pt-6 pb-12 lg:pt-10">
        <Container className="flex flex-col gap-6">
          <Breadcrumbs
            items={[
              { label: "Home", href: "/" },
              { label: "Routines", href: "/routines" },
              { label: routine.name, href: `/routines/${routine.slug}` },
            ]}
          />
          <div className="grid gap-8 lg:grid-cols-2 lg:gap-16">
            <ProductImage
              image={routine.images[0] ?? null}
              slot={null}
              type="BUNDLE"
              categorySlug="routines"
              sizes="(min-width: 1024px) 50vw, 100vw"
              priority
            />
            <div className="flex flex-col gap-6">
              <div className="flex flex-col gap-3">
                <p className="text-overline font-semibold text-muted-foreground uppercase">
                  {routine.steps.length}-step routine
                </p>
                <h1 className="font-display text-display-lg font-light">{routine.name}</h1>
                {routine.subtitle ? (
                  <p className="text-body-lg text-muted-foreground">{routine.subtitle}</p>
                ) : null}
                <p className="max-w-prose text-body text-muted-foreground">{routine.description}</p>
              </div>
              {savings > 0 ? (
                <div className="flex flex-wrap items-center gap-3 rounded-lg bg-sage-subtle p-4">
                  <Badge variant="sage">Save {formatMoney(savings)}</Badge>
                  <p className="text-body-sm">
                    <Price cents={partsCents} className="font-normal line-through" /> bought
                    separately
                  </p>
                </div>
              ) : null}
              <Suspense fallback={<Skeleton className="h-48 w-full" />}>
                <LivePurchase product={routine} />
              </Suspense>
              <p className="text-caption text-muted-foreground">
                Want it delivered regularly? Subscribe to the individual products from their pages
                and save on every delivery.
              </p>
            </div>
          </div>
        </Container>
      </Section>

      <Section className="bg-surface-alt">
        <Container className="flex flex-col gap-8">
          <div className="flex flex-col gap-2">
            <SectionTitle>Your morning and evening</SectionTitle>
            <p className="max-w-prose text-body text-muted-foreground">{routine.howToUse}</p>
          </div>
          <div className="grid gap-6 md:grid-cols-2">
            <Timeline title="Morning" icon={<Sun aria-hidden className="size-5" />} steps={am} />
            <Timeline title="Evening" icon={<Moon aria-hidden className="size-5" />} steps={pm} />
          </div>
        </Container>
      </Section>

      <Section>
        <Container>
          <ReviewsSection summary={summary} reviews={reviews} />
        </Container>
      </Section>
    </>
  );
}
