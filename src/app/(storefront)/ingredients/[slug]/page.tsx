import { AlertTriangle, Baby, Info } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";

import { Container, Section } from "@/components/layout/container";
import { Breadcrumbs } from "@/components/shared/breadcrumbs";
import { Badge } from "@/components/ui/badge";
import { ProductGrid } from "@/features/catalog/components/product-card";
import { formatConcentration } from "@/features/catalog/merchandising";
import { getCatalogue, getIngredient, getSlugRedirect } from "@/features/catalog/server/queries";

/** Unknown slugs get real 404s from the proxy catalogue gate (ADR-0020). */
export const instant = false;

const EVIDENCE = ["", "Limited evidence", "Good evidence", "Strong clinical evidence"] as const;
const SEVERITY = {
  avoid_same_routine: "Use at a different time of day",
  avoid_same_day: "Use on different days",
  caution: "Introduce gradually",
} as const;

export async function generateMetadata({
  params,
}: PageProps<"/ingredients/[slug]">): Promise<Metadata> {
  const ingredient = await getIngredient((await params).slug);
  if (!ingredient) return { robots: { index: false } };
  return {
    title: `${ingredient.commonName} (${ingredient.inciName})`,
    description:
      ingredient.description?.slice(0, 155) ??
      `What ${ingredient.commonName} does for skin, the evidence, and what not to mix it with.`,
    alternates: { canonical: `/ingredients/${ingredient.slug}` },
  };
}

/** Ingredient detail (docs/15 P10). */
export default async function IngredientPage({ params }: PageProps<"/ingredients/[slug]">) {
  const { slug } = await params;
  const ingredient = await getIngredient(slug);
  if (!ingredient) {
    const moved = await getSlugRedirect("ingredient", slug);
    if (moved) permanentRedirect(`/ingredients/${moved}`);
    notFound();
  }
  const catalogue = await getCatalogue();
  const products = catalogue.filter((p) => ingredient.productSlugs.includes(p.slug));

  return (
    <>
      <Section className="pt-8 pb-12 lg:pt-12">
        <Container className="flex flex-col gap-8">
          <Breadcrumbs
            items={[
              { label: "Home", href: "/" },
              { label: "Ingredients", href: "/ingredients" },
              { label: ingredient.commonName, href: `/ingredients/${ingredient.slug}` },
            ]}
          />
          <header className="flex max-w-prose flex-col gap-3">
            <div className="flex flex-wrap gap-2">
              <Badge variant="neutral" className="capitalize">
                {ingredient.category}
              </Badge>
              {ingredient.isActive ? <Badge variant="accent">Key active</Badge> : null}
            </div>
            <h1 className="font-display text-display-xl font-light">{ingredient.commonName}</h1>
            <p className="font-mono text-body-sm text-muted-foreground">
              INCI: {ingredient.inciName}
              {ingredient.aliases.length ? ` · Also known as ${ingredient.aliases.join(", ")}` : ""}
            </p>
            {ingredient.description ? (
              <p className="text-body-lg text-muted-foreground">{ingredient.description}</p>
            ) : null}
          </header>

          <div className="grid gap-8 lg:grid-cols-2">
            {ingredient.benefits.length ? (
              <section aria-labelledby="does" className="flex flex-col gap-3">
                <h2 id="does" className="font-display text-heading-xl font-normal">
                  What it does
                </h2>
                <ul className="flex list-disc flex-col gap-1 pl-5 text-body text-muted-foreground">
                  {ingredient.benefits.map((b) => (
                    <li key={b}>{b}</li>
                  ))}
                </ul>
              </section>
            ) : null}

            {ingredient.evidence.length ? (
              <section aria-labelledby="evidence" className="flex flex-col gap-3">
                <h2 id="evidence" className="font-display text-heading-xl font-normal">
                  Evidence by concern
                </h2>
                <ul className="flex flex-col gap-2">
                  {ingredient.evidence.map((e) => (
                    <li
                      key={e.slug}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-surface p-3"
                    >
                      <Link
                        href={`/concerns/${e.slug}`}
                        className="text-body font-medium underline-offset-4 hover:underline"
                      >
                        {e.name}
                      </Link>
                      <span className="flex items-center gap-2 text-body-sm text-muted-foreground">
                        <span aria-hidden className="flex gap-0.5">
                          {[1, 2, 3].map((n) => (
                            <span
                              key={n}
                              className={`h-2 w-4 rounded-full ${n <= e.evidence ? "bg-sage-foreground" : "bg-surface-alt"}`}
                            />
                          ))}
                        </span>
                        {EVIDENCE[e.evidence] ?? ""}
                        {e.minEffectiveBp ? ` · from ${formatConcentration(e.minEffectiveBp)}` : ""}
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="flex gap-3 rounded-lg border border-border bg-surface p-4">
              <Baby aria-hidden className="mt-0.5 size-5 shrink-0 text-muted-foreground" />
              <p className="text-body-sm">
                <strong className="font-semibold">Pregnancy: </strong>
                {ingredient.pregnancySafe === true
                  ? "Generally considered suitable. Check with your doctor if unsure."
                  : ingredient.pregnancySafe === false
                    ? "Usually avoided during pregnancy and breastfeeding."
                    : "Not enough data, so our routine engine treats it as not pregnancy-safe."}
              </p>
            </div>
            {ingredient.cautions ? (
              <div className="flex gap-3 rounded-lg border border-border bg-surface p-4">
                <Info aria-hidden className="mt-0.5 size-5 shrink-0 text-info" />
                <p className="text-body-sm">{ingredient.cautions}</p>
              </div>
            ) : null}
          </div>

          {ingredient.conflicts.length ? (
            <section aria-labelledby="conflicts" className="flex flex-col gap-3">
              <h2 id="conflicts" className="font-display text-heading-xl font-normal">
                Don&apos;t layer with
              </h2>
              <ul className="grid gap-3 md:grid-cols-2">
                {ingredient.conflicts.map((c) => (
                  <li
                    key={c.other.slug}
                    className="flex gap-3 rounded-lg border border-border bg-surface p-4"
                  >
                    <AlertTriangle aria-hidden className="mt-0.5 size-4 shrink-0 text-warning" />
                    <div className="flex flex-col gap-1">
                      <p className="text-body-sm font-semibold">
                        <Link
                          href={`/ingredients/${c.other.slug}`}
                          className="underline-offset-4 hover:underline"
                        >
                          {c.other.commonName}
                        </Link>{" "}
                        · {SEVERITY[c.severity]}
                      </p>
                      <p className="text-body-sm text-muted-foreground">{c.reason}</p>
                    </div>
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
            <h2 className="font-display text-display-lg font-normal">
              Products with {ingredient.commonName}
            </h2>
            <ProductGrid products={products} />
          </Container>
        </Section>
      ) : null}
    </>
  );
}
