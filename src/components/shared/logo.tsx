import { cn } from "@/lib/utils";

/**
 * Typographic wordmark: "nura" in the display face with the dew-drop mark (docs/14 §4).
 * Interim until the hand-drawn vector logo (LOGO-WORDMARK, asset inventory §9) replaces it;
 * the component API stays the same.
 */
export function Logo({
  className,
  withTagline = false,
}: {
  className?: string;
  withTagline?: boolean;
}) {
  return (
    <span className={cn("inline-flex flex-col leading-none", className)}>
      <span className="relative inline-flex items-start font-display text-[1.75rem] font-normal tracking-[0.02em] text-foreground">
        nura
        <DewDrop className="-mt-0.5 ml-0.5 size-2.5 text-accent" />
      </span>
      {withTagline ? (
        <span className="mt-1 text-overline font-semibold text-muted-foreground uppercase">
          Skin
        </span>
      ) : null}
    </span>
  );
}

export function DewDrop({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 10 14" aria-hidden className={className} fill="currentColor">
      <path d="M5 0C5 0 0 6.2 0 9.1A5 5 0 0 0 10 9.1C10 6.2 5 0 5 0Z" />
    </svg>
  );
}
