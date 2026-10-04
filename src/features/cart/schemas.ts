import { z } from "zod";

/** Cart action inputs (docs/09 §6). Shared by client forms and Server Actions. */
const id = z.string().min(1).max(64);

export const addToCartSchema = z
  .object({
    variantId: id,
    quantity: z.number().int().min(1).max(10),
    purchaseType: z.enum(["ONE_TIME", "SUBSCRIPTION"]),
    consultationId: id.nullish(),
    routineTier: z.enum(["ESSENTIAL", "COMPLETE", "ADVANCED"]).nullish(),
  })
  .strict();

export const updateCartItemSchema = z
  .object({
    itemId: id,
    quantity: z.number().int().min(1).max(10).optional(),
    purchaseType: z.enum(["ONE_TIME", "SUBSCRIPTION"]).optional(),
  })
  .strict()
  .refine((v) => v.quantity !== undefined || v.purchaseType !== undefined, {
    message: "Nothing to update.",
  });

export const removeCartItemSchema = z.object({ itemId: id }).strict();
export const planIntervalSchema = z
  .object({ intervalWeeks: z.union([z.literal(4), z.literal(8), z.literal(12)]) })
  .strict();
export const couponCodeSchema = z.object({ code: z.string().trim().min(3).max(32) }).strict();
export const emptySchema = z.object({}).strict();
