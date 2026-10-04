import { describe, expect, it } from "vitest";

import { buildTokensCss, type Tokens } from "./build-tokens";
import { contrastRatio } from "./contrast";
import tokensJson from "./tokens.json";

const tokens = tokensJson as unknown as Tokens & {
  contrast: { pairs: [string, string, number][] };
};

describe("contrastRatio", () => {
  it("matches known WCAG reference values", () => {
    expect(contrastRatio("#000000", "#FFFFFF")).toBeCloseTo(21, 5);
    expect(contrastRatio("#FFFFFF", "#FFFFFF")).toBeCloseTo(1, 5);
    // #767676 on white is the classic 4.54:1 threshold grey.
    expect(contrastRatio("#767676", "#FFFFFF")).toBeCloseTo(4.54, 2);
  });
});

describe.each(["light", "dark"] as const)("design tokens: %s theme", (theme) => {
  const palette = tokens.color[theme];

  it.each(tokens.contrast.pairs)("%s on %s ≥ %s:1 (WCAG 2.2 AA)", (fg, bg, min) => {
    const f = palette[fg];
    const b = palette[bg];
    expect(f, `missing token ${fg}`).toBeDefined();
    expect(b, `missing token ${bg}`).toBeDefined();
    expect(contrastRatio(f!, b!)).toBeGreaterThanOrEqual(min);
  });
});

describe("buildTokensCss", () => {
  const css = buildTokensCss(tokens);

  it("emits light and dark semantic variables for every token", () => {
    for (const key of Object.keys(tokens.color.light)) {
      expect(css).toContain(`--${key}: ${tokens.color.light[key]};`);
      expect(css).toContain(`--${key}: ${tokens.color.dark[key]};`);
      expect(css).toContain(`--color-${key}: var(--${key});`);
    }
  });

  it("emits the type scale with line-height and tracking", () => {
    expect(css).toContain("--text-display-2xl:");
    expect(css).toContain("--text-display-2xl--line-height: 1.02;");
    expect(css).toContain("--text-overline--letter-spacing: 0.12em;");
  });

  it("rejects themes with mismatched keys", () => {
    const broken = structuredClone(tokens);
    delete (broken.color.dark as Record<string, string>).foreground;
    expect(() => buildTokensCss(broken)).toThrow(/Missing in dark: \[foreground\]/);
  });
});
