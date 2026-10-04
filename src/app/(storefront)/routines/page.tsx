import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";

import { Container, Section } from "@/components/layout/container";
import { Breadcrumbs } from "@/components/shared/breadcrumbs";
import { Button } from "@/components/ui/button";
import { ProductGrid } from "@/features/catalog/components/product-card";
import { featuredRoutines } from "@/features/catalog/merchandising";
import { getCatalogue } from "@/features/catalog/server/queries";

/** Catalogue reads happen at request time (cached), never during `next build` (CI has no DB). */
export const instant = false;

export const metadata: Metadata = {
  title: "Skincare routines",
  description:
    "Complete routines where every step is compatible: barrier repair, clear skin, glow and renewal.",
  alternates: { canonical: "/routines" },
};

/** Routines index (docs/15 P6). */
export default async function RoutinesPage() {
  await connection();
  const catalogue = await getCatalogue();
  const routines = featuredRoutines(catalogue, 50);
  return (
    <Section className="pt-8 lg:pt-12">
      <Container className="flex flex-col gap-10">
        <Breadcrumbs
          items={[
            { label: "Home", href: "/" },
            { label: "Routines", href: "/routines" },
          ]}
        />
        <header className="flex max-w-prose flex-col gap-3">
          <h1 className="font-display text-display-xl font-light">Routines that work together</h1>
          <p className="text-body-lg text-muted-foreground">
            Each routine is checked for clashing actives and priced below its parts. Or let the
            finder build one around your skin.
          </p>
        </header>
        <ProductGrid products={routines} headingLevel="h2" priorityCount={4} />
        <div className="flex flex-col items-start gap-4 rounded-xl bg-accent-subtle p-8 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-col gap-1">
            <h2 className="font-display text-heading-xl font-normal">Or build yours</h2>
            <p className="text-body text-muted-foreground">
              Ten questions, three minutes, every step explained.
            </p>
          </div>
          <Button asChild variant="accent" size="lg">
            <Link href="/finder">Find my routine</Link>
          </Button>
        </div>
      </Container>
    </Section>
  );
}
