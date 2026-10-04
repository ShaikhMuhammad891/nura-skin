import type * as React from "react";

import { cn } from "@/lib/utils";

/** Text input (docs/13 §6.2). 16px text prevents iOS zoom; 44px height meets touch targets. */
export function Input({ className, type = "text", ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "flex h-11 w-full rounded-sm border border-border-strong bg-surface px-3 text-body text-foreground",
        "placeholder:text-subtle-foreground",
        "focus-visible:border-foreground focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring",
        "disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-danger",
        "file:border-0 file:bg-transparent file:text-body-sm file:font-medium",
        className,
      )}
      {...props}
    />
  );
}
