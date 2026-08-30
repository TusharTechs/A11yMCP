import { z } from "zod";

export type ToolResult =
  | { ok: true; data: unknown }
  | { ok: false; error: { message: string; issues?: unknown[] } };

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

function normalizeInput(input: unknown): unknown {
  return input === null || input === undefined ? {} : input;
}

function errorResult(message: string, issues?: unknown[]): ToolResult {
  return { ok: false, error: { message, issues } };
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

  if (
    typeof document !== "undefined" &&
    typeof document.modelContext?.registerTool === "function"
  ) {
    try {
      document.modelContext.registerTool({
        name: stored.name,
        title: stored.title,
        description: stored.description,
        inputSchema: stored.inputSchema,
        annotations: stored.annotations,
        execute: async (input: unknown, context?: WebMCPToolExecuteContext) =>
          executeA11yTool(stored.name, input, { signal: context?.signal }),
      });
    } catch (error) {
      console.error(
        `[A11yMCP] Failed to register WebMCP tool: ${stored.name}`,
        error
      );
    }
  }
}

export async function executeA11yTool(
  name: string,
  rawInput: unknown,
  options?: ToolExecutionContext
): Promise<ToolResult> {
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