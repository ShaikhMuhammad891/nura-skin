import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { Container, Section, SectionHeader } from "@/components/layout/container";
import { ThemeToggle } from "@/components/shared/theme-toggle";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";

export const metadata: Metadata = { title: "Component playground", robots: { index: false } };

// Full literal class strings: Tailwind only generates classes it can find verbatim in source.
const TYPE_SCALE = [
  ["display-2xl", "text-display-2xl font-display font-light"],
  ["display-xl", "text-display-xl font-display font-light"],
  ["display-lg", "text-display-lg font-display"],
  ["heading-xl", "text-heading-xl font-display"],
  ["heading-lg", "text-heading-lg font-semibold"],
  ["heading-md", "text-heading-md font-semibold"],
  ["body-lg", "text-body-lg"],
  ["body", "text-body"],
  ["body-sm", "text-body-sm"],
  ["caption", "text-caption"],
] as const;

const SWATCHES = [
  "bg-background",
  "bg-surface",
  "bg-surface-alt",
  "bg-primary",
  "bg-accent",
  "bg-accent-subtle",
  "bg-sage-subtle",
  "bg-dew-subtle",
  "bg-success-subtle",
  "bg-warning-subtle",
  "bg-danger-subtle",
  "bg-info-subtle",
] as const;

/** Design-system playground (docs/21 M0). Never available in production. */
export default function ComponentsPlayground() {
  if (process.env.NEXT_PUBLIC_APP_ENV === "production") notFound();

  return (
    <main className="flex-1">
      <Section>
        <Container className="flex flex-col gap-16">
          <div className="flex items-start justify-between gap-6">
            <SectionHeader eyebrow="Nura Dew" title="Design system playground" />
            <ThemeToggle />
          </div>

          <section aria-labelledby="type" className="flex flex-col gap-4">
            <h2 id="type" className="text-heading-lg font-semibold">
              Type scale
            </h2>
            {TYPE_SCALE.map(([token, classes]) => (
              <p key={token} className={classes}>
                <span className="mr-4 font-mono text-caption text-muted-foreground">{token}</span>
                Your routine, explained.
              </p>
            ))}
          </section>

          <section aria-labelledby="colour" className="flex flex-col gap-4">
            <h2 id="colour" className="text-heading-lg font-semibold">
              Semantic colours
            </h2>
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
              {SWATCHES.map((swatch) => (
                <li key={swatch} className="flex flex-col gap-2">
                  <span className={`h-16 rounded-md border border-border ${swatch}`} />
                  <span className="font-mono text-caption text-muted-foreground">{swatch}</span>
                </li>
              ))}
            </ul>
          </section>

          <section aria-labelledby="buttons" className="flex flex-col gap-4">
            <h2 id="buttons" className="text-heading-lg font-semibold">
              Buttons
            </h2>
            <div className="flex flex-wrap items-center gap-3">
              <Button>Add to cart</Button>
              <Button variant="accent">Find my routine</Button>
              <Button variant="secondary">Secondary</Button>
              <Button variant="ghost">Ghost</Button>
              <Button variant="link">Link</Button>
              <Button variant="destructive">Refund</Button>
              <Button loading>Saving</Button>
              <Button size="sm">Small</Button>
              <Button size="lg">Large</Button>
            </div>
          </section>

          <section aria-labelledby="badges" className="flex flex-col gap-4">
            <h2 id="badges" className="text-heading-lg font-semibold">
              Badges
            </h2>
            <div className="flex flex-wrap gap-2">
              <Badge>Neutral</Badge>
              <Badge variant="accent">Bestseller</Badge>
              <Badge variant="sage">Pregnancy-safe</Badge>
              <Badge variant="success">Paid</Badge>
              <Badge variant="warning">Low stock</Badge>
              <Badge variant="danger">Out of stock</Badge>
              <Badge variant="info">Processing</Badge>
              <Badge variant="outline">Draft</Badge>
            </div>
          </section>

          <section aria-labelledby="forms" className="grid gap-6 md:grid-cols-2">
            <h2 id="forms" className="sr-only">
              Forms and cards
            </h2>
            <Card>
              <CardHeader>
                <CardTitle>Form field</CardTitle>
                <CardDescription>Label, input, helper and error wiring.</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="you@example.com"
                    aria-describedby="email-help"
                  />
                  <p id="email-help" className="text-caption text-muted-foreground">
                    We&apos;ll send your routine here.
                  </p>
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="zip">ZIP code</Label>
                  <Input id="zip" aria-invalid aria-describedby="zip-error" defaultValue="ABC" />
                  <p id="zip-error" className="text-caption text-danger">
                    Enter a 5-digit US ZIP code.
                  </p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Loading skeleton</CardTitle>
                <CardDescription>Content-shaped placeholders.</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                <Skeleton className="aspect-4/5 w-40" />
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-4 w-20" />
              </CardContent>
            </Card>
          </section>
        </Container>
      </Section>
    </main>
  );
}
