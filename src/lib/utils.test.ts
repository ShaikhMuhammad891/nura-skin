import { describe, expect, it } from "vitest";

import { cn } from "./utils";

describe("cn", () => {
  it("keeps a colour class alongside a custom font-size class", () => {
    const classes = cn("text-accent-foreground", "text-body").split(" ");
    expect(classes).toContain("text-accent-foreground");
    expect(classes).toContain("text-body");
  });

  it("still resolves conflicts within the custom font-size scale", () => {
    expect(cn("text-body", "text-display-xl")).toBe("text-display-xl");
  });

  it("still resolves colour conflicts", () => {
    expect(cn("text-foreground", "text-link")).toBe("text-link");
  });
});
