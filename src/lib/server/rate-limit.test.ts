import { rateLimit, resetRateLimits } from "./rate-limit";

describe("rateLimit", () => {
  beforeEach(resetRateLimits);

  it("allows up to the limit within a window, then blocks", () => {
    const results = Array.from({ length: 4 }, () => rateLimit("ip:1", 3, 1000, 0));
    expect(results.map((r) => r.ok)).toEqual([true, true, true, false]);
    expect(results[2]?.remaining).toBe(0);
  });

  it("resets after the window and keeps keys independent", () => {
    for (let i = 0; i < 3; i++) rateLimit("ip:1", 3, 1000, 0);
    expect(rateLimit("ip:2", 3, 1000, 10).ok).toBe(true);
    expect(rateLimit("ip:1", 3, 1000, 999).ok).toBe(false);
    expect(rateLimit("ip:1", 3, 1000, 1000)).toMatchObject({ ok: true, remaining: 2 });
  });
});
