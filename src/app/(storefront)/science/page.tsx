import type { Metadata } from "next";
import Link from "next/link";

import { Container, Section, SectionHeader } from "@/components/layout/container";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "How our routine engine works",
  description:
    "Deterministic code decides what is safe and possible. AI picks what is best and explains why, choosing only from products the code allowed. Then the code checks it again.",
  alternates: { canonical: "/science" },
};

const PIPELINE = [
  {
    title: "Normalize your answers",
    body: "Your answers become a structured profile: skin type, ranked concerns, sensitivity, reactions, pregnancy status, budget and preferences.",
  },
  {
    title: "Safety screen",
    body: "Hard rules come first. Pregnancy excludes retinoids and anything with unknown safety data. Past reactions exclude those ingredient families. Prescription treatments trigger a gentler routine.",
  },
  {
    title: "Find candidates",
    body: "Only published, in-stock products that suit your skin type and pass every safety rule move on. Nothing else can ever be recommended.",
  },
  {
    title: "Score",
    body: "Each candidate is scored on evidence for your concerns, how well its texture suits your skin and climate, strength versus your sensitivity, and price versus your budget.",
  },
  {
    title: "Assemble a compatible routine",
    body: "Code builds morning and evening routines step by step, using our ingredient conflict rules so actives that clash are never layered together.",
  },
  {
    title: "AI chooses and explains",
    body: "A language model sees only the shortlisted product IDs and your profile. It picks the best combination and writes the reason behind every step. Its output must match a strict schema.",
  },
  {
    title: "Verify before you see it",
    body: "A validator re-checks every rule against the AI's choice. If anything fails, or the AI is unavailable, you get the deterministic routine instead: still safe, still explained.",
  },
] as const;

/** How the routine engine works (docs/15 P15, docs/12). The portfolio's "explain the AI" page. */
export default function SciencePage() {
  return (
    <>
      <Section className="pt-20 lg:pt-28">
        <Container className="flex max-w-4xl flex-col gap-6">
          <p className="text-overline font-semibold text-muted-foreground uppercase">The science</p>
          <h1 className="font-display text-display-xl font-light">
            Code decides what&apos;s safe. AI explains what&apos;s best.
          </h1>
          <p className="max-w-prose text-body-lg text-muted-foreground">
            Our routine engine combines an ingredient database, deterministic safety rules and a
            language model. The AI never invents products, claims or prices: it can only choose from
            products the code has already checked, and the code checks its choice again.
          </p>
        </Container>
      </Section>

      <Section className="bg-surface-alt">
        <Container className="flex flex-col gap-12">
          <SectionHeader eyebrow="The pipeline" title="Seven steps, every time" />
          <ol className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {PIPELINE.map((step, i) => (
              <li
                key={step.title}
                className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-6"
              >
                <span className="font-display text-heading-xl text-accent-foreground dark:text-accent">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <h3 className="text-heading-md font-semibold">{step.title}</h3>
                <p className="text-body text-muted-foreground">{step.body}</p>
              </li>
            ))}
          </ol>
        </Container>
      </Section>

      <Section>
        <Container className="grid gap-10 lg:grid-cols-2">
          <SectionHeader
            eyebrow="The ingredient database"
            title="Every claim traces to evidence"
            description="Each ingredient records which concerns it helps, how strong the evidence is (limited, good or strong clinical), the concentration where it starts to work, its pregnancy-safety status and which ingredients it clashes with."
          />
          <div className="flex flex-col items-start gap-4 self-end">
            <p className="text-body text-muted-foreground">
              It is the same data you can browse in the glossary, and the same rules the shop uses
              to warn you about combinations on every product page.
            </p>
            <div className="flex flex-wrap gap-3">
              <Button asChild variant="secondary">
                <Link href="/ingredients">Browse the glossary</Link>
              </Button>
              <Button asChild variant="accent">
                <Link href="/finder">Try the finder</Link>
              </Button>
            </div>
          </div>
        </Container>
      </Section>
    </>
  );
}
