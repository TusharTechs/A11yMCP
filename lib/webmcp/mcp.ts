/**
 * MCP tool-result envelope.
 *
 * WebMCP tools are MCP tools: `execute()` must resolve to an MCP tool
 * result — `{ content: [{ type: "text", text }] }` — optionally carrying
 * machine-readable `structuredContent` and an `isError` flag. That is what
 * the Chrome imperative API and the Web Machine Learning CG explainer both
 * show, and it is what a real agent (the ChatGPT in-app browser, Chrome's
 * built-in agent) knows how to render.
 *
 * A11yMCP's internal contract is a discriminated {@link ToolResult}
 * (`{ ok, data }` / `{ ok, error }`), which the UI, the guided agent and the
 * benchmark all depend on. Rather than pick one, every tool emits both:
 *
 *   - `content[0].text`   — a one-line natural-language summary, for the model
 *   - `structuredContent` — the exact `ToolResult`, for programmatic callers
 *   - `isError`           — true when the call failed
 *
 * {@link toMcpToolResponse} wraps on the way out, {@link fromMcpToolResponse}
 * unwraps on the way back in, so nothing downstream had to change.
 */

import type { ToolResult } from "./runtime";

export interface McpTextContent {
  type: "text";
  text: string;
}

export interface McpToolResponse {
  content: McpTextContent[];
  structuredContent?: unknown;
  isError?: boolean;
}

/** True for A11yMCP's internal `{ ok, data } | { ok, error }` result. */
export function isToolResult(value: unknown): value is ToolResult {
  return (
    value !== null &&
    typeof value === "object" &&
    typeof (value as { ok?: unknown }).ok === "boolean"
  );
}

/** True for an MCP tool result envelope. */
export function isMcpToolResponse(value: unknown): value is McpToolResponse {
  return (
    value !== null &&
    typeof value === "object" &&
    Array.isArray((value as { content?: unknown }).content)
  );
}

function plural(count: number, singular: string, pluralForm?: string): string {
  return `${count} ${count === 1 ? singular : pluralForm ?? `${singular}s`}`;
}

function summarizeFailure(
  name: string,
  error: { message: string; issues?: unknown[]; nextAction?: string }
): string {
  const parts = [`${name} failed: ${error.message}`];
  if (Array.isArray(error.issues) && error.issues.length > 0) {
    parts.push(`${plural(error.issues.length, "schema issue")}`);
  }
  if (error.nextAction) {
    parts.push(`next action: ${error.nextAction}`);
  }
  return `${parts.join(". ")}.`;
}

/**
 * A one-line, model-readable summary of a successful tool result.
 *
 * Deliberately field-driven rather than a JSON dump: an agent reading
 * `content[0].text` should learn the outcome without parsing anything, and
 * still have `structuredContent` when it needs the detail.
 */
function summarizeSuccess(name: string, data: unknown): string {
  if (data === null || data === undefined) return `${name} succeeded.`;
  if (typeof data !== "object") return `${name} succeeded: ${String(data)}.`;

  const record = data as Record<string, unknown>;
  const parts: string[] = [];

  const push = (value: unknown, render: (v: never) => string): void => {
    if (value === undefined || value === null) return;
    parts.push(render(value as never));
  };

  if (record.success === false) parts.push("no change applied");

  push(
    typeof record.taskAccessibility === "string" ? record.taskAccessibility : null,
    (v: string) => `task accessibility ${v}`
  );
  push(
    Array.isArray(record.capabilities) ? record.capabilities : null,
    (v: unknown[]) => plural(v.length, "declared capability", "declared capabilities")
  );
  push(
    Array.isArray(record.notCurrentlyDeclared) && record.notCurrentlyDeclared.length > 0
      ? record.notCurrentlyDeclared
      : null,
    (v: unknown[]) => `${plural(v.length, "need")} not declared`
  );
  push(
    Array.isArray(record.accepted) ? record.accepted : null,
    (v: unknown[]) => `${v.length} accepted`
  );
  push(
    Array.isArray(record.rejected) ? record.rejected : null,
    (v: unknown[]) => `${v.length} rejected`
  );
  push(
    Array.isArray(record.violations) ? record.violations : null,
    (v: unknown[]) => plural(v.length, "violation")
  );
  if (
    typeof record.beforeViolations === "number" &&
    typeof record.afterViolations === "number"
  ) {
    parts.push(
      `violations ${record.beforeViolations} -> ${record.afterViolations}`
    );
  }
  if (record.reversible === true) parts.push("reversible");
  push(
    typeof record.revertedSteps === "number" ? record.revertedSteps : null,
    (v: number) => `${plural(v, "change")} reverted`
  );
  push(
    Array.isArray(record.advisories) && record.advisories.length > 0
      ? record.advisories
      : null,
    (v: unknown[]) => plural(v.length, "advisory", "advisories")
  );
  push(
    Array.isArray(record.results) ? record.results : null,
    (v: unknown[]) => plural(v.length, "result")
  );
  push(
    Array.isArray(record.products) ? record.products : null,
    (v: unknown[]) => plural(v.length, "product")
  );
  if (
    record.order !== null &&
    typeof record.order === "object" &&
    typeof (record.order as { id?: unknown }).id === "string"
  ) {
    parts.push(`order ${(record.order as { id: string }).id}`);
  }
  push(
    typeof record.sessionId === "string" ? record.sessionId : null,
    (v: string) => `session ${v}`
  );
  push(
    typeof record.message === "string" ? record.message : null,
    (v: string) => v.replace(/\.$/, "")
  );

  if (parts.length === 0) {
    if (record.success === true) return `${name} succeeded.`;
    const keys = Object.keys(record).slice(0, 6);
    return keys.length > 0
      ? `${name} succeeded (${keys.join(", ")}).`
      : `${name} succeeded.`;
  }

  return `${name}: ${parts.join("; ")}.`;
}

/** Human-readable one-liner for either arm of a {@link ToolResult}. */
export function summarizeToolResult(name: string, result: ToolResult): string {
  return result.ok
    ? summarizeSuccess(name, result.data)
    : summarizeFailure(name, result.error);
}

/** Wraps an internal {@link ToolResult} as an MCP tool result. */
export function toMcpToolResponse(
  name: string,
  result: ToolResult
): McpToolResponse {
  return {
    content: [{ type: "text", text: summarizeToolResult(name, result) }],
    structuredContent: result,
    isError: !result.ok,
  };
}

/**
 * Unwraps an MCP tool result back into a {@link ToolResult}, or returns null
 * when the value is not an MCP envelope (so callers can fall through to the
 * legacy `{ ok, data }` shape a non-A11yMCP tool might return).
 */
export function fromMcpToolResponse(output: unknown): ToolResult | null {
  if (!isMcpToolResponse(output)) return null;

  const structured = output.structuredContent;
  if (isToolResult(structured)) return structured;

  const text = output.content
    .map((block) => (block && typeof block.text === "string" ? block.text : ""))
    .filter(Boolean)
    .join("\n");

  if (output.isError) {
    return { ok: false, error: { message: text || "Tool reported an error." } };
  }
  return { ok: true, data: structured !== undefined ? structured : text };
}

/**
 * Normalizes tool input. A native WebMCP implementation passes the arguments
 * as a JSON *string* (`executeTool(tool, jsonString)`); the polyfill and the
 * app pass an object. Tools should not have to care which.
 */
export function coerceToolInput(input: unknown): unknown {
  if (input === null || input === undefined) return {};
  if (typeof input === "string") {
    const trimmed = input.trim();
    if (trimmed === "") return {};
    try {
      return JSON.parse(trimmed);
    } catch {
      return input;
    }
  }
  return input;
}
