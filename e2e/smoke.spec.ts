import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test.describe("@smoke foundations", () => {
  test("home renders with landmarks and a single h1", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("banner")).toBeVisible();
    await expect(page.getByRole("main")).toBeVisible();
    await expect(page.getByRole("contentinfo")).toBeVisible();
    await expect(page.locator("h1")).toHaveCount(1);
  });

  test("stylesheets load and design tokens apply (regression: CSP broke WebKit)", async ({
    page,
  }) => {
    await page.emulateMedia({ colorScheme: "light" });
    await page.goto("/");
    // --background token (#FAF7F2) must reach <body>; an unstyled page has a transparent body.
    await expect(page.locator("body")).toHaveCSS("background-color", "rgb(250, 247, 242)");
    const cta = page.getByRole("link", { name: "Find my routine" });
    const box = await cta.boundingBox();
    expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
  });

  test("skip link is the first keyboard stop", async ({ page, isMobile }) => {
    // Touch devices have no Tab navigation (and WebKit doesn't tab to links by default).
    test.skip(isMobile, "keyboard navigation is a desktop concern");
    await page.goto("/");
    await page.keyboard.press("Tab");
    await expect(page.getByRole("link", { name: "Skip to content" })).toBeFocused();
  });

  test("home has no serious or critical accessibility violations (light & dark)", async ({
    page,
  }) => {
    for (const colorScheme of ["light", "dark"] as const) {
      await page.emulateMedia({ colorScheme });
      await page.goto("/");
      const results = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag22aa"])
        .analyze();
      const blocking = results.violations.filter(
        (v) => v.impact === "serious" || v.impact === "critical",
      );
      expect(blocking, JSON.stringify(blocking.map((v) => v.id))).toEqual([]);
    }
  });

  test("unknown routes render the branded 404", async ({ page }) => {
    const response = await page.goto("/this-page-does-not-exist");
    expect(response?.status()).toBe(404);
    await expect(page.getByRole("heading", { name: /wandered off/i })).toBeVisible();
  });

  test("security headers are present", async ({ request }) => {
    const response = await request.get("/");
    const headers = response.headers();
    expect(headers["x-content-type-options"]).toBe("nosniff");
    expect(headers["referrer-policy"]).toBe("strict-origin-when-cross-origin");
    expect(headers["x-powered-by"]).toBeUndefined();
  });
});
