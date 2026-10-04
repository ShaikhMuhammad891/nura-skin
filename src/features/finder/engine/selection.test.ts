import { describe, expect, it } from "vitest";

import type { Answers } from "../questionnaire";

import { applyHardFilters } from "./filters";
import { recommendDeterministic } from "./index";
import { scoreCandidate } from "./scoring";
import {
  buildCandidateLists,
  draftAsSelection,
  validateSelection,
  type Selection,
} from "./selection";
import { buildSeedCatalog } from "./testing/seed-catalog";

const catalog = buildSeedCatalog();

function setup(patch: Partial<Answers> = {}) {
  const answers: Answers = {
    "skin-type": { skinType: "NORMAL" },
    concerns: { ranked: ["fine-lines", "dullness"] },
    sensitivity: { level: 2 },
    reactions: { items: ["none"] },
    conditions: { items: ["none"], sensitiveConsent: false },
    "routine-time": { value: "standard" },
    budget: { monthlyCents: 20000 },
    ...patch,
  };
  const draft = recommendDeterministic(answers, catalog);
  const eligible = applyHardFilters(catalog.candidates, draft.profile, catalog.kb).eligible.map(
    (c) => scoreCandidate(c, draft.profile, catalog.kb),
  );
  const lists = buildCandidateLists(draft, eligible);
  return { draft, lists, selection: draftAsSelection(draft, lists) };
}

const clone = (s: Selection): Selection => structuredClone(s);

describe("buildCandidateLists", () => {
  it("puts the draft pick first and never exceeds 8 per slot", () => {
    const { draft, lists } = setup();
    const amTreat = draft.tiers.COMPLETE.am.find((s) => s.slot === "TREAT")!;
    expect(lists.AM_TREAT?.map((c) => c.productId)).toContain(amTreat.candidate.productId);
    for (const list of Object.values(lists)) expect(list!.length).toBeLessThanOrEqual(8);
    // Only AM-appropriate products may appear in AM lists.
    for (const c of lists.AM_TREAT ?? [])
      expect(c.timeOfDay === "AM" || c.timeOfDay === "BOTH").toBe(true);
  });
});

describe("validateSelection", () => {
  it("accepts the draft itself (the model kept everything)", () => {
    const { draft, lists, selection } = setup();
    const result = validateSelection(selection, draft, lists, catalog.kb);
    expect(result).toMatchObject({ ok: true, swaps: 0 });
  });

  it("rejects schema violations (e.g. an index outside 0–7)", () => {
    const { draft, lists, selection } = setup();
    const bad = clone(selection);
    bad.selections[0]!.candidateIndex = 12;
    expect(validateSelection(bad, draft, lists, catalog.kb)).toMatchObject({
      ok: false,
      reason: "schema",
    });
  });

  it("rejects an index past the end of a short list (unknown product)", () => {
    const { draft, lists, selection } = setup();
    const bad = clone(selection);
    const target = bad.selections.find((s) => (lists[s.slotKey]?.length ?? 0) < 8)!;
    target.candidateIndex = lists[target.slotKey]!.length;
    expect(validateSelection(bad, draft, lists, catalog.kb)).toMatchObject({
      ok: false,
      reason: "unknown_id",
    });
  });

  it("rejects missing or extra slots", () => {
    const { draft, lists, selection } = setup();
    const missingSpf = {
      ...selection,
      selections: selection.selections.filter(
        (s) => !(s.tier === "ESSENTIAL" && s.slotKey === "AM_PROTECT"),
      ),
    };
    expect(validateSelection(missingSpf, draft, lists, catalog.kb)).toMatchObject({
      ok: false,
      reason: "structure",
    });
  });

  it("rejects a swap that creates an ingredient conflict (vitamin C + retinal in one PM routine)", () => {
    const { draft, lists, selection } = setup({
      "routine-time": { value: "enthusiast" },
      concerns: { ranked: ["fine-lines", "dullness", "texture"] },
    });
    const bad = clone(selection);
    // Force the PM treatment to retinal and the PM cleanser to salicylic (avoid_same_routine).
    const pmTreat = bad.selections.find((s) => s.tier === "ADVANCED" && s.slotKey === "PM_TREAT")!;
    pmTreat.candidateIndex = lists.PM_TREAT!.findIndex((c) => c.slug === "renew-night-serum");
    const pmCleanse = bad.selections.find(
      (s) => s.tier === "ADVANCED" && s.slotKey === "PM_CLEANSE",
    )!;
    const bhaIndex = lists.PM_CLEANSE!.findIndex((c) => c.slug === "clarify-gel-cleanser");
    expect(bhaIndex).toBeGreaterThanOrEqual(0);
    pmCleanse.candidateIndex = bhaIndex;
    pmCleanse.decision = "swapped";
    expect(validateSelection(bad, draft, lists, catalog.kb)).toMatchObject({
      ok: false,
      reason: "conflict",
    });
  });

  it("rejects a recommended tier far over budget", () => {
    const { draft, lists, selection } = setup({ budget: { monthlyCents: 3000 } });
    const bad = { ...clone(selection), recommendedTier: "ADVANCED" as const };
    expect(validateSelection(bad, draft, lists, catalog.kb)).toMatchObject({
      ok: false,
      reason: "budget",
    });
  });
});
