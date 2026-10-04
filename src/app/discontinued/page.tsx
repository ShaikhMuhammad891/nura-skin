import type { Metadata } from "next";
import Link from "next/link";

import { Container } from "@/components/layout/container";
import { MAIN_CONTENT_ID, SkipLink } from "@/components/layout/skip-link";
import { Logo } from "@/components/shared/logo";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Product discontinued",
  robots: { index: false, follow: true },
};

/**
 * ER2 (docs/15 §8): the proxy rewrites retired product and routine URLs here with a 410 status
 * (ADR-0020). It lives outside the storefront layout and stays fully static, like the global 404:
 * only a static rewrite target keeps the proxy's status (a streaming page always answers 200).
 */
export default function DiscontinuedPage() {
  return (
    <>
      <SkipLink />
      <header className="border-b border-border">
        <Container className="flex h-15 items-center lg:h-18">
          <Link href="/" aria-label="Nura Skin home" className="rounded-sm">
            <Logo />
          </Link>
        </Container>
      </header>
      <main id={MAIN_CONTENT_ID} tabIndex={-1} className="flex flex-1 items-center outline-none">
        <Container className="flex flex-col items-start gap-6 py-24">
          <p className="text-overline font-semibold text-muted-foreground uppercase">
            Discontinued
          </p>
          <h1 className="font-display text-display-xl font-light">
            This product has been discontinued.
          </h1>
          <p className="max-w-prose text-body-lg text-muted-foreground">
            We retire formulas when we have something better. Browse the current range, or let the
            finder build a routine around your skin.
          </p>
          <div className="flex flex-wrap gap-3">
            <Button asChild variant="accent">
              <Link href="/finder">Find my routine</Link>
            </Button>
            <Button asChild variant="secondary">
              <Link href="/shop">Browse the shop</Link>
            </Button>
          </div>
        </Container>
      </main>
    </>
  );
}
