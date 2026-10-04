/** Routine Finder consultation lifecycle against the seeded catalogue (docs/12, docs/09 §11). */
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { Answers } from "../../src/features/finder/questionnaire";
import {
  claimGuestConsultations,
  getConsultation,
  getResult,
  recommend,
  reviseConsultation,
  saveAnswer,
  startConsultation,
  tierCartLines,
} from "../../src/features/finder/server/service";
import type { PrismaClient } from "../../src/generated/prisma/client";

import { uid } from "./factories";
import { createTestPrisma } from "./helpers";

let prisma: PrismaClient;

beforeAll(() => {
  prisma = createTestPrisma();
});
afterAll(async () => {
  await prisma.$disconnect();
});

const guest = () => ({ userId: null, anonymousId: `anon-${uid()}` });

const OILY_ACNE: Answers = {
  "skin-type": { skinType: "OILY" },
  concerns: { ranked: ["acne", "oiliness"] },
  sensitivity: { level: 2 },
  reactions: { items: ["none"] },
  conditions: { items: ["none"], sensitiveConsent: false },
  lifestyle: { climate: "humid", sunExposure: "moderate", wearsMakeup: false },
  "routine-time": { value: "standard" },
  preferences: {
    fragranceFree: false,
    vegan: false,
    tintedSpf: null,
    avoid: [],
    pregnancySafeOnly: false,
  },
  budget: { monthlyCents: 10000 },
};

async function answerAll(id: string, owner: ReturnType<typeof guest>, answers: Answers) {
  for (const [step, answer] of Object.entries(answers)) {
    await saveAnswer(prisma, id, owner, step as keyof Answers, answer);
  }
}

async function createUser() {
  const role = await prisma.role.findUniqueOrThrow({ where: { key: "CUSTOMER" } });
  const id = uid();
  return prisma.user.create({
    data: { clerkId: `clerk_${id}`, email: `finder-${id}@example.test`, roleId: role.id },
  });
}

describe("finder consultations", () => {
  it("autosaves answers, validates them, and points to the next step", async () => {
    const owner = guest();
    const c = await startConsultation(prisma, owner);
    const res = await saveAnswer(prisma, c.id, owner, "skin-type", { skinType: "UNSURE" });
    expect(res.nextStepId).toBe("skin-type-helper");
    expect(res.missingSteps).toContain("skin-type-helper");

    await expect(saveAnswer(prisma, c.id, owner, "sensitivity", { level: 9 })).rejects.toThrow();
    await expect(
      saveAnswer(prisma, c.id, owner, "conditions", {
        items: ["pregnant"],
        sensitiveConsent: false,
      }),
    ).rejects.toThrow();

    const back = await getConsultation(prisma, c.id, owner);
    expect(back.lastStep).toBe("skin-type");
    expect(back.answers["skin-type"]).toEqual({ skinType: "UNSURE" });
  });

  it("only lets the owner see or change a consultation", async () => {
    const owner = guest();
    const c = await startConsultation(prisma, owner);
    await expect(getConsultation(prisma, c.id, guest())).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    await expect(
      saveAnswer(prisma, c.id, { userId: null, anonymousId: null }, "sensitivity", { level: 2 }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("refuses to recommend until the required steps are answered", async () => {
    const owner = guest();
    const c = await startConsultation(prisma, owner);
    await saveAnswer(prisma, c.id, owner, "skin-type", { skinType: "DRY" });
    await expect(recommend(prisma, c.id, owner)).rejects.toMatchObject({
      code: "VALIDATION",
      details: { code: "INCOMPLETE" },
    });
  });

  it("builds, persists and serves three tiers with real, in-stock products", async () => {
    const owner = guest();
    const c = await startConsultation(prisma, owner);
    await answerAll(c.id, owner, OILY_ACNE);
    await recommend(prisma, c.id, owner);
    await recommend(prisma, c.id, owner); // idempotent

    const recs = await prisma.routineRecommendation.count({ where: { consultationId: c.id } });
    expect(recs).toBe(3);

    const result = await getResult(prisma, c.id, owner, 1000);
    expect(result.engine).toBe("RULES_FALLBACK");
    expect(result.tiers.map((t) => t.tier)).toEqual(["ESSENTIAL", "COMPLETE", "ADVANCED"]);
    expect(result.tiers.filter((t) => t.isRecommended)).toHaveLength(1);
    const recommended = result.tiers.find((t) => t.isRecommended)!;
    expect(recommended.am.length).toBeGreaterThan(0);
    expect(recommended.am.some((s) => s.slot === "PROTECT")).toBe(true);
    expect(recommended.pm.every((s) => s.slot !== "PROTECT")).toBe(true);
    for (const step of [...recommended.am, ...recommended.pm]) {
      expect(step.rationale.length).toBeGreaterThan(10);
      expect(step.priceCents).toBeGreaterThan(0);
    }
    expect(result.profileSummary.concerns).toContain("Breakouts");
    expect(JSON.parse(JSON.stringify(result))).toEqual(result);

    // Completed consultations are immutable.
    await expect(
      saveAnswer(prisma, c.id, owner, "sensitivity", { level: 3 }),
    ).rejects.toMatchObject({
      code: "CONFLICT",
    });

    const lines = await tierCartLines(prisma, c.id, owner, recommended.tier);
    expect(lines.length).toBe(recommended.products.filter((p) => p.variantId).length);
  });

  it("survives two tabs completing the same consultation at once", async () => {
    const owner = guest();
    const c = await startConsultation(prisma, owner);
    await answerAll(c.id, owner, OILY_ACNE);
    await Promise.all([recommend(prisma, c.id, owner), recommend(prisma, c.id, owner)]);
    expect(await prisma.routineRecommendation.count({ where: { consultationId: c.id } })).toBe(3);
  });

  it("keeps pregnancy routines free of retinoids", async () => {
    const owner = guest();
    const c = await startConsultation(prisma, owner);
    await answerAll(c.id, owner, {
      ...OILY_ACNE,
      concerns: { ranked: ["fine-lines", "pigmentation"] },
      conditions: { items: ["pregnant"], sensitiveConsent: true },
      "routine-time": { value: "enthusiast" },
      budget: { monthlyCents: 20000 },
    });
    await recommend(prisma, c.id, owner);
    const result = await getResult(prisma, c.id, owner, 1000);
    const slugs = result.tiers.flatMap((t) => [...t.am, ...t.pm].map((s) => s.product.slug));
    expect(slugs).not.toContain("renew-night-serum");
    expect(result.safetyFlags).toContain("pregnancy");
    expect(result.excluded.some((e) => e.slug === "renew-night-serum")).toBe(true);
  });

  it("revises into a prefilled child consultation", async () => {
    const owner = guest();
    const c = await startConsultation(prisma, owner);
    await answerAll(c.id, owner, OILY_ACNE);
    await recommend(prisma, c.id, owner);
    const child = await reviseConsultation(prisma, c.id, owner);
    expect(child.id).not.toBe(c.id);
    expect(child.status).toBe("IN_PROGRESS");
    expect(child.answers["skin-type"]).toEqual({ skinType: "OILY" });
  });

  it("claims a guest's consultations into the account", async () => {
    const owner = guest();
    const c = await startConsultation(prisma, owner);
    const user = await createUser();
    expect(await claimGuestConsultations(prisma, owner.anonymousId, user.id)).toBe(1);
    expect(await claimGuestConsultations(prisma, owner.anonymousId, user.id)).toBe(0);
    // Now owned by the user, no longer by the bare cookie.
    await expect(getConsultation(prisma, c.id, owner)).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect((await getConsultation(prisma, c.id, { userId: user.id, anonymousId: null })).id).toBe(
      c.id,
    );
  });
});
