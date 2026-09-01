import { expect, test } from "@playwright/test";

/**
 * Judge mode (`/demo?judge=1`) is the sixty-second path: one button, a live
 * checklist, and the side-by-side proof. It is the first thing a judge sees,
 * so it is worth a test that walks it exactly as they would.
 */

test("judge mode walks the whole story from one button", async ({ page }) => {
  await page.goto("/demo?judge=1");

  const judge = page.getByRole("region", { name: "Judge mode" });
  await expect(judge).toBeVisible();

  // The transport is stated up front, and the tools are really registered.
  await expect(judge.getByText(/transport:/)).toBeVisible();
  await expect(judge.getByText(/tools on document\.modelContext/)).toBeVisible();
  await expect(judge.getByText("0/8 steps")).toBeVisible();

  await judge.getByRole("button", { name: "Start the run" }).click();

  // Discovery, audit and negotiation happen without any further input.
  await expect(judge.getByText("4/8 steps")).toBeVisible({ timeout: 30_000 });

  // The honest rejection is on screen before anything is touched: the run
  // asks for high_contrast, which this site does not declare.
  await expect(
    judge.getByText(/Negotiation: \d+ accepted, [1-9]\d* rejected/)
  ).toBeVisible();

  // Nothing may change until a human says so.
  const approval = judge.getByRole("alertdialog", {
    name: "Approval requested",
  });
  await expect(approval).toBeVisible();
  await approval.getByRole("button", { name: "Approve" }).click();

  // Adaptation and site-provided verification.
  await expect(judge.getByText(/Verification: PASS/)).toBeVisible({
    timeout: 30_000,
  });

  // The order is a second, separate gate.
  const confirmation = judge.getByRole("alertdialog", {
    name: "Order confirmation",
  });
  await expect(confirmation).toBeVisible({ timeout: 30_000 });
  await confirmation.getByRole("button", { name: "Confirm order" }).click();

  await expect(judge.getByText("8/8 steps")).toBeVisible({ timeout: 30_000 });
  await expect(judge.getByText(/^order /)).toBeVisible();
});

test("the side-by-side proof runs both lanes live and they disagree", async ({
  page,
}) => {
  await page.goto("/demo?judge=1");

  const race = page.getByRole("region", { name: "Side-by-side proof" });
  await race.getByRole("button", { name: "Run both lanes" }).click();

  // Lane A: a keyboard-only actuation agent cannot reach the size selector,
  // and has no contract to consult before it starts guessing.
  await expect(
    race.getByText(/none are in the tab order/)
  ).toBeVisible({ timeout: 30_000 });
  await expect(
    race.getByText(/No capability contract exists to query/)
  ).toBeVisible();

  // It gets there only by mutating a page that never authorized it.
  await expect(
    race.getByText(/the site was never asked, never consented/i)
  ).toBeVisible({ timeout: 30_000 });
  await expect(race.getByText("unauthorized mutations: 0")).toHaveCount(0);

  // Lane B pauses for the human, exactly like the guided run.
  const approval = race.getByRole("alertdialog", {
    name: "Approval requested",
  });
  await expect(approval).toBeVisible({ timeout: 30_000 });
  await approval.getByRole("button", { name: "Approve" }).click();

  // And finishes the task, verified by the site, with nothing unauthorized.
  await expect(
    race.getByText(/ORDER PLACED — verified by the site/)
  ).toBeVisible({ timeout: 60_000 });
  await expect(race.getByText("unauthorized mutations: 0")).toBeVisible();
  await expect(race.getByText("site verifications: 1")).toBeVisible();
});

test("judge mode is opt-in and does not alter the default demo", async ({
  page,
}) => {
  await page.goto("/demo");
  await expect(
    page.getByRole("region", { name: "Judge mode" })
  ).toHaveCount(0);
  await expect(
    page.getByRole("region", { name: "Side-by-side proof" })
  ).toHaveCount(0);
});
