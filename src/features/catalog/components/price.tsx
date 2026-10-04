import { formatMoney } from "@/features/pricing/money";
import { cn } from "@/lib/utils";

/** Price (docs/13 §2.1 `price`): tabular numerals; a compare-at price is struck through. */
export function Price({
  cents,
  compareAtCents,
  from = false,
  className,
}: {
  cents: number;
  compareAtCents?: number | null;
  from?: boolean;
  className?: string;
}) {
  const onSale = compareAtCents != null && compareAtCents > cents;
  return (
    <span className={cn("tabular inline-flex items-baseline gap-2 font-semibold", className)}>
      <span>
        {from ? <span className="font-normal text-muted-foreground">From </span> : null}
        {formatMoney(cents)}
      </span>
      {onSale ? (
        <s className="text-body-sm font-normal text-muted-foreground">
          <span className="sr-only">Was </span>
          {formatMoney(compareAtCents)}
        </s>
      ) : null}
    </span>
  );
}
