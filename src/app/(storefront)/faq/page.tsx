import type { Metadata } from "next";
import Link from "next/link";

import { Container, Section } from "@/components/layout/container";
import { Breadcrumbs } from "@/components/shared/breadcrumbs";
import { JsonLd } from "@/components/shared/json-ld";

export const metadata: Metadata = {
  title: "FAQ",
  description: "Orders, Routine Plans, the routine finder and our ingredients, answered.",
  alternates: { canonical: "/faq" },
};

const FAQ: { group: string; items: { q: string; a: string }[] }[] = [
  {
    group: "Orders & shipping",
    items: [
      {
        q: "How much is shipping?",
        a: "Standard shipping is free on orders over $50. Below that, a flat rate is shown at checkout before you pay.",
      },
      {
        q: "Can I return an opened product?",
        a: "Yes. You have 30 days, even if it's opened. If something irritates your skin, stop using it and contact us.",
      },
    ],
  },
  {
    group: "Routine Plans",
    items: [
      {
        q: "How does subscribing work?",
        a: "Choose “Subscribe & save” on a product. You get a discount on every delivery and can skip, swap, pause or cancel online before the next charge.",
      },
      {
        q: "Can I subscribe to a ready-made routine?",
        a: "Routines are one-time purchases. To get them regularly, subscribe to each product: they ship together in one plan.",
      },
    ],
  },
  {
    group: "The routine finder",
    items: [
      {
        q: "Is the finder medical advice?",
        a: "No. It recommends cosmetic products based on your answers and our ingredient database. For medical skin conditions, see a dermatologist.",
      },
      {
        q: "How does it avoid bad combinations?",
        a: "Every recommendation is checked against our ingredient conflict rules, your skin type, sensitivities and pregnancy status before you see it.",
      },
    ],
  },
  {
    group: "Ingredients",
    items: [
      {
        q: "Why do you show concentrations?",
        a: "Because the percentage is what tells you whether an active can work. Every key active lists its concentration on the product page.",
      },
      {
        q: "Are your products fragrance-free?",
        a: "Most are. Use the “Fragrance-free” filter in the shop to see them all.",
      },
    ],
  },
];

/** FAQ (docs/15 P17) with FAQPage JSON-LD. */
export default function FaqPage() {
  return (
    <Section className="pt-8 lg:pt-12">
      <Container className="flex max-w-3xl flex-col gap-10">
        <Breadcrumbs
          items={[
            { label: "Home", href: "/" },
            { label: "FAQ", href: "/faq" },
          ]}
        />
        <header className="flex flex-col gap-3">
          <h1 className="font-display text-display-xl font-light">Questions, answered</h1>
          <p className="text-body-lg text-muted-foreground">
            Can&apos;t find yours? Email{" "}
            <Link
              href="mailto:hello@nuraskin.app"
              className="text-link underline underline-offset-4"
            >
              hello@nuraskin.app
            </Link>
            .
          </p>
        </header>
        {FAQ.map((group) => (
          <section key={group.group} className="flex flex-col gap-3">
            <h2 className="font-display text-heading-xl font-normal">{group.group}</h2>
            <div className="flex flex-col divide-y divide-border border-y border-border">
              {group.items.map((item) => (
                <details key={item.q} className="group">
                  <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 py-3 text-heading-sm font-semibold [&::-webkit-details-marker]:hidden">
                    {item.q}
                    <span
                      aria-hidden
                      className="text-muted-foreground transition-transform group-open:rotate-45"
                    >
                      +
                    </span>
                  </summary>
                  <p className="pb-4 text-body text-muted-foreground">{item.a}</p>
                </details>
              ))}
            </div>
          </section>
        ))}
        <JsonLd
          data={{
            "@context": "https://schema.org",
            "@type": "FAQPage",
            mainEntity: FAQ.flatMap((g) =>
              g.items.map((i) => ({
                "@type": "Question",
                name: i.q,
                acceptedAnswer: { "@type": "Answer", text: i.a },
              })),
            ),
          }}
        />
      </Container>
    </Section>
  );
}
