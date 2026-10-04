import type { Metadata } from "next";
import Link from "next/link";

import { Container } from "@/components/layout/container";
import { MAIN_CONTENT_ID, SkipLink } from "@/components/layout/skip-link";
import { Logo } from "@/components/shared/logo";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Page not found" };

/** Global 404 (docs/15 ER1). Also used for admin concealment (non-staff see this). */
export default function NotFound() {
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
          <p className="text-overline font-semibold text-muted-foreground uppercase">404</p>
          <h1 className="font-display text-display-xl font-light">This page has wandered off.</h1>
          <p className="max-w-prose text-body-lg text-muted-foreground">
            The link may be old, or the page may have moved. Let&apos;s get you back on track.
          </p>
          <div className="flex flex-wrap gap-3">
            <Button asChild>
              <Link href="/">Go to the homepage</Link>
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
