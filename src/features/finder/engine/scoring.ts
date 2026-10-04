/** Step 4: rule scorer, 0–100 per candidate (docs/12 §4.4). */
import type {
  Candidate,
  ConcernSlug,
  KnowledgeBase,
  ScoredCandidate,
  SkinProfile,
  Slot,
} from "./types";

const WEIGHTS = {
  concern: 45,
  skinType: 15,
  sensitivity: 15,
  texture: 10,
  price: 10,
  social: 5,
} as const;
const DUPLICATION_PENALTY = 10;

/** Share of the monthly budget each slot "deserves" when judging price fit. */
export const SLOT_BUDGET_SHARE: Record<Slot, number> = {
  CLEANSE: 0.2,
  TREAT: 0.35,
  MOISTURIZE: 0.25,
  PROTECT: 0.2,
};

const ALLOWED_STRENGTH: Record<SkinProfile["sensitivity"], number> = {
  1: 3,
  2: 3,
  3: 2,
  4: 1,
  5: 1,
};

const LIGHT = new Set(["gel", "gel-cream", "fluid", "serum"]);
const RICH = new Set(["cream", "rich", "balm"]);

export function monthlyCostCents(priceCents: number, replenishDays: number): number {
  return Math.round((priceCents * 30) / replenishDays);
}

function concernFit(
  candidate: Candidate,
  profile: SkinProfile,
  kb: KnowledgeBase,
): { fit: number; matched: ConcernSlug[] } {
  const totalWeight = profile.concerns.reduce((s, c) => s + c.weight, 0);
  let weighted = 0;
  const matched: ConcernSlug[] = [];
  for (const { slug, weight } of profile.concerns) {
    const productEfficacy = (candidate.concerns[slug] ?? 0) / 3;
    let bestActive = 0;
    for (const active of candidate.keyActives) {
      const ev = kb.evidence.get(active.slug)?.get(slug);
      if (!ev) continue;
      const doseOk =
        ev.minEffectiveBp == null
          ? 1
          : active.bp == null
            ? 0.75
            : active.bp >= ev.minEffectiveBp
              ? 1
              : 0.5;
      bestActive = Math.max(bestActive, (ev.evidence / 3) * doseOk);
    }
    const fit = Math.max(productEfficacy, bestActive);
    if (fit >= 2 / 3) matched.push(slug);
    weighted += weight * fit;
  }
  return { fit: totalWeight ? weighted / totalWeight : 0, matched };
}

function textureFit(candidate: Candidate, profile: SkinProfile): number {
  const wantsLight = profile.skinType === "OILY" || profile.climate === "humid";
  const wantsRich = profile.skinType === "DRY" || profile.climate === "cold";
  const light = candidate.textures.some((t) => LIGHT.has(t));
  const rich = candidate.textures.some((t) => RICH.has(t));
  if (wantsLight && !wantsRich) return light ? 1 : rich ? 0.2 : 0.5;
  if (wantsRich && !wantsLight) return rich ? 1 : light ? 0.4 : 0.5;
  return 0.7;
}

export function scoreCandidate(
  candidate: Candidate,
  profile: SkinProfile,
  kb: KnowledgeBase,
): ScoredCandidate {
  const { fit, matched } = concernFit(candidate, profile, kb);
  const skinTypeFit = candidate.skinTypes.length >= 4 ? 0.6 : 1;
  const sensitivityFit = Math.max(
    0,
    1 - Math.max(0, candidate.strengthLevel - ALLOWED_STRENGTH[profile.sensitivity]) * 0.5,
  );
  const monthly = monthlyCostCents(candidate.variant.priceCents, candidate.variant.replenishDays);
  const slotBudget = profile.monthlyBudgetCents * SLOT_BUDGET_SHARE[candidate.slot];
  const priceFit = 1 - Math.min(1, Math.max(0, (monthly - slotBudget) / slotBudget));
  const social = (candidate.ratingAvg / 5) * Math.min(1, candidate.ratingCount / 50);
  const duplicates = candidate.keyActives.some((a) => profile.currentActives.has(a.slug));

  const raw =
    WEIGHTS.concern * fit +
    WEIGHTS.skinType * skinTypeFit +
    WEIGHTS.sensitivity * sensitivityFit +
    WEIGHTS.texture * textureFit(candidate, profile) +
    WEIGHTS.price * priceFit +
    WEIGHTS.social * social -
    (duplicates ? DUPLICATION_PENALTY : 0);

  return {
    ...candidate,
    score: Math.round(Math.min(100, Math.max(0, raw))),
    matchedConcerns: matched,
    monthlyCostCents: monthly,
  };
}
