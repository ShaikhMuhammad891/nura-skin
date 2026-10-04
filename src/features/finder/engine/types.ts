/** Routine engine types (docs/12 §4). Shared by the rules engine, the LLM adapter and the UI DTOs. */
import type { ConcernSlug, SkinType } from "../questionnaire";

export type { ConcernSlug, SkinType };
export type Slot = "CLEANSE" | "TREAT" | "MOISTURIZE" | "PROTECT";
export type Time = "AM" | "PM";
export type TimeOfDay = Time | "BOTH";
export type Tier = "ESSENTIAL" | "COMPLETE" | "ADVANCED";
export type Frequency = "daily" | "alternate_days" | "3x_week" | "2x_week";

export type SkinProfile = {
  skinType: SkinType;
  concerns: { slug: ConcernSlug; weight: number }[];
  sensitivity: 1 | 2 | 3 | 4 | 5;
  reactions: ReadonlySet<"fragrance" | "acids" | "retinoids" | "vitamin_c" | "essential_oils">;
  pregnancyOrNursing: boolean;
  conditions: ReadonlySet<"rosacea" | "eczema">;
  prescriptionTopicals: boolean;
  currentActives: ReadonlySet<string>;
  climate: "humid" | "dry" | "temperate" | "cold";
  sunExposure: "low" | "moderate" | "high";
  wearsMakeup: boolean;
  routineTime: "minimal" | "standard" | "enthusiast";
  prefs: {
    fragranceFree: boolean;
    /** true = the engine forced it (sensitivity/conditions); shown to the user as a notice. */
    fragranceFreeForced: boolean;
    vegan: boolean;
    tintedSpf: boolean | null;
    avoidIngredients: ReadonlySet<string>;
  };
  monthlyBudgetCents: number;
  notes: string | null;
};

export type IngredientInfo = {
  slug: string;
  name: string;
  category: string;
  pregnancySafe: boolean | null;
  isFragrance: boolean;
  isAnimalDerived: boolean;
  irritancyLevel: number;
  description: string;
};

export type Conflict = {
  a: string;
  b: string;
  severity: "avoid_same_routine" | "avoid_same_day" | "caution";
  reason: string;
};

export type KnowledgeBase = {
  ingredients: ReadonlyMap<string, IngredientInfo>;
  conflicts: readonly Conflict[];
  /** ingredient slug → concern → evidence (1–3) and minimum effective dose (bp). */
  evidence: ReadonlyMap<
    string,
    ReadonlyMap<ConcernSlug, { evidence: number; minEffectiveBp: number | null }>
  >;
  concernNames: ReadonlyMap<ConcernSlug, string>;
};

export type CandidateVariant = {
  id: string;
  sku: string;
  name: string;
  priceCents: number;
  replenishDays: number;
  available: number;
};

/** A single (non-bundle) published product as the engine sees it (built by SQL in prod, fixtures in tests). */
export type Candidate = {
  productId: string;
  slug: string;
  name: string;
  slot: Slot;
  timeOfDay: TimeOfDay;
  skinTypes: readonly SkinType[];
  textures: readonly string[];
  pregnancySafe: boolean;
  fragranceFree: boolean;
  vegan: boolean;
  strengthLevel: number;
  ratingAvg: number;
  ratingCount: number;
  usage: string;
  isTinted: boolean;
  /** Every ingredient slug in the formula. */
  ingredients: readonly string[];
  keyActives: readonly { slug: string; bp: number | null }[];
  concerns: Partial<Record<ConcernSlug, number>>;
  /** The default variant (or cheapest in stock); shade products need a user choice. */
  variant: CandidateVariant;
  variants: readonly CandidateVariant[];
};

export type ExclusionReason =
  | "out_of_stock"
  | "skin_type"
  | "pregnancy"
  | "prescription"
  | "fragrance"
  | "vegan"
  | "avoid_list"
  | "reaction"
  | "too_strong_for_sensitivity"
  | "not_tinted_preference";

export type Excluded = { candidate: Candidate; reason: ExclusionReason; detail?: string };

export type SafetyFlag =
  "pregnancy" | "prescription_retinoid" | "sensitive_condition" | "derm_referral" | "crisis";

export type ScoredCandidate = Candidate & {
  score: number;
  matchedConcerns: ConcernSlug[];
  monthlyCostCents: number;
};

export type RoutineStepDraft = {
  time: Time;
  slot: Slot;
  order: number;
  candidate: ScoredCandidate;
  frequency: Frequency;
  requiresVariantChoice: boolean;
  rationale: string;
  usage: string;
  matchedConcerns: ConcernSlug[];
};

export type TierDraft = {
  tier: Tier;
  am: RoutineStepDraft[];
  pm: RoutineStepDraft[];
  products: ScoredCandidate[];
  monthlyCostCents: number;
  totalCents: number;
  withinBudget: boolean;
  cautions: string[];
};

export type DraftRoutine = {
  profile: SkinProfile;
  safetyFlags: SafetyFlag[];
  tiers: Record<Tier, TierDraft>;
  recommendedTier: Tier;
  excluded: Excluded[];
  introductionPlan: { weeks: string; instructions: string }[];
  notices: string[];
};
