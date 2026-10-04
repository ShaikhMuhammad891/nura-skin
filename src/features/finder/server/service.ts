import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import { AppError } from "@/lib/errors";
import { inTransaction, type DbClient } from "@/lib/server/db-types";

import { recommendDeterministic, type DraftRoutine, type EngineCatalog } from "../engine";
import { FREQUENCY_LABEL, introductionPlan } from "../engine/explain";
import { exclusionCopy } from "../engine/filters";
import type { RoutineStepDraft, SkinProfile, TierDraft } from "../engine/types";
import {
  missingRequiredSteps,
  nextStep,
  QUESTIONNAIRE_VERSION,
  STEP_ORDER,
  stepSchemas,
  type Answers,
  type StepId,
} from "../questionnaire";
import type {
  ConsultationDTO,
  RoutineResultDTO,
  RoutineStepDTO,
  RoutineTierDTO,
  Tier,
} from "../types";

import { loadEngineCatalog } from "./catalog-loader";

/**
 * Routine Finder consultations (docs/12 §3–§5, docs/09 §11). Phase A only: the deterministic engine
 * produces and persists all three tiers with templated rationales (`engine = RULES_FALLBACK`,
 * `fallbackReason = "llm_disabled"`). The Claude selection/explanation phases (12 §4.6) slot in
 * later without changing the stored shape. Completed consultations are never mutated; edits
 * create a child consultation (`revise`).
 */

/** Who may touch a consultation: the signed-in user, or the guest's signed anonymous id. */
export type ConsultationOwner = { userId: string | null; anonymousId: string | null };

const TIERS: Tier[] = ["ESSENTIAL", "COMPLETE", "ADVANCED"];
export const FALLBACK_REASON = "llm_disabled";

function ownsWhere(owner: ConsultationOwner): Prisma.RoutineConsultationWhereInput {
  const or: Prisma.RoutineConsultationWhereInput[] = [];
  if (owner.userId) or.push({ userId: owner.userId });
  if (owner.anonymousId) or.push({ anonymousId: owner.anonymousId, userId: null });
  return or.length ? { OR: or } : { id: "__nobody__" };
}

async function findOwned(db: DbClient, id: string, owner: ConsultationOwner) {
  const row = await db.routineConsultation.findFirst({ where: { id, ...ownsWhere(owner) } });
  if (!row) throw new AppError("NOT_FOUND", "We couldn't find that consultation.");
  return row;
}

function toConsultationDTO(row: {
  id: string;
  status: ConsultationDTO["status"];
  answers: Prisma.JsonValue;
  lastStep: string | null;
}): ConsultationDTO {
  return {
    id: row.id,
    status: row.status,
    answers: (row.answers ?? {}) as Answers,
    lastStep: (STEP_ORDER as string[]).includes(row.lastStep ?? "")
      ? (row.lastStep as StepId)
      : null,
  };
}

export async function startConsultation(
  db: DbClient,
  owner: ConsultationOwner,
  options: { source?: string; parentId?: string } = {},
): Promise<ConsultationDTO> {
  let answers: Prisma.InputJsonValue = {};
  if (options.parentId) {
    const parent = await findOwned(db, options.parentId, owner);
    answers = parent.answers as Prisma.InputJsonValue;
  }
  const row = await db.routineConsultation.create({
    data: {
      userId: owner.userId,
      anonymousId: owner.userId ? null : owner.anonymousId,
      questionnaireVersion: QUESTIONNAIRE_VERSION,
      source: options.source?.slice(0, 40) ?? null,
      parentId: options.parentId ?? null,
      answers,
    },
  });
  return toConsultationDTO(row);
}

export async function getConsultation(
  db: DbClient,
  id: string,
  owner: ConsultationOwner,
): Promise<ConsultationDTO> {
  return toConsultationDTO(await findOwned(db, id, owner));
}

/** Autosave one step (validated against its schema). Returns the next step to show. */
export async function saveAnswer(
  db: DbClient,
  id: string,
  owner: ConsultationOwner,
  stepId: StepId,
  answer: unknown,
): Promise<{ nextStepId: StepId | null; missingSteps: StepId[] }> {
  const schema = stepSchemas[stepId];
  if (!schema) throw new AppError("VALIDATION", "Unknown step.");
  const parsed = schema.safeParse(answer);
  if (!parsed.success) throw parsed.error;

  return inTransaction(db, async (tx) => {
    const row = await findOwned(tx, id, owner);
    if (row.status === "COMPLETED") {
      throw new AppError(
        "CONFLICT",
        "This consultation is finished. Edit your answers to start a new one.",
      );
    }
    const answers = { ...(row.answers as Answers), [stepId]: parsed.data } as Answers;
    // Changing skin type away from "unsure" makes the helper answer meaningless.
    if (stepId === "skin-type" && answers["skin-type"]?.skinType !== "UNSURE") {
      delete answers["skin-type-helper"];
    }
    await tx.routineConsultation.update({
      where: { id },
      data: { answers: answers as Prisma.InputJsonValue, lastStep: stepId },
    });
    return { nextStepId: nextStep(stepId, answers), missingSteps: missingRequiredSteps(answers) };
  });
}

// ── Recommendation ──────────────────────────────────────────────────────────

const SLOT_NAMES = {
  CLEANSE: "cleanse",
  TREAT: "treat",
  MOISTURIZE: "moisturize",
  PROTECT: "protect",
};
const TIER_TITLES: Record<Tier, string> = {
  ESSENTIAL: "The Essentials",
  COMPLETE: "The Complete Routine",
  ADVANCED: "The Advanced Routine",
};

const SKIN_LABEL: Record<string, string> = {
  DRY: "dry",
  OILY: "oily",
  COMBINATION: "combination",
  NORMAL: "normal",
};

export function tierSummary(
  tier: TierDraft,
  profile: SkinProfile,
  concernNames: ReadonlyMap<string, string>,
): string {
  const slots = [...new Set([...tier.am, ...tier.pm].map((s) => SLOT_NAMES[s.slot]))];
  const concerns = profile.concerns
    .slice(0, 2)
    .map((c) => (concernNames.get(c.slug) ?? c.slug).toLowerCase());
  const focus = concerns.length ? `, focused on ${concerns.join(" and ")}` : "";
  return `${distinctProducts(tier).length} products for ${SKIN_LABEL[profile.skinType] ?? "your"} skin${focus}: ${slots.join(", ")}.`;
}

function distinctProducts(tier: TierDraft) {
  const seen = new Map<string, RoutineStepDraft>();
  for (const s of [...tier.am, ...tier.pm])
    if (!seen.has(s.candidate.productId)) seen.set(s.candidate.productId, s);
  return [...seen.values()];
}

/** JSON-safe profile (Sets → arrays) for `RoutineConsultation.profile`. */
export function serializeProfile(p: SkinProfile): Prisma.InputJsonValue {
  return {
    ...p,
    reactions: [...p.reactions],
    conditions: [...p.conditions],
    currentActives: [...p.currentActives],
    prefs: { ...p.prefs, avoidIngredients: [...p.prefs.avoidIngredients] },
  } as unknown as Prisma.InputJsonValue;
}

/**
 * Writes the three tiers in four statements (recommendations, steps, consultation), not one
 * insert per row: the transaction stays short even far from the database.
 */
async function persistDraft(
  tx: DbClient,
  id: string,
  draft: DraftRoutine,
  catalog: EngineCatalog,
  latencyMs: number,
): Promise<void> {
  const names = catalog.kb.concernNames as ReadonlyMap<string, string>;
  const excluded = draft.excluded.map((e) => ({
    slug: e.candidate.slug,
    name: e.candidate.name,
    reason: exclusionCopy(e),
  }));

  const recommendations = await tx.routineRecommendation.createManyAndReturn({
    data: TIERS.map((tier) => {
      const t = draft.tiers[tier];
      return {
        consultationId: id,
        tier,
        title: TIER_TITLES[tier],
        summary: tierSummary(t, draft.profile, names),
        // Stored as an object: the plan plus the tier's budget fit and cautions (UI-only facts).
        introductionPlan: {
          steps: introductionPlan(t.products, draft.profile, catalog.kb),
          monthlyCostCents: t.monthlyCostCents,
          withinBudget: t.withinBudget,
          cautions: t.cautions,
        },
        excludedProducts: excluded,
        totalCents: t.totalCents,
        isRecommended: tier === draft.recommendedTier,
      };
    }),
    select: { id: true, tier: true },
  });
  const recommendationId = new Map(recommendations.map((r) => [r.tier, r.id]));

  await tx.routineStep.createMany({
    data: TIERS.flatMap((tier) =>
      [...draft.tiers[tier].am, ...draft.tiers[tier].pm].map((s) => ({
        recommendationId: recommendationId.get(tier)!,
        timeOfDay: s.time,
        slot: s.slot,
        stepOrder: s.order,
        productId: s.candidate.productId,
        variantId: s.requiresVariantChoice ? null : s.candidate.variant.id,
        requiresVariantChoice: s.requiresVariantChoice,
        rationale: s.rationale,
        rationaleSource: "TEMPLATE" as const,
        usage: s.usage,
        frequency: s.frequency,
        matchedConcerns: s.matchedConcerns,
        score: Math.round(s.candidate.score),
      })),
    ),
  });

  await tx.routineConsultation.update({
    where: { id },
    data: {
      status: "COMPLETED",
      completedAt: new Date(),
      latencyMs,
      profile: serializeProfile(draft.profile),
      safetyFlags: draft.safetyFlags,
      engine: "RULES_FALLBACK",
      fallbackReason: FALLBACK_REASON,
      candidateSnapshot: {
        notices: draft.notices,
        recommendedTier: draft.recommendedTier,
        scores: Object.fromEntries(
          TIERS.flatMap((tier) =>
            draft.tiers[tier].products.map((p) => [p.slug, Math.round(p.score)]),
          ),
        ),
        excludedCount: draft.excluded.length,
      },
    },
  });
}

/**
 * Builds (once) and persists the routine. Idempotent: a completed consultation just returns.
 * `loadCatalog` is injectable so tests can run the engine against the seed fixture.
 */
export async function recommend(
  db: DbClient,
  id: string,
  owner: ConsultationOwner,
  loadCatalog: (db: DbClient) => Promise<EngineCatalog> = loadEngineCatalog,
): Promise<{ consultationId: string }> {
  const started = Date.now();
  const row = await findOwned(db, id, owner);
  if (row.status === "COMPLETED") return { consultationId: id };

  const answers = row.answers as Answers;
  const missing = missingRequiredSteps(answers);
  if (missing.length) {
    throw new AppError("VALIDATION", "A few questions still need an answer.", {
      details: { code: "INCOMPLETE", missingSteps: missing },
    });
  }

  const catalog = await loadCatalog(db);
  const draft = recommendDeterministic(answers, catalog);

  await inTransaction(db, async (tx) => {
    // Lock the row: two tabs racing to complete the same consultation serialize here, and the
    // second sees COMPLETED instead of violating the (consultation, tier) unique key.
    const [fresh] = await tx.$queryRaw<{ status: string }[]>`
      SELECT status::text AS status FROM routine_consultations WHERE id = ${id} FOR UPDATE`;
    if (!fresh || fresh.status === "COMPLETED") return;
    await persistDraft(tx, id, draft, catalog, Date.now() - started);
  });
  return { consultationId: id };
}

/** "Edit answers": a child consultation prefilled from the parent (completed ones are immutable). */
export async function reviseConsultation(db: DbClient, id: string, owner: ConsultationOwner) {
  return startConsultation(db, owner, { parentId: id, source: "revise" });
}

/** Attach a guest's consultations to the account at sign-in (`/auth/complete`). Idempotent. */
export async function claimGuestConsultations(
  db: DbClient,
  anonymousId: string,
  userId: string,
): Promise<number> {
  const { count } = await db.routineConsultation.updateMany({
    where: { anonymousId, userId: null },
    data: { userId, claimedAt: new Date() },
  });
  return count;
}

// ── Result view ─────────────────────────────────────────────────────────────

type IntroJson = {
  steps?: { weeks: string; instructions: string }[];
  monthlyCostCents?: number;
  withinBudget?: boolean;
  cautions?: string[];
};

export async function getResult(
  db: DbClient,
  id: string,
  owner: ConsultationOwner,
  routineDiscountBp: number,
): Promise<RoutineResultDTO> {
  const row = await db.routineConsultation.findFirst({
    where: { id, ...ownsWhere(owner) },
    include: {
      recommendations: {
        include: {
          steps: {
            orderBy: [{ timeOfDay: "asc" }, { stepOrder: "asc" }],
            include: {
              variant: { select: { id: true, name: true, priceCents: true } },
              product: {
                select: {
                  slug: true,
                  name: true,
                  subtitle: true,
                  category: { select: { slug: true } },
                  variants: {
                    where: { archivedAt: null },
                    orderBy: { position: "asc" },
                    take: 1,
                    select: { priceCents: true },
                  },
                  images: {
                    orderBy: { position: "asc" },
                    take: 1,
                    select: { publicId: true, width: true, height: true, alt: true },
                  },
                },
              },
            },
          },
        },
      },
    },
  });
  if (!row) throw new AppError("NOT_FOUND", "We couldn't find that consultation.");
  if (row.status !== "COMPLETED" || !row.completedAt) {
    throw new AppError("CONFLICT", "Your routine isn't ready yet.", {
      details: { code: "NOT_COMPLETED" },
    });
  }

  const concernIds =
    (row.profile as { concerns?: { slug: string }[] } | null)?.concerns?.map((c) => c.slug) ?? [];
  const concernRows = await db.concern.findMany({ select: { slug: true, name: true } });
  const concernName = new Map(concernRows.map((c) => [c.slug, c.name]));
  const profile = (row.profile ?? {}) as { skinType?: string; monthlyBudgetCents?: number };
  const snapshot = (row.candidateSnapshot ?? {}) as { notices?: string[] };

  const tiers: RoutineTierDTO[] = TIERS.flatMap((tier) => {
    const rec = row.recommendations.find((r) => r.tier === tier);
    if (!rec) return [];
    const intro = (rec.introductionPlan ?? {}) as IntroJson;
    const steps: RoutineStepDTO[] = rec.steps.map((s) => ({
      id: s.id,
      time: s.timeOfDay === "PM" ? "PM" : "AM",
      slot: s.slot,
      order: s.stepOrder,
      product: {
        slug: s.product.slug,
        name: s.product.name,
        subtitle: s.product.subtitle,
        categorySlug: s.product.category.slug,
        image: s.product.images[0] ?? null,
      },
      variantId: s.variantId,
      variantName: s.variant?.name ?? null,
      priceCents: s.variant?.priceCents ?? s.product.variants[0]?.priceCents ?? 0,
      frequency: FREQUENCY_LABEL[s.frequency as keyof typeof FREQUENCY_LABEL] ?? s.frequency,
      rationale: s.rationale,
      usage: s.usage,
      matchedConcerns: s.matchedConcerns.map((c) => concernName.get(c) ?? c),
      requiresVariantChoice: s.requiresVariantChoice,
    }));
    const products = new Map<string, RoutineTierDTO["products"][number]>();
    for (const s of steps) {
      if (!products.has(s.product.slug)) {
        products.set(s.product.slug, {
          variantId: s.variantId,
          slug: s.product.slug,
          name: s.product.name,
          priceCents: s.priceCents,
        });
      }
    }
    return [
      {
        tier,
        title: rec.title,
        summary: rec.summary,
        isRecommended: rec.isRecommended,
        totalCents: rec.totalCents,
        monthlyCostCents: intro.monthlyCostCents ?? 0,
        withinBudget: intro.withinBudget ?? true,
        cautions: intro.cautions ?? [],
        introductionPlan: intro.steps ?? [],
        am: steps.filter((s) => s.time === "AM"),
        pm: steps.filter((s) => s.time === "PM"),
        products: [...products.values()],
      },
    ];
  });

  const recommended = tiers.find((t) => t.isRecommended)?.tier ?? "COMPLETE";
  const excluded = (row.recommendations.find((r) => r.isRecommended)?.excludedProducts ??
    []) as RoutineResultDTO["excluded"];

  return {
    consultationId: row.id,
    completedAt: row.completedAt.toISOString(),
    engine: row.engine ?? "RULES_FALLBACK",
    recommendedTier: recommended,
    notices: snapshot.notices ?? [],
    safetyFlags: row.safetyFlags,
    profileSummary: {
      skinType: SKIN_LABEL[profile.skinType ?? ""] ?? "your",
      concerns: concernIds.map((c) => concernName.get(c) ?? c),
      monthlyBudgetCents: profile.monthlyBudgetCents ?? 0,
    },
    tiers,
    excluded,
    routineDiscountBp,
  };
}

/** The variants to add for one tier, deduplicated; steps still needing a shade are skipped. */
export async function tierCartLines(
  db: DbClient,
  id: string,
  owner: ConsultationOwner,
  tier: Tier,
): Promise<{ variantId: string }[]> {
  const row = await findOwned(db, id, owner);
  if (row.status !== "COMPLETED") throw new AppError("CONFLICT", "Your routine isn't ready yet.");
  const rec = await db.routineRecommendation.findUnique({
    where: { consultationId_tier: { consultationId: id, tier } },
    include: { steps: { select: { variantId: true } } },
  });
  if (!rec) throw new AppError("NOT_FOUND");
  const ids = [...new Set(rec.steps.flatMap((s) => (s.variantId ? [s.variantId] : [])))];
  return ids.map((variantId) => ({ variantId }));
}

/** A user's completed consultations, newest first (account "Saved routines", docs/15 AC7). */
export async function listUserConsultations(db: DbClient, userId: string) {
  return db.routineConsultation.findMany({
    where: { userId, status: "COMPLETED" },
    orderBy: { completedAt: "desc" },
    take: 20,
    select: {
      id: true,
      completedAt: true,
      recommendations: {
        where: { isRecommended: true },
        select: { title: true, summary: true, totalCents: true },
      },
    },
  });
}
