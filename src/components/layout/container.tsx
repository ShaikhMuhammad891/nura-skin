import type * as React from "react";

import { cn } from "@/lib/utils";

/** Page container: max 1320px, gutters 16/24/40px (docs/13 §3). */
export function Container({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div className={cn("mx-auto w-full max-w-page px-4 sm:px-6 lg:px-10", className)} {...props} />
  );
}

/** Vertical section rhythm (docs/13 §3). */
export function Section({ className, ...props }: React.ComponentProps<"section">) {
  return <section className={cn("py-16 lg:py-24", className)} {...props} />;
}

export function SectionHeader({
  eyebrow,
  title,
  description,
  className,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  className?: string;
}) {
  return (
    <div className={cn("flex max-w-prose flex-col gap-3", className)}>
      {eyebrow ? (
        <p className="text-overline font-semibold text-muted-foreground uppercase">{eyebrow}</p>
      ) : null}
      <h2 className="font-display text-display-lg font-normal">{title}</h2>
      {description ? <p className="text-body-lg text-muted-foreground">{description}</p> : null}
    </div>
  );
}
