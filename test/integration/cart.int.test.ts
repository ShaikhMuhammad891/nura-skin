/** Cart service against the real database and seeded catalogue (FR-CART-*, docs/04 C6, 09 §6). */
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  addItem,
  applyCoupon,
  ensureCart,
  findActiveCart,
  getCartView,
  mergeGuestCart,
  removeItem,
  setPlanInterval,
  updateItem,
} from "../../src/features/cart/server/service";
import { getPricingSettings } from "../../src/features/settings/server/settings";
import type { PrismaClient } from "../../src/generated/prisma/client";

import { createTestVariant, uid } from "./factories";
import { createTestPrisma } from "./helpers";

let prisma: PrismaClient;
const guest = { userId: null, email: null };
const variantId = async (sku: string) =>
  (await prisma.productVariant.findUniqueOrThrow({ where: { sku } })).id;
const newGuestCart = () => ensureCart(prisma, { guestCartId: null });

async function createUser() {
  const role = await prisma.role.findUniqueOrThrow({ where: { key: "CUSTOMER" } });
  const id = uid();
  return prisma.user.create({
    data: { clerkId: `clerk_${id}`, email: `user-${id}@example.test`, roleId: role.id },
  });
}

beforeAll(() => {
  prisma = createTestPrisma();
});
afterAll(async () => {
  await prisma.$disconnect();
});

describe("adding items", () => {
  it("adds, merges repeated adds and quotes server-side", async () => {
    const cart = await newGuestCart();
    const glow = await variantId("NURA-SER-GLOW-30");
    await addItem(prisma, cart.id, { variantId: glow, quantity: 1, purchaseType: "ONE_TIME" });
    await addItem(prisma, cart.id, { variantId: glow, quantity: 1, purchaseType: "ONE_TIME" });
    const view = await getCartView(prisma, cart.id, guest);
    expect(view.lines).toHaveLength(1);
    expect(view.lines[0]!.quantity).toBe(2);
    expect(view.quote).toMatchObject({ subtotalCents: 9600, shippingCents: 0, totalCents: 9600 });
  });

  it("clamps to stock and the 10-per-line max", async () => {
    const { variant } = await createTestVariant(prisma, { onHand: 3 });
    const cart = await newGuestCart();
    await addItem(prisma, cart.id, {
      variantId: variant.id,
      quantity: 3,
      purchaseType: "ONE_TIME",
    });
    await expect(
      addItem(prisma, cart.id, { variantId: variant.id, quantity: 1, purchaseType: "ONE_TIME" }),
    ).rejects.toMatchObject({
      code: "OUT_OF_STOCK",
      details: { maxQuantity: 3, inCart: 3 },
    });
    await expect(
      addItem(prisma, cart.id, { variantId: variant.id, quantity: 11, purchaseType: "ONE_TIME" }),
    ).rejects.toMatchObject({
      code: "VALIDATION",
    });
  });

  it("refuses sold-out, draft and non-subscribable items", async () => {
    const cart = await newGuestCart();
    await expect(
      addItem(prisma, cart.id, {
        variantId: await variantId("NURA-SPF-TINT-DEEP"),
        quantity: 1,
        purchaseType: "ONE_TIME",
      }),
    ).rejects.toMatchObject({ code: "OUT_OF_STOCK" });
    const draft = await createTestVariant(prisma, { onHand: 5, status: "DRAFT" });
    await expect(
      addItem(prisma, cart.id, {
        variantId: draft.variant.id,
        quantity: 1,
        purchaseType: "ONE_TIME",
      }),
    ).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    // Bundles are one-time only (review R-08); so is the travel mini.
    await expect(
      addItem(prisma, cart.id, {
        variantId: await variantId("NURA-RTN-CLEAR"),
        quantity: 1,
        purchaseType: "SUBSCRIPTION",
      }),
    ).rejects.toMatchObject({ code: "VALIDATION", details: { code: "NOT_SUBSCRIBABLE" } });
  });
});

describe("Routine Plans (review R-07)", () => {
  it("the first subscription line sets the plan interval; SPF gets a quantity suggestion", async () => {
    const cart = await newGuestCart();
    await addItem(prisma, cart.id, {
      variantId: await variantId("NURA-SER-DEW-30"),
      quantity: 1,
      purchaseType: "SUBSCRIPTION",
    });
    await addItem(prisma, cart.id, {
      variantId: await variantId("NURA-SPF-VEIL-50"),
      quantity: 1,
      purchaseType: "SUBSCRIPTION",
    });
    const view = await getCartView(prisma, cart.id, guest);
    expect(view.planIntervalWeeks).toBe(8);
    const spf = view.lines.find((l) => l.sku === "NURA-SPF-VEIL-50")!;
    expect(spf.suggestedQuantity).toBe(2);
    // 15% off each and free shipping.
    expect(view.quote.shippingCents).toBe(0);
    expect(view.quote.discounts).toEqual([{ kind: "subscription", amountCents: 510 + 540 }]);
  });

  it("allows only 4/8/12-week intervals, and only with subscription lines", async () => {
    const cart = await newGuestCart();
    await expect(setPlanInterval(prisma, cart.id, 8)).rejects.toMatchObject({ code: "CONFLICT" });
    await addItem(prisma, cart.id, {
      variantId: await variantId("NURA-SER-DEW-30"),
      quantity: 1,
      purchaseType: "SUBSCRIPTION",
    });
    await expect(setPlanInterval(prisma, cart.id, 6)).rejects.toMatchObject({ code: "VALIDATION" });
    await setPlanInterval(prisma, cart.id, 12);
    expect((await getCartView(prisma, cart.id, guest)).planIntervalWeeks).toBe(12);
  });

  it("switching a line to subscription merges with an existing subscription line", async () => {
    const cart = await newGuestCart();
    const dew = await variantId("NURA-SER-DEW-30");
    await addItem(prisma, cart.id, { variantId: dew, quantity: 1, purchaseType: "SUBSCRIPTION" });
    const oneTime = await addItem(prisma, cart.id, {
      variantId: dew,
      quantity: 2,
      purchaseType: "ONE_TIME",
    });
    await updateItem(prisma, cart.id, oneTime.id, { purchaseType: "SUBSCRIPTION" });
    const view = await getCartView(prisma, cart.id, guest);
    expect(view.lines).toEqual([
      expect.objectContaining({ purchaseType: "SUBSCRIPTION", quantity: 3 }),
    ]);
  });
});

describe("routine discount", () => {
  it("applies 10% when three lines come from one consultation", async () => {
    const cart = await newGuestCart();
    const user = await createUser();
    const consultation = await prisma.routineConsultation.create({
      data: { userId: user.id, questionnaireVersion: "q-2026.09", status: "COMPLETED" },
    });
    for (const sku of ["NURA-CLN-CLOUD-150", "NURA-SER-DEW-30", "NURA-MOI-BARRIER-50"]) {
      await addItem(prisma, cart.id, {
        variantId: await variantId(sku),
        quantity: 1,
        purchaseType: "ONE_TIME",
        consultationId: consultation.id,
      });
    }
    const view = await getCartView(prisma, cart.id, guest);
    expect(view.quote.discounts).toEqual([{ kind: "routine", amountCents: 960 }]);
    // Removing a step loses the discount (docs/04 C6 edge case).
    await removeItem(prisma, cart.id, view.lines[0]!.id);
    expect((await getCartView(prisma, cart.id, guest)).quote.discounts).toEqual([]);
  });
});

describe("coupons", () => {
  async function createCoupon(patch: Record<string, unknown> = {}) {
    return prisma.coupon.create({
      data: { code: `TEST${uid().toUpperCase()}`, type: "PERCENTAGE", valueBp: 1000, ...patch },
    });
  }

  it("applies a valid code (case-insensitive) and prices it in", async () => {
    const coupon = await createCoupon();
    const cart = await newGuestCart();
    await addItem(prisma, cart.id, {
      variantId: await variantId("NURA-SER-GLOW-30"),
      quantity: 1,
      purchaseType: "ONE_TIME",
    });
    await applyCoupon(prisma, cart.id, coupon.code.toLowerCase(), guest);
    const view = await getCartView(prisma, cart.id, guest);
    expect(view.coupon?.code).toBe(coupon.code);
    expect(view.quote.discounts).toEqual([{ kind: "coupon", amountCents: 480 }]);
  });

  it("rejects unknown and inactive codes with the same message", async () => {
    const inactive = await createCoupon({ isActive: false });
    const cart = await newGuestCart();
    await addItem(prisma, cart.id, {
      variantId: await variantId("NURA-SER-GLOW-30"),
      quantity: 1,
      purchaseType: "ONE_TIME",
    });
    const unknown = await applyCoupon(prisma, cart.id, "NOPE123", guest).catch((e: unknown) => e);
    const off = await applyCoupon(prisma, cart.id, inactive.code, guest).catch((e: unknown) => e);
    expect(unknown).toMatchObject({ code: "COUPON_INVALID", message: "This code isn't valid." });
    expect(off).toMatchObject({ code: "COUPON_INVALID", message: "This code isn't valid." });
  });

  it("explains the minimum subtotal gap", async () => {
    const coupon = await createCoupon({ minSubtotalCents: 6000 });
    const cart = await newGuestCart();
    await addItem(prisma, cart.id, {
      variantId: await variantId("NURA-SER-GLOW-30"),
      quantity: 1,
      purchaseType: "ONE_TIME",
    });
    await expect(applyCoupon(prisma, cart.id, coupon.code, guest)).rejects.toMatchObject({
      code: "COUPON_INVALID",
      details: { reason: "min_subtotal" },
      message: "Add $12.00 more to use this code.",
    });
  });

  it("drops an applied coupon that stops being valid, with a warning", async () => {
    const coupon = await createCoupon();
    const cart = await newGuestCart();
    await addItem(prisma, cart.id, {
      variantId: await variantId("NURA-SER-GLOW-30"),
      quantity: 1,
      purchaseType: "ONE_TIME",
    });
    await applyCoupon(prisma, cart.id, coupon.code, guest);
    await prisma.coupon.update({
      where: { id: coupon.id },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });
    const view = await getCartView(prisma, cart.id, guest);
    expect(view.coupon).toBeNull();
    expect(view.warnings).toContainEqual({
      type: "coupon_removed",
      reason: "This code has expired.",
    });
  });
});

describe("warnings & merging", () => {
  it("flags price changes and stock reductions, quoting only what can be bought", async () => {
    const { variant } = await createTestVariant(prisma, { onHand: 5, priceCents: 3000 });
    const cart = await newGuestCart();
    const item = await addItem(prisma, cart.id, {
      variantId: variant.id,
      quantity: 4,
      purchaseType: "ONE_TIME",
    });
    await prisma.productVariant.update({ where: { id: variant.id }, data: { priceCents: 3200 } });
    await prisma.inventoryItem.update({ where: { variantId: variant.id }, data: { onHand: 2 } });
    const view = await getCartView(prisma, cart.id, guest);
    expect(view.warnings).toContainEqual({
      type: "price_changed",
      lineId: item.id,
      previousCents: 3000,
      currentCents: 3200,
    });
    expect(view.warnings).toContainEqual({ type: "stock_reduced", lineId: item.id, available: 2 });
    expect(view.quote.subtotalCents).toBe(6400);
  });

  it("merges a guest cart into the user's cart once, clamping and keeping routine attribution", async () => {
    const user = await createUser();
    const { variant } = await createTestVariant(prisma, { onHand: 4 });
    const userCart = await ensureCart(prisma, { userId: user.id });
    await addItem(prisma, userCart.id, {
      variantId: variant.id,
      quantity: 3,
      purchaseType: "ONE_TIME",
    });

    const guestCart = await newGuestCart();
    const consultation = await prisma.routineConsultation.create({
      data: { anonymousId: `anon_${uid()}`, questionnaireVersion: "q-2026.09" },
    });
    await addItem(prisma, guestCart.id, {
      variantId: variant.id,
      quantity: 3,
      purchaseType: "ONE_TIME",
      consultationId: consultation.id,
    });

    expect(await mergeGuestCart(prisma, guestCart.id, user.id)).toEqual({ merged: 1, clamped: 1 });
    expect(await mergeGuestCart(prisma, guestCart.id, user.id)).toEqual({ merged: 0, clamped: 0 }); // idempotent
    const merged = await prisma.cartItem.findFirstOrThrow({
      where: { cartId: userCart.id, variantId: variant.id },
    });
    expect(merged).toMatchObject({ quantity: 4, consultationId: consultation.id });
    expect(await findActiveCart(prisma, { guestCartId: guestCart.id })).toBeNull();
  });

  it("a guest cart id cannot be used to read a user's cart", async () => {
    const user = await createUser();
    const userCart = await ensureCart(prisma, { userId: user.id });
    expect(await findActiveCart(prisma, { guestCartId: userCart.id })).toBeNull();
  });
});

describe("settings", () => {
  it("reads seeded pricing settings and falls back on malformed values", async () => {
    const settings = await getPricingSettings(prisma);
    expect(settings).toMatchObject({
      subscriptionDiscountBp: 1500,
      freeShippingThresholdCents: 6000,
      invalidKeys: [],
    });
    await prisma.storeSetting.update({
      where: { key: "shipping.flat_rate_cents" },
      data: { value: "oops" },
    });
    try {
      const fallback = await getPricingSettings(prisma);
      expect(fallback.shippingFlatRateCents).toBe(650);
      expect(fallback.invalidKeys).toEqual(["shipping.flat_rate_cents"]);
    } finally {
      await prisma.storeSetting.update({
        where: { key: "shipping.flat_rate_cents" },
        data: { value: 650 },
      });
    }
  });
});
