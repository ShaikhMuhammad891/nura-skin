/**
 * Deterministic explanations: templated rationales (the fallback text and the phase-A
 * placeholder, 12 §4.8/§8), usage frequencies and the introduction plan (12 §4.5 step 6).
 */
import type { ConcernSlug, Frequency, KnowledgeBase, ScoredCandidate, SkinProfile } from "./types";

const lowerFirst = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);
const trimTo = (s: string, max: number) =>
  s.length <= max ? s : `${s.slice(0, max - 1).trimEnd()}…`;

export function joinWords(words: string[]): string {
  if (words.length <= 1) return words[0] ?? "";
  return `${words.slice(0, -1).join(", ")} and ${words.at(-1)}`;
}

export function concernPhrase(concerns: ConcernSlug[], kb: KnowledgeBase): string {
  return joinWords(concerns.map((c) => (kb.concernNames.get(c) ?? c).toLowerCase()));
}

const pct = (bp: number | null) => (bp == null ? null : `${Number((bp / 100).toFixed(2))}%`);

export function frequencyFor(
  candidate: ScoredCandidate,
  profile: SkinProfile,
  kb: KnowledgeBase,
): Frequency {
  const categories = candidate.keyActives.map((a) => kb.ingredients.get(a.slug)?.category);
  if (categories.includes("retinoid")) return profile.sensitivity <= 2 ? "3x_week" : "2x_week";
  const leaveOn = candidate.slot !== "CLEANSE";
  if (leaveOn && (categories.includes("exfoliant-bha") || categories.includes("exfoliant-aha"))) {
    return profile.sensitivity >= 4 ? "alternate_days" : "daily";
  }
  if (leaveOn && categories.includes("exfoliant-other") && profile.sensitivity >= 3)
    return "alternate_days";
  return "daily";
}

export const FREQUENCY_LABEL: Record<Frequency, string> = {
  daily: "Daily",
  alternate_days: "Every other day to start",
  "3x_week": "3× a week to start",
  "2x_week": "2× a week to start",
};

export function templateRationale(
  candidate: ScoredCandidate,
  profile: SkinProfile,
  kb: KnowledgeBase,
): string {
  const matched = candidate.matchedConcerns.filter((c) =>
    profile.concerns.some((p) => p.slug === c),
  );
  const concernText = matched.length ? concernPhrase(matched, kb) : null;

  if (candidate.slot === "PROTECT") {
    const mineral = candidate.keyActives.every(
      (a) => kb.ingredients.get(a.slug)?.category !== "uv-filter" || a.slug === "zinc-oxide",
    );
    const base = `Daily SPF is the single most effective step for ${concernText ?? "keeping skin healthy"}`;
    const detail = mineral ? " — gentle mineral zinc oxide protects without irritating." : ".";
    return trimTo(`${base}${detail}`, 400);
  }

  if (candidate.slot === "CLEANSE") {
    const soft =
      candidate.strengthLevel === 1
        ? "cleanses without stripping your barrier"
        : "clears pores while it cleanses";
    return trimTo(
      `${candidate.name} ${soft}${concernText ? `, a good first step for your ${concernText}` : ""}.`,
      400,
    );
  }

  // Treat / moisturize: lead with the key active that best matches the primary concern.
  const primary = matched[0] ?? profile.concerns[0]?.slug;
  const best =
    [...candidate.keyActives].sort((x, y) => {
      const ex = (primary && kb.evidence.get(x.slug)?.get(primary)?.evidence) || 0;
      const ey = (primary && kb.evidence.get(y.slug)?.get(primary)?.evidence) || 0;
      return ey - ex;
    })[0] ?? candidate.keyActives[0];
  const info = best ? kb.ingredients.get(best.slug) : undefined;
  if (!best || !info) return trimTo(`${candidate.name} suits your skin type and routine.`, 400);

  const dose = pct(best.bp);
  const lead = `${info.name}${dose ? ` at ${dose}` : ""} ${lowerFirst(info.description).replace(/\.$/, "")}.`;
  return trimTo(concernText ? `${lead} A direct match for your ${concernText}.` : lead, 400);
}

export function introductionPlan(
  products: readonly ScoredCandidate[],
  profile: SkinProfile,
  kb: KnowledgeBase,
): { weeks: string; instructions: string }[] {
  const actives = products
    .filter((p) => p.slot === "TREAT" || p.strengthLevel >= 2)
    .filter((p) => !p.keyActives.some((a) => profile.currentActives.has(a.slug)))
    .sort((a, b) => a.strengthLevel - b.strengthLevel);

  const patchTest = "Patch-test each new product on your jawline for 2–3 days first.";
  if (actives.length === 0) {
    return [{ weeks: "1+", instructions: `Start your full routine from day one. ${patchTest}` }];
  }

  const plan = [
    {
      weeks: "1–2",
      instructions: `Start with your cleanser, moisturizer and SPF, plus ${actives[0]!.name} (${FREQUENCY_LABEL[
        frequencyFor(actives[0]!, profile, kb)
      ].toLowerCase()}). ${patchTest}`,
    },
  ];
  actives.slice(1).forEach((p, i) => {
    const from = 3 + i * 2;
    plan.push({
      weeks: `${from}–${from + 1}`,
      instructions: `Add ${p.name} (${FREQUENCY_LABEL[frequencyFor(p, profile, kb)].toLowerCase()}) once your skin feels settled.`,
    });
  });
  const retinoid = actives.find((p) =>
    p.keyActives.some((a) => kb.ingredients.get(a.slug)?.category === "retinoid"),
  );
  plan.push({
    weeks: `${3 + (actives.length - 1) * 2}+`,
    instructions: retinoid
      ? `If there's no irritation, increase ${retinoid.name} gradually toward nightly. Always wear SPF.`
      : "Keep going consistently. Most results show after 6–8 weeks.",
  });
  return plan;
}
