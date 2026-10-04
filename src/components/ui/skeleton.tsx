import type * as React from "react";

import { cn } from "@/lib/utils";

/** Content-shaped loading placeholder (docs/15 §6). Pulse is disabled under reduced motion. */
export function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      aria-hidden
      className={cn(
        "animate-pulse rounded-sm bg-surface-alt motion-reduce:animate-none",
        className,
      )}
      {...props}
    />
  );
}
