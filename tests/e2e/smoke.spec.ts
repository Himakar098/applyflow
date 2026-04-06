import { expect, test, type Page } from "@playwright/test";

const email = process.env.E2E_TEST_EMAIL;
const password = process.env.E2E_TEST_PASSWORD;

async function login(page: Page) {
  if (!email || !password) {
    test.skip(true, "Set E2E_TEST_EMAIL and E2E_TEST_PASSWORD for authenticated smoke tests.");
  }

  await page.goto("/login");
  await page.getByPlaceholder("work@email.com").fill(email as string);
  await page.getByPlaceholder("••••••••").fill(password as string);
  await Promise.all([
    page.waitForURL("**/dashboard"),
    page.getByRole("button", { name: "Continue" }).click(),
  ]);
}

test("marketing + auth pages render", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /One workspace for your entire job search/i })).toBeVisible();

  await page.goto("/pricing");
  await expect(page.getByRole("heading", { name: /Current access/i })).toBeVisible();

  await page.goto("/resources");
  await expect(page.getByRole("heading", { name: /Public reference pages/i })).toBeVisible();

  await page.goto("/about");
  await expect(page.getByRole("heading", { name: /ApplyFlow is built by Omnari Group/i })).toBeVisible();

  await page.goto("/forgot-password");
  await expect(page.getByText("Reset your password", { exact: true })).toBeVisible();
});

test.describe("authenticated smoke", () => {
  test.beforeEach(async ({ page }) => {
    test.skip(
      !email || !password,
      "Set E2E_TEST_EMAIL and E2E_TEST_PASSWORD for authenticated smoke tests.",
    );
    await login(page);
  });

  test("profile save + recommendations refresh", async ({ page }) => {
    await page.goto("/settings");

    await page.getByLabel("Target roles").fill("Business Analyst, Product Analyst");
    await page.getByLabel("Preferred country").fill("Australia");
    await page.getByLabel("Preferred state / region").fill("Western Australia");
    await page.getByLabel("Preferred city").fill("Perth");
    await page.getByLabel("Work mode preference").fill("remote, hybrid");
    await page.getByLabel("Seniority preference").fill("entry, mid");

    const saveResponsePromise = page.waitForResponse((resp) =>
      resp.url().includes("/api/profile/save") && resp.request().method() === "POST",
    );
    await page.getByRole("button", { name: "Save profile" }).click();
    const saveResponse = await saveResponsePromise;
    expect(saveResponse.ok()).toBeTruthy();

    await page.goto("/recommendations");
    const recResponse = await page.waitForResponse((resp) =>
      resp.url().includes("/api/recommendations") && resp.request().method() === "GET",
    );
    expect(recResponse.ok()).toBeTruthy();
    await expect(page.getByRole("button", { name: /Refresh recommendations/i })).toBeVisible();
  });

  test("search request succeeds", async ({ page }) => {
    await page.goto("/search");
    await page.getByLabel("Role / Keywords").fill("Business Analyst");
    await page.getByLabel("Location").fill("Perth");

    const searchResponsePromise = page.waitForResponse((resp) =>
      resp.url().includes("/api/jobs/search") && resp.request().method() === "POST",
    );
    await page.getByRole("button", { name: "Search" }).click();
    const searchResponse = await searchResponsePromise;
    expect(searchResponse.ok()).toBeTruthy();

    await expect(page.getByRole("heading", { name: "Results" })).toBeVisible();
  });
});
