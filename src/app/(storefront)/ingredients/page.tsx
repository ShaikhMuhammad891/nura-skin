import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";

import { Container, Section } from "@/components/layout/container";
import { Breadcrumbs } from "@/components/shared/breadcrumbs";
import { Badge } from "@/components/ui/badge";
import { getIngredients } from "@/features/catalog/server/queries";

/** Catalogue reads happen at request time (cached), never during `next build` (CI has no DB). */
export const instant = false;

export const metadata: Metadata = {
  title: "Ingredient glossary",
  description:
    "Every ingredient we use, in plain language: what it does, which concerns it helps and what not to mix it with.",
  alternates: { canonical: "/ingredients" },
};

/** Ingredient glossary (docs/15 P9): actives first, then an A–Z index of everything else. */
export default async function IngredientsPage() {
  await connection();
  const ingredients = await getIngredients();
  const actives = ingredients.filter((i) => i.isActive);
  const groups = new Map<string, typeof ingredients>();
  for (const ingredient of ingredients) {
    const letter = ingredient.commonName[0]?.toUpperCase() ?? "#";
    const key = /[A-Z]/.test(letter) ? letter : "#";
    groups.set(key, [...(groups.get(key) ?? []), ingredient]);
  }
  const letters = [...groups.keys()].sort();

  return (
    <Section className="pt-8 lg:pt-12">
      <Container className="flex flex-col gap-12">
        <Breadcrumbs
          items={[
            { label: "Home", href: "/" },
            { label: "Ingredients", href: "/ingredients" },
          ]}
        />
        <header className="flex max-w-prose flex-col gap-3">
          <h1 className="font-display text-display-xl font-light">Ingredient glossary</h1>
          <p className="text-body-lg text-muted-foreground">
            No mystery blends. Here is every ingredient in our formulas, what it does, and how
            strong the evidence is.
          </p>
        </header>

        <section aria-labelledby="actives" className="flex flex-col gap-6">
          <h2 id="actives" className="font-display text-display-lg font-normal">
            Key actives
          </h2>
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {actives.map((a) => (
              <li key={a.slug}>
                <Link
                  href={`/ingredients/${a.slug}`}
                  className="flex h-full flex-col gap-2 rounded-lg border border-border bg-surface p-5 transition-shadow hover:shadow-sm"
                >
                  <span className="text-heading-md font-semibold">{a.commonName}</span>
                  <span className="text-caption text-muted-foreground">{a.inciName}</span>
                  {a.benefits[0] ? (
                    <span className="text-body-sm text-muted-foreground">{a.benefits[0]}</span>
                  ) : null}
                </Link>
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="a-z" className="flex flex-col gap-6">
          <h2 id="a-z" className="font-display text-display-lg font-normal">
            A–Z
          </h2>
          <nav aria-label="Jump to letter" className="flex flex-wrap gap-1">
            {letters.map((l) => (
              <a
                key={l}
                href={`#letter-${l}`}
                className="inline-flex size-11 items-center justify-center rounded-md border border-border text-body-sm font-medium hover:bg-surface-alt"
              >
                {l}
              </a>
            ))}
          </nav>
          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {letters.map((l) => (
              <div key={l} id={`letter-${l}`} className="flex scroll-mt-24 flex-col gap-2">
                <h3 className="font-display text-heading-xl font-normal">{l}</h3>
                <ul className="flex flex-col gap-1">
                  {groups.get(l)!.map((i) => (
                    <li key={i.slug} className="flex items-center gap-2">
                      <Link
                        href={`/ingredients/${i.slug}`}
                        className="text-body underline-offset-4 hover:underline"
                      >
                        {i.commonName}
                      </Link>
                      {i.isActive ? <Badge variant="accent">Active</Badge> : null}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>
      </Container>
    </Section>
  );
}
