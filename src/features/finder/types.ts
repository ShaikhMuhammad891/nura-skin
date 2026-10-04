/**
 * Finder DTOs (docs/09 §11 ConsultationDTO / RoutineResultDTO). Plain and serializable: they cross
 * the server → client boundary and are rebuilt from the persisted rows on every view.
 */
import type { Answers, StepId } from "./questionnaire";

export type Tier = "ESSENTIAL" | "COMPLETE" | "ADVANCED";
export type Slot = "CLEANSE" | "TREAT" | "MOISTURIZE" | "PROTECT";

export type ConsultationDTO = {
  id: string;
  status: "IN_PROGRESS" | "COMPLETED" | "ABANDONED";
  answers: Answers;
  lastStep: StepId | null;
};

export type RoutineStepDTO = {
  id: string;
  time: "AM" | "PM";
  slot: Slot;
  order: number;
  product: {
    slug: string;
    name: string;
    subtitle: string | null;
    categorySlug: string;
    image: { publicId: string; width: number; height: number; alt: string } | null;
  };
  variantId: string | null;
  variantName: string | null;
  priceCents: number;
  frequency: string;
  rationale: string;
  usage: string;
  matchedConcerns: string[];
  requiresVariantChoice: boolean;
};

export type RoutineTierDTO = {
  tier: Tier;
  title: string;
  summary: string;
  isRecommended: boolean;
  totalCents: number;
  monthlyCostCents: number;
  withinBudget: boolean;
  cautions: string[];
  introductionPlan: { weeks: string; instructions: string }[];
  am: RoutineStepDTO[];
  pm: RoutineStepDTO[];
  /** Distinct products (a cleanser used AM and PM appears once). */
  products: { variantId: string | null; slug: string; name: string; priceCents: number }[];
};

export type RoutineResultDTO = {
  consultationId: string;
  completedAt: string;
  engine: "LLM" | "RULES_FALLBACK";
  recommendedTier: Tier;
  notices: string[];
  safetyFlags: string[];
  profileSummary: { skinType: string; concerns: string[]; monthlyBudgetCents: number };
  tiers: RoutineTierDTO[];
  excluded: { slug: string; name: string; reason: string }[];
  /** Routine discount for buying every step from this consultation (pricing engine). */
  routineDiscountBp: number;
};
