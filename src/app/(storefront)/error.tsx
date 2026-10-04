"use client";

import { useEffect } from "react";

import { Container } from "@/components/layout/container";
import { Button } from "@/components/ui/button";

/** Segment error boundary (docs/15 ER3). Sentry reporting is wired in M9. */
export default function StorefrontError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <Container className="flex flex-col items-start gap-6 py-24">
      <h1 className="font-display text-display-lg font-light">Something went wrong on our side.</h1>
      <p className="max-w-prose text-body-lg text-muted-foreground">
        It&apos;s not you. Please try again. If it keeps happening, contact us and mention the
        reference below.
      </p>
      <div className="flex gap-3">
        <Button onClick={reset}>Try again</Button>
      </div>
      {error.digest ? (
        <p className="font-mono text-caption text-muted-foreground">Reference: {error.digest}</p>
      ) : null}
    </Container>
  );
}
