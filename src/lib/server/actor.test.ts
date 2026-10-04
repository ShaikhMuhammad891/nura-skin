import { beforeEach, describe, expect, it, vi } from "vitest";

import type { RoleKey } from "@/lib/permissions";

const state = vi.hoisted(() => ({
  user: null as null | { id: string; role: { key: RoleKey } },
  demoMode: false,
}));

vi.mock("./clerk", () => ({ getCurrentUser: async () => state.user }));
vi.mock("@/lib/env", () => ({
  env: {
    get DEMO_MODE_ENABLED() {
      return state.demoMode;
    },
  },
}));

const { ANONYMOUS, getActor } = await import("./actor");

describe("getActor (docs/10 §3, ADR-0016)", () => {
  beforeEach(() => {
    state.user = null;
    state.demoMode = false;
  });

  it("is anonymous without a signed-in user", async () => {
    expect(await getActor()).toBe(ANONYMOUS);
  });

  it("uses the DB role and its permissions", async () => {
    state.user = { id: "u1", role: { key: "SUPPORT" } };
    const actor = await getActor();
    expect(actor).toMatchObject({ userId: "u1", role: "SUPPORT", isDemo: false });
    expect(actor.permissions.has("order:refund_limited")).toBe(true);
    expect(actor.permissions.has("order:refund")).toBe(false);
  });

  it("gives DEMO_STAFF nothing outside a demo deployment", async () => {
    state.user = { id: "d1", role: { key: "DEMO_STAFF" } };
    expect(await getActor()).toBe(ANONYMOUS);
    state.demoMode = true;
    expect(await getActor()).toMatchObject({ userId: "d1", role: "DEMO_STAFF", isDemo: true });
  });
});
