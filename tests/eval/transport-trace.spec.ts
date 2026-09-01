import { expect, test } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

/**
 * Captures a real WebMCP transport chain through document.modelContext:
 * registerTool -> getTools -> executeTool (read) -> executeTool (schema
 * rejection) -> executeTool (consequential gate) -> toolchange on
 * task-scoped register/unregister.
 *
 * Output: docs/evidence/webmcp-transport-trace.json — cited by
 * docs/STAGE_ONE_COMPLIANCE.md and README. Regenerate with
 * `npm run eval:webmcp`.
 */
test("webmcp transport trace via document.modelContext", async ({ page }) => {
  await page.goto("/demo");
  await page.waitForFunction(() => {
    const mc = (document as unknown as { modelContext?: { getTools?: () => unknown[] } })
      .modelContext;
    return Array.isArray(mc?.getTools?.());
  });

  const trace = await page.evaluate(async () => {
    const mc = (
      document as unknown as {
        modelContext?: {
          getTools: () => Array<{ name: string; origin?: string }>;
          executeTool: (n: string, i: unknown) => Promise<unknown>;
          __a11ymcpPolyfill?: boolean;
        };
      }
    ).modelContext!;

    const tools = mc.getTools();
    const read = await mc.executeTool("get_accessibility_capabilities", {});
    const badSchema = await mc.executeTool("search_products", {
      query: "x",
      evil: "payload",
    });
    const consequential = await mc.executeTool("place_order", {
      sessionId: "x",
      confirmation: false,
    });

    return {
      transport: mc.__a11ymcpPolyfill
        ? "A11yMCP spec-compatible polyfill"
        : "native document.modelContext",
      toolCount: tools.length,
      toolNames: tools.map((t) => t.name).sort(),
      toolOrigins: Array.from(new Set(tools.map((t) => t.origin ?? "native"))),
      readOk: (read as { ok?: boolean }).ok === true,
      badSchemaRejected: (badSchema as { ok?: boolean }).ok === false,
      consequentialRejected:
        (consequential as { ok?: boolean }).ok === false,
    };
  });

  // Task-scoped lifecycle: navigate away from the storefront, commerce
  // tools must disappear from getTools().
  await page.goto("/");
  await page.waitForFunction(() => {
    const mc = (document as unknown as { modelContext?: { getTools?: () => Array<{ name: string }> } })
      .modelContext;
    const names = (mc?.getTools?.() ?? []).map((t) => t.name);
    return !names.includes("place_order");
  });
  const afterUnmount = await page.evaluate(() => {
    const mc = (document as unknown as { modelContext?: { getTools: () => Array<{ name: string }> } })
      .modelContext!;
    return mc.getTools().map((t) => t.name).sort();
  });

  const payload = {
    capturedAt: new Date().toISOString(),
    environment: "playwright chromium via npm run dev",
    ...trace,
    commerceToolsUnregisteredOnUnmount:
      !afterUnmount.includes("place_order") &&
      !afterUnmount.includes("search_products"),
    coreToolsStillRegistered: afterUnmount.includes(
      "get_accessibility_capabilities"
    ),
  };

  mkdirSync(path.join(process.cwd(), "docs", "evidence"), { recursive: true });
  writeFileSync(
    path.join(process.cwd(), "docs", "evidence", "webmcp-transport-trace.json"),
    JSON.stringify(payload, null, 2)
  );

  expect(payload.readOk).toBe(true);
  expect(payload.badSchemaRejected).toBe(true);
  expect(payload.consequentialRejected).toBe(true);
  expect(payload.commerceToolsUnregisteredOnUnmount).toBe(true);
  expect(payload.coreToolsStillRegistered).toBe(true);
});
