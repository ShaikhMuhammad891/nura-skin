/**
 * Step 2: deterministic safety screen (docs/12 §4.2). The optional LLM classifier (M6) can only
 * ADD flags to this result, never remove them.
 */
import type { SafetyFlag, SkinProfile } from "./types";

/** Symptoms a cosmetic routine should not be the answer to → suggest a dermatologist. */
const RED_FLAG_PATTERNS: RegExp[] = [
  /\bbleed(?:s|ing)?\b/i,
  /\bmoles?\b.{0,30}\b(?:chang|grow|bigger|dark|itch)/i,
  /\b(?:chang|grow)\w*\b.{0,20}\bmoles?\b/i,
  /\binfect(?:ed|ion)s?\b/i,
  /\bpus\b|\boozing\b/i,
  /\b(?:severe|intense|a lot of)\s+(?:pain|burning|itch\w*)\b/i,
  /\bpainful\b/i,
  /\bswell(?:ing)?\b|\bswollen\b/i,
  /\ballergic reaction\b|\bhives\b/i,
  /\bopen (?:wound|sore)s?\b/i,
  /\bcyst(?:s|ic)?\b|\bnodul(?:e|es|ar)\b/i,
  /\bscarr(?:ing|ed)\b/i,
  /\bsudden(?:ly)?\b.{0,40}\b(?:rash|breakout|acne|spots?|redness)\b/i,
];

/** Crisis language: show support resources and no sales content (12 §4.2, §10). */
const CRISIS_PATTERNS: RegExp[] = [
  /\b(?:kill|hurt|harm)(?:ing)? my ?self\b/i,
  /\bsuicid\w*/i,
  /\bself[- ]harm\w*/i,
  /\bwant to die\b|\bend my life\b/i,
];

export type SafetyScreen = {
  flags: SafetyFlag[];
  redFlagMatches: string[];
};

export function screenSafety(profile: SkinProfile): SafetyScreen {
  const flags = new Set<SafetyFlag>();
  if (profile.pregnancyOrNursing) flags.add("pregnancy");
  if (profile.prescriptionTopicals) flags.add("prescription_retinoid");
  if (profile.conditions.size > 0) flags.add("sensitive_condition");

  const notes = profile.notes ?? "";
  const redFlagMatches = RED_FLAG_PATTERNS.flatMap((re) => {
    const m = re.exec(notes);
    return m ? [m[0]] : [];
  });
  if (redFlagMatches.length) flags.add("derm_referral");
  if (CRISIS_PATTERNS.some((re) => re.test(notes))) flags.add("crisis");

  return { flags: [...flags], redFlagMatches };
}
