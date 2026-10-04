"use server";

import { headers } from "next/headers";
import { z } from "zod";

import { addItem, ensureCart } from "@/features/cart/server/service";
import { readGuestCartId, writeGuestCartId } from "@/features/cart/server/cart-cookie";
import { AppError } from "@/lib/errors";
import { createAction, type ActionContext } from "@/lib/server/action";
import { rateLimit } from "@/lib/server/rate-limit";

import { STEP_ORDER, type StepId } from "../questionnaire";

import { ensureAnonymousId, readAnonymousId } from "./consult-cookie";
import {
  recommend,
  reviseConsultation,
  saveAnswer,
  startConsultation,
  tierCartLines,
  type ConsultationOwner,
} from "./service";

/**
 * Finder Server Actions (docs/09 §11, ADR-0017). Ownership is the signed-in user or the guest's
 * signed anonymous-id cookie; rate limits follow 09 §3 (interim per-instance limiter).
 */
const id = z.string().min(1).max(64);
const tier = z.enum(["ESSENTIAL", "COMPLETE", "ADVANCED"]);

async function ownerOf(ctx: ActionContext, create = false): Promise<ConsultationOwner> {
  if (ctx.actor.userId) return { userId: ctx.actor.userId, anonymousId: null };
  return {
    userId: null,
    anonymousId: create ? await ensureAnonymousId() : await readAnonymousId(),
  };
}

async function limit(bucket: string, max: number, windowMs: number) {
  const ip = (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (!rateLimit(`${bucket}:${ip}`, max, windowMs).ok) throw new AppError("RATE_LIMITED");
}

export const startConsultationAction = createAction({
  name: "finder.start",
  auth: "guest-or-user",
  schema: z.object({ source: z.string().max(40).optional(), parentId: id.optional() }).strict(),
  handler: async (input, ctx) => {
    await limit("finder-create", 10, 60 * 60 * 1000);
    const consultation = await startConsultation(ctx.db, await ownerOf(ctx, true), input);
    return { id: consultation.id };
  },
});

export const saveAnswerAction = createAction({
  name: "finder.saveAnswer",
  auth: "guest-or-user",
  schema: z
    .object({
      consultationId: id,
      stepId: z.enum(STEP_ORDER as [StepId, ...StepId[]]),
      answer: z.unknown(),
    })
    .strict(),
  handler: async ({ consultationId, stepId, answer }, ctx) =>
    saveAnswer(ctx.db, consultationId, await ownerOf(ctx), stepId, answer),
});

export const recommendAction = createAction({
  name: "finder.recommend",
  auth: "guest-or-user",
  schema: z.object({ consultationId: id }).strict(),
  handler: async ({ consultationId }, ctx) => {
    await limit("finder-recommend", 20, 60 * 60 * 1000);
    return recommend(ctx.db, consultationId, await ownerOf(ctx));
  },
});

export const reviseAction = createAction({
  name: "finder.revise",
  auth: "guest-or-user",
  schema: z.object({ consultationId: id }).strict(),
  handler: async ({ consultationId }, ctx) => {
    await limit("finder-create", 10, 60 * 60 * 1000);
    const child = await reviseConsultation(ctx.db, consultationId, await ownerOf(ctx));
    return { id: child.id };
  },
});

/** Adds every product of a tier, tagged with the consultation so the routine discount applies. */
export const addRoutineToCartAction = createAction({
  name: "finder.addRoutineToCart",
  auth: "guest-or-user",
  schema: z.object({ consultationId: id, tier }).strict(),
  handler: async ({ consultationId, tier }, ctx) => {
    const lines = await tierCartLines(ctx.db, consultationId, await ownerOf(ctx), tier);
    const cartOwner = ctx.actor.userId
      ? { userId: ctx.actor.userId }
      : { guestCartId: await readGuestCartId() };
    const cart = await ensureCart(ctx.db, cartOwner);
    if (!("userId" in cartOwner) && cartOwner.guestCartId !== cart.id)
      await writeGuestCartId(cart.id);

    let added = 0;
    const skipped: string[] = [];
    for (const line of lines) {
      try {
        await addItem(ctx.db, cart.id, {
          variantId: line.variantId,
          quantity: 1,
          purchaseType: "ONE_TIME",
          consultationId,
          routineTier: tier,
        });
        added += 1;
      } catch (error) {
        // One sold-out step shouldn't block the rest of the routine.
        if (error instanceof AppError && error.code === "OUT_OF_STOCK")
          skipped.push(line.variantId);
        else throw error;
      }
    }
    return { added, skipped: skipped.length };
  },
});
