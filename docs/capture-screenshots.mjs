/**
 * Regenerates docs/screenshots/*.png from a locally running instance.
 *
 *   npm run dev            # terminal A
 *   node docs/capture-screenshots.mjs   # terminal B
 *
 * Drives headless Chromium at 2x. Nothing here needs an account or a key.
 */
import { chromium } from "@playwright/test";
import { mkdirSync } from "node:fs";
import path from "node:path";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const OUT = path.join(process.cwd(), "docs", "screenshots");
mkdirSync(OUT, { recursive: true });

const shot = async (page, name) => {
  // remove the Next.js dev-mode overlay so it isn't in the screenshots
  await page
    .evaluate(() => {
      document.querySelectorAll("nextjs-portal").forEach((el) => el.remove());
    })
    .catch(() => {});
  await page.screenshot({ path: path.join(OUT, name), animations: "disabled" });
};

const browser = await chromium.launch();
const page = await browser.newPage({
  viewport: { width: 1280, height: 900 },
  deviceScaleFactor: 2,
});

// 1 — landing
await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
await shot(page, "01-landing.png");

// 2 — demo, task BLOCKED before adaptation
await page.goto(`${BASE}/demo`, { waitUntil: "networkidle" });
await page.waitForSelector("text=task accessibility: BLOCKED");
await shot(page, "02-demo-blocked.png");

// 3 — negotiation + honest rejection (agent paused at the approval gate)
await page.getByRole("button", { name: "Keyboard-only checkout" }).click();
await page.getByRole("button", { name: "Approve", exact: true }).waitFor({ timeout: 30000 });
await shot(page, "03-negotiation-approval.png");

// 4 — adapted + verified + order placed
await page.getByRole("button", { name: "Approve", exact: true }).click();
await page.getByRole("button", { name: "Confirm order" }).click({ timeout: 30000 });
await page
  .getByRole("heading", { name: "Task completed successfully." })
  .waitFor({ timeout: 30000 });
await page.getByRole("button", { name: "Verify" }).click();
await page.waitForTimeout(400);
await shot(page, "04-adapted-verified.png");

// 5 — inspector chain verification + live transport
await page.goto(`${BASE}/inspector`, { waitUntil: "networkidle" });
await page.getByRole("button", { name: "Run chain verification" }).click();
await page.waitForSelector("text=Live transport:");
await shot(page, "05-inspector-chain.png");

// 6 — drop-in adapter on a static third-party page
await page.goto(`${BASE}/partner`, { waitUntil: "networkidle" });
await page.waitForFunction(() => {
  const mc = document.modelContext;
  return mc && mc.getTools && mc.getTools().length > 0;
});
await shot(page, "06-partner-adapter.png");

// 7 — judge mode: the one-button checklist, mid-run at the approval gate
await page.goto(`${BASE}/demo?judge=1`, { waitUntil: "networkidle" });
const judge = page.getByRole("region", { name: "Judge mode" });
await judge.getByRole("button", { name: "Start the run" }).click();
await judge
  .getByRole("alertdialog", { name: "Approval requested" })
  .waitFor({ timeout: 30000 });
await shot(page, "07-judge-mode.png");

// 8 — the side-by-side proof, both lanes finished
await judge.getByRole("button", { name: "Approve", exact: true }).click();
await judge
  .getByRole("alertdialog", { name: "Order confirmation" })
  .waitFor({ timeout: 30000 });
await judge.getByRole("button", { name: "Confirm order" }).click();

const race = page.getByRole("region", { name: "Side-by-side proof" });
await race.getByRole("button", { name: "Run both lanes" }).click();
await race
  .getByRole("alertdialog", { name: "Approval requested" })
  .waitFor({ timeout: 30000 });
await race.getByRole("button", { name: "Approve", exact: true }).click();
await race
  .getByText(/ORDER PLACED — verified by the site/)
  .waitFor({ timeout: 60000 });
await race.scrollIntoViewIfNeeded();
await shot(page, "08-proof-race.png");

await browser.close();
console.log(`Wrote screenshots to ${OUT}`);
