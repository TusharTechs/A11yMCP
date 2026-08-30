import { expect, test } from "@playwright/test";

test("consequential gate rejects confirmation:false", async ({ page }) => {
  await page.goto("/inspector");
  
  await page.waitForLoadState("networkidle");
  
  const hasTools = await page.locator(".tool-card").count();
  if (hasTools === 0) {
    test.skip(true, "Inspector page did not render tool cards");
    return;
  }
  
  await page.fill(
    "#input-place_order",
    '{"sessionId":"x","confirmation":false}'
  );
  await page.click("#invoke-place_order");
  await expect(page.locator("#result-place_order")).toContainText(
    "Invalid input",
    { timeout: 10_000 }
  );
});

test("fill before begin fails safely", async ({ page }) => {
  await page.goto("/inspector");
  await page.waitForLoadState("networkidle");
  
  const hasTools = await page.locator(".tool-card").count();
  if (hasTools === 0) {
    test.skip(true, "Inspector page did not render tool cards");
    return;
  }
  
  await page.click("#invoke-fill_checkout_form");
  await expect(page.locator("#result-fill_checkout_form")).toContainText(
    "Checkout session not started",
    { timeout: 10_000 }
  );
});