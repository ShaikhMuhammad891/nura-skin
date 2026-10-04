import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";

import { Container, Section, SectionHeader } from "@/components/layout/container";
import { Button } from "@/components/ui/button";
import { bestsellers, featuredRoutines } from "@/features/catalog/merchandising";
import { getCatalogue, getConcerns, getIngredient } from "@/features/catalog/server/queries";
import {
  HomeSectionsSkeleton,
  MerchandisedSections,
} from "@/features/marketing/components/home-sections";

const STEPS = [
  {
    title: "Answer 10 questions",
    body: "Skin type, what you'd like to improve, how your skin reacts, your budget. About three minutes.",
  },
  {
    title: "We match ingredients to your skin",
    body: "Only products that suit you, work together and are in stock. Nothing that clashes.",
  },
  {
    title: "Get your routine, explained",
    body: "A morning and evening routine with the reason behind every step, and how to start it gently.",
  },
] as const;

/**
 * Catalogue-driven sections read at request time (cached), so the hero stays prerendered and the
 * build never touches the database.
 */
async function HomeMerchandising() {
  await connection();
  const [catalogue, concerns, story] = await Promise.all([
    getCatalogue(),
    getConcerns(),
    getIngredient("niacinamide"),
  ]);
  return (
    <MerchandisedSections
      routines={featuredRoutines(catalogue, 3)}
      best={bestsellers(catalogue, 4)}
      concerns={concerns}
      story={story}
      storyProducts={
        story ? catalogue.filter((p) => story.productSlugs.includes(p.slug)).slice(0, 2) : []
      }
    />
  );
}

/**
 * Home (docs/15 P1). The hero and editorial bands are prerendered; merchandised catalogue
 * sections stream in. The art-directed hero image arrives with the asset batch (docs/17).
 */
export default function HomePage() {
  return (
    <>
      <Section className="pt-20 lg:pt-32">
        <Container className="flex flex-col gap-8">
          <p className="text-overline font-semibold text-muted-foreground uppercase">
            Personalized skincare
          </p>
          <h1 className="max-w-4xl font-display text-display-2xl font-light">
            Your skin, understood.
          </h1>
          <p className="max-w-prose text-body-lg text-muted-foreground">
            Get a routine built for your skin in three minutes, with every step explained. Fewer
            products, chosen to work together.
          </p>
          <div className="flex flex-wrap gap-3">
            <Button asChild variant="accent" size="lg">
              <Link href="/finder">Find my routine</Link>
            </Button>
          </div>
        </Container>
      </Section>

      <Section className="bg-surface-alt">
        <Container className="flex flex-col gap-12">
          <SectionHeader
            eyebrow="How it works"
            title="A consultation, not a quiz"
            description="Our routine engine checks every recommendation against your answers and our ingredient database before you see it."
          />
          <ol className="grid gap-8 md:grid-cols-3">
            {STEPS.map((step, index) => (
              <li
                key={step.title}
                className="flex flex-col gap-3 border-t border-border-strong pt-6"
              >
                <span className="font-display text-heading-xl text-accent-foreground dark:text-accent">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <h3 className="text-heading-md font-semibold">{step.title}</h3>
                <p className="text-body text-muted-foreground">{step.body}</p>
              </li>
            ))}
          </ol>
        </Container>
      </Section>

      <Suspense fallback={<HomeSectionsSkeleton />}>
        <HomeMerchandising />
      </Suspense>

      <Section>
        <Container className="flex flex-col items-start gap-6">
          <p className="max-w-3xl font-display text-display-lg font-light">
            Fewer products. Better skin.{" "}
            <span className="text-muted-foreground">Made to work together.</span>
          </p>
          <Button asChild variant="secondary">
            <Link href="/science">How our routine engine works</Link>
          </Button>
        </Container>
      </Section>
    </>
  );
}
