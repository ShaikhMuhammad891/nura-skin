/** Step 1: answers → SkinProfile (docs/12 §4.1). Pure and deterministic. */
import type { Answers, SkinType } from "../questionnaire";

import type { SkinProfile } from "./types";

const CONCERN_WEIGHTS = [1, 0.7, 0.5] as const;

/** Decision table for "Not sure" skin type (12 §2, step 1a). */
export function inferSkinType(helper: NonNullable<Answers["skin-type-helper"]>): SkinType {
  const { afterCleansing, cheekShine } = helper;
  if (afterCleansing === "tight") return cheekShine === "often" ? "COMBINATION" : "DRY";
  if (afterCleansing === "shiny_all") return "OILY";
  if (afterCleansing === "shiny_tzone") return "COMBINATION";
  return cheekShine === "often" ? "OILY" : cheekShine === "sometimes" ? "COMBINATION" : "NORMAL";
}

const URL_RE = /\b(?:https?:\/\/|www\.)\S+/gi;
const EMAIL_RE = /[\w.+-]+@[\w-]+\.[\w.-]+/g;
const PHONE_RE = /\+?\d[\d\s().-]{7,}\d/g;
const CONTROL_RE = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;

/** Scrubs PII and links from free text before it is stored for the LLM (12 §3, 18 §8). */
export function sanitizeNotes(text: string | undefined | null): string | null {
  if (!text) return null;
  const cleaned = text
    .replace(CONTROL_RE, " ")
    .replace(URL_RE, "[link removed]")
    .replace(EMAIL_RE, "[email removed]")
    .replace(PHONE_RE, "[number removed]")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 500);
  return cleaned.length ? cleaned : null;
}

export class IncompleteAnswersError extends Error {
  constructor(readonly missing: string[]) {
    super(`Missing required answers: ${missing.join(", ")}`);
    this.name = "IncompleteAnswersError";
  }
}

export function normalizeAnswers(answers: Answers): SkinProfile {
  const skinTypeAnswer = answers["skin-type"]?.skinType;
  const concerns = answers.concerns?.ranked;
  const sensitivity = answers.sensitivity?.level;
  const budget = answers.budget?.monthlyCents;
  const missing = [
    !skinTypeAnswer && "skin-type",
    skinTypeAnswer === "UNSURE" && !answers["skin-type-helper"] && "skin-type-helper",
    !concerns && "concerns",
    !sensitivity && "sensitivity",
    !budget && "budget",
  ].filter((x): x is string => Boolean(x));
  if (missing.length) throw new IncompleteAnswersError(missing);

  const skinType =
    skinTypeAnswer === "UNSURE"
      ? inferSkinType(answers["skin-type-helper"]!)
      : (skinTypeAnswer as SkinType);

  const reactionItems = answers.reactions?.items ?? [];
  const reactions = new Set(
    reactionItems.filter(
      (r): r is "fragrance" | "acids" | "retinoids" | "vitamin_c" | "essential_oils" =>
        r !== "none" && r !== "not_sure",
    ),
  );
  const conditionItems = answers.conditions?.sensitiveConsent
    ? (answers.conditions.items ?? [])
    : [];
  const conditions = new Set(
    conditionItems.filter((c): c is "rosacea" | "eczema" => c === "rosacea" || c === "eczema"),
  );
  const prefs = answers.preferences;
  const pregnancyOrNursing =
    conditionItems.some((c) => c === "pregnant" || c === "breastfeeding" || c === "trying") ||
    Boolean(prefs?.pregnancySafeOnly);

  // 12 §4.1 derived rule: sensitive profiles are kept fragrance-free.
  const fragranceFreeForced =
    sensitivity! >= 4 ||
    conditions.size > 0 ||
    reactions.has("fragrance") ||
    reactions.has("essential_oils");

  return {
    skinType,
    concerns: concerns!.map((slug, i) => ({ slug, weight: CONCERN_WEIGHTS[i] ?? 0.5 })),
    sensitivity: sensitivity as SkinProfile["sensitivity"],
    reactions,
    pregnancyOrNursing,
    conditions,
    prescriptionTopicals: conditionItems.includes("prescription"),
    currentActives: new Set(answers["current-routine"]?.actives ?? []),
    climate: answers.lifestyle?.climate ?? "temperate",
    sunExposure: answers.lifestyle?.sunExposure ?? "moderate",
    wearsMakeup: answers.lifestyle?.wearsMakeup ?? false,
    routineTime: answers["routine-time"]?.value ?? "standard",
    prefs: {
      fragranceFree: Boolean(prefs?.fragranceFree) || fragranceFreeForced,
      fragranceFreeForced: fragranceFreeForced && !prefs?.fragranceFree,
      vegan: Boolean(prefs?.vegan),
      tintedSpf: prefs?.tintedSpf ?? null,
      avoidIngredients: new Set(prefs?.avoid ?? []),
    },
    monthlyBudgetCents: budget!,
    notes: sanitizeNotes(answers.notes?.text),
  };
}
