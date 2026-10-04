import { catalogDecision, catalogPath, type SlugIndex } from "./catalog-gate";

const index: SlugIndex = {
  products: new Set(["clear-serum"]),
  routines: new Set(["glow-routine"]),
  retired: new Set(["old-serum", "old-routine"]),
  categories: new Set(["serums"]),
  ingredients: new Set(["niacinamide"]),
  concerns: new Set(["acne"]),
  legal: new Set(["privacy"]),
  redirects: new Map([
    ["product:clear-serum-v1", "clear-serum"],
    ["category:treatments", "serums"],
    ["ingredient:vitamin-b3", "niacinamide"],
  ]),
};

const decide = (path: string) => catalogDecision(path, index);

describe("catalogPath", () => {
  it("matches exactly /<prefix>/<slug>", () => {
    expect(catalogPath("/products/clear-serum")).toEqual(["products", "clear-serum"]);
    expect(catalogPath("/products")).toBeNull();
    expect(catalogPath("/products/a/b")).toBeNull();
    expect(catalogPath("/products/")).toBeNull();
    expect(catalogPath("/admin/x")).toBeNull();
    expect(catalogPath("/shop/serums")).toEqual(["shop", "serums"]);
  });

  it("decodes slugs and never throws on malformed escapes", () => {
    expect(catalogPath("/products/clear%2Dserum")).toEqual(["products", "clear-serum"]);
    expect(decide("/products/%E0%A4%A")).toEqual({ kind: "not-found" });
  });
});

describe("catalogDecision", () => {
  it("allows live slugs and ignores other paths", () => {
    for (const p of [
      "/products/clear-serum",
      "/routines/glow-routine",
      "/shop/serums",
      "/ingredients/niacinamide",
      "/concerns/acne",
      "/legal/privacy",
      "/",
      "/shop",
      "/cart",
      "/api/v1/search",
    ]) {
      expect(decide(p), p).toEqual({ kind: "allow" });
    }
  });

  it("returns 404 for unknown slugs", () => {
    for (const p of [
      "/products/nope",
      "/routines/clear-serum",
      "/shop/nope",
      "/ingredients/nope",
      "/concerns/nope",
      "/legal/nope",
    ]) {
      expect(decide(p), p).toEqual({ kind: "not-found" });
    }
  });

  it("returns 410 for retired products and routines", () => {
    expect(decide("/products/old-serum")).toEqual({ kind: "gone" });
    expect(decide("/routines/old-routine")).toEqual({ kind: "gone" });
  });

  it("redirects moved slugs and misplaced routines", () => {
    expect(decide("/products/glow-routine")).toEqual({
      kind: "redirect",
      to: "/routines/glow-routine",
    });
    expect(decide("/products/clear-serum-v1")).toEqual({
      kind: "redirect",
      to: "/products/clear-serum",
    });
    expect(decide("/shop/treatments")).toEqual({ kind: "redirect", to: "/shop/serums" });
    expect(decide("/shop/routines")).toEqual({ kind: "redirect", to: "/routines" });
    expect(decide("/ingredients/vitamin-b3")).toEqual({
      kind: "redirect",
      to: "/ingredients/niacinamide",
    });
  });
});
