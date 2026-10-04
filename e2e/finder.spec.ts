import AxeBuilder from "@axe-core/playwright";
import { expect as baseExpect, test, type Page } from "@playwright/test";

// Each step is a server round-trip (autosave); allow for cold dev compiles and remote databases.
const expect = baseExpect.configure({ timeout: 30_000 });

/** CUJ: Routine Finder, questionnaire → results → add routine to cart (docs/04 C4–C5). */

async function choose(page: Page, label: string | RegExp) {
  await page
    .getByText(label, { exact: typeof label === "string" })
    .first()
    .click();
}

async function next(page: Page) {
  await page.getByRole("button", { name: /^(Continue|See my routine)/ }).click();
}

test.describe("@finder routine finder", () => {
  test("a guest completes the consultation and adds the routine to the cart", async ({ page }) => {
    test.setTimeout(240_000);
    await page.goto("/finder");
    await page.getByRole("button", { name: "Start the consultation" }).click();
    await expect(page).toHaveURL(/\/finder\/[^/]+$/);

    // 1. Skin type
    await expect(page.getByRole("heading", { name: /feel by midday/ })).toBeVisible();
    await choose(page, "Shiny all over");
    await next(page);

    // 2. Concerns (ranked chips)
    await expect(page.getByRole("heading", { name: /most like to improve/ })).toBeVisible();
    await choose(page, "Breakouts");
    await choose(page, "Excess oil");
    await next(page);

    // 3. Sensitivity
    await expect(page.getByRole("heading", { name: /react to new products/ })).toBeVisible();
    await page.getByRole("radio", { name: "2" }).check({ force: true });
    await next(page);

    // 4. Reactions
    await choose(page, "None of these");
    await next(page);

    // 5. Conditions
    await expect(page.getByRole("heading", { name: /apply to you right now/ })).toBeVisible();
    await choose(page, "None of these");
    await next(page);

    // 6–7. Optional steps: skip current routine, keep default lifestyle.
    await page.getByRole("button", { name: "Skip" }).click();
    await expect(page.getByRole("heading", { name: "Your environment" })).toBeVisible();
    await next(page);

    // 8. Routine time
    await choose(page, "5 minutes");
    await next(page);

    // 9. Preferences (defaults), 10. Budget (default $80), 11. Notes (skip)
    await next(page);
    await expect(page.getByRole("heading", { name: /monthly skincare budget/ })).toBeVisible();
    await next(page);
    await expect(page.getByRole("heading", { name: /Anything else/ })).toBeVisible();
    await page.getByRole("button", { name: "Skip" }).click();

    // Results
    await expect(page).toHaveURL(/\/finder\/results\//, { timeout: 30_000 });
    await expect(
      page.getByRole("heading", { level: 1, name: /Built for oily skin/ }),
    ).toBeVisible();
    await expect(page.getByRole("tab", { name: /Recommended/ })).toHaveAttribute(
      "data-state",
      "active",
    );
    const panel = page.getByRole("tabpanel");
    await expect(panel.getByRole("heading", { name: "Morning" })).toBeVisible();
    await expect(panel.getByText(/Protect/).first()).toBeVisible();

    const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
    const serious = results.violations.filter((v) =>
      ["serious", "critical"].includes(v.impact ?? ""),
    );
    expect(serious, serious.map((v) => v.id).join(", ")).toEqual([]);

    await panel.getByRole("button", { name: "Add this routine to cart" }).click();
    await expect(page.getByText(/Added (all )?\d+ products/)).toBeVisible({ timeout: 20_000 });

    // A finished consultation can't be edited in place: the questions page redirects to results.
    const resultsUrl = page.url();
    await page.goto(resultsUrl.replace("/results", ""));
    await expect(page).toHaveURL(resultsUrl);
  });

  test("other visitors can't open someone else's consultation", async ({ page, browser }) => {
    await page.goto("/finder");
    await page.getByRole("button", { name: "Start the consultation" }).click();
    await expect(page).toHaveURL(/\/finder\/[^/]+$/);
    const url = page.url();

    // Private and noindex: strangers get the not-found page (status may be a streamed 200).
    const stranger = await browser.newContext();
    const strangerPage = await stranger.newPage();
    await strangerPage.goto(url);
    await expect(strangerPage.getByRole("heading", { name: /wandered off/ })).toBeVisible();
    await expect(strangerPage.getByRole("button", { name: /Continue/ })).toHaveCount(0);
    await stranger.close();
  });
});
