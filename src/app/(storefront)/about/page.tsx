import type { Metadata } from "next";
import Link from "next/link";

import { Container, Section, SectionHeader } from "@/components/layout/container";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "About Nura",
  description: "Fewer products, chosen to work together, with every ingredient explained.",
  alternates: { canonical: "/about" },
};

const PRINCIPLES = [
  {
    title: "Fewer products",
    body: "A good routine has three or four steps. We'd rather sell you less that works than more that clashes.",
  },
  {
    title: "Radical transparency",
    body: "Every key active shows its concentration. Every ingredient has a page explaining what it does and the evidence behind it.",
  },
  {
    title: "Compatibility by design",
    body: "Our formulas are built to layer. The shop and the finder both warn you before you combine actives that don't belong together.",
  },
  {
    title: "Gentle by default",
    body: "Most of our range is fragrance-free, and we recommend introducing actives slowly, even when it means a slower routine.",
  },
] as const;

/** About (docs/15 P16). Nura Skin is a fictional brand built as a portfolio project. */
export default function AboutPage() {
  return (
    <>
      <Section className="pt-20 lg:pt-28">
        <Container className="flex max-w-4xl flex-col gap-6">
          <p className="text-overline font-semibold text-muted-foreground uppercase">About</p>
          <h1 className="font-display text-display-xl font-light">
            Skincare that explains itself.
          </h1>
          <p className="max-w-prose text-body-lg text-muted-foreground">
            Nura started from a simple frustration: shelves of products, no idea which ones work
            together. So we built a small range of compatible formulas, and a routine engine that
            tells you exactly why each step is there.
          </p>
          <p className="max-w-prose rounded-lg bg-surface-alt p-4 text-body-sm text-muted-foreground">
            Nura Skin is a fictional brand and a portfolio project. Orders are never charged or
            shipped, and payments run in test mode.
          </p>
        </Container>
      </Section>
      <Section className="bg-surface-alt">
        <Container className="flex flex-col gap-12">
          <SectionHeader eyebrow="Principles" title="What we won't compromise on" />
          <ul className="grid gap-8 md:grid-cols-2">
            {PRINCIPLES.map((p) => (
              <li key={p.title} className="flex flex-col gap-2 border-t border-border-strong pt-6">
                <h3 className="text-heading-md font-semibold">{p.title}</h3>
                <p className="text-body text-muted-foreground">{p.body}</p>
              </li>
            ))}
          </ul>
        </Container>
      </Section>
      <Section>
        <Container className="flex flex-col items-start gap-4">
          <h2 className="font-display text-display-lg font-light">See it for yourself</h2>
          <div className="flex flex-wrap gap-3">
            <Button asChild variant="accent" size="lg">
              <Link href="/finder">Find my routine</Link>
            </Button>
            <Button asChild variant="secondary" size="lg">
              <Link href="/science">How the engine works</Link>
            </Button>
          </div>
        </Container>
      </Section>
    </>
  );
}
