/** Ingredient compatibility between routine products (docs/12 §4.5, step 2). */
import type { Candidate, Conflict, KnowledgeBase } from "./types";

export type PairConflict = Conflict & { products: [string, string] };

export function conflictsBetween(x: Candidate, y: Candidate, kb: KnowledgeBase): PairConflict[] {
  if (x.productId === y.productId) return [];
  const xs = new Set(x.keyActives.map((a) => a.slug));
  const ys = new Set(y.keyActives.map((a) => a.slug));
  return kb.conflicts
    .filter((c) => (xs.has(c.a) && ys.has(c.b)) || (xs.has(c.b) && ys.has(c.a)))
    .map((c) => ({ ...c, products: [x.slug, y.slug] }));
}

/** Can `candidate` join a routine (same time of day) that already contains `routine`? */
export function fitsRoutine(
  candidate: Candidate,
  routine: readonly Candidate[],
  kb: KnowledgeBase,
): boolean {
  return routine.every((existing) =>
    conflictsBetween(candidate, existing, kb).every((c) => c.severity === "caution"),
  );
}

/** Can `candidate` join a tier (whole day) given everything already chosen in it? */
export function fitsDay(
  candidate: Candidate,
  tierProducts: readonly Candidate[],
  kb: KnowledgeBase,
): boolean {
  return tierProducts.every((existing) =>
    conflictsBetween(candidate, existing, kb).every((c) => c.severity !== "avoid_same_day"),
  );
}
