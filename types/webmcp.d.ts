export {};

declare global {
  interface WebMCPToolAnnotations {
    readOnlyHint?: boolean;
    destructiveHint?: boolean;
    idempotentHint?: boolean;
    openWorldHint?: boolean;
    [key: string]: unknown;
  }

  interface WebMCPToolInputSchema {
    type: "object";
    properties?: Record<string, unknown>;
    required?: string[];
    additionalProperties?: boolean;
    [key: string]: unknown;
  }

  interface WebMCPToolExecuteContext {
    signal?: AbortSignal;
    [key: string]: unknown;
  }

  interface WebMCPToolDefinition {
    name: string;
    title?: string;
    description: string;
    inputSchema?: WebMCPToolInputSchema;
    annotations?: WebMCPToolAnnotations;
    execute: (
      input: unknown,
      context?: WebMCPToolExecuteContext
    ) => unknown | Promise<unknown>;
  }

  interface ModelContext {
    registerTool: (tool: WebMCPToolDefinition) => unknown;
    unregisterTool?: (tool: unknown) => void;
    getTools?: () => unknown;
    executeTool?: (name: string, input: unknown) => unknown;
    addEventListener?: (type: "toolchange", listener: () => void) => void;
    removeEventListener?: (type: "toolchange", listener: () => void) => void;
  }

  interface Document {
    modelContext?: ModelContext;
  }
}