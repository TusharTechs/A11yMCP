/**
 * Cross-origin tool access.
 *
 * WebMCP's cross-origin story has three moving parts, and they only mean
 * something together:
 *
 *   1. The embedding page must grant the frame the `tools` Permissions
 *      Policy — `<iframe allow="tools">`. Without it the frame may not
 *      expose tools at all.
 *   2. The framed document opts each tool in to a named foreign origin with
 *      `registerTool(def, { exposedTo: ["https://embedder.example"] })`.
 *      **Default-deny**: a tool with no `exposedTo` is same-origin only.
 *   3. The embedder asks for them with `getTools({ fromOrigins: [...] })`.
 *
 * A native implementation does this inside the browser. This module is the
 * polyfill's equivalent: a `postMessage` bridge where the framed document is
 * the authority on who may see and run its tools. The embedder cannot reach
 * past it — there is no shared registry, only messages the host chooses to
 * answer.
 *
 * The interesting property is that the *frame* decides. An embedder that
 * lists an origin in `fromOrigins` is stating an interest, not an
 * entitlement.
 */

import { fromMcpToolResponse, isToolResult } from "./mcp";
import { isToolExposedTo } from "./polyfill";
import type { ToolResult } from "./runtime";

const CHANNEL = "a11ymcp/federation@1";

type HostRequest =
  | { channel: typeof CHANNEL; id: string; op: "getTools" }
  | {
      channel: typeof CHANNEL;
      id: string;
      op: "executeTool";
      name: string;
      input: unknown;
    };

interface HostResponse {
  channel: typeof CHANNEL;
  id: string;
  ok: boolean;
  tools?: FederatedTool[];
  result?: ToolResult;
  error?: string;
}

export interface FederatedTool {
  name: string;
  title?: string;
  description?: string;
  inputSchema?: unknown;
  annotations?: unknown;
  /** The origin that registered the tool, as the embedder sees it. */
  origin: string;
}

/** The body of a request, without the envelope fields `send` adds. */
type RequestPayload =
  | { op: "getTools" }
  | { op: "executeTool"; name: string; input: unknown };

function isHostRequest(value: unknown): value is HostRequest {
  return (
    value !== null &&
    typeof value === "object" &&
    (value as { channel?: unknown }).channel === CHANNEL &&
    typeof (value as { id?: unknown }).id === "string"
  );
}

/* ------------------------------------------------------------------ */
/* Framed document: the authority                                      */
/* ------------------------------------------------------------------ */

export interface ToolFrameHostOptions {
  /** Origins permitted to ask at all. Anything else is ignored silently. */
  allowedOrigins: string[];
  /** Called for every decision, so the demo can show the audit trail. */
  onEvent?: (event: {
    kind: "denied-origin" | "listed" | "denied-tool" | "executed";
    origin: string;
    detail: string;
  }) => void;
}

/**
 * Installs the message handler in the framed document. Returns a teardown.
 *
 * Two independent gates, in order: is this origin allowed to ask, and is
 * this specific tool exposed to it? Failing the second is reported as a
 * refusal rather than an empty result, because "you may not" and "there is
 * nothing" are different answers and an agent deserves to know which.
 */
export function installToolFrameHost(
  options: ToolFrameHostOptions
): () => void {
  const allowed = new Set(options.allowedOrigins);

  const onMessage = async (event: MessageEvent): Promise<void> => {
    if (!isHostRequest(event.data)) return;

    const origin = event.origin;
    const reply = (response: Omit<HostResponse, "channel">): void => {
      (event.source as Window | null)?.postMessage(
        { channel: CHANNEL, ...response },
        // Reply only to the origin that asked. An opaque origin ("null",
        // e.g. a sandboxed frame) cannot be targeted, so it is refused.
        origin === "null" ? "*" : origin
      );
    };

    if (!allowed.has(origin)) {
      options.onEvent?.({
        kind: "denied-origin",
        origin,
        detail: `${origin} is not in this document's allowed origins.`,
      });
      reply({
        id: event.data.id,
        ok: false,
        error: `Origin ${origin} may not access this document's tools.`,
      });
      return;
    }

    const modelContext = document.modelContext;
    if (!modelContext) {
      reply({ id: event.data.id, ok: false, error: "No modelContext." });
      return;
    }

    if (event.data.op === "getTools") {
      const all = ((await modelContext.getTools?.()) ?? []) as Array<
        Record<string, unknown>
      >;
      const visible = all
        .filter((tool) => isToolExposedTo(String(tool.name), origin))
        .map((tool) => ({
          name: String(tool.name),
          title: tool.title as string | undefined,
          description: tool.description as string | undefined,
          inputSchema: tool.inputSchema,
          annotations: tool.annotations,
          origin: location.origin,
        }));

      options.onEvent?.({
        kind: "listed",
        origin,
        detail: `${origin} may see ${visible.length} of ${all.length} tools.`,
      });
      reply({ id: event.data.id, ok: true, tools: visible });
      return;
    }

    const { name, input } = event.data;
    if (!isToolExposedTo(name, origin)) {
      options.onEvent?.({
        kind: "denied-tool",
        origin,
        detail: `${origin} asked for "${name}", which is not exposed to it.`,
      });
      reply({
        id: event.data.id,
        ok: false,
        error: `Tool "${name}" is not exposed to ${origin}.`,
      });
      return;
    }

    const raw = await modelContext.executeTool?.(name, input);
    const result = fromMcpToolResponse(raw) ??
      (isToolResult(raw) ? raw : { ok: true as const, data: raw });

    options.onEvent?.({
      kind: "executed",
      origin,
      detail: `${origin} executed "${name}".`,
    });
    reply({ id: event.data.id, ok: true, result });
  };

  const listener = (event: MessageEvent): void => {
    void onMessage(event);
  };
  window.addEventListener("message", listener);
  return () => window.removeEventListener("message", listener);
}

/* ------------------------------------------------------------------ */
/* Embedder: the requester                                             */
/* ------------------------------------------------------------------ */

export class ToolFrameUnavailable extends Error {}

let requestCounter = 0;

/**
 * A handle onto the tools a framed document is willing to share.
 *
 * Refuses to talk to a frame the embedder did not grant `allow="tools"` —
 * the browser enforces the Permissions Policy natively, and the polyfill
 * should not be a way around it.
 */
export class ToolFrameClient {
  constructor(
    private frame: HTMLIFrameElement,
    private frameOrigin: string,
    private timeoutMs = 5_000
  ) {
    const allow = frame.getAttribute("allow") ?? "";
    if (!/\btools\b/.test(allow)) {
      throw new ToolFrameUnavailable(
        'The frame was not granted the "tools" Permissions Policy. Add allow="tools" to the iframe.'
      );
    }
  }

  private send<T extends HostResponse>(payload: RequestPayload): Promise<T> {
    const target = this.frame.contentWindow;
    if (!target) {
      return Promise.reject(new ToolFrameUnavailable("The frame has no window."));
    }

    requestCounter += 1;
    const id = `fed-${requestCounter}`;

    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        window.removeEventListener("message", onReply);
        reject(new ToolFrameUnavailable("The frame did not answer in time."));
      }, this.timeoutMs);

      const onReply = (event: MessageEvent): void => {
        const data = event.data as HostResponse | undefined;
        if (!data || data.channel !== CHANNEL || data.id !== id) return;
        clearTimeout(timer);
        window.removeEventListener("message", onReply);
        resolve(data as T);
      };

      window.addEventListener("message", onReply);
      target.postMessage(
        { channel: CHANNEL, id, ...payload },
        this.frameOrigin
      );
    });
  }

  /** The tools this frame is willing to show this origin. */
  async getTools(): Promise<FederatedTool[]> {
    const response = await this.send({ op: "getTools" });
    if (!response.ok) throw new ToolFrameUnavailable(response.error ?? "Refused.");
    return response.tools ?? [];
  }

  /** Executes a tool inside the frame, in the frame's own document. */
  async executeTool(name: string, input: unknown): Promise<ToolResult> {
    const response = await this.send({ op: "executeTool", name, input });
    if (!response.ok) {
      return { ok: false, error: { message: response.error ?? "Refused." } };
    }
    return response.result ?? { ok: true, data: null };
  }
}

/**
 * Connects to a framed document's tools.
 *
 * `frameOrigin` is where messages are *sent*; use `"*"` only for a sandboxed
 * frame with an opaque origin, where no specific target exists.
 */
export function connectToolFrame(
  frame: HTMLIFrameElement,
  frameOrigin: string
): ToolFrameClient {
  return new ToolFrameClient(frame, frameOrigin);
}
