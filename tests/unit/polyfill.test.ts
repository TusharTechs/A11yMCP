// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import {
  ensureModelContext,
  isNativeWebMCP,
  isPolyfilledWebMCP,
} from "@/lib/webmcp/polyfill";

describe("document.modelContext polyfill", () => {
  it("installs a spec-shaped modelContext when none exists", () => {
    const mc = ensureModelContext();
    expect(mc).toBeTruthy();
    expect(typeof mc?.registerTool).toBe("function");
    expect(typeof mc?.unregisterTool).toBe("function");
    expect(typeof mc?.getTools).toBe("function");
    expect(typeof mc?.executeTool).toBe("function");
    expect(isPolyfilledWebMCP()).toBe(true);
    expect(isNativeWebMCP()).toBe(false);
  });

  it("register → getTools → executeTool → unregister, with toolchange events", async () => {
    const mc = ensureModelContext()!;
    let changes = 0;
    mc.addEventListener?.("toolchange", () => {
      changes += 1;
    });

    const before = (mc.getTools!() as unknown[]).length;
    const handle = mc.registerTool({
      name: "echo_test",
      description: "test",
      inputSchema: { type: "object", additionalProperties: false },
      execute: (input) => ({ ok: true, data: input }),
    }) as { unregister: () => void };

    expect((mc.getTools!() as Array<{ name: string }>).some((t) => t.name === "echo_test")).toBe(true);
    const result = await mc.executeTool!("echo_test", { hi: 1 });
    expect(result).toEqual({ ok: true, data: { hi: 1 } });

    handle.unregister();
    expect((mc.getTools!() as unknown[]).length).toBe(before);
    expect(changes).toBeGreaterThanOrEqual(2);
  });

  it("does not overwrite a native implementation", () => {
    const native = { registerTool: () => {}, __native: true };
    (document as unknown as { modelContext: unknown }).modelContext = native;
    expect(ensureModelContext()).toBe(native);
    expect(isNativeWebMCP()).toBe(true);
    delete (document as unknown as { modelContext?: unknown }).modelContext;
  });
});
