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

  interface WebMCPToolRegistration {
    unregister: () => void;
  }

  /**
   * Second argument to `registerTool`. Per the spec, aborting `signal` is
   * how a registration is torn down; `exposedTo` limits which origins may
   * see the tool.
   */
  interface WebMCPRegisterToolOptions {
    signal?: AbortSignal;
    exposedTo?: string[];
    [key: string]: unknown;
  }

  interface ModelContext {
    registerTool: (
      tool: WebMCPToolDefinition,
      options?: WebMCPRegisterToolOptions
    ) => WebMCPToolRegistration | Promise<unknown> | void | unknown;
    /** Not part of the spec surface; present on the A11yMCP polyfill. */
    unregisterTool?: (tool: unknown) => void;
    getTools?: (options?: { fromOrigins?: string[] }) => unknown;
    /**
     * Native WebMCP takes a tool descriptor from `getTools()` and a JSON
     * string; the polyfill also accepts a tool name and a plain object.
     */
    executeTool?: (
      target: unknown,
      input?: unknown,
      context?: WebMCPToolExecuteContext
    ) => unknown;
    addEventListener?: (type: "toolchange", listener: () => void) => void;
    removeEventListener?: (type: "toolchange", listener: () => void) => void;
  }

  interface Document {
    modelContext?: ModelContext;
  }
}