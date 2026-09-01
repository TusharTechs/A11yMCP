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
    const mc = (
      document as unknown as {
        modelContext: {
          getTools: () => Array<{ name: string; origin?: string }>;
          executeTool: (n: string, i: unknown) => Promise<{ ok: boolean; data?: unknown; error?: { message: string } }>;
        };
      }
    ).modelContext;

    const tools = mc.getTools();
    const caps = await mc.executeTool("get_accessibility_capabilities", {});
    const neg = await mc.executeTool("negotiate_accessibility_profile", {
      needs: ["keyboard_only", "strong_focus", "high_contrast"],
    });
    const noApproval = await mc.executeTool("apply_accessibility_adaptation", {
      capabilityId: "keyboard_navigation",
    });
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

    const verify = await mc.executeTool("verify_accessibility_profile", {});
    const rollback = await mc.executeTool("rollback_accessibility_adaptations", {});

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
  expect(result.verifyPass).toBe(true);
  expect(result.advisoriesReported).toBe(true);
  expect(result.rolledBack).toBe(true);
  expect(result.radioFocusableAfterApply).toBe(true);
  expect(result.radioFocusableAfterRollback).toBe(false);
});
