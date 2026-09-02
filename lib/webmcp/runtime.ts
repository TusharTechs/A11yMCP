import { z } from "zod";
import {
  coerceToolInput,
  fromMcpToolResponse,
  isToolResult,
  toMcpToolResponse,
} from "./mcp";
import { ensureModelContext, isNativeWebMCP } from "./polyfill";

export { isNativeWebMCP, isPolyfilledWebMCP, webmcpTransportLabel } from "./polyfill";
export type { McpToolResponse } from "./mcp";

export type ToolResult =
  | { ok: true; data: unknown }
  | {
      ok: false;
      error: { message: string; issues?: unknown[]; nextAction?: string };
    };

export interface ToolExecutionContext {
  signal?: AbortSignal;
}

export interface ToolDefinition<TInput> {
  name: string;
  title: string;
  description: string;
  inputSchema: WebMCPToolInputSchema;
  annotations?: WebMCPToolAnnotations;
  schema: z.ZodType<TInput>;
  run: (
    input: TInput,
    context?: ToolExecutionContext
  ) => Promise<unknown> | unknown;
}

interface StoredTool {
  name: string;
  title: string;
  description: string;
  inputSchema: WebMCPToolInputSchema;
  annotations?: WebMCPToolAnnotations;
  schema: z.ZodTypeAny;
  run: (
    input: unknown,
    context?: ToolExecutionContext
  ) => Promise<unknown> | unknown;
}

export interface BrowserToolInfo {
  name: string;
  description?: string;
  inputSchema?: unknown;
  annotations?: unknown;
  origin?: string;
}

const toolRegistry = new Map<string, StoredTool>();
const registrationHandles = new Map<string, { unregister: () => void }>();
/**
 * Per-tool AbortControllers. Aborting the signal passed to `registerTool` is
 * the spec's only defined way to unregister a tool, so this is the primary
 * teardown path — the handle and `unregisterTool` below are fallbacks for
 * implementations that predate it (including our own polyfill's handle).
 */
const registrationControllers = new Map<string, AbortController>();

function normalizeInput(input: unknown): unknown {
  return input === null || input === undefined ? {} : input;
}

function errorResult(
  message: string,
  issues?: unknown[],
  nextAction?: string
): ToolResult {
  return { ok: false, error: { message, issues, nextAction } };
}

export function registerA11yTool<TInput>(
  definition: ToolDefinition<TInput>
): void {
  const stored: StoredTool = {
    name: definition.name,
    title: definition.title,
    description: definition.description,
    inputSchema: definition.inputSchema,
    annotations: definition.annotations,
    schema: definition.schema,
    run: definition.run as StoredTool["run"],
  };

  toolRegistry.set(stored.name, stored);

  // Install the spec-compatible polyfill if the browser has no native
  // WebMCP, then register through whichever implementation is live.
  ensureModelContext();
  // Server rendering has no `document` at all, so this must not be touched
  // unguarded — reading it directly here threw a ReferenceError in every
  // non-DOM test file.
  const live =
    typeof document !== "undefined" ? document.modelContext : undefined;

  if (live && typeof live.registerTool === "function") {
    const controller =
      typeof AbortController !== "undefined" ? new AbortController() : null;

    try {
      // Written as `document.modelContext.registerTool(...)` deliberately:
      // that is the spec's own call, and `ensureModelContext()` above
      // guarantees the property is the live implementation — the browser's
      // own where one exists, the spec-compatible polyfill otherwise. The
      // re-check immediately below is what lets it be written that way
      // without an assertion.
      if (!document.modelContext) return;
      const registration = document.modelContext.registerTool(
        {
          name: stored.name,
          title: stored.title,
          description: stored.description,
          inputSchema: stored.inputSchema,
          annotations: stored.annotations,
          // WebMCP tools are MCP tools: resolve to a content-block result
          // carrying the machine-readable payload in structuredContent.
          execute: async (
            input: unknown,
            context?: WebMCPToolExecuteContext
          ) => {
            const result = await executeA11yTool(
              stored.name,
              coerceToolInput(input),
              { signal: context?.signal }
            );
            return toMcpToolResponse(stored.name, result);
          },
        },
        controller ? { signal: controller.signal } : undefined
      );

      if (controller) registrationControllers.set(stored.name, controller);

      // Native registerTool resolves a promise; the polyfill returns a handle.
      if (isThenable(registration)) {
        registration.catch((error: unknown) => {
          registrationControllers.delete(stored.name);
          console.error(
            `[A11yMCP] Failed to register WebMCP tool: ${stored.name}`,
            error
          );
        });
      } else if (
        registration &&
        typeof (registration as { unregister?: unknown }).unregister === "function"
      ) {
        registrationHandles.set(
          stored.name,
          registration as { unregister: () => void }
        );
      }
    } catch (error) {
      registrationControllers.delete(stored.name);
      console.error(
        `[A11yMCP] Failed to register WebMCP tool: ${stored.name}`,
        error
      );
    }
  }
}

function isThenable(value: unknown): value is Promise<unknown> {
  return (
    value !== null &&
    (typeof value === "object" || typeof value === "function") &&
    typeof (value as { then?: unknown }).then === "function"
  );
}

/**
 * Removes a tool from both the local registry and the live
 * `document.modelContext`, emitting a `toolchange` event. Used for
 * task-scoped tools (e.g. commerce tools that exist only while a
 * storefront is mounted) so agents never see tools whose UI is gone.
 */
export function unregisterA11yTool(name: string): void {
  toolRegistry.delete(name);

  let removed = false;

  // 1. The spec path: abort the signal handed to registerTool.
  const controller = registrationControllers.get(name);
  if (controller) {
    try {
      controller.abort();
      removed = true;
    } catch (error) {
      console.error(`[A11yMCP] Failed to abort registration: ${name}`, error);
    }
    registrationControllers.delete(name);
  }

  // 2. A returned registration handle, where the implementation offers one.
  const handle = registrationHandles.get(name);
  if (handle) {
    try {
      handle.unregister();
      removed = true;
    } catch (error) {
      console.error(`[A11yMCP] Failed to unregister WebMCP tool: ${name}`, error);
    }
    registrationHandles.delete(name);
  }

  if (removed) return;

  // 3. Last resort for implementations that expose a non-spec unregisterTool.
  const modelContext =
    typeof document !== "undefined" ? document.modelContext : undefined;
  if (modelContext && typeof modelContext.unregisterTool === "function") {
    try {
      modelContext.unregisterTool(name);
    } catch (error) {
      console.error(`[A11yMCP] Failed to unregister WebMCP tool: ${name}`, error);
    }
  }
}

/**
 * Single execution path for the whole app. Routes through the live
 * `document.modelContext.executeTool` (native or polyfill) so the demo,
 * inspector and benchmark all exercise the real WebMCP transport rather
 * than reaching into the registry. Falls back to the local validated
 * executor only when no `document.modelContext` exists (server render).
 */
export async function invokeTool(
  name: string,
  rawInput: unknown,
  options?: ToolExecutionContext
): Promise<ToolResult> {
  const modelContext =
    typeof document !== "undefined" ? document.modelContext : undefined;

  if (modelContext && typeof modelContext.executeTool === "function") {
    try {
      const output = await dispatchExecuteTool(
        modelContext,
        name,
        normalizeInput(rawInput),
        options?.signal
      );
      return unwrapToolOutput(output);
    } catch (error) {
      return errorResult(
        error instanceof Error ? error.message : `Execution failed for ${name}`
      );
    }
  }

  return executeA11yTool(name, rawInput, options);
}

/**
 * Turns whatever `executeTool` resolved to back into a {@link ToolResult}.
 *
 * Chrome's native implementation is
 * `executeTool(...) -> Promise<string?>` — it hands back the tool result
 * **JSON-serialized**, not as an object. Without parsing that first, every
 * native call would fall through to `{ ok: true, data: "<raw json>" }` and
 * the UI would receive a string where it expects data. A null resolution
 * means the call produced no result.
 */
function unwrapToolOutput(output: unknown): ToolResult {
  let value = output;

  if (typeof value === "string") {
    try {
      value = JSON.parse(value);
    } catch {
      return { ok: true, data: value };
    }
  }

  if (value === null || value === undefined) {
    return { ok: false, error: { message: "The tool returned no result." } };
  }

  const unwrapped = fromMcpToolResponse(value);
  if (unwrapped) return unwrapped;
  if (isToolResult(value)) return value;
  return { ok: true, data: value };
}

/** Finds the tool descriptor `getTools()` reports for a given tool name. */
async function findToolDescriptor(
  modelContext: ModelContext,
  name: string
): Promise<unknown | null> {
  if (typeof modelContext.getTools !== "function") return null;
  try {
    const tools = await modelContext.getTools();
    if (!Array.isArray(tools)) return null;
    return (
      tools.find(
        (tool) =>
          tool !== null &&
          typeof tool === "object" &&
          (tool as { name?: unknown }).name === name
      ) ?? null
    );
  } catch {
    return null;
  }
}

/**
 * A thrown TypeError (or a message complaining about the arguments) means the
 * implementation wanted a different call shape — not that the tool itself
 * failed. Only those are worth retrying with the other signature; anything
 * else propagates, so a genuinely failing mutation is never run twice.
 */
function isSignatureError(error: unknown): boolean {
  if (error instanceof TypeError) return true;
  const message = error instanceof Error ? error.message : String(error);
  return /argument|signature|overload|expects|cannot convert|is not of type/i.test(
    message
  );
}

/**
 * Calls `executeTool` using the signature the live implementation expects.
 *
 * Chrome's native WebMCP is documented as
 * `executeTool(toolDescriptor, jsonString, { signal })` — a descriptor from
 * `getTools()` and JSON-encoded arguments. The A11yMCP polyfill also accepts
 * `(name, object)`. Calling the native form first, and retrying the object
 * form only on an argument-shape error, means the same app code drives both.
 */
async function dispatchExecuteTool(
  modelContext: ModelContext,
  name: string,
  input: unknown,
  signal?: AbortSignal
): Promise<unknown> {
  const context = signal ? { signal } : undefined;
  const execute = modelContext.executeTool!;

  if (isNativeWebMCP()) {
    const descriptor = await findToolDescriptor(modelContext, name);
    try {
      return await execute.call(
        modelContext,
        descriptor ?? name,
        JSON.stringify(input ?? {}),
        context
      );
    } catch (error) {
      if (!isSignatureError(error)) throw error;
    }
  }

  return await execute.call(modelContext, name, input ?? {}, context);
}

export async function executeA11yTool(
  name: string,
  rawInput: unknown,
  options?: ToolExecutionContext
): Promise<ToolResult> {
  if (options?.signal?.aborted) {
    return errorResult("aborted");
  }

  const tool = toolRegistry.get(name);

  if (!tool) {
    return errorResult(`Tool not found: ${name}`);
  }

  const parsed = await tool.schema.safeParseAsync(normalizeInput(rawInput));

  if (!parsed.success) {
    return errorResult(`Invalid input for ${name}`, parsed.error.issues);
  }

  try {
    const data = await tool.run(parsed.data, { signal: options?.signal });
    return { ok: true, data };
  } catch (error) {
    return errorResult(
      error instanceof Error ? error.message : `Execution failed for ${name}`
    );
  }
}

export function getLocalTools(): Array<
  Pick<
    StoredTool,
    "name" | "title" | "description" | "annotations" | "inputSchema"
  >
> {
  return Array.from(toolRegistry.values()).map(
    ({ name, title, description, annotations, inputSchema }) => ({
      name,
      title,
      description,
      annotations,
      inputSchema,
    })
  );
}

export function isWebMCPSupported(): boolean {
  return (
    typeof document !== "undefined" &&
    typeof document.modelContext?.registerTool === "function"
  );
}

/**
 * Browser-visible tools via the real WebMCP runtime.
 * Returns null when WebMCP is unavailable; never conflated with the
 * local registry.
 */
export async function getBrowserTools(): Promise<BrowserToolInfo[] | null> {
  if (typeof document === "undefined") return null;
  const mc = document.modelContext;
  if (!mc || typeof mc.getTools !== "function") return null;

  try {
    const raw = await mc.getTools();
    if (!Array.isArray(raw)) return null;
    return (raw as Array<Record<string, unknown>>).map((tool) => ({
      name: String(tool.name ?? "unknown"),
      description:
        typeof tool.description === "string" ? tool.description : undefined,
      inputSchema: tool.inputSchema,
      annotations: tool.annotations,
      origin: typeof tool.origin === "string" ? tool.origin : undefined,
    }));
  } catch {
    return null;
  }
}

/** Executes through the browser's WebMCP executeTool when available. */
export async function executeBrowserTool(
  name: string,
  input: unknown
): Promise<unknown | null> {
  if (typeof document === "undefined") return null;
  const mc = document.modelContext;
  if (!mc || typeof mc.executeTool !== "function") return null;

  try {
    return await dispatchExecuteTool(mc, name, normalizeInput(input));
  } catch (error) {
    return {
      browserError: error instanceof Error ? error.message : String(error),
    };
  }
}

export function subscribeToolChange(listener: () => void): () => void {
  if (typeof document === "undefined") return () => {};
  const mc = document.modelContext;
  if (!mc || typeof mc.addEventListener !== "function") return () => {};

  mc.addEventListener("toolchange", listener);
  return () => {
    mc.removeEventListener?.("toolchange", listener);
  };
}