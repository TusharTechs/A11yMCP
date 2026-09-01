// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import { z } from "zod";
import {
  invokeTool,
  isNativeWebMCP,
  registerA11yTool,
  unregisterA11yTool,
} from "@/lib/webmcp/runtime";

/**
 * Conformance against a *native* WebMCP implementation.
 *
 * The A11yMCP polyfill is deliberately forgiving, which makes it a poor
 * oracle: code can pass against it and still break in the one browser that
 * matters — Chrome with WebMCP enabled, or the ChatGPT in-app browser.
 *
 * So this suite builds a strict stand-in that implements *only* the surface
 * the spec and the Chrome imperative-API docs define, and nothing more:
 *
 *   - `registerTool(definition, { signal })` returns a **promise**, not a
 *     handle, and the only way to unregister is to abort that signal.
 *   - **No `unregisterTool`.** It is not in the spec.
 *   - `executeTool(toolDescriptor, jsonString, { signal })` accepts a
 *     descriptor from `getTools()` and JSON-encoded arguments, and throws a
 *     TypeError for anything else.
 *   - `getTools()` is async.
 *
 * If the app's register / execute / unregister paths work here, they work
 * against a real implementation.
 */

interface NativeToolDefinition {
  name: string;
  title?: string;
  description: string;
  inputSchema?: unknown;
  annotations?: unknown;
  execute: (input: unknown, context?: { signal?: AbortSignal }) => unknown;
}

interface StrictNativeModelContext extends ModelContext {
  toolChangeCount: () => number;
}

function createStrictNativeModelContext(): StrictNativeModelContext {
  const tools = new Map<string, NativeToolDefinition>();
  const listeners = new Set<() => void>();
  let changes = 0;

  const emit = (): void => {
    changes += 1;
    listeners.forEach((listener) => listener());
  };

  const describe = (tool: NativeToolDefinition) => ({
    name: tool.name,
    title: tool.title,
    description: tool.description,
    inputSchema: tool.inputSchema,
    annotations: tool.annotations,
    origin: "https://native.test",
  });

  return {
    // Spec shape: resolves a promise; teardown is via options.signal only.
    registerTool(
      tool: WebMCPToolDefinition,
      options?: WebMCPRegisterToolOptions
    ): Promise<void> {
      const stored = tool as unknown as NativeToolDefinition;
      tools.set(stored.name, stored);
      emit();

      const signal = options?.signal;
      if (signal) {
        signal.addEventListener(
          "abort",
          () => {
            if (tools.get(stored.name) === stored) {
              tools.delete(stored.name);
              emit();
            }
          },
          { once: true }
        );
      }
      return Promise.resolve();
    },

    // Intentionally absent: unregisterTool.

    async getTools() {
      return Array.from(tools.values())
        .map(describe)
        .sort((a, b) => a.name.localeCompare(b.name));
    },

    async executeTool(
      target: unknown,
      input?: unknown,
      context?: WebMCPToolExecuteContext
    ) {
      if (target === null || typeof target !== "object") {
        throw new TypeError(
          "executeTool: first argument must be a tool from getTools()."
        );
      }
      if (typeof input !== "string") {
        throw new TypeError("executeTool: arguments must be a JSON string.");
      }
      const name = String((target as { name?: unknown }).name ?? "");
      const tool = tools.get(name);
      if (!tool) throw new Error(`Unknown tool: ${name}`);
      return tool.execute(input, context);
    },

    addEventListener(type, listener) {
      if (type === "toolchange") listeners.add(listener);
    },
    removeEventListener(type, listener) {
      if (type === "toolchange") listeners.delete(listener);
    },

    toolChangeCount: () => changes,
  };
}

async function toolNames(mc: ModelContext): Promise<string[]> {
  const tools = (await mc.getTools!()) as Array<{ name: string }>;
  return tools.map((tool) => tool.name);
}

describe("conformance against a strict native document.modelContext", () => {
  let native: StrictNativeModelContext;

  beforeEach(() => {
    native = createStrictNativeModelContext();
    (document as unknown as { modelContext: ModelContext }).modelContext =
      native;
  });

  it("is detected as native, so the polyfill stands down", () => {
    expect(isNativeWebMCP()).toBe(true);
  });

  it("registers through the native registerTool and is discoverable", async () => {
    registerA11yTool({
      name: "native_echo",
      title: "Native echo",
      description: "Echoes its input.",
      inputSchema: {
        type: "object",
        properties: { value: { type: "string" } },
        required: ["value"],
        additionalProperties: false,
      },
      schema: z.object({ value: z.string() }).strict(),
      run: (input) => ({ echoed: input.value }),
    });

    expect(await toolNames(native)).toContain("native_echo");
  });

  it("executes via executeTool(descriptor, jsonString) and returns an MCP result", async () => {
    registerA11yTool({
      name: "native_summary",
      title: "Native summary",
      description: "Returns a verifiable payload.",
      inputSchema: {
        type: "object",
        properties: { value: { type: "string" } },
        required: ["value"],
        additionalProperties: false,
      },
      schema: z.object({ value: z.string() }).strict(),
      run: (input) => ({ success: true, message: `Saw ${input.value}.` }),
    });

    // The raw wire result the agent sees must be an MCP tool result.
    const descriptor = ((await native.getTools!()) as Array<{ name: string }>).find(
      (tool) => tool.name === "native_summary"
    );
    const raw = (await native.executeTool!(
      descriptor,
      JSON.stringify({ value: "hello" })
    )) as {
      content: Array<{ type: string; text: string }>;
      structuredContent: { ok: boolean; data: unknown };
      isError: boolean;
    };

    expect(Array.isArray(raw.content)).toBe(true);
    expect(raw.content[0].type).toBe("text");
    expect(raw.content[0].text).toContain("Saw hello");
    expect(raw.isError).toBe(false);
    expect(raw.structuredContent).toEqual({
      ok: true,
      data: { success: true, message: "Saw hello." },
    });

    // And the app's own dispatch path unwraps it back to a ToolResult.
    const result = await invokeTool("native_summary", { value: "hello" });
    expect(result).toEqual({
      ok: true,
      data: { success: true, message: "Saw hello." },
    });
  });

  it("surfaces schema rejections as isError with a recovery hint", async () => {
    registerA11yTool({
      name: "native_strict",
      title: "Native strict",
      description: "Rejects unknown properties.",
      inputSchema: {
        type: "object",
        properties: { query: { type: "string" } },
        required: ["query"],
        additionalProperties: false,
      },
      schema: z.object({ query: z.string() }).strict(),
      run: () => ({ success: true }),
    });

    const descriptor = ((await native.getTools!()) as Array<{ name: string }>).find(
      (tool) => tool.name === "native_strict"
    );
    const raw = (await native.executeTool!(
      descriptor,
      JSON.stringify({ query: "x", evil: "payload" })
    )) as { isError: boolean; structuredContent: { ok: boolean } };

    expect(raw.isError).toBe(true);
    expect(raw.structuredContent.ok).toBe(false);

    const result = await invokeTool("native_strict", {
      query: "x",
      evil: "payload",
    });
    expect(result.ok).toBe(false);
  });

  it("unregisters by aborting the registration signal, with no unregisterTool", async () => {
    // The whole point: the strict native context has no unregisterTool, so
    // the task-scoped lifecycle has to work through the AbortSignal alone.
    expect(native.unregisterTool).toBeUndefined();

    registerA11yTool({
      name: "native_task_scoped",
      title: "Native task scoped",
      description: "Exists only while its UI is mounted.",
      inputSchema: { type: "object", additionalProperties: false },
      schema: z.object({}).strict(),
      run: () => ({ success: true }),
    });
    expect(await toolNames(native)).toContain("native_task_scoped");

    let toolChanges = 0;
    native.addEventListener!("toolchange", () => {
      toolChanges += 1;
    });

    unregisterA11yTool("native_task_scoped");

    expect(await toolNames(native)).not.toContain("native_task_scoped");
    expect(toolChanges).toBe(1);
  });

  it("accepts a JSON string as tool input, not just an object", async () => {
    registerA11yTool({
      name: "native_json_input",
      title: "Native JSON input",
      description: "Parses JSON-encoded arguments.",
      inputSchema: {
        type: "object",
        properties: { value: { type: "string" } },
        required: ["value"],
        additionalProperties: false,
      },
      schema: z.object({ value: z.string() }).strict(),
      run: (input) => ({ received: input.value }),
    });

    const descriptor = ((await native.getTools!()) as Array<{ name: string }>).find(
      (tool) => tool.name === "native_json_input"
    );
    const raw = (await native.executeTool!(
      descriptor,
      '{"value":"from-json-string"}'
    )) as { structuredContent: { ok: boolean; data: unknown } };

    expect(raw.structuredContent).toEqual({
      ok: true,
      data: { received: "from-json-string" },
    });
  });

  it("propagates AbortSignal cancellation through the native context", async () => {
    registerA11yTool({
      name: "native_abortable",
      title: "Native abortable",
      description: "Honors cancellation.",
      inputSchema: { type: "object", additionalProperties: false },
      schema: z.object({}).strict(),
      run: () => ({ success: true }),
    });

    const controller = new AbortController();
    controller.abort();
    const result = await invokeTool("native_abortable", {}, {
      signal: controller.signal,
    });

    expect(result.ok).toBe(false);
  });
});
