/**
 * Step 5: deterministic tier assembly (docs/12 §4.5). Produces a complete, valid routine per
 * tier. This is both the LLM's starting draft and the fallback answer.
 */
import { fitsDay, fitsRoutine } from "./compatibility";
import { frequencyFor, templateRationale } from "./explain";
import type {
  KnowledgeBase,
  RoutineStepDraft,
  ScoredCandidate,
  SkinProfile,
  Slot,
  Tier,
  TierDraft,
  Time,
} from "./types";

export const TIER_TEMPLATES: Record<Tier, { am: Slot[]; pm: Slot[] }> = {
  ESSENTIAL: { am: ["CLEANSE", "PROTECT"], pm: ["CLEANSE", "MOISTURIZE"] },
  COMPLETE: {
    am: ["CLEANSE", "TREAT", "MOISTURIZE", "PROTECT"],
    pm: ["CLEANSE", "TREAT", "MOISTURIZE"],
  },
  ADVANCED: {
    am: ["CLEANSE", "TREAT", "MOISTURIZE", "PROTECT"],
    pm: ["CLEANSE", "TREAT", "MOISTURIZE"],
  },
};

/** Budget tolerance: a tier counts as within budget up to +15% (12 §4.7). */
export const BUDGET_TOLERANCE = 1.15;

const allowedAt = (c: ScoredCandidate, time: Time) =>
  c.timeOfDay === "BOTH" || c.timeOfDay === time;

type Pools = Record<Slot, ScoredCandidate[]>;

export function poolsBySlot(candidates: readonly ScoredCandidate[]): Pools {
  const pools: Pools = { CLEANSE: [], TREAT: [], MOISTURIZE: [], PROTECT: [] };
  for (const c of candidates) pools[c.slot].push(c);
  for (const slot of Object.keys(pools) as Slot[]) {
    pools[slot].sort(
      (a, b) =>
        b.score - a.score ||
        a.variant.priceCents - b.variant.priceCents ||
        a.slug.localeCompare(b.slug),
    );
  }
  return pools;
}

type Choice = Partial<Record<`${Time}_${Slot}`, ScoredCandidate>>;

class TierBuilder {
  readonly choice: Choice = {};
  constructor(
    readonly tier: Tier,
    readonly pools: Pools,
    readonly profile: SkinProfile,
    readonly kb: KnowledgeBase,
  ) {}

  routine(time: Time): ScoredCandidate[] {
    return Object.entries(this.choice)
      .filter(([key]) => key.startsWith(time))
      .map(([, c]) => c!);
  }

  products(): ScoredCandidate[] {
    const seen = new Map<string, ScoredCandidate>();
    for (const c of Object.values(this.choice)) if (c) seen.set(c.productId, c);
    return [...seen.values()];
  }

  canUse(c: ScoredCandidate, time: Time, replacing?: ScoredCandidate): boolean {
    if (!allowedAt(c, time)) return false;
    const others = (list: ScoredCandidate[]) =>
      list.filter((x) => x.productId !== replacing?.productId);
    return (
      fitsRoutine(c, others(this.routine(time)), this.kb) &&
      fitsDay(c, others(this.products()), this.kb)
    );
  }

  best(
    slot: Slot,
    time: Time,
    bonus: (c: ScoredCandidate) => number = () => 0,
    exclude: string[] = [],
  ) {
    return [...this.pools[slot]]
      .filter((c) => !exclude.includes(c.productId) && this.canUse(c, time))
      .sort((a, b) => b.score + bonus(b) - (a.score + bonus(a)))[0];
  }

  set(time: Time, slot: Slot, c: ScoredCandidate | undefined) {
    if (c) this.choice[`${time}_${slot}`] = c;
  }
}

/**
 * Selection priority: the treatment addresses the user's concerns, so it is chosen first and
 * the supporting steps adapt around it (e.g. a BHA cleanser must not block retinal at night).
 * Steps are still presented in application order (TIER_TEMPLATES).
 */
const SELECTION_ORDER: Slot[] = ["TREAT", "PROTECT", "MOISTURIZE", "CLEANSE"];
const inSelectionOrder = (slots: Slot[]) => SELECTION_ORDER.filter((s) => slots.includes(s));

export function buildTier(
  tier: Tier,
  pools: Pools,
  profile: SkinProfile,
  kb: KnowledgeBase,
): TierDraft {
  // An explicit tinted-SPF preference is decisive whenever a tinted option is eligible.
  const tinted = pools.PROTECT.filter((c) => c.isTinted);
  const effectivePools: Pools =
    profile.prefs.tintedSpf === true && tinted.length ? { ...pools, PROTECT: tinted } : pools;

  const b = new TierBuilder(tier, effectivePools, profile, kb);
  const template = TIER_TEMPLATES[tier];
  const advanced = tier === "ADVANCED";

  // ── AM ────────────────────────────────────────────────────────────────────
  for (const slot of inSelectionOrder(template.am)) b.set("AM", slot, b.best(slot, "AM"));

  // ── PM ────────────────────────────────────────────────────────────────────
  for (const slot of inSelectionOrder(template.pm)) {
    const am = b.choice[`AM_${slot}`];
    if (slot === "CLEANSE") {
      const balm =
        advanced && profile.wearsMakeup
          ? b.best("CLEANSE", "PM", (c) => (c.textures.includes("balm") ? 30 : 0))
          : undefined;
      const reuse = am && b.canUse(am, "PM") ? am : undefined;
      b.set(
        "PM",
        slot,
        balm?.textures.includes("balm") ? balm : (reuse ?? b.best("CLEANSE", "PM")),
      );
      continue;
    }
    if (slot === "TREAT") {
      const exclude = advanced && am ? [am.productId] : [];
      const alternative = b.best("TREAT", "PM", () => 0, exclude);
      const reuse = am && !advanced && b.canUse(am, "PM") ? am : undefined;
      // Reuse the AM treatment unless a meaningfully better PM-appropriate one exists.
      const pick =
        reuse && (!alternative || alternative.score <= reuse.score + 5) ? reuse : alternative;
      if (!advanced || (pick && pick.score >= 40)) b.set("PM", slot, pick);
      continue;
    }
    if (slot === "MOISTURIZE") {
      const night = b.best("MOISTURIZE", "PM", (c) => (advanced && c.timeOfDay === "PM" ? 8 : 0));
      const reuse = am && b.canUse(am, "PM") ? am : undefined;
      b.set("PM", slot, advanced ? (night ?? reuse) : (reuse ?? night));
    }
  }

  fitBudget(b);
  return toDraft(b);
}

/** Greedy cheaper swaps (never removing cleanser or SPF) until the tier fits the budget. */
function fitBudget(b: TierBuilder) {
  const limit = b.profile.monthlyBudgetCents;
  const cost = () => b.products().reduce((s, c) => s + c.monthlyCostCents, 0);
  const priority: Slot[] = ["MOISTURIZE", "TREAT", "CLEANSE", "PROTECT"];

  for (let guard = 0; guard < 12 && cost() > limit; guard++) {
    let swapped = false;
    for (const slot of priority) {
      const keys = (["AM", "PM"] as Time[])
        .map((t) => `${t}_${slot}` as const)
        .filter((k) => b.choice[k]);
      for (const key of keys) {
        const current = b.choice[key]!;
        const time = key.slice(0, 2) as Time;
        const cheaper = b.pools[slot]
          .filter(
            (c) => c.monthlyCostCents < current.monthlyCostCents && c.score >= current.score - 15,
          )
          .find((c) => b.canUse(c, time, current));
        if (cheaper) {
          b.choice[key] = cheaper;
          swapped = true;
          break;
        }
      }
      if (swapped) break;
    }
    if (!swapped) {
      // Drop a distinct PM treatment before giving up (keeps cleanser + SPF + moisturizer).
      const pmTreat = b.choice.PM_TREAT;
      if (pmTreat && pmTreat.productId !== b.choice.AM_TREAT?.productId) delete b.choice.PM_TREAT;
      else break;
    }
  }
}

function toDraft(b: TierBuilder): TierDraft {
  const { profile, kb } = b;
  const cautions: string[] = [];

  const steps = (time: Time): RoutineStepDraft[] =>
    TIER_TEMPLATES[b.tier][time === "AM" ? "am" : "pm"]
      .map((slot) => ({ slot, c: b.choice[`${time}_${slot}`] }))
      .filter((s): s is { slot: Slot; c: ScoredCandidate } => Boolean(s.c))
      .map(({ slot, c }, i) => {
        let frequency = frequencyFor(c, profile, kb);
        // "caution" pairs in the same routine: slow down the later one (12 §4.5 step 2).
        const earlier = TIER_TEMPLATES[b.tier][time === "AM" ? "am" : "pm"]
          .slice(0, i)
          .map((s) => b.choice[`${time}_${s}`])
          .filter((x): x is ScoredCandidate => Boolean(x));
        const caution = kb.conflicts.find(
          (cf) =>
            cf.severity === "caution" &&
            earlier.some((e) => {
              const es = new Set(e.keyActives.map((a) => a.slug));
              const cs = new Set(c.keyActives.map((a) => a.slug));
              return (es.has(cf.a) && cs.has(cf.b)) || (es.has(cf.b) && cs.has(cf.a));
            }),
        );
        if (caution) {
          if (frequency === "daily") frequency = "alternate_days";
          cautions.push(caution.reason);
        }
        return {
          time,
          slot,
          order: i + 1,
          candidate: c,
          frequency,
          requiresVariantChoice: c.isTinted && c.variants.filter((v) => v.available > 0).length > 1,
          rationale: templateRationale(c, profile, kb),
          usage: c.usage,
          matchedConcerns: c.matchedConcerns,
        };
      });

  const products = b.products();
  const monthlyCostCents = products.reduce((s, c) => s + c.monthlyCostCents, 0);
  return {
    tier: b.tier,
    am: steps("AM"),
    pm: steps("PM"),
    products,
    monthlyCostCents,
    totalCents: products.reduce((s, c) => s + c.variant.priceCents, 0),
    withinBudget: monthlyCostCents <= profile.monthlyBudgetCents * BUDGET_TOLERANCE,
    cautions: [...new Set(cautions)],
  };
}
