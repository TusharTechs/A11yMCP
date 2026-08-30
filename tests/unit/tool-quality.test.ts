import { describe, expect, it } from "vitest";
import { getLocalTools } from "@/lib/webmcp/runtime";
import {
  registerWebMCPToolsOnce,
  setAgentCallbacks,
} from "@/lib/webmcp/tools";

setAgentCallbacks({ logEvent: () => {}, getRoot: () => null });
registerWebMCPToolsOnce();

const tools = getLocalTools();

describe("tool quality scorecard", () => {
  it("registers the full 20-tool surface", () => {
    expect(tools.length).toBe(20);
  });

  for (const tool of tools) {
    it(`${tool.name}: agent-first description`, () => {
      expect(tool.description.length).toBeGreaterThan(120);
      expect(tool.description).toMatch(/Call|Precondition/);
      expect(tool.description).toMatch(
        /Read-only|approval|confirmation|reversible|Idempotent/
      );
    });

    it(`${tool.name}: bounded schema`, () => {
      expect(tool.inputSchema.additionalProperties).toBe(false);
    });

    it(`${tool.name}: annotations present`, () => {
      expect(tool.annotations).toBeDefined();
      expect(typeof tool.annotations?.readOnlyHint).toBe("boolean");
    });
  }
});