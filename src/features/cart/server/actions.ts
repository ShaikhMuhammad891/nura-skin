"use server";

import type { ActionContext } from "@/lib/server/action";
import { createAction } from "@/lib/server/action";
import { db } from "@/lib/server/db";

import {
  addToCartSchema,
  couponCodeSchema,
  emptySchema,
  planIntervalSchema,
  removeCartItemSchema,
  updateCartItemSchema,
} from "../schemas";

import { readGuestCartId, writeGuestCartId } from "./cart-cookie";
import {
  addItem,
  applyCoupon,
  ensureCart,
  findActiveCart,
  getCartView,
  removeCoupon,
  removeItem,
  setPlanInterval,
  updateItem,
  type CartOwner,
  type CartView,
} from "./service";

/**
 * Cart Server Actions (docs/09 §6, ADR-0017). Thin: resolve the cart owner (signed-in user or
 * signed guest cookie), delegate to the tested service, and return the authoritative view.
 * Rate limiting is added with Upstash in M4.
 */

async function ownerFor(ctx: ActionContext): Promise<CartOwner> {
  return ctx.actor.userId ? { userId: ctx.actor.userId } : { guestCartId: await readGuestCartId() };
}

/** Existing cart or a new one (persisting the guest cookie when a guest cart is created). */
async function cartFor(ctx: ActionContext) {
  const owner = await ownerFor(ctx);
  const cart = await ensureCart(db, owner);
  if (!("userId" in owner) && owner.guestCartId !== cart.id) await writeGuestCartId(cart.id);
  return cart;
}

const customerOf = (ctx: ActionContext) => ({ userId: ctx.actor.userId, email: null });

export const getCart = createAction({
  name: "cart.get",
  auth: "guest-or-user",
  schema: emptySchema,
  handler: async (_input, ctx): Promise<CartView | null> => {
    const cart = await findActiveCart(db, await ownerFor(ctx));
    return cart ? getCartView(db, cart.id, customerOf(ctx)) : null;
  },
});

export const addToCart = createAction({
  name: "cart.add",
  auth: "guest-or-user",
  schema: addToCartSchema,
  handler: async (input, ctx) => {
    const cart = await cartFor(ctx);
    await addItem(db, cart.id, input);
    return getCartView(db, cart.id, customerOf(ctx));
  },
});

export const updateCartItem = createAction({
  name: "cart.update",
  auth: "guest-or-user",
  schema: updateCartItemSchema,
  handler: async ({ itemId, ...patch }, ctx) => {
    const cart = await cartFor(ctx);
    await updateItem(db, cart.id, itemId, patch);
    return getCartView(db, cart.id, customerOf(ctx));
  },
});

export const removeCartItem = createAction({
  name: "cart.remove",
  auth: "guest-or-user",
  schema: removeCartItemSchema,
  handler: async ({ itemId }, ctx) => {
    const cart = await cartFor(ctx);
    await removeItem(db, cart.id, itemId);
    return getCartView(db, cart.id, customerOf(ctx));
  },
});

export const setCartPlanInterval = createAction({
  name: "cart.setInterval",
  auth: "guest-or-user",
  schema: planIntervalSchema,
  handler: async ({ intervalWeeks }, ctx) => {
    const cart = await cartFor(ctx);
    await setPlanInterval(db, cart.id, intervalWeeks);
    return getCartView(db, cart.id, customerOf(ctx));
  },
});

export const applyCartCoupon = createAction({
  name: "cart.applyCoupon",
  auth: "guest-or-user",
  schema: couponCodeSchema,
  handler: async ({ code }, ctx) => {
    const cart = await cartFor(ctx);
    await applyCoupon(db, cart.id, code, customerOf(ctx));
    return getCartView(db, cart.id, customerOf(ctx));
  },
});

export const removeCartCoupon = createAction({
  name: "cart.removeCoupon",
  auth: "guest-or-user",
  schema: emptySchema,
  handler: async (_input, ctx) => {
    const cart = await cartFor(ctx);
    await removeCoupon(db, cart.id);
    return getCartView(db, cart.id, customerOf(ctx));
  },
});
