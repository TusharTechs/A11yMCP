import { beforeEach, describe, expect, it } from "vitest";
import { executeA11yTool, type ToolResult } from "@/lib/webmcp/runtime";
import { registerWebMCPToolsOnce, setAgentCallbacks } from "@/lib/webmcp/tools";

registerWebMCPToolsOnce();

function dataOf(result: ToolResult): unknown {
  if (!result.ok) {
    throw new Error(
      `Expected successful tool result, got: ${result.error.message}`
    );
  }
  return result.data;
}

describe("security negatives", () => {
  beforeEach(() => {
    setAgentCallbacks({
      logEvent: () => {},
      getRoot: () => null,
    });
  });

  it("rejects remediation without approval", async () => {
    const result = await executeA11yTool("repair_focus_management", {});
    expect(result.ok).toBe(false);
  });

  it("rejects order placement with confirmation false", async () => {
    const result = await executeA11yTool("place_order", {
      sessionId: "x",
      confirmation: false,
    });
    expect(result.ok).toBe(false);
  });

  it("fails fill_checkout_form before begin_checkout", async () => {
    const result = await executeA11yTool("fill_checkout_form", {
      sessionId: "checkout-1",
      values: {
        email: "a@b.co",
        fullName: "Alex",
        address: "12 Lake Street",
        city: "Bengaluru",
        postalCode: "560001",
      },
    });
    expect(result.ok).toBe(true);
    expect((dataOf(result) as { success: boolean }).success).toBe(false);
  });

  it("rejects unknown products", async () => {
    const result = await executeA11yTool("add_product_to_cart", {
      productId: "nope",
      variantId: "9",
    });
    expect(result.ok).toBe(true);
    expect((dataOf(result) as { success: boolean }).success).toBe(false);
  });

  it("rejects unknown sizes", async () => {
    const result = await executeA11yTool("add_product_to_cart", {
      productId: "noma-runner",
      variantId: "99",
    });
    expect(result.ok).toBe(true);
    expect((dataOf(result) as { success: boolean }).success).toBe(false);
  });

  it("rejects malformed extra properties", async () => {
    const result = await executeA11yTool("search_products", {
      query: "runner",
      evil: "payload",
    });
    expect(result.ok).toBe(false);
  });
});