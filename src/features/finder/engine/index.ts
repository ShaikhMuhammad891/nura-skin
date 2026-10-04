/**
 * Deterministic routine engine: steps 1–5 of docs/12 §4, plus templated explanations.
 * `recommendDeterministic` is the fallback answer and the LLM's starting draft.
 */
import type { Answers } from "../questionnaire";

import { buildTier, poolsBySlot } from "./assemble";
import { introductionPlan } from "./explain";
import { applyHardFilters } from "./filters";
import { normalizeAnswers } from "./normalize";
import { screenSafety } from "./safety";
import { scoreCandidate } from "./scoring";
import type { Candidate, DraftRoutine, KnowledgeBase, SkinProfile, Tier } from "./types";

export type EngineCatalog = { candidates: readonly Candidate[]; kb: KnowledgeBase };

const TIER_ORDER: Tier[] = ["ESSENTIAL", "COMPLETE", "ADVANCED"];
const DEFAULT_TIER: Record<SkinProfile["routineTime"], Tier> = {
  minimal: "ESSENTIAL",
  standard: "COMPLETE",
  enthusiast: "ADVANCED",
};

export function recommendDeterministic(
  input: Answers | SkinProfile,
  catalog: EngineCatalog,
): DraftRoutine {
  const profile = "skinType" in input ? input : normalizeAnswers(input);
  const { flags } = screenSafety(profile);
  const { eligible, excluded } = applyHardFilters(catalog.candidates, profile, catalog.kb);

  // Red flags: offer only the gentlest products alongside the dermatologist suggestion (12 §4.2).
  const gentleOnly = flags.includes("derm_referral") || flags.includes("crisis");
  const scored = eligible
    .filter((c) => !gentleOnly || c.strengthLevel === 1)
    .map((c) => scoreCandidate(c, profile, catalog.kb));
  const pools = poolsBySlot(scored);

  const tiers = {
    ESSENTIAL: buildTier("ESSENTIAL", pools, profile, catalog.kb),
    COMPLETE: buildTier("COMPLETE", pools, profile, catalog.kb),
    ADVANCED: buildTier("ADVANCED", pools, profile, catalog.kb),
  };

  let recommendedTier: Tier = gentleOnly ? "ESSENTIAL" : DEFAULT_TIER[profile.routineTime];
  while (recommendedTier !== "ESSENTIAL" && !tiers[recommendedTier].withinBudget) {
    recommendedTier = TIER_ORDER[TIER_ORDER.indexOf(recommendedTier) - 1]!;
  }

  const notices: string[] = [];
  if (profile.prefs.fragranceFreeForced)
    notices.push("We kept everything fragrance-free for your skin.");
  if (flags.includes("pregnancy"))
    notices.push("We've only included options suitable during pregnancy and breastfeeding.");
  if (flags.includes("prescription_retinoid")) {
    notices.push(
      "We've avoided retinoids and strong exfoliants so nothing doubles up with your prescription. Keep following your dermatologist's advice.",
    );
  }
  if (flags.includes("derm_referral")) {
    notices.push(
      "Some of what you described is best checked by a dermatologist. Here's a gentle routine in the meantime.",
    );
  }
  if (!tiers[recommendedTier].withinBudget) {
    notices.push("Even our simplest routine is a little over your budget. Here's the closest fit.");
  }

  return {
    profile,
    safetyFlags: flags,
    tiers,
    recommendedTier,
    excluded,
    introductionPlan: introductionPlan(tiers[recommendedTier].products, profile, catalog.kb),
    notices,
  };
}

export { applyHardFilters, normalizeAnswers, scoreCandidate, screenSafety };
export type { Candidate, DraftRoutine, KnowledgeBase, SkinProfile };
