import { Star } from "lucide-react";

import { cn } from "@/lib/utils";

/** Read-only star rating with an accessible text equivalent. Hidden when there are no reviews. */
export function Rating({
  value,
  count,
  className,
  showCount = true,
}: {
  value: number;
  count: number;
  className?: string;
  showCount?: boolean;
}) {
  if (count <= 0) return null;
  const rounded = Math.round(value * 2) / 2;
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-body-sm", className)}>
      <span aria-hidden className="inline-flex">
        {[1, 2, 3, 4, 5].map((i) => (
          <Star
            key={i}
            className={cn(
              "size-3.5",
              i <= rounded ? "fill-foreground text-foreground" : "text-border-strong",
            )}
          />
        ))}
      </span>
      <span className="sr-only">
        Rated {value.toFixed(1)} out of 5 from {count} {count === 1 ? "review" : "reviews"}
      </span>
      {showCount ? (
        <span aria-hidden className="tabular text-muted-foreground">
          {value.toFixed(1)} ({count})
        </span>
      ) : null}
    </span>
  );
}
