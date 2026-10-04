/**
 * Phase-A selection: the static structured-output schema (`finder-output.v2`) and its validator
 * (docs/12 §4.6–4.7, §6.2; ADR-0005/0012). The model never sees product IDs. It picks
 * `candidateIndex` 0–7 from per-slot lists built here, and every pick is re-checked before
 * any user sees it. Any failure → the deterministic draft (the fallback).
 */
import { z } from "zod";

import { BUDGET_TOLERANCE, TIER_TEMPLATES } from "./assemble";
import { fitsDay, fitsRoutine } from "./compatibility";
import { applyHardFilters } from "./filters";
import type { DraftRoutine, KnowledgeBase, ScoredCandidate, Slot, Tier, Time } from "./types";

export const MAX_CANDIDATES_PER_SLOT = 8;
export const SLOT_KEYS = [
  "AM_CLEANSE",
  "AM_TREAT",
  "AM_MOISTURIZE",
  "AM_PROTECT",
  "PM_CLEANSE",
  "PM_TREAT",
  "PM_MOISTURIZE",
] as const;
export type SlotKey = (typeof SLOT_KEYS)[number];

const TIERS = ["ESSENTIAL", "COMPLETE", "ADVANCED"] as const;

/** Phase A of `finder-output.v2`: identical for every request, so grammar/prompt caches stay warm. */
export const selectionSchema = z
  .object({
    recommendedTier: z.enum(TIERS),
    selections: z
      .array(
        z
          .object({
            tier: z.enum(TIERS),
            slotKey: z.enum(SLOT_KEYS),
            candidateIndex: z
              .number()
              .int()
              .min(0)
              .max(MAX_CANDIDATES_PER_SLOT - 1),
            decision: z.enum(["kept", "swapped"]),
            swapReasonCode: z
              .enum([
                "notes_texture",
                "notes_sensitivity",
                "notes_preference",
                "concern_priority",
                "budget",
                "simplicity",
              ])
              .nullable(),
          })
          .strict(),
      )
      .max(21),
  })
  .strict();
export type Selection = z.infer<typeof selectionSchema>;

export type CandidateLists = Partial<Record<SlotKey, ScoredCandidate[]>>;

const splitKey = (key: SlotKey) => key.split("_") as [Time, Slot];

/**
 * Per-slot candidate lists shown to the model. The draft's choices come first (index 0 is
 * always the draft pick), then the best other eligible candidates for that slot and time.
 */
export function buildCandidateLists(
  draft: DraftRoutine,
  eligible: readonly ScoredCandidate[],
): CandidateLists {
  const lists: CandidateLists = {};
  for (const key of SLOT_KEYS) {
    const [time, slot] = splitKey(key);
    const draftPicks = TIERS.map(
      (t) => draft.tiers[t][time === "AM" ? "am" : "pm"].find((s) => s.slot === slot)?.candidate,
    ).filter((c): c is ScoredCandidate => Boolean(c));
    const others = eligible
      .filter((c) => c.slot === slot && (c.timeOfDay === "BOTH" || c.timeOfDay === time))
      .sort((a, b) => b.score - a.score);
    const unique = new Map<string, ScoredCandidate>();
    for (const c of [...draftPicks, ...others])
      if (!unique.has(c.productId)) unique.set(c.productId, c);
    const list = [...unique.values()].slice(0, MAX_CANDIDATES_PER_SLOT);
    if (list.length) lists[key] = list;
  }
  return lists;
}

export type ResolvedTier = {
  tier: Tier;
  picks: Partial<Record<SlotKey, ScoredCandidate>>;
  monthlyCostCents: number;
};

export type SelectionResult =
  | { ok: true; recommendedTier: Tier; tiers: Record<Tier, ResolvedTier>; swaps: number }
  | {
      ok: false;
      reason: "schema" | "unknown_id" | "structure" | "conflict" | "safety" | "budget";
      detail: string;
    };

const fail = (
  reason: Extract<SelectionResult, { ok: false }>["reason"],
  detail: string,
): SelectionResult => ({
  ok: false,
  reason,
  detail,
});

export function validateSelection(
  raw: unknown,
  draft: DraftRoutine,
  lists: CandidateLists,
  kb: KnowledgeBase,
): SelectionResult {
  const parsed = selectionSchema.safeParse(raw);
  if (!parsed.success) return fail("schema", parsed.error.issues.map((i) => i.message).join("; "));
  const selection = parsed.data;

  const tiers = {} as Record<Tier, ResolvedTier>;
  let swaps = 0;

  for (const tier of TIERS) {
    const draftTier = draft.tiers[tier];
    const expected = new Set<SlotKey>([
      ...draftTier.am.map((s) => `AM_${s.slot}` as SlotKey),
      ...draftTier.pm.map((s) => `PM_${s.slot}` as SlotKey),
    ]);
    const mine = selection.selections.filter((s) => s.tier === tier);
    const got = new Set(mine.map((s) => s.slotKey));
    if (
      mine.length !== got.size ||
      got.size !== expected.size ||
      [...expected].some((k) => !got.has(k))
    ) {
      return fail(
        "structure",
        `${tier}: expected slots ${[...expected].join(",")}, got ${[...got].join(",")}`,
      );
    }

    const picks: ResolvedTier["picks"] = {};
    for (const s of mine) {
      const candidate = lists[s.slotKey]?.[s.candidateIndex];
      if (!candidate)
        return fail("unknown_id", `${tier} ${s.slotKey}: index ${s.candidateIndex} out of range`);
      picks[s.slotKey] = candidate;
      const draftStep = (s.slotKey.startsWith("AM") ? draftTier.am : draftTier.pm).find(
        (d) => `${d.time}_${d.slot}` === s.slotKey,
      );
      if (draftStep && draftStep.candidate.productId !== candidate.productId) swaps += 1;
    }

    for (const time of ["AM", "PM"] as const) {
      const routine = Object.entries(picks)
        .filter(([k]) => k.startsWith(time))
        .map(([, c]) => c!);
      for (const [i, c] of routine.entries()) {
        if (c.timeOfDay !== "BOTH" && c.timeOfDay !== time)
          return fail("structure", `${c.slug} is not for ${time}`);
        if (!fitsRoutine(c, routine.slice(i + 1), kb))
          return fail("conflict", `${tier} ${time}: ${c.slug}`);
      }
    }
    const products = [...new Map(Object.values(picks).map((c) => [c!.productId, c!])).values()];
    for (const [i, c] of products.entries()) {
      if (!fitsDay(c, products.slice(i + 1), kb))
        return fail("conflict", `${tier}: ${c.slug} (same day)`);
    }

    // Defence in depth: every pick must still pass the profile's hard filters.
    const { excluded } = applyHardFilters(products, draft.profile, kb);
    if (excluded.length)
      return fail("safety", `${excluded[0]!.candidate.slug}: ${excluded[0]!.reason}`);

    tiers[tier] = {
      tier,
      picks,
      monthlyCostCents: products.reduce((s, c) => s + c.monthlyCostCents, 0),
    };
  }

  const recommended = tiers[selection.recommendedTier];
  if (recommended.monthlyCostCents > draft.profile.monthlyBudgetCents * BUDGET_TOLERANCE) {
    return fail(
      "budget",
      `${selection.recommendedTier} costs ${recommended.monthlyCostCents}/month`,
    );
  }
  return { ok: true, recommendedTier: selection.recommendedTier, tiers, swaps };
}

/** The draft expressed as a selection: what "the model kept everything" looks like. */
export function draftAsSelection(draft: DraftRoutine, lists: CandidateLists): Selection {
  const selections: Selection["selections"] = [];
  for (const tier of TIERS) {
    for (const step of [...draft.tiers[tier].am, ...draft.tiers[tier].pm]) {
      const slotKey = `${step.time}_${step.slot}` as SlotKey;
      const candidateIndex =
        lists[slotKey]?.findIndex((c) => c.productId === step.candidate.productId) ?? -1;
      selections.push({ tier, slotKey, candidateIndex, decision: "kept", swapReasonCode: null });
    }
  }
  return { recommendedTier: draft.recommendedTier, selections };
}

export { TIER_TEMPLATES };
