import tokens from "@/styles/tokens.json";

/** Motion tokens for Framer Motion (docs/13 §8). Durations in seconds. */
const d = tokens.motion.duration;

export const duration = {
  instant: d.instant / 1000,
  fast: d.fast / 1000,
  base: d.base / 1000,
  slow: d.slow / 1000,
} as const;

export const ease = {
  standard: tokens.motion.ease.standard as [number, number, number, number],
  emphasized: tokens.motion.ease.emphasized as [number, number, number, number],
} as const;

export const spring = {
  soft: { type: "spring", ...tokens.motion.spring.soft },
} as const;
