import { expect, test } from "@playwright/test";

test("golden path: keyboard-only purchase via guided agent", async ({
  page,
}) => {
  await page.goto("/demo");

  await page.getByRole("button", { name: "Keyboard-only checkout" }).click();

  await page
    .getByRole("button", { name: "Approve", exact: true })
    .click({ timeout: 30_000 });

  await page
    .getByRole("button", { name: "Confirm order" })
    .click({ timeout: 30_000 });

  // Verify the order completed (the heading appears in the fixture)
  await expect(
    page.getByRole("heading", { name: "Task completed successfully." })
  ).toBeVisible({ timeout: 30_000 });
  
  // Verify the agent phase is completed (target the specific chip in the agent panel)
  await expect(
    page
      .getByLabel("Guided agent")
      .locator(".chip")
      .filter({ hasText: /^phase: completed$/ })
      .first()
  ).toBeVisible({
    timeout: 30_000,
  });
});