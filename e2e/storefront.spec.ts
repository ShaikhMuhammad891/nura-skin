import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

/** CUJ-04 (browse part) and M3 storefront templates (docs/19 M3). Needs the seeded database. */
test.describe("@storefront browse", () => {
  test("shop → filter → product detail", async ({ page, isMobile }) => {
    await page.goto("/shop");
    await expect(page.getByRole("heading", { level: 1, name: "Shop all" })).toBeVisible();

    const status = page
      .getByRole("status")
      .filter({ hasText: /products?$/ })
      .first();
    const before = Number((await status.textContent())?.split(" ")[0]);

    // On phones the facets live in a collapsed native disclosure.
    if (isMobile) await page.getByText("Filters", { exact: false }).first().click();
    // Facets are plain links, so this works with or without JavaScript.
    await page
      .getByRole("link", { name: /^Fragrance-free/ })
      .filter({ visible: true })
      .first()
      .click();
    await expect(page).toHaveURL(/pref=fragrance-free/);
    await expect(
      page.getByRole("link", { name: /Fragrance-free \(remove filter\)/ }),
    ).toBeVisible();
    const after = Number((await status.textContent())?.split(" ")[0]);
    expect(after).toBeLessThanOrEqual(before);

    await page.goto("/products/clear-serum");
    await expect(page.getByRole("heading", { level: 1, name: "Clear Serum" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Key actives" })).toBeVisible();
    await expect(page.getByRole("button", { name: /Add to cart|Out of stock/ })).toBeVisible();
    await expect(page.locator('script[type="application/ld+json"]')).not.toHaveCount(0);
  });

  test("unknown products are real 404s and routines redirect", async ({ request }) => {
    // Decided by the proxy catalogue gate before any shell streams (ADR-0020).
    for (const path of [
      "/products/does-not-exist",
      "/routines/clear-serum",
      "/shop/nope",
      "/ingredients/nope",
      "/concerns/nope",
      "/legal/nope",
    ]) {
      expect((await request.get(path)).status(), path).toBe(404);
    }
    expect((await request.get("/products/clear-serum")).status()).toBe(200);
    const moved = await request.get("/products/barrier-rescue-routine", { maxRedirects: 0 });
    expect(moved.status()).toBe(308);
    expect(moved.headers().location).toContain("/routines/barrier-rescue-routine");
  });

  test("search finds products despite typos", async ({ page }) => {
    await page.goto("/search?q=niacinamde");
    await expect(page.getByRole("heading", { name: "Ingredients" })).toBeVisible();
  });

  test("PLP and PDP have no serious accessibility violations", async ({ page }) => {
    for (const path of ["/shop", "/products/renew-night-serum", "/routines/glow-routine"]) {
      await page.goto(path);
      const results = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag22aa"])
        .analyze();
      const serious = results.violations.filter((v) =>
        ["serious", "critical"].includes(v.impact ?? ""),
      );
      expect(serious, `${path}: ${serious.map((v) => v.id).join(", ")}`).toEqual([]);
    }
  });
});
