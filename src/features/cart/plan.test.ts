import { describe, expect, it } from "vitest";

import { suggestedQuantity, suggestPlanInterval } from "./plan";

describe("suggestPlanInterval", () => {
  it("picks the allowed interval nearest the median replenishment cycle", () => {
    expect(suggestPlanInterval([56])).toBe(8);
    expect(suggestPlanInterval([35, 56, 56, 60])).toBe(8);
    expect(suggestPlanInterval([21, 28])).toBe(4);
    expect(suggestPlanInterval([112, 75])).toBe(12);
    expect(suggestPlanInterval([])).toBe(8);
  });
});

describe("suggestedQuantity", () => {
  it("suggests 2 SPFs per 8-week box (SPF lasts ~5 weeks)", () => {
    expect(suggestedQuantity(8, 35)).toBe(2);
  });
  it("suggests 1 when a product lasts the whole interval", () => {
    expect(suggestedQuantity(8, 56)).toBe(1);
    expect(suggestedQuantity(8, 60)).toBe(1);
  });
  it("tolerates a few days' shortfall and caps at 3", () => {
    expect(suggestedQuantity(4, 26)).toBe(1); // 28/26 ≈ 1.08 → 1
    expect(suggestedQuantity(12, 21)).toBe(3);
  });
});
