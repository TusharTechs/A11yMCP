import { expect, test } from "@playwright/test";

/**
 * The drop-in adapter (public/a11ymcp-adapter.js) on a plain static HTML
 * page (public/partner/index.html) that the A11yMCP app does not render.
 * Proves the contract model works decoupled: manifest + one script tag.
 */
test("static partner page becomes agent-adaptable via the drop-in adapter", async ({
  page,
}) => {
  await page.goto("/partner");
  await page.waitForFunction(() => {
    const mc = (document as unknown as { modelContext?: { getTools?: () => unknown[] } })
      .modelContext;
    return (mc?.getTools?.() ?? []).length > 0;
  });

  const result = await page.evaluate(async () => {
    type McpResult = {
      content?: Array<{ type?: string; text?: string }>;
      structuredContent?: { ok?: boolean; data?: unknown; error?: { message: string } };
      isError?: boolean;
    };
    const mc = (
      document as unknown as {
        modelContext: {
          getTools: () => Array<{ name: string; origin?: string }>;
          executeTool: (n: unknown, i: unknown) => Promise<McpResult>;
        };
      }
    ).modelContext;

    // Adapter tools are MCP tools: unwrap the { ok, data } payload the
    // envelope carries in structuredContent.
    const unwrap = (r: McpResult) =>
      (r?.structuredContent ?? {}) as {
        ok?: boolean;
        data?: unknown;
        error?: { message: string };
      };
    const isMcpShaped = (r: McpResult): boolean =>
      Array.isArray(r?.content) &&
      r.content.length > 0 &&
      r.content.every((b) => b?.type === "text" && typeof b.text === "string");

    const tools = mc.getTools();
    const capsRaw = await mc.executeTool("get_accessibility_capabilities", {});
    const caps = unwrap(capsRaw);
    const neg = unwrap(
      await mc.executeTool("negotiate_accessibility_profile", {
        needs: ["keyboard_only", "strong_focus", "high_contrast"],
      })
    );
    const noApprovalRaw = await mc.executeTool("apply_accessibility_adaptation", {
      capabilityId: "keyboard_navigation",
    });
    const noApproval = unwrap(noApprovalRaw);
    // Native WebMCP passes a tool descriptor and a JSON string.
    const nativeStyle = unwrap(
      await mc.executeTool(
        tools.find((t) => t.name === "audit_accessibility"),
        JSON.stringify({})
      )
    );
    await mc.executeTool("apply_accessibility_adaptation", {
      capabilityId: "keyboard_navigation",
      approval: true,
    });
    await mc.executeTool("apply_accessibility_adaptation", {
      capabilityId: "focus_visibility",
      approval: true,
    });

    // keyboard fix is live now — before rollback
    const firstRadio = document.querySelector('[role="radio"]') as HTMLElement | null;
    firstRadio?.focus();
    const radioFocusableAfterApply = document.activeElement === firstRadio;

    const verify = unwrap(await mc.executeTool("verify_accessibility_profile", {}));
    const rollback = unwrap(
      await mc.executeTool("rollback_accessibility_adaptations", {})
    );

    // rollback must have reverted the tabindex
    firstRadio?.focus();
    const radioFocusableAfterRollback = document.activeElement === firstRadio;

    return {
      radioFocusableAfterApply,
      radioFocusableAfterRollback,
      toolCount: tools.length,
      hasDeclarativeForm: tools.some((t) => t.name === "fill_book_order"),
      hasAutoSubmitForm: tools.some((t) => t.name === "search_catalogue"),
      origin: tools[0]?.origin,
      capsSite: (caps.data as { site?: string }).site,
      capsSource: (caps.data as { source?: string }).source,
      rejectedHighContrast:
        ((neg.data as { rejected?: Array<{ need: string }> }).rejected ?? []).some(
          (r) => r.need === "high_contrast"
        ),
      approvalEnforced: noApproval.ok === false,
      resultsAreMcpShaped: isMcpShaped(capsRaw) && isMcpShaped(noApprovalRaw),
      errorFlagsIsError: noApprovalRaw.isError === true,
      descriptorAndJsonStringAccepted: nativeStyle.ok === true,
      verifyPass: (verify.data as { taskAccessibility?: string }).taskAccessibility === "PASS",
      advisoriesReported:
        ((verify.data as { advisories?: unknown[] }).advisories ?? []).length > 0,
      rolledBack: (rollback.data as { success?: boolean }).success === true,
    };
  });

  expect(result.toolCount).toBe(8); // 6 imperative + 2 declarative forms
  expect(result.hasDeclarativeForm).toBe(true);
  expect(result.hasAutoSubmitForm).toBe(true);
  expect(result.origin).toBe("a11ymcp-adapter");
  expect(result.capsSite).toBe("Vellum Books");
  expect(result.capsSource).toBe("/partner/a11ymcp.json");
  expect(result.rejectedHighContrast).toBe(true);
  expect(result.approvalEnforced).toBe(true);
  expect(result.resultsAreMcpShaped).toBe(true);
  expect(result.errorFlagsIsError).toBe(true);
  expect(result.descriptorAndJsonStringAccepted).toBe(true);
  expect(result.verifyPass).toBe(true);
  expect(result.advisoriesReported).toBe(true);
  expect(result.rolledBack).toBe(true);
  expect(result.radioFocusableAfterApply).toBe(true);
  expect(result.radioFocusableAfterRollback).toBe(false);
});

/**
 * The declarative API, as Chrome documents it: the schema is derived from the
 * fields (types, enums, required, per-field descriptions), and `toolautosubmit`
 * is what separates "the agent may do this outright" from "the agent may
 * prepare this, and a person presses the button".
 */
test("declarative forms derive a real schema and respect toolautosubmit", async ({
  page,
}) => {
  await page.goto("/partner");
  await page.waitForFunction(() => {
    const mc = (document as unknown as { modelContext?: { getTools?: () => unknown[] } })
      .modelContext;
    return (mc?.getTools?.() ?? []).length > 0;
  });

  // Reveal the checkout so its form is in the DOM.
  await page.getByRole("button", { name: "Add to basket" }).click();
  await page.reload();
  await page.waitForFunction(() => {
    const mc = (document as unknown as { modelContext?: { getTools?: () => Array<{ name: string }> } })
      .modelContext;
    return (mc?.getTools?.() ?? []).some((t) => t.name === "search_catalogue");
  });

  const result = await page.evaluate(async () => {
    const mc = (
      document as unknown as {
        modelContext: {
          getTools: () => Array<{
            name: string;
            inputSchema?: {
              properties?: Record<string, { type?: string; description?: string; format?: string }>;
              required?: string[];
            };
            annotations?: { destructiveHint?: boolean };
          }>;
          executeTool: (n: unknown, i: unknown) => Promise<{
            structuredContent?: { ok?: boolean; data?: { submitted?: boolean; filled?: string[] } };
          }>;
        };
      }
    ).modelContext;

    const tools = mc.getTools();
    const search = tools.find((t) => t.name === "search_catalogue");

    // The harmless, autosubmitting tool really runs the search.
    const ran = await mc.executeTool("search_catalogue", { query: "salt" });

    return {
      searchRequired: search?.inputSchema?.required ?? [],
      searchDescription:
        search?.inputSchema?.properties?.query?.description ?? null,
      searchDestructive: search?.annotations?.destructiveHint ?? null,
      searchSubmitted: ran.structuredContent?.data?.submitted ?? null,
      resultText: document.getElementById("search-result")?.textContent ?? "",
    };
  });

  // The schema carries what the author annotated, not just field names.
  expect(result.searchRequired).toContain("query");
  expect(result.searchDescription).toContain("Words to search");
  expect(result.searchDestructive).toBe(true);
  expect(result.searchSubmitted).toBe(true);
  expect(result.resultText).toContain("salt");
});

test("a consequential declarative form is filled but never submitted", async ({
  page,
}) => {
  await page.goto("/partner");
  await page.getByRole("button", { name: "Add to basket" }).click();
  await page.waitForFunction(() => {
    const mc = (document as unknown as { modelContext?: { getTools?: () => Array<{ name: string }> } })
      .modelContext;
    return (mc?.getTools?.() ?? []).some((t) => t.name === "fill_book_order");
  });

  const result = await page.evaluate(async () => {
    const mc = (
      document as unknown as {
        modelContext: {
          getTools: () => Array<{
            name: string;
            inputSchema?: {
              properties?: Record<string, { format?: string; description?: string }>;
              required?: string[];
            };
            annotations?: { destructiveHint?: boolean };
          }>;
          executeTool: (n: unknown, i: unknown) => Promise<{
            structuredContent?: {
              data?: { submitted?: boolean; filled?: string[]; nextStep?: string | null };
            };
          }>;
        };
      }
    ).modelContext;

    const order = mc.getTools().find((t) => t.name === "fill_book_order");
    const filled = await mc.executeTool("fill_book_order", {
      email: "alex@example.com",
      fullName: "Alex Sharma",
      address: "12 Lake Street",
    });

    return {
      emailFormat: order?.inputSchema?.properties?.email?.format ?? null,
      addressDescription:
        order?.inputSchema?.properties?.address?.description ?? null,
      required: order?.inputSchema?.required ?? [],
      destructive: order?.annotations?.destructiveHint ?? null,
      submitted: filled.structuredContent?.data?.submitted ?? null,
      filledFields: filled.structuredContent?.data?.filled ?? [],
      nextStep: filled.structuredContent?.data?.nextStep ?? null,
      emailValue: (document.querySelector('#checkout [name="email"]') as HTMLInputElement)?.value,
      // The order must NOT have been placed.
      orderPlaced: /thank|placed|confirmed/i.test(document.body.innerText),
    };
  });

  expect(result.emailFormat).toBe("email");
  expect(result.addressDescription).toContain("postal code");
  expect(result.required).toEqual(
    expect.arrayContaining(["email", "fullName", "address"])
  );
  // No toolautosubmit: the agent stages the values, the person submits.
  expect(result.destructive).toBe(false);
  expect(result.submitted).toBe(false);
  expect(result.filledFields).toEqual(["email", "fullName", "address"]);
  expect(result.nextStep).toContain("not submitted");
  expect(result.emailValue).toBe("alex@example.com");
  expect(result.orderPlaced).toBe(false);
});

/**
 * The probe bookmarklet. Its job is to make the *absence* of a contract
 * visible on an ordinary page — and, just as importantly, to change nothing
 * while doing it.
 */
test("the probe reports a declared contract, and adds nothing but its panel", async ({
  page,
}) => {
  await page.goto("/partner");
  await page.waitForFunction(() => {
    const mc = (document as unknown as { modelContext?: { getTools?: () => unknown[] } })
      .modelContext;
    return (mc?.getTools?.() ?? []).length > 0;
  });

  const before = await page.evaluate(() => ({
    html: document.body.innerHTML.length,
    tabindexed: document.querySelectorAll("[tabindex]").length,
  }));

  await page.addScriptTag({ path: "public/a11ymcp-probe.js" });
  const panel = page.locator("#a11ymcp-probe-panel");
  await expect(panel).toBeVisible();
  await expect(panel.getByText("declared")).toBeVisible();
  await expect(panel.getByText("page polyfill")).toBeVisible();

  // It must not have adapted anything: the page is as it was, apart from
  // the panel itself.
  const after = await page.evaluate(() => {
    const p = document.getElementById("a11ymcp-probe-panel");
    const size = p ? p.outerHTML.length : 0;
    return {
      html: document.body.innerHTML.length - size,
      tabindexed: document.querySelectorAll(
        "[tabindex]:not(#a11ymcp-probe-panel)"
      ).length,
    };
  });
  expect(after.tabindexed).toBe(before.tabindexed);
  expect(Math.abs(after.html - before.html)).toBeLessThan(200);

  // Escape dismisses it, leaving no trace.
  await page.keyboard.press("Escape");
  await expect(panel).toHaveCount(0);
});

test("the probe says 'none' on a page with no contract", async ({ page }) => {
  // about:blank origin: no modelContext, and the /.well-known fetch fails.
  await page.setContent("<html><body><h1>An ordinary page</h1></body></html>");
  await page.addScriptTag({ path: "public/a11ymcp-probe.js" });

  const panel = page.locator("#a11ymcp-probe-panel");
  await expect(panel).toBeVisible();
  await expect(panel.getByText("none", { exact: true }).first()).toBeVisible();
  await expect(
    panel.getByText(/inject CSS or attributes the site never authorised/)
  ).toBeVisible();
  await expect(
    panel.getByText(/will not adapt the page/)
  ).toBeVisible();
});
