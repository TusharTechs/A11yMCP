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
      hasDeclarativeForm: tools.some((t) => t.name === "place_book_order"),
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

  expect(result.toolCount).toBe(7); // 6 imperative + 1 declarative form
  expect(result.hasDeclarativeForm).toBe(true);
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
