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

  it("unregisters via the AbortSignal passed to registerTool", () => {
    const mc = ensureModelContext()!;
    const controller = new AbortController();
    let changes = 0;
    mc.addEventListener?.("toolchange", () => {
      changes += 1;
    });

    mc.registerTool(
      {
        name: "signal_test",
        description: "test",
        inputSchema: { type: "object", additionalProperties: false },
        execute: () => ({ ok: true, data: null }),
      },
      { signal: controller.signal }
    );
    expect(
      (mc.getTools!() as Array<{ name: string }>).some((t) => t.name === "signal_test")
    ).toBe(true);

    controller.abort();
    expect(
      (mc.getTools!() as Array<{ name: string }>).some((t) => t.name === "signal_test")
    ).toBe(false);
    expect(changes).toBe(2);
  });

  it("accepts the native executeTool(descriptor, jsonString) call shape", async () => {
    const mc = ensureModelContext()!;
    mc.registerTool({
      name: "shape_test",
      description: "test",
      inputSchema: { type: "object", additionalProperties: false },
      execute: (input) => ({ ok: true, data: input }),
    });

    const descriptor = (mc.getTools!() as Array<{ name: string }>).find(
      (t) => t.name === "shape_test"
    );

    // native shape: tool descriptor + JSON string
    await expect(
      mc.executeTool!(descriptor, JSON.stringify({ hi: 1 }))
    ).resolves.toEqual({ ok: true, data: { hi: 1 } });

    // legacy shape: name + object
    await expect(mc.executeTool!("shape_test", { hi: 1 })).resolves.toEqual({
      ok: true,
      data: { hi: 1 },
    });

    mc.unregisterTool!("shape_test");
  });

  it("returns an MCP-shaped error for an unknown tool", async () => {
    const mc = ensureModelContext()!;
    const result = (await mc.executeTool!("does_not_exist", {})) as {
      content: Array<{ type: string; text: string }>;
      structuredContent: { ok: boolean };
      isError: boolean;
    };
    expect(result.isError).toBe(true);
    expect(result.content[0].type).toBe("text");
    expect(result.content[0].text).toContain("does_not_exist");
    expect(result.structuredContent.ok).toBe(false);
  });

  it("does not overwrite a native implementation", () => {
    const native = { registerTool: () => {}, __native: true };
    (document as unknown as { modelContext: unknown }).modelContext = native;
    expect(ensureModelContext()).toBe(native);
    expect(isNativeWebMCP()).toBe(true);
    delete (document as unknown as { modelContext?: unknown }).modelContext;
  });
});
