import { expect, test } from "@playwright/test";

/**
 * Cross-origin tools.
 *
 * The widget runs in a sandboxed iframe without `allow-same-origin`, so it
 * has an opaque origin: no shared globals, no shared storage, and
 * `postMessage` as the only channel. That makes these assertions meaningful
 * — the embedder genuinely cannot reach past what the widget answers.
 */

test("the embedder sees only the tools the widget exposed to it", async ({
  page,
}) => {
  await page.goto("/inspector");

  const section = page.getByRole("region", { name: "Cross-origin tools" });
  await expect(section).toBeVisible();

  // The Permissions Policy the spec requires for a frame to expose tools.
  const frame = section.locator("iframe.tool-frame");
  await expect(frame).toHaveAttribute("allow", "tools");
  await expect(frame).toHaveAttribute("sandbox", "allow-scripts");

  await section.getByRole("button", { name: "Ask the widget for its tools" }).click();

  // Two of three: the widget opted in `get_next_departures` and
  // `get_step_free_route`, and never exposed `charge_travel_card`.
  await expect(section.getByText("2 of 3 tools visible")).toBeVisible({
    timeout: 15_000,
  });
  await expect(
    section.getByText(/getTools\(\) → 2 tool\(s\): get_next_departures, get_step_free_route/)
  ).toBeVisible();

  // The exposed tool really runs, inside the widget's own document.
  await expect(
    section.getByText(/executeTool\("get_next_departures"\) → .*Central Quay/)
  ).toBeVisible({ timeout: 15_000 });

  // And the tool that was never exposed is refused by name, not silently
  // missing — "you may not" and "there is nothing" are different answers.
  await expect(
    section.getByText(
      /executeTool\("charge_travel_card"\) → Tool "charge_travel_card" is not exposed to/
    )
  ).toBeVisible({ timeout: 15_000 });
});

test("the widget refuses an embedder it was not configured to trust", async ({
  page,
}) => {
  await page.goto("/inspector");
  const section = page.getByRole("region", { name: "Cross-origin tools" });

  // Reconfigure the widget to trust a different site. Nothing about the
  // embedding page changes; it simply stops getting answers.
  await section
    .getByRole("checkbox", { name: "the widget trusts this origin" })
    .uncheck();
  await section.getByRole("button", { name: "Ask the widget for its tools" }).click();

  await expect(
    section.getByText(/may not access this document's tools/)
  ).toBeVisible({ timeout: 15_000 });
  await expect(section.getByText("2 of 3 tools visible")).toHaveCount(0);
});

test("the widget itself logs every decision it made", async ({ page }) => {
  await page.goto("/inspector");
  const section = page.getByRole("region", { name: "Cross-origin tools" });
  await section.getByRole("button", { name: "Ask the widget for its tools" }).click();

  const widget = page.frameLocator("iframe.tool-frame");
  await expect(widget.getByText(/may see 2 of \d+ tools/)).toBeVisible({
    timeout: 15_000,
  });
  await expect(
    widget.getByText(/asked for "charge_travel_card", which is not exposed to it/)
  ).toBeVisible();
  // The widget names what it keeps private, on its own page.
  await expect(widget.getByText("charge_travel_card").first()).toBeVisible();
});
