/**
 * Step 3: hard filters (docs/12 §4.3). In production the same predicates run in SQL for
 * efficiency (M6); this TypeScript implementation is the reference that the SQL is tested
 * against, and what the fallback path and unit tests use.
 * Order matters: each excluded product reports its FIRST failing reason ("what we left out").
 */
import type { Candidate, Excluded, ExclusionReason, KnowledgeBase, SkinProfile } from "./types";

const REACTION_INGREDIENTS: Record<string, (slug: string, kb: KnowledgeBase) => boolean> = {
  acids: (slug, kb) =>
    ["exfoliant-bha", "exfoliant-aha"].includes(kb.ingredients.get(slug)?.category ?? ""),
  retinoids: (slug, kb) => kb.ingredients.get(slug)?.category === "retinoid",
  vitamin_c: (slug) => slug === "ethyl-ascorbic-acid" || slug === "ascorbic-acid",
  fragrance: (slug, kb) => Boolean(kb.ingredients.get(slug)?.isFragrance),
  essential_oils: (slug, kb) => Boolean(kb.ingredients.get(slug)?.isFragrance),
};

/** Rosacea/eczema/high sensitivity: max strength 2 and no ingredient above irritancy 1 (12 §4.3 #9). */
function tooStrong(candidate: Candidate, profile: SkinProfile, kb: KnowledgeBase): boolean {
  const gentleOnly = profile.conditions.size > 0 || profile.sensitivity >= 4;
  if (!gentleOnly) return false;
  if (candidate.strengthLevel > 2) return true;
  return candidate.ingredients.some((slug) => (kb.ingredients.get(slug)?.irritancyLevel ?? 0) > 1);
}

function firstFailure(
  candidate: Candidate,
  profile: SkinProfile,
  kb: KnowledgeBase,
): { reason: ExclusionReason; detail?: string } | null {
  if (!candidate.variants.some((v) => v.available > 0)) return { reason: "out_of_stock" };
  if (!candidate.skinTypes.includes(profile.skinType)) return { reason: "skin_type" };

  if (profile.pregnancyOrNursing) {
    const unsafeActive = candidate.keyActives.find(
      (a) => kb.ingredients.get(a.slug)?.pregnancySafe !== true,
    );
    if (!candidate.pregnancySafe || unsafeActive) {
      return {
        reason: "pregnancy",
        detail: unsafeActive ? kb.ingredients.get(unsafeActive.slug)?.name : undefined,
      };
    }
  }

  if (profile.prescriptionTopicals) {
    const clash = candidate.ingredients.find((slug) =>
      ["retinoid", "exfoliant-bha", "exfoliant-aha"].includes(
        kb.ingredients.get(slug)?.category ?? "",
      ),
    );
    if (clash) return { reason: "prescription", detail: kb.ingredients.get(clash)?.name };
  }

  if (profile.prefs.fragranceFree && !candidate.fragranceFree) return { reason: "fragrance" };
  if (profile.prefs.vegan && !candidate.vegan) return { reason: "vegan" };

  const avoided = candidate.ingredients.find((slug) => profile.prefs.avoidIngredients.has(slug));
  if (avoided) return { reason: "avoid_list", detail: kb.ingredients.get(avoided)?.name };

  for (const reaction of profile.reactions) {
    const test = REACTION_INGREDIENTS[reaction];
    const hit = test ? candidate.ingredients.find((slug) => test(slug, kb)) : undefined;
    if (hit) return { reason: "reaction", detail: kb.ingredients.get(hit)?.name };
  }

  if (tooStrong(candidate, profile, kb)) return { reason: "too_strong_for_sensitivity" };
  if (candidate.slot === "PROTECT" && profile.prefs.tintedSpf === false && candidate.isTinted) {
    return { reason: "not_tinted_preference" };
  }
  return null;
}

export function applyHardFilters(
  candidates: readonly Candidate[],
  profile: SkinProfile,
  kb: KnowledgeBase,
): { eligible: Candidate[]; excluded: Excluded[] } {
  const eligible: Candidate[] = [];
  const excluded: Excluded[] = [];
  for (const candidate of candidates) {
    const failure = firstFailure(candidate, profile, kb);
    if (failure) excluded.push({ candidate, ...failure });
    else eligible.push(candidate);
  }
  return { eligible, excluded };
}

/** Customer-facing copy for "What we left out and why" (12 §4.5, 14 §3 voice). */
export function exclusionCopy(e: Excluded): string {
  const d = e.detail;
  switch (e.reason) {
    case "out_of_stock":
      return "Temporarily out of stock.";
    case "skin_type":
      return "Made for a different skin type.";
    case "pregnancy":
      return d
        ? `Contains ${d}, which we avoid during pregnancy and breastfeeding.`
        : "Not suitable during pregnancy.";
    case "prescription":
      return `Contains ${d}. We avoid doubling up with prescription skincare.`;
    case "fragrance":
      return "Contains fragrance, and we kept your routine fragrance-free.";
    case "vegan":
      return "Not vegan.";
    case "avoid_list":
      return `Contains ${d}, which you asked us to avoid.`;
    case "reaction":
      return `Contains ${d}, which has irritated your skin before.`;
    case "too_strong_for_sensitivity":
      return "Stronger than we'd suggest for sensitive skin right now.";
    case "not_tinted_preference":
      return "Tinted, and you prefer untinted sunscreen.";
  }
}
