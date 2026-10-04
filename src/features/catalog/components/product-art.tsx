import { cn } from "@/lib/utils";

import type { SlotKey } from "../types";

/**
 * Illustrated packshot (4:5) used until the photographed packshots land in Cloudinary
 * (docs/17 IMG-PROD-*). Vessel shape follows the routine step, tint follows the category, so the
 * grid still reads at a glance. Pure SVG + tokens: themes with light/dark, zero bytes of imagery.
 */
const TINTS: Record<string, { bg: string; fg: string }> = {
  cleansers: { bg: "bg-dew-subtle", fg: "text-dew-foreground" },
  serums: { bg: "bg-accent-subtle", fg: "text-accent" },
  moisturizers: { bg: "bg-sage-subtle", fg: "text-sage-foreground" },
  sunscreens: { bg: "bg-warning-subtle", fg: "text-warning" },
};
const DEFAULT_TINT = { bg: "bg-surface-alt", fg: "text-muted-foreground" };

function Vessel({ slot, x = 0, scale = 1 }: { slot: SlotKey | null; x?: number; scale?: number }) {
  const t = `translate(${x} 0) translate(100 250) scale(${scale}) translate(-100 -250)`;
  switch (slot) {
    case "CLEANSE":
      return (
        <g transform={t}>
          <rect x="70" y="100" width="60" height="120" rx="16" className="fill-current" />
          <rect x="88" y="80" width="24" height="22" rx="3" className="fill-current opacity-80" />
          <path d="M84 66h32v14H84z M108 66h26v8h-26z" className="fill-current opacity-70" />
          <rect
            x="78"
            y="140"
            width="44"
            height="34"
            rx="4"
            className="fill-background opacity-80"
          />
        </g>
      );
    case "TREAT":
      return (
        <g transform={t}>
          <ellipse cx="100" cy="82" rx="13" ry="22" className="fill-current opacity-70" />
          <rect x="85" y="100" width="30" height="24" rx="4" className="fill-current opacity-85" />
          <rect x="72" y="122" width="56" height="98" rx="14" className="fill-current" />
          <rect
            x="80"
            y="152"
            width="40"
            height="34"
            rx="4"
            className="fill-background opacity-80"
          />
        </g>
      );
    case "MOISTURIZE":
      return (
        <g transform={t}>
          <rect x="54" y="130" width="92" height="26" rx="7" className="fill-current opacity-75" />
          <rect x="48" y="154" width="104" height="66" rx="16" className="fill-current" />
          <rect
            x="70"
            y="172"
            width="60"
            height="28"
            rx="4"
            className="fill-background opacity-80"
          />
        </g>
      );
    case "PROTECT":
      return (
        <g transform={t}>
          <path d="M66 70h68l-10 120H76z" className="fill-current" />
          <rect x="64" y="62" width="72" height="12" rx="2" className="fill-current opacity-70" />
          <rect x="80" y="188" width="40" height="32" rx="5" className="fill-current opacity-80" />
          <rect
            x="80"
            y="104"
            width="40"
            height="40"
            rx="4"
            className="fill-background opacity-80"
          />
        </g>
      );
    default:
      return null;
  }
}

export function ProductArt({
  slot,
  categorySlug,
  type = "SINGLE",
  className,
}: {
  slot: SlotKey | null;
  categorySlug: string;
  type?: "SINGLE" | "BUNDLE";
  className?: string;
}) {
  const tint = TINTS[categorySlug] ?? DEFAULT_TINT;
  return (
    <div
      aria-hidden
      className={cn("relative aspect-[4/5] w-full overflow-hidden rounded-lg", tint.bg, className)}
    >
      <svg viewBox="0 0 200 250" className={cn("size-full", tint.fg)}>
        <circle cx="100" cy="150" r="78" className="fill-background opacity-40" />
        {type === "BUNDLE" ? (
          <g className="text-foreground/70">
            <Vessel slot="CLEANSE" x={-66} scale={0.5} />
            <Vessel slot="TREAT" x={-22} scale={0.56} />
            <Vessel slot="MOISTURIZE" x={26} scale={0.46} />
            <Vessel slot="PROTECT" x={68} scale={0.5} />
          </g>
        ) : (
          <Vessel slot={slot} />
        )}
        <ellipse cx="100" cy="224" rx="62" ry="5" className="fill-foreground opacity-10" />
      </svg>
    </div>
  );
}
