import { z } from "zod";
import { ensureModelContext } from "./polyfill";

export { isNativeWebMCP, isPolyfilledWebMCP, webmcpTransportLabel } from "./polyfill";

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
  const modelContext = ensureModelContext();
  if (modelContext && typeof modelContext.registerTool === "function") {
    try {
      const handle = modelContext.registerTool({
        name: stored.name,
        title: stored.title,
        description: stored.description,
        inputSchema: stored.inputSchema,
        annotations: stored.annotations,
        execute: async (input: unknown, context?: WebMCPToolExecuteContext) =>
          executeA11yTool(stored.name, input, { signal: context?.signal }),
      });
      if (handle && typeof (handle as { unregister?: unknown }).unregister === "function") {
        registrationHandles.set(stored.name, handle as { unregister: () => void });
      }
    } catch (error) {
      console.error(
        `[A11yMCP] Failed to register WebMCP tool: ${stored.name}`,
        error
      );
    }
  }
}

/**
 * Removes a tool from both the local registry and the live
 * `document.modelContext`, emitting a `toolchange` event. Used for
 * task-scoped tools (e.g. commerce tools that exist only while a
 * storefront is mounted) so agents never see tools whose UI is gone.
 */
export function unregisterA11yTool(name: string): void {
  toolRegistry.delete(name);

  const handle = registrationHandles.get(name);
  if (handle) {
    handle.unregister();
    registrationHandles.delete(name);
    return;
  }

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
      const output = await modelContext.executeTool(
        name,
        normalizeInput(rawInput),
        { signal: options?.signal }
      );
      if (
        output &&
        typeof output === "object" &&
        "ok" in (output as Record<string, unknown>)
      ) {
        return output as ToolResult;
      }
      return { ok: true, data: output };
    } catch (error) {
      return errorResult(
        error instanceof Error ? error.message : `Execution failed for ${name}`
      );
    }
  }

  return executeA11yTool(name, rawInput, options);
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
    return await mc.executeTool(name, input);
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