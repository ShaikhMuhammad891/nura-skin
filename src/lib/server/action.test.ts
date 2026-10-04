import { beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

import { AppError } from "@/lib/errors";

import type * as actorModule from "./actor";
import { actorFor, ANONYMOUS, type Actor } from "./actor";

const actorRef: { current: Actor } = { current: ANONYMOUS };

// The real actor module resolves Clerk + env at import; the tests drive `getActor` directly.
const reverified = { current: false };
vi.mock("./clerk", () => ({
  getCurrentUser: async () => null,
  hasRecentReverification: async () => reverified.current,
}));

// A fake client: the demo path must run the handler on the transaction client and roll it back.
const txClient = { kind: "tx" };
const rootClient = {
  kind: "root",
  $transaction: vi.fn(async (fn: (tx: unknown) => Promise<unknown>) => fn(txClient)),
};
vi.mock("./db", () => ({ db: rootClient }));
vi.mock("@/lib/env", () => ({ env: { DEMO_MODE_ENABLED: false } }));
vi.mock("./actor", async (importOriginal) => {
  const original = await importOriginal<typeof actorModule>();
  return { ...original, getActor: async () => actorRef.current };
});

const { createAction } = await import("./action");

const schema = z.object({ quantity: z.number().int().min(1).max(10) });

describe("createAction", () => {
  beforeEach(() => {
    actorRef.current = ANONYMOUS;
    reverified.current = false;
    rootClient.$transaction.mockClear();
  });

  it("validates input before running the handler", async () => {
    const handler = vi.fn(async () => "ok");
    const action = createAction({ name: "test.validate", auth: "public", schema, handler });

    const result = await action({ quantity: 0 });

    expect(handler).not.toHaveBeenCalled();
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("VALIDATION");
      expect(result.error.fieldErrors?.quantity).toBeDefined();
    }
  });

  it("requires a signed-in user for auth: user", async () => {
    const action = createAction({
      name: "test.user",
      auth: "user",
      schema,
      handler: async () => 1,
    });
    const result = await action({ quantity: 1 });
    expect(result).toMatchObject({ ok: false, error: { code: "UNAUTHENTICATED" } });
  });

  it("hides staff actions from non-staff with NOT_FOUND", async () => {
    actorRef.current = actorFor("user_1", "CUSTOMER");
    const action = createAction({
      name: "test.staff",
      auth: "staff",
      permission: "order:refund",
      schema,
      handler: async () => 1,
    });
    expect(await action({ quantity: 1 })).toMatchObject({
      ok: false,
      error: { code: "NOT_FOUND" },
    });
  });

  it("returns FORBIDDEN for staff lacking the permission", async () => {
    actorRef.current = actorFor("user_2", "SUPPORT");
    const action = createAction({
      name: "test.refund",
      auth: "staff",
      permission: "order:refund",
      schema,
      handler: async () => 1,
    });
    expect(await action({ quantity: 1 })).toMatchObject({
      ok: false,
      error: { code: "FORBIDDEN" },
    });
  });

  it("runs the handler with parsed input and context when authorized", async () => {
    actorRef.current = actorFor("user_3", "ADMIN");
    const action = createAction({
      name: "test.ok",
      auth: "staff",
      permission: "order:refund",
      schema,
      handler: async (input, ctx) => ({ doubled: input.quantity * 2, by: ctx.actor.userId }),
    });
    expect(await action({ quantity: 3 })).toEqual({ ok: true, data: { doubled: 6, by: "user_3" } });
  });

  it("maps domain errors and never leaks unknown error details", async () => {
    const domain = createAction({
      name: "test.domain",
      auth: "public",
      schema,
      handler: async () => {
        throw new AppError("OUT_OF_STOCK", "Only 2 left.", { details: { available: 2 } });
      },
    });
    expect(await domain({ quantity: 5 })).toMatchObject({
      ok: false,
      error: { code: "OUT_OF_STOCK", details: { available: 2 } },
    });

    const crash = createAction({
      name: "test.crash",
      auth: "public",
      schema,
      handler: async () => {
        throw new Error("db password is hunter2");
      },
    });
    const result = await crash({ quantity: 1 });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("INTERNAL");
      expect(JSON.stringify(result.error)).not.toContain("hunter2");
      expect(result.error.requestId).toMatch(/[0-9a-f-]{36}/);
    }
  });

  it("requires a recent re-verification for sensitive actions", async () => {
    actorRef.current = actorFor("user_4", "ADMIN");
    const handler = vi.fn(async () => "refunded");
    const action = createAction({
      name: "test.sensitive",
      auth: "staff",
      permission: "order:refund",
      reverify: true,
      schema,
      handler,
    });

    expect(await action({ quantity: 1 })).toMatchObject({
      ok: false,
      error: { code: "REVERIFICATION_REQUIRED", details: { level: "strict" } },
    });
    expect(handler).not.toHaveBeenCalled();

    reverified.current = true;
    expect(await action({ quantity: 1 })).toEqual({ ok: true, data: "refunded" });
  });

  it("passes the root client to normal handlers", async () => {
    actorRef.current = actorFor("user_5", "ADMIN");
    const action = createAction({
      name: "test.root",
      auth: "staff",
      permission: "product:update",
      schema,
      handler: async (_input, ctx) => ({
        client: (ctx.db as unknown as { kind: string }).kind,
        demo: ctx.demo,
      }),
    });
    expect(await action({ quantity: 1 })).toEqual({
      ok: true,
      data: { client: "root", demo: false },
    });
    expect(rootClient.$transaction).not.toHaveBeenCalled();
  });

  it("runs demo staff mutations in a rolled-back transaction, without step-up", async () => {
    actorRef.current = actorFor("demo_1", "DEMO_STAFF");
    const action = createAction({
      name: "test.demo",
      auth: "staff",
      permission: "product:update",
      reverify: true,
      schema,
      handler: async (_input, ctx) => ({
        client: (ctx.db as unknown as { kind: string }).kind,
        demo: ctx.demo,
      }),
    });
    expect(await action({ quantity: 1 })).toEqual({ ok: true, data: { client: "tx", demo: true } });
    expect(rootClient.$transaction).toHaveBeenCalledTimes(1);
    // The transaction callback must reject, or Prisma would commit.
    await expect(rootClient.$transaction.mock.results[0]?.value).rejects.toThrow("demo rollback");
  });
});
