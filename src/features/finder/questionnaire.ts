/**
 * Routine Finder questionnaire `q-2026.09` (docs/12 §2). Single source of truth for the step
 * UI and server validation: each step has an id, a Zod schema and a required flag.
 */
import { z } from "zod";

export const QUESTIONNAIRE_VERSION = "q-2026.09";

export const CONCERN_SLUGS = [
  "acne",
  "post-acne-marks",
  "dullness",
  "pigmentation",
  "redness",
  "dryness",
  "dehydration",
  "oiliness",
  "pores",
  "fine-lines",
  "texture",
  "sensitivity",
] as const;
export type ConcernSlug = (typeof CONCERN_SLUGS)[number];

export const SKIN_TYPES = ["DRY", "OILY", "COMBINATION", "NORMAL"] as const;
export type SkinType = (typeof SKIN_TYPES)[number];

const slug = z.string().regex(/^[a-z0-9-]{2,60}$/);

export const stepSchemas = {
  "skin-type": z.object({ skinType: z.enum([...SKIN_TYPES, "UNSURE"]) }).strict(),
  "skin-type-helper": z
    .object({
      afterCleansing: z.enum(["tight", "comfortable", "shiny_tzone", "shiny_all"]),
      cheekShine: z.enum(["never", "sometimes", "often"]),
    })
    .strict(),
  concerns: z
    .object({ ranked: z.array(z.enum(CONCERN_SLUGS)).min(1).max(3) })
    .strict()
    .refine((v) => new Set(v.ranked).size === v.ranked.length, {
      message: "Pick each concern once.",
    }),
  sensitivity: z.object({ level: z.number().int().min(1).max(5) }).strict(),
  reactions: z
    .object({
      items: z
        .array(
          z.enum([
            "fragrance",
            "acids",
            "retinoids",
            "vitamin_c",
            "essential_oils",
            "none",
            "not_sure",
          ]),
        )
        .max(7),
    })
    .strict(),
  conditions: z
    .object({
      items: z
        .array(
          z.enum([
            "pregnant",
            "breastfeeding",
            "trying",
            "rosacea",
            "eczema",
            "prescription",
            "none",
            "prefer_not",
          ]),
        )
        .max(8),
      /** Required when any health-adjacent condition is shared (NFR-PRIV, review R-15). */
      sensitiveConsent: z.boolean().default(false),
    })
    .strict()
    .refine((v) => v.sensitiveConsent || v.items.every((i) => i === "none" || i === "prefer_not"), {
      message: "Please confirm we may use this health information to tailor your routine.",
      path: ["sensitiveConsent"],
    }),
  "current-routine": z.object({ actives: z.array(slug).max(15) }).strict(),
  lifestyle: z
    .object({
      climate: z.enum(["humid", "dry", "temperate", "cold"]),
      sunExposure: z.enum(["low", "moderate", "high"]),
      wearsMakeup: z.boolean(),
    })
    .strict(),
  "routine-time": z.object({ value: z.enum(["minimal", "standard", "enthusiast"]) }).strict(),
  preferences: z
    .object({
      fragranceFree: z.boolean(),
      vegan: z.boolean(),
      tintedSpf: z.boolean().nullable(),
      avoid: z.array(slug).max(10),
      /** Neutral, non-stored alternative when health-data consent is declined (review R-15). */
      pregnancySafeOnly: z.boolean().default(false),
    })
    .strict(),
  budget: z
    .object({ monthlyCents: z.number().int().min(3000).max(20000).multipleOf(500) })
    .strict(),
  notes: z.object({ text: z.string().max(500) }).strict(),
} as const;

export type StepId = keyof typeof stepSchemas;
export type StepAnswer<S extends StepId> = z.infer<(typeof stepSchemas)[S]>;
export type Answers = { [S in StepId]?: StepAnswer<S> };

export const STEP_ORDER: StepId[] = [
  "skin-type",
  "skin-type-helper",
  "concerns",
  "sensitivity",
  "reactions",
  "conditions",
  "current-routine",
  "lifestyle",
  "routine-time",
  "preferences",
  "budget",
  "notes",
];

export const REQUIRED_STEPS: StepId[] = [
  "skin-type",
  "concerns",
  "sensitivity",
  "reactions",
  "conditions",
  "routine-time",
  "budget",
];

/** The helper step is only shown (and required) when the user is unsure of their skin type. */
export function missingRequiredSteps(answers: Answers): StepId[] {
  const missing = REQUIRED_STEPS.filter((s) => answers[s] === undefined);
  if (answers["skin-type"]?.skinType === "UNSURE" && !answers["skin-type-helper"])
    missing.push("skin-type-helper");
  return missing;
}

export function nextStep(current: StepId, answers: Answers): StepId | null {
  const index = STEP_ORDER.indexOf(current);
  for (const step of STEP_ORDER.slice(index + 1)) {
    if (step === "skin-type-helper" && answers["skin-type"]?.skinType !== "UNSURE") continue;
    return step;
  }
  return null;
}
