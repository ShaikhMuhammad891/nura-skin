import { vi } from "vitest";

vi.mock("@clerk/nextjs", () => ({ useReverification: vi.fn() }));

const { toReverificationHint } = await import("./use-reverified-action");

describe("toReverificationHint", () => {
  it("turns REVERIFICATION_REQUIRED into Clerk's reverification hint", () => {
    const hint = toReverificationHint({
      ok: false,
      error: {
        code: "REVERIFICATION_REQUIRED",
        message: "Please confirm it's you to continue.",
        requestId: "r1",
        details: { level: "strict" },
      },
    });
    expect(hint).toEqual({
      clerk_error: {
        type: "forbidden",
        reason: "reverification-error",
        metadata: { reverification: "strict" },
      },
    });
  });

  it("passes every other result through untouched", () => {
    const ok = { ok: true as const, data: 1 };
    const forbidden = {
      ok: false as const,
      error: { code: "FORBIDDEN" as const, message: "no", requestId: "r2" },
    };
    expect(toReverificationHint(ok)).toBe(ok);
    expect(toReverificationHint(forbidden)).toBe(forbidden);
  });
});
