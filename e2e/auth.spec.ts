import { expect, test } from "@playwright/test";

/**
 * Auth gates (docs/10 §5, docs/19 M2). Signed-out paths run everywhere. Signed-in role checks
 * (customer → 404, staff without MFA → /admin/mfa-required) need Clerk test users and
 * `@clerk/testing`; they land with the staging instance (docs/20).
 */
test.describe("@auth gates", () => {
  test("the admin area is indistinguishable from a 404 when signed out", async ({ page }) => {
    for (const path of ["/admin", "/admin/orders", "/admin/mfa-required"]) {
      const response = await page.goto(path);
      expect(response?.status(), path).toBe(404);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      await expect(page.getByRole("navigation", { name: "Admin" })).toHaveCount(0);
    }
  });

  test("admin API returns a JSON 404 when signed out", async ({ request }) => {
    const response = await request.get("/api/v1/admin/orders");
    expect(response.status()).toBe(404);
    expect(await response.json()).toMatchObject({ error: { code: "NOT_FOUND" } });
  });

  test("account pages send guests to sign in", async ({ page }) => {
    await page.goto("/account");
    await expect(page).toHaveURL(/\/sign-in/);
    await expect(page.getByRole("heading", { name: "Sign in to Nura Skin" })).toBeAttached();
  });

  test("the demo entry point is hidden outside the demo deployment", async ({ page }) => {
    await page.goto("/sign-in");
    await expect(page.getByRole("button", { name: "Try the admin demo" })).toHaveCount(0);
  });
});
