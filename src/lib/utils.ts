import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

import tokens from "@/styles/tokens.json";

/**
 * tailwind-merge must know our custom font-size scale (text-body, text-display-xl, …).
 * Otherwise it treats `text-body` as a colour and silently drops real colour classes such as
 * `text-accent-foreground` (a dark-mode contrast bug caught by the axe E2E check).
 */
const twMerge = extendTailwindMerge({
  extend: {
    theme: {
      text: Object.keys(tokens.text),
    },
  },
});

/** Merge conditional class names, resolving Tailwind conflicts (last wins). */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
