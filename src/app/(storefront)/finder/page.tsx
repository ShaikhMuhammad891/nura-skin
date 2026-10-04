import { Clock, ShieldCheck, Sparkles } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { Container, Section } from "@/components/layout/container";
import { StartFinderButton } from "@/features/finder/components/start-button";

export const metadata: Metadata = {
  title: "Routine Finder",
  description:
    "Answer ten questions and get a morning and evening routine built for your skin, with every step explained.",
  alternates: { canonical: "/finder" },
};

const POINTS = [
  {
    icon: Clock,
    title: "About three minutes",
    body: "Ten short questions. Your answers save as you go.",
  },
  {
    icon: ShieldCheck,
    title: "Safe by design",
    body: "Every product is checked against your skin, sensitivities and pregnancy status, and against every other step.",
  },
  {
    icon: Sparkles,
    title: "Every step explained",
    body: "Why each product is there, how often to use it, and how to introduce it gently.",
  },
] as const;

/** Routine Finder intro (docs/15 P11). */
export default function FinderIntroPage() {
  return (
    <Section className="pt-16 lg:pt-24">
      <Container className="flex max-w-3xl flex-col gap-10">
        <div className="flex flex-col gap-5">
          <p className="text-overline font-semibold text-muted-foreground uppercase">
            Routine Finder
          </p>
          <h1 className="font-display text-display-xl font-light">
            A routine built for your skin.
          </h1>
          <p className="text-body-lg text-muted-foreground">
            Tell us about your skin, and our engine matches it to the right ingredients, checks that
            everything works together, and explains every step.
          </p>
          <StartFinderButton />
        </div>
        <ul className="grid gap-6 sm:grid-cols-3">
          {POINTS.map(({ icon: Icon, title, body }) => (
            <li key={title} className="flex flex-col gap-2 border-t border-border-strong pt-5">
              <Icon aria-hidden className="size-5 text-accent-foreground dark:text-accent" />
              <h2 className="text-heading-sm font-semibold">{title}</h2>
              <p className="text-body-sm text-muted-foreground">{body}</p>
            </li>
          ))}
        </ul>
        <p className="text-caption text-subtle-foreground">
          Cosmetic guidance, not medical advice. Curious how it works?{" "}
          <Link href="/science" className="text-link underline underline-offset-4">
            Read about the engine
          </Link>
          .
        </p>
      </Container>
    </Section>
  );
}
