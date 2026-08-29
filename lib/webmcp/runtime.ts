import { z } from "zod";

export type ToolResult =
  | { ok: true; data: unknown }
  | { ok: false; error: { message: string; issues?: unknown[] } };

export interface ToolDefinition<TInput> {
  name: string;
  title: string;
  description: string;
  inputSchema: WebMCPToolInputSchema;
  annotations?: WebMCPToolAnnotations;
  schema: z.ZodType<TInput>;
  run: (input: TInput) => Promise<unknown> | unknown;
}

interface StoredTool {
  name: string;
  title: string;
  description: string;
  inputSchema: WebMCPToolInputSchema;
  annotations?: WebMCPToolAnnotations;
  schema: z.ZodTypeAny;
  run: (input: unknown) => Promise<unknown> | unknown;
}

const toolRegistry = new Map<string, StoredTool>();

function normalizeInput(input: unknown): unknown {
  return input === null || input === undefined ? {} : input;
}

function errorResult(message: string, issues?: unknown[]): ToolResult {
  return {
    ok: false,
    error: {
      message,
      issues,
    },
  };
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
    run: definition.run as (input: unknown) => Promise<unknown> | unknown,
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
        execute: async (input: unknown) => executeA11yTool(stored.name, input),
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
  rawInput: unknown
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
    const data = await tool.run(parsed.data);
    return {
      ok: true,
      data,
    };
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