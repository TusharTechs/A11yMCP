import { describe, expect, it } from "vitest";
import {
  coerceToolInput,
  fromMcpToolResponse,
  isMcpToolResponse,
  summarizeToolResult,
  toMcpToolResponse,
} from "@/lib/webmcp/mcp";

describe("MCP tool-result envelope", () => {
  it("wraps a success as content + structuredContent, isError false", () => {
    const response = toMcpToolResponse("verify_accessibility_profile", {
      ok: true,
      data: { taskAccessibility: "PASS", advisories: [{ rule: "x" }] },
    });

    expect(isMcpToolResponse(response)).toBe(true);
    expect(response.content).toHaveLength(1);
    expect(response.content[0].type).toBe("text");
    expect(response.isError).toBe(false);
    expect(response.structuredContent).toEqual({
      ok: true,
      data: { taskAccessibility: "PASS", advisories: [{ rule: "x" }] },
    });
  });

  it("wraps a failure with isError and keeps the recovery hint readable", () => {
    const response = toMcpToolResponse("repair_keyboard_navigation", {
      ok: false,
      error: {
        message: "Remediation requires explicit user approval.",
        nextAction: "ask the user to approve, then retry",
      },
    });

    expect(response.isError).toBe(true);
    expect(response.content[0].text).toContain(
      "repair_keyboard_navigation failed"
    );
    expect(response.content[0].text).toContain(
      "next action: ask the user to approve, then retry"
    );
  });

  it("round-trips through fromMcpToolResponse", () => {
    const original = { ok: true as const, data: { success: true } };
    const restored = fromMcpToolResponse(
      toMcpToolResponse("rollback_all_remediations", original)
    );
    expect(restored).toEqual(original);
  });

  it("returns null for a value that is not an MCP envelope", () => {
    expect(fromMcpToolResponse({ ok: true, data: 1 })).toBeNull();
    expect(fromMcpToolResponse(null)).toBeNull();
    expect(fromMcpToolResponse("text")).toBeNull();
  });

  it("reconstructs a result from content blocks when structuredContent is absent", () => {
    expect(
      fromMcpToolResponse({
        content: [{ type: "text", text: "Order placed." }],
      })
    ).toEqual({ ok: true, data: "Order placed." });

    expect(
      fromMcpToolResponse({
        content: [{ type: "text", text: "Nope." }],
        isError: true,
      })
    ).toEqual({ ok: false, error: { message: "Nope." } });
  });

  describe("summaries an agent can read without parsing", () => {
    const cases: Array<[string, unknown, string]> = [
      [
        "negotiate_accessibility_profile",
        { accepted: [1, 2], rejected: [3] },
        "2 accepted; 1 rejected",
      ],
      [
        "audit_keyboard_navigation",
        { violations: [1] },
        "1 violation",
      ],
      [
        "repair_focus_management",
        { beforeViolations: 3, afterViolations: 0, reversible: true },
        "violations 3 -> 0; reversible",
      ],
      [
        "repair_reduced_motion",
        { success: false, beforeViolations: 1, afterViolations: 1 },
        "no change applied",
      ],
      [
        "verify_accessibility_profile",
        { taskAccessibility: "BLOCKED", advisories: [1, 2] },
        "task accessibility BLOCKED; 2 advisories",
      ],
      [
        "place_order",
        { success: true, order: { id: "NOMA-1042" }, message: "Order placed." },
        "order NOMA-1042; Order placed",
      ],
    ];

    it.each(cases)("summarizes %s", (name, data, expected) => {
      expect(summarizeToolResult(name, { ok: true, data })).toContain(expected);
    });

    it("falls back to the key list for an unrecognized payload", () => {
      const text = summarizeToolResult("inspect_accessibility_tree", {
        ok: true,
        data: { role: "main", children: {} },
      });
      expect(text).toContain("inspect_accessibility_tree succeeded");
      expect(text).toContain("role");
    });
  });

  describe("input coercion", () => {
    it("parses the JSON string a native implementation passes", () => {
      expect(coerceToolInput('{"needs":["keyboard_only"]}')).toEqual({
        needs: ["keyboard_only"],
      });
    });

    it("treats null, undefined and empty strings as no arguments", () => {
      expect(coerceToolInput(null)).toEqual({});
      expect(coerceToolInput(undefined)).toEqual({});
      expect(coerceToolInput("  ")).toEqual({});
    });

    it("passes objects through and leaves unparseable strings intact", () => {
      const input = { query: "runner" };
      expect(coerceToolInput(input)).toBe(input);
      expect(coerceToolInput("not json")).toBe("not json");
    });
  });
});
