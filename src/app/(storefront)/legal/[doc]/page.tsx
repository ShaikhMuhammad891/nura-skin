import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { Container, Section } from "@/components/layout/container";
import { Breadcrumbs } from "@/components/shared/breadcrumbs";
import { getLegalDoc, LEGAL_DOCS } from "@/features/marketing/legal";

export function generateStaticParams() {
  return LEGAL_DOCS.map((d) => ({ doc: d.slug }));
}

export async function generateMetadata({ params }: PageProps<"/legal/[doc]">): Promise<Metadata> {
  const doc = getLegalDoc((await params).doc);
  return doc ? { title: doc.title, alternates: { canonical: `/legal/${doc.slug}` } } : {};
}

/** Legal documents (docs/15 P21): long-form text with a table of contents. */
export default async function LegalPage({ params }: PageProps<"/legal/[doc]">) {
  const doc = getLegalDoc((await params).doc);
  if (!doc) notFound();
  const anchor = (heading: string) => heading.toLowerCase().replace(/[^a-z0-9]+/g, "-");

  return (
    <Section className="pt-8 lg:pt-12">
      <Container className="flex flex-col gap-8">
        <Breadcrumbs
          items={[
            { label: "Home", href: "/" },
            { label: doc.title, href: `/legal/${doc.slug}` },
          ]}
        />
        <div className="grid gap-10 lg:grid-cols-[220px_1fr]">
          <nav aria-label="On this page" className="lg:sticky lg:top-24 lg:self-start">
            <p className="mb-2 text-overline font-semibold text-muted-foreground uppercase">
              On this page
            </p>
            <ul className="flex flex-col gap-1 text-body-sm">
              {doc.sections.map((s) => (
                <li key={s.heading}>
                  <a href={`#${anchor(s.heading)}`} className="text-link hover:underline">
                    {s.heading}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
          <article className="flex max-w-[68ch] flex-col gap-8">
            <header className="flex flex-col gap-3">
              <h1 className="font-display text-display-xl font-light">{doc.title}</h1>
              <p className="text-caption text-muted-foreground">
                Last updated <time dateTime={doc.updated}>{doc.updated}</time>
              </p>
              <p className="text-body-lg text-muted-foreground">{doc.intro}</p>
            </header>
            {doc.sections.map((s) => (
              <section
                key={s.heading}
                id={anchor(s.heading)}
                className="flex scroll-mt-24 flex-col gap-3"
              >
                <h2 className="font-display text-heading-xl font-normal">{s.heading}</h2>
                {s.body.map((p) => (
                  <p key={p} className="text-body text-muted-foreground">
                    {p}
                  </p>
                ))}
              </section>
            ))}
          </article>
        </div>
      </Container>
    </Section>
  );
}
